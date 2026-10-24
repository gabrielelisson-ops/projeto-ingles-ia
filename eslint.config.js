// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'conteudo-gerado/*'],
  },
  {
    // Scripts de computador (Node), não fazem parte do app.
    files: ['scripts/**/*.js'],
    languageOptions: { globals: { __dirname: 'readonly', require: 'readonly', module: 'writable', process: 'readonly', console: 'readonly' } },
  },
]);
