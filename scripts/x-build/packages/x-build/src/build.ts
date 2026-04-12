import { readdir } from 'node:fs/promises';
import { extname, join, normalize, relative, resolve } from 'node:path';
import * as vite from 'vite';
import * as ccBuild from '@cocos/ccbuild';
import vitePluginOutputSystemJS from './plugins/vite-plugin-output-systemjs.ts';
import vitePluginReportStats from './plugins/vite-plugin-report-stats.ts';
import vitePluginDynamicOverrideModules from './plugins/vite-plugin-dynamic-override-modules.ts';
import vitePluginStaticOverrideModules from './plugins/vite-plugin-static-override-modules.ts';
import vitePluginTransform from './plugins/vite-plugin-transform.ts';
import { moduleId_ccEnv, moduleId_configureDynamicConstants } from './shared.ts';
import vitePluginDeprecatedFeatures from './plugins/vite-plugin-deprecated-features.ts';

export interface BuildOptions {
  engineRepo: string;
  out: string;
  format?: 'es' | 'cjs' | 'systemjs';
  targets?: string[];
  deprecatedApi?: boolean;
  features?: string[];
  compress?: boolean;
  sourceMap?: boolean;
  split?: boolean;
  mode?: string;
  platform?: string;
  preserveModules?: boolean;
  editorExports?: boolean;
}

export async function build(options: BuildOptions) {
  console.debug(`Build options: ${JSON.stringify(options, undefined, 2)}`);
  const engineRepoPath = normalize(options.engineRepo);

  const statsQuery = await ccBuild.StatsQuery.create(engineRepoPath);

  const featureFiles = Object.fromEntries(statsQuery.getFeatureUnits().map((featureUnit) => {
    return [featureUnit, statsQuery.getFeatureUnitFile(featureUnit)];
  }));
  console.debug(`Features: ${JSON.stringify(featureFiles, undefined, 2)}`);

  const featureEntries = collectFeatureEntries(featureFiles, options.features);

  const flags: Record<string, boolean> = {};
  flags.DEBUG = true;

  const useStaticModuleOverrides: boolean = false;

  const entries: Record<string, string> = {
    ...featureEntries,
    ...(options.editorExports ? await collectEditorExportEntries(engineRepoPath) : {}),
    env: moduleId_ccEnv,
  };
  if (!useStaticModuleOverrides) {
    entries['configure'] = moduleId_configureDynamicConstants;
  }

  const output = await vite.build({
    esbuild: false,
    build: {
      lib: {
        entry: entries,
        formats: ['es'],
      },
      emptyOutDir: true,
      outDir: options.out,
      sourcemap: true,
      minify: false,
      rollupOptions: {
        external: (id) => {
          if (id === 'cce:/internal/x/prerequisite-imports') {
            return true;
          }
          if (id.startsWith('external:')) {
            return true;
          }
        },
        output: {
          entryFileNames: `[format]/[name].js`,
          chunkFileNames: `[format]/_chunks/[name].js`,
          assetFileNames: `_assets/[name].[ext]`,
          preserveModules: options.preserveModules,
        },
      },
    },

    resolve: {
      alias: {
        'cc.decorator': resolve(engineRepoPath, 'cocos/core/data/decorators/index.ts'),
      },
    },

    plugins: [
      useStaticModuleOverrides
        ? vitePluginStaticOverrideModules({ statsQuery })
        : vitePluginDynamicOverrideModules({ statsQuery }),
      enginePlugin({ engineRepoPath }),
      vitePluginReportStats(),
      vitePluginOutputSystemJS(),
      vitePluginTransform({
        targets: 'chrome>=107',
      }),
      vitePluginDeprecatedFeatures({}),
    ],
  });
  void output;
}

const supportedEditorExportExtensions = new Set(['.ts', '.js', '.json']);

function collectFeatureEntries(featureFiles: Record<string, string>, features?: string[]): Record<string, string> {
  const selectedFeatures = features ?? Object.keys(featureFiles);
  const entries: Record<string, string> = {};

  for (const feature of selectedFeatures) {
    const file = featureFiles[feature];
    if (!file) {
      throw new Error(`Unknown feature: ${feature}`);
    }

    entries[`exports/${feature}`] = file;
  }

  return entries;
}

async function collectEditorExportEntries(engineRepoPath: string): Promise<Record<string, string>> {
  const editorExportsPath = resolve(engineRepoPath, 'editor/exports');
  const files = await collectFiles(editorExportsPath);
  const entries: Record<string, string> = {};

  for (const file of files.sort()) {
    const extension = extname(file);
    if (!supportedEditorExportExtensions.has(extension) || file.endsWith('.d.ts')) {
      continue;
    }

    const relativeFile = relative(editorExportsPath, file);
    const entryName = `editor/exports/${toEntryName(relativeFile.slice(0, -extension.length))}`;
    if (Object.prototype.hasOwnProperty.call(entries, entryName)) {
      throw new Error(`Duplicate editor export entry: ${entryName}`);
    }

    entries[entryName] = file;
  }

  return entries;
}

async function collectFiles(directoryPath: string): Promise<string[]> {
  const dirents = await readdir(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const dirent of dirents) {
    const childPath = join(directoryPath, dirent.name);
    if (dirent.isDirectory()) {
      files.push(...await collectFiles(childPath));
    } else if (dirent.isFile()) {
      files.push(childPath);
    }
  }

  return files;
}

function toEntryName(path: string) {
  return path.replace(/\\/g, '/');
}

function enginePlugin({
  engineRepoPath,
}: { engineRepoPath: string }): vite.Plugin {
  return {
    name: 'engine-plugin',

    resolveId(id, parent) {
      if (id === '../settings.js' && parent && normalize(parent) === normalize(resolve(engineRepoPath, 'cocos/core/settings.ts'))) {
        return { id, external: true };
      }
    },
  };
}
