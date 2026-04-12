import * as vite from 'vite';
import fs from 'fs-extra';
import { join, relative } from 'node:path';
import assert from 'node:assert';
import Ejs from 'ejs';
import babel from '@babel/core';
import babelPluginTransformModulesSystemJS from '@babel/plugin-transform-modules-systemjs';
// @ts-expect-error
import babelPluginTransformDynamicImport from '@babel/plugin-transform-dynamic-import';
import { staticDir } from '../dirs.ts';

export default async function vitePluginOutputSystemJS(): Promise<vite.Plugin> {
  const useProxy: boolean = true;
  const systemJSProxyTemplate = await fs.readFile(join(staticDir, 'systemjs-proxy.js.ejs'), 'utf-8');
  return {
    name: 'output-systemjs',

    enforce: 'post',

    async generateBundle(opts, bundle) {
      if (opts.format !== 'es') {
        return;
      }
      await Promise.all(Object.entries(bundle).map(async ([chunkName, chunk]) => {
        if (chunk.type !== 'chunk') {
          return;
        }

        assert(opts.dir);
        const chunkNameStripped = relative('esm', chunkName);
        const fileName = join(opts.dir, 'systemjs', `${chunkNameStripped}`);

        if (useProxy) {
          const code = Ejs.render(systemJSProxyTemplate, {
            target: '../' + chunkName,
            dependencies: [], // chunk.imports,
          });
          await fs.outputFile(fileName, code);
          return;
        }

        const result = await babel.transformAsync(chunk.code, {
          plugins: [
            [babelPluginTransformModulesSystemJS],
            [babelPluginTransformDynamicImport],
          ],
        });
        if (!result || !result.code) {
          return;
        }
        await fs.outputFile(fileName, result.code);
        if (result.map) {
          await fs.outputFile(`${fileName}.map`, JSON.stringify(result.map));
        }
      }));
    },
  };
}
