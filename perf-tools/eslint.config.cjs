const globals = require('globals');
module.exports = [{
  files: ['**/*.js'],
  languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...globals.es2021, wx: 'readonly', GameGlobal: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly', queueMicrotask: 'readonly', TextDecoder: 'readonly', TextEncoder: 'readonly', require: 'readonly', module: 'writable', exports: 'writable', globalThis: 'readonly' } },
  linterOptions: { reportUnusedDisableDirectives: false },
  rules: {
    'no-undef': 'error', 'no-dupe-keys': 'error', 'no-dupe-class-members': 'error', 'no-unreachable': 'warn', 'no-self-assign': 'warn',
    'no-self-compare': 'warn', 'use-isnan': 'error', 'valid-typeof': 'error', 'no-unsafe-negation': 'error', 'getter-return': 'error',
    'no-const-assign': 'error', 'no-func-assign': 'error', 'no-import-assign': 'error', 'no-redeclare': 'warn', 'no-dupe-else-if': 'warn', 'no-duplicate-case': 'error',
    'no-compare-neg-zero': 'error', 'no-unsafe-finally': 'warn', 'no-loss-of-precision': 'warn', 'no-unused-private-class-members': 'off'
  }
}];
