import * as vite from 'vite';

export default function vitePluginReportStats(): vite.Plugin {
  return {
    name: 'report-stats',

    enforce: 'post',

    async generateBundle(opts, bundle) {
      const externals = new Set<string>();
      for (const [_, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk') {
          for (const importModuleSpecifier of chunk.imports) {
            if (!bundle[importModuleSpecifier]) {
              externals.add(importModuleSpecifier);
            }
          }
          for (const importModuleSpecifier of chunk.dynamicImports) {
            if (!bundle[importModuleSpecifier]) {
              externals.add(importModuleSpecifier);
            }
          }
        }
      }
      console.debug(`(${externals.size}) externals:\n${[...externals].map((e, i) => `  [${i}] ${e}`).join('\n')}`);
    },
  };
}
