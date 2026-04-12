import * as vite from 'vite';
import ccBuild from '@cocos/ccbuild';
import { normalize, resolve } from 'node:path';
import assert from 'node:assert';
import fs from 'fs-extra';
import { join } from 'node:path';
import Ejs from 'ejs';
import * as ts from 'typescript';
import { staticDir } from '../dirs.ts';
import { moduleId_ccEnv, moduleId_configureDynamicConstants, moduleId_internalConstants } from '../shared.ts';

const moduleId_dynamicConstantsStore = '\0cc-dynamic-constants-config';

export default function vitePluginDynamicOverrideModules({
  statsQuery,
}: {
  statsQuery: ccBuild.StatsQuery;
}): vite.Plugin {
  const overrideMap: Record<string, {
    isVirtual: boolean;
    variants: Array<{
      condition: string;
      override: string;
    }>;
  }> = {};
  // @ts-expect-error
  const config = statsQuery._config as ccBuild.ConfigInterface.Config;
  if (config.moduleOverrides) {
    for (const moduleOverrideEntry of config.moduleOverrides) {
      for (const [k, v] of Object.entries(moduleOverrideEntry.overrides)) {
        const mId = moduleOverrideEntry.isVirtualModule ? k : resolve(statsQuery.path, k);
        let overrideInfo = overrideMap[mId];
        if (!overrideInfo) {
          overrideInfo = {
            isVirtual: moduleOverrideEntry.isVirtualModule,
            variants: [],
          };
          overrideMap[mId] = overrideInfo;
        }
        if (overrideInfo.isVirtual !== moduleOverrideEntry.isVirtualModule) {
          throw new Error(`Module ${mId} is declared as both virtual and non-virtual`);
        }
        overrideInfo.variants.push({
          condition: moduleOverrideEntry.test,
          override: resolve(statsQuery.path, v).replace(/\\/g, '/'),
        });
      }
    }
  }

  const modulePrefix_override = `\0override:`;
  const modulePrefix_real = `\0real:`;
  const contextModuleId = '\0__cc-module-override-context';

  for (const [k, m] of Object.entries(overrideMap)) {
    if (!m.isVirtual) {
      m.variants.push({
        condition: 'true',
        override: modulePrefix_real + k.replace(/\\/g, '/'),
      });
    }
  }

  const constantManager = new DynamicConstantManager(statsQuery);
  let exportNamesByModule = new Map<string, string[]>();

  return {
    name: 'dynamic-override-modules',

    enforce: 'pre',

    async buildStart() {
      const label = 'Collecting override export names';
      console.time(label);
      try {
        exportNamesByModule = await collectOverrideExportNames({
          statsQuery,
          overrideMap,
          modulePrefix_real,
        });
      } finally {
        console.timeEnd(label);
      }
    },

    async resolveId(id, a, opts) {
      // I don't know why the `moduleId_ccEnv` is joined by vite.
      if (id.endsWith(moduleId_ccEnv)) {
        return moduleId_ccEnv;
      }

      if (id.endsWith(moduleId_configureDynamicConstants)) {
        return moduleId_configureDynamicConstants;
      }

      switch (id) {
        case moduleId_internalConstants:
        case moduleId_dynamicConstantsStore:
          return id;
        default:
          break;
      }

      if (id.startsWith(modulePrefix_real)) {
        const realId = id.slice(modulePrefix_real.length);
        return this.resolve(realId, a, {
          ...opts,
          skipSelf: true,
        });
      }
      if (id === contextModuleId) {
        return contextModuleId;
      }
      if (id in overrideMap) {
        return modulePrefix_override + id;
      }
      const resolved = await this.resolve(id, a, {
        ...opts,
        skipSelf: true,
      });
      if (resolved && !resolved.external) {
        const normalized = normalize(resolved.id);
        if (normalized in overrideMap) {
          return modulePrefix_override + normalized;
        }
      }
      return resolved;
    },

    async load(id, options) {
      switch (id) {
        case moduleId_internalConstants: {
          const constants = constantManager.get();
          const code = await renderEjs('dynamic-constants/exposes.ts', {
            constants,
            storeModule: moduleId_dynamicConstantsStore,
          });
          return {
            code,
          };
        }
        case moduleId_dynamicConstantsStore: {
          const constants = constantManager.get();
          const code = await renderEjs('dynamic-constants/store.ts', {
            constants,
            hasPlatformConstants: constants.some((constant) => constant.category === 'platform'),
            platformDefault: constants.find((constant) => constant.category === 'platform' && constant.value === true)?.name ?? '',
          });
          return {
            code,
          };
        }
        case moduleId_configureDynamicConstants: {
          const code = await renderEjs('dynamic-constants/configure.ts', {
            storeModule: moduleId_dynamicConstantsStore,
          });
          return {
            code,
          };
        }
        case moduleId_ccEnv: {
          const code = generateCCEnvModule(statsQuery);
          return {
            code,
          };
        }
      }

      if (id.startsWith(modulePrefix_override)) {
        const k = id.slice(modulePrefix_override.length);
        assert(k in overrideMap);
        const { variants } = overrideMap[k];
        let code = '';
        const proxyTemplate = await fs.readFile(join(staticDir, 'module-override-proxy.ts.ejs'), 'utf-8');
        code += Ejs.render(proxyTemplate, {
          alias: k,
          contextModuleId,
          exportNames: exportNamesByModule.get(k) ?? [],
          variants: variants.map((v) => ({
            condition: v.condition || 'true',
            override: v.override,
          })),
        });
        code += '\n';
        return {
          code,
          syntheticNamedExports: '__synthetic',
        };
      }
      if (id === contextModuleId) {
        const code = await renderEjs('module-override-context.ts', {
          constantsModule: moduleId_internalConstants,
          storeModule: moduleId_dynamicConstantsStore,
        });
        return {
          code,
        };
      }
      return null;
    },
  };
}

async function collectOverrideExportNames({
  statsQuery,
  overrideMap,
  modulePrefix_real,
}: {
  statsQuery: ccBuild.StatsQuery;
  overrideMap: Record<string, {
    isVirtual: boolean;
    variants: Array<{
      condition: string;
      override: string;
    }>;
  }>;
  modulePrefix_real: string;
}): Promise<Map<string, string[]>> {
  const moduleFilesByAlias = new Map<string, string[]>();
  for (const [alias, overrideInfo] of Object.entries(overrideMap)) {
    if (overrideInfo.isVirtual) {
      continue;
    }
    const moduleFiles = unique([
      alias,
      ...overrideInfo.variants.map((variant) => {
        if (variant.override.startsWith(modulePrefix_real)) {
          return variant.override.slice(modulePrefix_real.length);
        }
        return variant.override;
      }),
    ]).map((file) => normalize(file));
    moduleFilesByAlias.set(alias, moduleFiles);
  }

  const rootNames = unique([...moduleFilesByAlias.values()].flat())
    .filter((file) => /\.(?:cm|m)?[jt]sx?$/.test(file))
    .filter((file) => fs.existsSync(file));
  if (rootNames.length === 0) {
    return new Map();
  }

  const compilerOptions = getCompilerOptions(statsQuery.path);
  const program = ts.createProgram({
    rootNames,
    options: {
      ...compilerOptions,
      noEmit: true,
    },
  });
  const checker = program.getTypeChecker();

  const exportNamesByFile = new Map<string, string[]>();
  const exportStarOverrideAliasesByFile = new Map<string, string[]>();
  const normalizedAliasByFile = new Map<string, string>();
  for (const alias of moduleFilesByAlias.keys()) {
    normalizedAliasByFile.set(normalize(alias), alias);
  }

  for (const rootName of rootNames) {
    const sourceFile = program.getSourceFile(rootName);
    if (!sourceFile) {
      continue;
    }
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) {
      continue;
    }
    const exportNames = checker.getExportsOfModule(moduleSymbol)
      .filter((symbol) => symbol.name !== 'default')
      .filter((symbol) => isRuntimeExportSymbol(checker, symbol))
      .map((symbol) => symbol.name)
      .filter(isIdentifierName)
      .sort((a, b) => a.localeCompare(b));
    exportNamesByFile.set(normalize(rootName), unique(exportNames));
    exportStarOverrideAliasesByFile.set(
      normalize(rootName),
      getExportStarOverrideAliases({
        sourceFile,
        compilerOptions,
        normalizedAliasByFile,
      }),
    );
  }

  const exportNamesByAlias = new Map<string, string[]>();
  for (const [alias, moduleFiles] of moduleFilesByAlias) {
    const exportNames = unique(moduleFiles.flatMap((moduleFile) => {
      return exportNamesByFile.get(normalize(moduleFile)) ?? [];
    })).sort((a, b) => a.localeCompare(b));
    exportNamesByAlias.set(alias, exportNames);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [alias, moduleFiles] of moduleFilesByAlias) {
      const exportNames = new Set(exportNamesByAlias.get(alias) ?? []);
      for (const moduleFile of moduleFiles) {
        const exportStarAliases = exportStarOverrideAliasesByFile.get(normalize(moduleFile)) ?? [];
        for (const exportStarAlias of exportStarAliases) {
          for (const exportName of exportNamesByAlias.get(exportStarAlias) ?? []) {
            exportNames.add(exportName);
          }
        }
      }
      const nextExportNames = [...exportNames].sort((a, b) => a.localeCompare(b));
      const previousExportNames = exportNamesByAlias.get(alias) ?? [];
      if (nextExportNames.length !== previousExportNames.length) {
        exportNamesByAlias.set(alias, nextExportNames);
        changed = true;
      }
    }
  }
  return exportNamesByAlias;
}

function getCompilerOptions(engineRepoPath: string): ts.CompilerOptions {
  const configPath = ts.findConfigFile(engineRepoPath, ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) {
    return {};
  }
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) {
    return {};
  }
  const parsedConfig = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    engineRepoPath,
  );
  return parsedConfig.options;
}

function getExportStarOverrideAliases({
  sourceFile,
  compilerOptions,
  normalizedAliasByFile,
}: {
  sourceFile: ts.SourceFile;
  compilerOptions: ts.CompilerOptions;
  normalizedAliasByFile: Map<string, string>;
}): string[] {
  const exportStarAliases: string[] = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier || statement.exportClause) {
      continue;
    }
    if (!ts.isStringLiteralLike(statement.moduleSpecifier)) {
      continue;
    }
    const resolvedModule = ts.resolveModuleName(
      statement.moduleSpecifier.text,
      sourceFile.fileName,
      compilerOptions,
      ts.sys,
    ).resolvedModule;
    if (!resolvedModule) {
      continue;
    }
    const alias = normalizedAliasByFile.get(normalize(resolvedModule.resolvedFileName));
    if (alias) {
      exportStarAliases.push(alias);
    }
  }
  return unique(exportStarAliases);
}

function isRuntimeExportSymbol(checker: ts.TypeChecker, symbol: ts.Symbol): boolean {
  const targetSymbol = (symbol.flags & ts.SymbolFlags.Alias) !== 0
    ? checker.getAliasedSymbol(symbol)
    : symbol;
  const flags = targetSymbol.getFlags();
  if ((flags & ts.SymbolFlags.Value) !== 0 || (flags & ts.SymbolFlags.NamespaceModule) !== 0) {
    return true;
  }
  const declarations = targetSymbol.getDeclarations() ?? [];
  return declarations.some((declaration) => {
    return ts.isExportAssignment(declaration)
      || ts.isEnumDeclaration(declaration)
      || ts.isClassDeclaration(declaration)
      || ts.isFunctionDeclaration(declaration)
      || ts.isVariableDeclaration(declaration)
      || ts.isModuleDeclaration(declaration);
  });
}

function isIdentifierName(name: string): boolean {
  return /^[$_\p{ID_Start}][$_\u200c\u200d\p{ID_Continue}]*$/u.test(name);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

async function renderEjs(templateName: string, data: Record<string, unknown>) {
  const proxyTemplate = await fs.readFile(join(staticDir, templateName + '.ejs'), 'utf-8');
  const code = Ejs.render(proxyTemplate, data);
  return code;
}

function generateCCEnvModule(statsQuery: ccBuild.StatsQuery) {
  const constantConfigs = getConstantConfig(statsQuery);
  let code = '';
  code += 'export {\n';
  for (const [constantName, constantConfig] of Object.entries(constantConfigs)) {
    if (!constantConfig.internal) {
      code += `  ${constantName},\n`;
    }
  }
  code += `} from ${JSON.stringify(moduleId_internalConstants)};\n`;
  return code;
}

interface XBuildConstantConfig {
  comment: string;
  type: string;
  value: string | boolean | number;
  internal: boolean;
  ccGlobal?: boolean;
  xBuild?: XBuildConstantInfo;
}

type XBuildConstantConfigMap = Record<string, XBuildConstantConfig>;

interface XBuildConstantInfo {
  category?: string;
  configurable?: boolean;
  dynamic?: boolean;
}

interface DynamicConstant {
  name: string;
  value: string | boolean | number;
  category?: string;
  configurable?: boolean;
  dynamic?: boolean;
}

function getConstantConfig(statsQuery: ccBuild.StatsQuery) {
  // @ts-expect-error
  return statsQuery.constantManager._getConstantConfig() as XBuildConstantConfigMap;
}

function getConstantSortKey(constant: DynamicConstant) {
  // 0. static but not string value
  // 0. dynamic but not string value
  // 0. string value
  if (typeof constant.value === 'string') {
    return 2 + (constant.dynamic ? 1 : 0);
  } else {
    return 0 + (constant.dynamic ? 1 : 0);
  }
}

class DynamicConstantManager {
  constructor(private _statsQuery: ccBuild.StatsQuery) {

  }

  get() {
    if (this._cache) {
      return this._cache;
    }
    const constantConfigs = getConstantConfig(this._statsQuery);
    const constants = Object.entries(constantConfigs)
      .map(([constantName, constantConfig]) => {
        let valueExpr = constantConfig.value;
        if (constantConfig.type === 'boolean') {
          if (typeof valueExpr === 'string') {
            valueExpr = valueExpr.replace(/\$/g, '');
          }
        }
        const xBuild = constantConfig.xBuild ?? {};
        return {
          name: constantName,
          value: valueExpr,
          ...xBuild,
        };
      })
      .filter((c) => {
        return !c.dynamic;
      })
      .sort((a, b) => {
        return getConstantSortKey(a) - getConstantSortKey(b);
      })
      ;
    this._cache = constants;
    return constants;
  }

  private _cache: undefined | DynamicConstant[];
}
