module.exports = {
  root: true,
  env: {
    es6: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'google',
    'plugin:@typescript-eslint/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['tsconfig.json', 'tsconfig.dev.json'],
    tsconfigRootDir: __dirname,
    sourceType: 'module'
  },
  ignorePatterns: [
    '/lib/**/*', // Ignore built files.
    '/generated/**/*' // Ignore generated files.
  ],
  plugins: ['@typescript-eslint', 'import'],
  rules: {
    // eslint-config-google가 강제하는 `linebreak-style: ['error', 'unix']`(LF)와
    // Windows 체크아웃(CRLF)이 충돌해 전 파일에서 오탐이 발생한다(개행은 코드 품질이
    // 아닌 체크아웃 아티팩트 — .gitattributes/git autocrlf가 소유). 플랫폼 무관하게 off.
    'linebreak-style': 'off',
    quotes: ['error', 'double'],
    'import/no-unresolved': 0,
    indent: ['error', 2],
    'object-curly-spacing': ['error', 'always'],
    'max-len': ['error', { code: 100 }],
    'require-jsdoc': 'off',
    'valid-jsdoc': 'off',
    'no-var': 'warn',
    'new-cap': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off'
  }
};
