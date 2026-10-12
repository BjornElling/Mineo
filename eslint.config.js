import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

/**
 * React-reglerne svarer til det tidligere `eslint-plugin-react`-recommended-sæt (pluginet understøtter
 * ikke ESLint 10). Hooks-reglerne ligger fortsat i `eslint-plugin-react-hooks`, så kun de
 * JSX-/DOM-/livscyklusregler, som det gamle sæt dækkede, er slået til her. Dubletter af TypeScripts egen
 * kontrol (udefinerede JSX-navne, dublerede props) og af ESLint 10's native JSX-referencesporing
 * (`jsx-uses-vars`) er udeladt.
 */
const reactRules = {
  '@eslint-react/no-missing-key': 'error',
  '@eslint-react/jsx-no-comment-textnodes': 'error',
  '@eslint-react/jsx-no-children-prop': 'error',
  '@eslint-react/dom-no-dangerously-set-innerhtml-with-children': 'error',
  '@eslint-react/dom-no-unsafe-target-blank': 'error',
  '@eslint-react/dom-no-unknown-property': 'error',
  '@eslint-react/dom-no-find-dom-node': 'error',
  '@eslint-react/dom-no-render': 'error',
  '@eslint-react/dom-no-hydrate': 'error',
  '@eslint-react/dom-no-render-return-value': 'error',
  '@eslint-react/no-direct-mutation-state': 'error',
  '@eslint-react/no-component-will-mount': 'error',
  '@eslint-react/no-component-will-receive-props': 'error',
  '@eslint-react/no-component-will-update': 'error',
  '@eslint-react/no-unsafe-component-will-mount': 'error',
  '@eslint-react/no-unsafe-component-will-receive-props': 'error',
  '@eslint-react/no-unsafe-component-will-update': 'error',
  '@eslint-react/no-missing-component-display-name': 'warn',
};

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

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: baseLanguageOptions,
    plugins: {
      '@eslint-react': eslintReact,
      'react-hooks': reactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactRules,
      ...reactHooks.configs.recommended.rules,
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
      '@eslint-react': eslintReact,
      'react-hooks': reactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...reactRules,
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
              message: 'Brug vitest globals i stedet (Vitest 5.x). Type imports er tilladt.',
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
