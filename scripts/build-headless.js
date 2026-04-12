// @ts-check

const { join } = require('node:path');
const { ensureDir, emptyDir } = require('fs-extra');

const min = process.argv.includes('--min');

(async function exec () {
    const outDir = join(__dirname, '..', 'bin', 'dev', 'headless', min ? 'min' : 'debug');
    await ensureDir(outDir);
    await emptyDir(outDir);

    // eslint-disable-next-line import/extensions
    const { build } = await require('./x-build/packages/x-build/lib/index.js');

    const platform = 'HEADLESS';

    await build({
        engineRepo: join(__dirname, '..'),
        out: outDir,
        format: 'es',
        targets: ['chrome 80'],
        deprecatedApi: false,
        features: [
            'headless-core',
        ],
        compress: min,
        sourceMap: true,
        split: true,
        preserveModules: true,
    });

    // const statsQuery = await StatsQuery.create(join(__dirname, '..'));
    // const mode = 'HEADLESS';
    // const flags = {
    //     DEBUG: true,
    // };
    // const ccEnvSource = statsQuery.constantManager.exportStaticConstants({
    //     mode,
    //     platform,
    //     flags,
    // });
    // const ccEnvFile = join(outDir, 'cc-env.js');
    // await outputFile(ccEnvFile, ccEnvSource);
}()).catch(console.error.bind(console));
