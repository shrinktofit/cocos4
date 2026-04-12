import * as vite from 'vite';
import { normalize } from 'node:path';
import ccBuild from '@cocos/ccbuild';

export default async function vitePluginStaticOverrideModules({
  statsQuery,
}: {
  statsQuery: ccBuild.StatsQuery;
}): Promise<vite.Plugin> {
  return {
    name: 'override-modules',

    enforce: 'pre',

    async resolveId(id, a, opts) {
      void normalize;
      // if (id in overrides) {
      //   return overrides[id];
      // }
      // const resolved = await this.resolve(id, a, {
      //   ...opts,
      //   skipSelf: true,
      // });
      // if (resolved && !resolved.external) {
      //   const normalized = normalize(resolved.id);
      //   if (normalized in overrides) {
      //     return overrides[normalized];
      //   }
      // }
      // return resolved;
    },
  };
}
