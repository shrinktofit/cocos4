import * as vite from 'vite';
import { babel } from '@rollup/plugin-babel';
import babelPresetEnv, { type Options as BabelPresetEnvOptions } from '@babel/preset-env';
// @ts-expect-error
import babelPluginProposalDecorators from '@babel/plugin-proposal-decorators';
// @ts-expect-error
import babelPluginTransformPrivateMethods from '@babel/plugin-transform-private-methods';
// @ts-expect-error
import babelPluginTransformPrivatePropertyInObject from '@babel/plugin-transform-private-property-in-object';
// @ts-expect-error
import babelPluginTransformClassProperties from '@babel/plugin-transform-class-properties';
// @ts-expect-error
import babelPluginTransformTypescript from '@babel/plugin-transform-typescript';

export default function vitePluginTransform({
  targets,
}: {
  targets?: string | string[];
} = {}): vite.PluginOption[] {
  return [
    babel({
      cwd: import.meta.dirname,
      root: import.meta.dirname,
      babelrc: false,
      babelrcRoots: false,
      babelHelpers: 'bundled',
      skipPreflightCheck: true,
      assumptions: {
      },
      extensions: ['.ts', '.tsx'],
      presets: [
        [babelPresetEnv, {
          targets,
        } satisfies BabelPresetEnvOptions],
      ],
      plugins: [
        [babelPluginTransformTypescript, {
          allowDeclareFields: true,
        }],
        [babelPluginProposalDecorators, {
          version: 'legacy',
        }],
        [babelPluginTransformClassProperties, { loose: true }],
        [babelPluginTransformPrivateMethods, { loose: true }],
        [babelPluginTransformPrivatePropertyInObject, { loose: true }],
      ],
    }),
  ];
}
