import { build } from './build.ts';
import { defineCommandModule } from './utils.ts';
import process from 'node:process';

export default defineCommandModule({
  command: 'build',

  builder: (argv) => argv.options({
    engineRepo: {
      type: 'string',
      default: process.cwd(),
    },

    out: {
      type: 'string',
      demandOption: true,
    },

    editorExports: {
      type: 'boolean',
      default: false,
    },
  }),

  handler: async (argv) => {
    await build({
      engineRepo: argv.engineRepo,
      out: argv.out,
      editorExports: argv.editorExports,
    });
  },
});
