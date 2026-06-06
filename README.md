# feature-walkthrough

Feature walkthrough is a small browser app for building and navigating feature trees.

It stores projects locally in the browser, lets you move through parent, sibling, and child nodes, and can optionally ask OpenAI for direct-child feature suggestions.

## Features

- Multiple walkthrough projects, each stored under its own localStorage key.
- Path-based project routes, for example `/feature-walkthrough/my-project`.
- Parent, sibling, and child navigation.
- Autosave on textarea keyup.
- JSON export and import for project backup or transfer.
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

## GitHub Pages

The app is configured for a GitHub Pages project site at:

```text
/feature-walkthrough/
```

The deployment workflow is in `.github/workflows/deploy-pages.yml` and runs on pushes to `master` or manually through GitHub Actions.

In the repository settings, configure Pages to use `GitHub Actions` as the source.

## Import and Export

On the home page:

- Use the download button on a project row to export that project as JSON.
- Enter a project key and click `Import` to import a JSON file into that key.
- If the project key field is empty, import uses the selected filename without `.json`.

## License

MIT. See `LICENSE`.
