// @ts-check

const { join } = require('node:path');
const { ensureDir, emptyDir } = require('fs-extra');

(async function exec () {
  const outDir = join(__dirname, '..', 'bin', 'test-purpose');
  await ensureDir(outDir);
  await emptyDir(outDir);

  // eslint-disable-next-line import/extensions
  const { build } = await require('./x-build/packages/x-build/lib/index.js');

  await build({
    engineRepo: join(__dirname, '..'),
    out: outDir,
    format: 'es',
    targets: ['chrome 80'],
    deprecatedApi: false,
    compress: false,
    sourceMap: true,
    split: true,
    preserveModules: true,
    editorExports: true,
  });
}()).catch(console.error.bind(console));
