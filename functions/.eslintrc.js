module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/generated/**/*", // Ignore generated files.
    "/scripts/**/*", // tsconfig(project)에 미포함된 개발용 검증 스크립트 — 타입 인식 lint 대상 아님.
  ],
  plugins: ["@typescript-eslint", "import"],
  rules: {
    // eslint-config-google가 강제하는 `linebreak-style: ['error', 'unix']`(LF)와
    // Windows 체크아웃(CRLF)이 충돌해 전 파일에서 오탐이 발생한다(개행은 코드 품질이
    // 아닌 체크아웃 아티팩트 — .gitattributes/git autocrlf가 소유). 플랫폼 무관하게 off.
    "linebreak-style": "off",
    "quotes": ["error", "double"],
    "import/no-unresolved": 0,
    "indent": ["error", 2],
    "object-curly-spacing": ["error", "always"],
    // code 100 유지. 다만 긴 문자열/템플릿/정규식/URL은 강제 줄바꿈 시 내용이 훼손되거나
    // 가독성이 더 나빠지므로 예외 — 순수 코드 라인에만 길이 제한을 적용한다.
    "max-len": ["error", {
      code: 100,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals: true,
      ignoreUrls: true,
    }],
    "require-jsdoc": "off",
    "valid-jsdoc": "off",
    "no-var": "warn",
    "new-cap": "off",
    "@typescript-eslint/no-empty-function": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
  },
  overrides: [
    {
      // ambient 전역 선언(.d.ts)에서는 전역 바인딩을 만드는 `var`가 정석이라 no-var를 끈다.
      files: ["**/*.d.ts"],
      rules: { "no-var": "off" },
    },
  ],
};
