import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import reactPlugin from 'eslint-plugin-react';

export default [
  { ignores: ['dist/', 'node_modules/'] },
  {
    files: ['**/*.js', '**/*.jsx'],
    plugins: {
      react: reactPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactPlugin.configs.flat.recommended.rules,
      'react/react-in-jsx-scope': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  prettier,
];
