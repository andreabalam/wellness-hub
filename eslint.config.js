import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_', // allow _ in destructuring: const { id: _, ...rest }
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // These rules catch real bugs but have intentional false-positives in this codebase
      // (e.g. setState in load effects, Date.now in helper fns called from JSX).
      // Downgrade to warn so CI flags regressions without blocking valid patterns.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      // All localStorage access must go through lib/storage (safeGet/safeSet/etc.)
      // so error handling and validation live in one place.
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message: 'Use safeGet/safeSet/safeRemove/safeHas/safeClear from lib/storage instead.',
        },
      ],
      // Day keys are LOCAL dates. toISOString() is UTC — "today" becomes
      // tomorrow every evening in the Americas. Use lib/dateKey instead.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name=/^(split|slice|substring)$/][callee.object.callee.property.name='toISOString']",
          message: 'UTC date string — use dkey()/todayKey() from lib/dateKey for local day keys.',
        },
        {
          selector:
            "TemplateLiteral:has(CallExpression[callee.property.name='getFullYear']):has(CallExpression[callee.property.name='getDate'])",
          message: 'Hand-rolled date key — use dkey() from lib/dateKey.',
        },
      ],
    },
  },
  // dateKey.ts is the one place allowed to build a day key by hand.
  {
    files: ['src/lib/dateKey.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  // storage.ts is the one place allowed to touch localStorage directly.
  {
    files: ['src/lib/storage.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  // Relax type-checking + storage rules in test files (they stub localStorage)
  {
    files: ['src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-restricted-globals': 'off',
    },
  },
  // Must be last: turns off ESLint rules that conflict with Prettier formatting.
  prettier,
  { ignores: ['dist/', 'coverage/', 'scripts/'] },
)
