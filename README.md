# feature-walkthrough

Feature walkthrough is a small browser app for building and navigating feature trees.

It stores projects locally in the browser, lets you move through parent, sibling, and child nodes, and can optionally ask OpenAI for direct-child feature suggestions.

## Features

- Multiple walkthrough projects, each stored under its own localStorage key.
- Path-based project routes, for example `/feature-walkthrough/my-project`.
- Parent, sibling, and child navigation.
- Autosave on textarea keyup.
- Signed JWT export and import for project backup or transfer.
- Local WebAssembly training and plotting of a sparse `phi_all` curve for each project.
- Optional OpenAI suggestions using an API key stored in sessionStorage.
- Session key cleanup on logout, tab unload, and 30 minutes of inactivity.
- GitHub Pages deployment workflow.

## Storage and Security

Projects are stored in `localStorage` and remain in the browser until deleted.

The OpenAI API key is stored in `sessionStorage`, not localStorage. It is still available to this page while the tab is open, so avoid using the app on shared or untrusted devices.

The API key is only activated after clicking `Use key`; typing into the input alone does not log in or enable suggestions.

## Development

Install dependencies:

```sh
npm install
```

Start the development server:

```sh
npm run serve
```

Build for production:

```sh
npm run build
```

Rebuild the Rust WebAssembly module after changing `wasm/phi-walkthrough`:

```sh
rustup target add wasm32-unknown-unknown
npm run build:wasm
```

The chart button on each project trains a sparse degree-one/degree-two curve in
a browser worker, so larger projects do not freeze the page. Each child node is
learned as a response to its parent, while the path to the root supplies context
with a `0.65` decay per ancestor. Only the aggregate curve and training
statistics are displayed; walkthrough text never leaves the browser.

## GitHub Pages

The app is configured for a GitHub Pages project site at:

```text
/feature-walkthrough/
```

The deployment workflow is in `.github/workflows/deploy-pages.yml` and runs on pushes to `master` or manually through GitHub Actions.
It installs the `wasm32-unknown-unknown` Rust target and rebuilds the phi module before compiling the Vue application.

In the repository settings, configure Pages to use `GitHub Actions` as the source.

## Import and Export

On the home page:

- Use the download button on a project row to export that project as a signed JWT file.
- Click `Import` to import a signed JWT file.
- Imported projects use the selected filename without `.jwt` as the project name.
- Project JWTs are signed with the project name as the HS256 secret.

## License

MIT. See `LICENSE`.
