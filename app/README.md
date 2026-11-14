# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

## iOS

Install dependencies with Node.js 22 or later, then set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` in `app/.env` or the environment. From `app/`, run:

```sh
npm run ios:sync
npm run ios:open
```

If `.env` contains 1Password `op://` references, resolve them during the build
instead of bundling the references into the app:

```sh
op run --env-file=.env -- npm run ios:sync
```

In Xcode, select a signing team and a connected device, then build and run the
app. Run the sync command again after changing the web app.

On iOS, YouTube videos open in an in-app player. Its WebView uses the app's
bundle ID as the HTTPS base URL so YouTube receives the required referrer.
Browser playback continues to use the embedded player in the video feed.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
