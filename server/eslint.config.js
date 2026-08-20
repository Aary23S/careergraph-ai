import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['coverage/', 'node_modules/'] },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': 'off',
    },
  },
  prettier,
];
