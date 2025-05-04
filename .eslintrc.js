module.exports = {
  "env": {
    "node": true,
    "es2021": true,
    "jest": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:node/recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2021,
    "sourceType": "module"
  },
  "plugins": [
    "@typescript-eslint",
    "prettier"
  ],
  "rules": {
    // Node.js kuralları
    "node/exports-style": ["error", "module.exports"],
    "node/file-extension-in-import": ["error", "always", { ".ts": "never" }],
    "node/prefer-global/buffer": ["error", "always"],
    "node/prefer-global/console": ["error", "always"],
    "node/prefer-global/process": ["error", "always"],
    "node/prefer-global/url-search-params": ["error", "always"],
    "node/prefer-global/url": ["error", "always"],
    "node/prefer-promises/dns": "error",
    "node/prefer-promises/fs": "error",
    "node/no-unsupported-features/es-syntax": ["error", { "ignores": ["modules"] }],

    // TypeScript kuralları
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": ["warn", { "allowExpressions": true }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-module-boundary-types": "warn",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/ban-ts-comment": "warn",
    "@typescript-eslint/no-empty-interface": "warn",
    "@typescript-eslint/no-empty-function": "warn",

    // Genel kurallar
    "no-console": ["warn", { "allow": ["info", "warn", "error"] }],
    "quotes": ["error", "single"],
    "semi": ["error", "always"],
    "indent": ["error", 2],
    "object-curly-spacing": ["error", "always"],
    "arrow-parens": ["error", "always"],
    "max-len": ["warn", { "code": 100 }],
    "prettier/prettier": "error"
  },
  "overrides": [
    {
      "files": ["*.js"],
      "rules": {
        "@typescript-eslint/no-var-requires": "off"
      }
    }
  ]
}
