module.exports = {
  root: true,
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'artifacts/',
    'hint-report/',
    'offline-job-runner/',
    '.venv/',
    '**/.venv/',
    '**/__pycache__/',
    'public/',
    '**/*.d.ts',
  ],
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      presets: ['@babel/preset-env', '@babel/preset-react'],
    },
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: 'detect' },
  },
  plugins: ['react', 'react-hooks', 'import', 'jsx-a11y'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:import/recommended',
    'prettier',
  ],
  rules: {
    'no-debugger': 'error',

    // Strong correctness. Keep existing repo behavior for `== null` checks.
    eqeqeq: ['error', 'always', { null: 'ignore' }],

    // Keep console usable but disciplined.
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // Import hygiene.
    'import/no-duplicates': 'error',
    'import/no-unresolved': 'off',

    // Reduce friction.
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
  },
  overrides: [
    {
      files: ['**/*.{ts,tsx}'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },

        // Intentionally NOT setting `project` yet to avoid perf/config churn.
        project: undefined,
      },
      plugins: ['@typescript-eslint'],
      extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
      rules: {
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/consistent-type-imports': 'warn',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    {
      files: [
        '**/*.test.{js,jsx,ts,tsx}',
        '**/*.spec.{js,jsx,ts,tsx}',
        'tests/**/*.{js,jsx,ts,tsx}',
        'test/**/*.{js,jsx,ts,tsx}',
      ],
      env: { jest: true },
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
