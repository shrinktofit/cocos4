import * as vite from 'vite';
import { isAbsolute, basename, extname } from 'node:path';
import semver from 'semver';

export default function vitePluginDeprecatedFeatures({
  versionRange,
}: {
  versionRange?: string;
}): vite.Plugin {
  return {
    name: 'deprecated-features',

    load(id: string) {
      if (!isAbsolute(id)) {
        return null;
      }
      const stem = basename(id, extname(id));
      const match = /^deprecated(-)?(.*)/.exec(stem);
      if (!match) {
        return null;
      }
      const versionString = match[2];
      if (versionString.length !== 0) {
        const parsedVersion = semver.parse(versionString);
        if (!parsedVersion) {
          console.debug(`${id} looks like a deprecated module, but it contains an invalid version.`);
          return null;
        }
        if (versionRange && !semver.satisfies(parsedVersion, versionRange)) {
          return null;
        }
      }
      console.debug(`Exclude deprecated module ${id}`);
      return `export {}`;
    },
  };
}
