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

## Train Tic-Tac-Toe

Train a sparse Phi model from a TSV file:

```sh
npm run train:tic-tac-toe -- training-games.tsv
```

Each row contains `board<TAB>move<TAB>history`. A board is nine cells in reading order,
using `X`, `O`, and `.` for an empty cell. Moves are numbered `1` through `9`
in reading order; coordinates from `A1` through `C3` are also accepted. A
header row and lines beginning with `#` are optional. History is an optional,
comma-separated list of previous moves in chronological order; it is replayed
and validated against the board before training.

```tsv
board	move	history
.........	5
X...O....	9	1,5
....X....	1	5
```

By default this writes `training-games.phi.json`. Pass a second path to choose
the output file:

```sh
npm run train:tic-tac-toe -- training-games.tsv models/tic-tac-toe.phi.json
```

The command encodes each board cell and the current player as position-aware
text features, then trains them with the same weighted sparse curve learner used
by walkthroughs. It uses the same linear and pairwise terms, eight-point curves,
learning rate, convergence threshold, and positive-response training. The full
board after each previous move forms an ancestry level: the position immediately
before the current board has weight `0.65`, with each older position decaying by
another factor of `0.65`; the current board has weight `1`. The published binary
model contains those curves plus the aggregate `points` curve and training
statistics. The browser loads and validates that binary with the Rust WebAssembly
module before inference reconstructs the board-history path, interpolates each
active sparse curve, and returns the highest-scoring legal move.

Bundled minimax training gives winning moves and draw-preserving moves that
avoid a losing alternative target `1`. Ordinary pat moves retain the `0.65`
decay, while losing moves have target `0`. Every legal move supplies a training
example, giving Phi direct negative evidence for losing responses instead of
merely omitting them.
Coverage is exhaustive for every reachable O-turn position where a win or draw
remains available, so avoidable losses are not limited by per-ply sampling.

The browser exposes the learned function separately from decision-making:

```js
phi(model, board)
// {
//   1: {
//     points: [ [[0], contribution], [[0, 3], contribution], ... ],
//     result: score
//   },
//   ...
// }

inferPhi(model, board) // { response, score, evaluations }
```

Thus `phi(x)` is a weighted sparse degree-2 curve function from the
position-aware board vector to a 9-dimensional response result. Every returned
point uses vocabulary indices, so its linear or pairwise contribution can be
resolved through `model.vocabulary`. `inferPhi` only applies `argmax` afterward.

Build the bundled model from deterministic, minimax-optimal positions:

```sh
npm run build:tic-tac-toe-model
```

This rebuilds the WASM learner and writes the public binary model to
`public/tic-tac-toe.phi.bin`. The Tic-Tac-Toe footer popup parses that asset
automatically and lets an OpenAI language model play X against Phi as O. An
active API key is required before starting a match. Phi training and model file
access remain local and require no additional npm dependencies.

The binary contains only numeric metadata, vocabulary tokens, response/feature
indices, and populated 32-bit curve control points. Zero-only terms are omitted,
and zero points within retained curves use a bitmask instead of occupying four
bytes each. Descriptive model fields are restored by the WASM parser and are not
duplicated in the published payload.

## GitHub Pages

The app is configured for a GitHub Pages project site at:

```text
/feature-walkthrough/
```

The deployment workflow is in `.github/workflows/deploy-pages.yml` and runs on pushes to `master` or manually through GitHub Actions.
It installs the `wasm32-unknown-unknown` Rust target, rebuilds the Phi WASM and binary Tic-Tac-Toe model, then compiles the Vue application.

In the repository settings, configure Pages to use `GitHub Actions` as the source.

## Import and Export

On the home page:

- Use the download button on a project row to export that project as a signed JWT file.
- Click `Import` to import a signed JWT file.
- Imported projects use the selected filename without `.jwt` as the project name.
- Project JWTs are signed with the project name as the HS256 secret.

## License

MIT. See `LICENSE`.
