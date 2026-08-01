const js = require('@eslint/js');
const globals = require('globals');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

const baseLanguageOptions = {
  ecmaVersion: 'latest',
  sourceType: 'module',
  globals: {
    ...globals.browser,
    ...globals.es2021,
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
  },
};

module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: baseLanguageOptions,
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/display-name': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'no-unused-vars': 'warn',
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ...baseLanguageOptions,
      parser: tsParser,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-redeclare': 'error',
      'no-redeclare': 'off',
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/display-name': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'no-console': 'off',
    },
  },
  // Testfiler: Vitest globals + forbyd imports fra 'vitest'
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.jest, // Vitest er kompatibel med Jest globals
        ...globals.node,
      },
    },
    rules: {
      'react-hooks/globals': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'vitest',
              message: 'Brug vitest globals i stedet (Vitest 4.x). Type imports er tilladt.',
              importNames: [
                'describe',
                'it',
                'test',
                'expect',
                'vi',
                'beforeEach',
                'afterEach',
                'beforeAll',
                'afterAll',
              ],
            },
          ],
        },
      ],
    },
  },
  // Playwright-specifikationer bruger eksplicit test-runnerens importerede API.
  {
    files: ['e2e/**/*.spec.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
