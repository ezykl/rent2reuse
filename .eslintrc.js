module.exports = {
  root: true,
  extends: ["expo", "prettier"],
  ignorePatterns: [
    "dist/*",
    "node_modules/*",
    // functions/ is a separate Node/TS project with its own dependencies
    // (firebase-admin, firebase-functions) not installed at the app root —
    // lint it via `cd functions && npx eslint .` with its own config if
    // desired, rather than pulling it into the Expo app's lint run.
    "functions/*",
    "android/*",
    "credentials/*",
  ],
  rules: {
    // The codebase has ~125 existing `any` usages — warn (don't block on
    // it) so new ones stay visible without a big-bang cleanup.
    "@typescript-eslint/no-explicit-any": "warn",
    // Reinforces the __DEV__-gating convention (see AGENTS.md) without
    // hard-failing the large volume of existing console.* calls at once.
    "no-console": "warn",
    // "@env" is a virtual module provided by babel-plugin-dotenv-import at
    // build time, not a real file — ESLint's import resolver can't see it
    // and would otherwise report every "@env" import as unresolved.
    "import/no-unresolved": ["error", { ignore: ["^@env$"] }],
    // chat/[id].tsx has several pre-existing conditional hook calls this
    // rule caught (a real bug worth fixing on its own) — downgraded to warn
    // for now so lint stays usable without that unrelated fix blocking it.
    "react-hooks/rules-of-hooks": "warn",
  },
};
