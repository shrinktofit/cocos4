// @ts-check

import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default defineConfig(
  globalIgnores([
    '**/node_modules/**',
    '**/lib/**',
  ]),
  eslint.configs.recommended,
  tseslint.configs.recommended,
  stylistic.configs.customize({
    indent: 2,
    quotes: 'single',
    semi: true,
    braceStyle: '1tbs',
    arrowParens: true,
  }),
);
