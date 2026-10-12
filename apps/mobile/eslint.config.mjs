import { builtinModules, createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const expoConfig = require('eslint-config-expo/flat');
export default [
  ...expoConfig,
  {
    files: ['*.cjs'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: builtinModules,
          patterns: [
            'server-only',
            'next',
            'next/**',
            'node:*',
            '@calorie-donate/web',
            '@calorie-donate/web/**',
            '**/web/**',
            '**/apps/web/**',
            '**/server/**',
          ],
        },
      ],
    },
  },
];
