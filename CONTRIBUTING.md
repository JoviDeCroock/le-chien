# Contributing

Thanks for your interest in contributing to le chien.

## Getting set up

1. Fork and clone the repository.
2. Install dependencies and run local setup:
   ```sh
   ./setup.sh
   ```
3. Fill in `web/.dev.vars` with your own Polar / OpenAI / Cloudflare credentials. See the [README](./README.md) for details.
4. Start the dev server:
   ```sh
   cd web && pnpm dev
   ```

## Making a change

1. Create a branch off `main`.
2. Make your change. Keep the diff focused — one concern per PR.
3. Before committing, make sure the checks pass:
   ```sh
   pnpm -w run check        # lint + format
   pnpm --dir web run typecheck
   pnpm --dir web run build
   ```
4. Commits go through `lint-staged` via a pre-commit hook installed during `pnpm install`.

## Pull requests

- **Keep PRs small.** Reviewers should be able to hold the whole change in their head.
- **Describe the "why."** What user-visible behavior changes, and why is this the right approach?
- **Link related issues.** If your PR closes one, use `Closes #123`.
- **Screenshots for UI changes.** Before/after helps a lot.
- **No unrelated refactors.** Separate cleanup into its own PR.

## Style

- **Package manager:** `pnpm`. Don't commit `package-lock.json` or `yarn.lock`.
- **Linting & formatting:** `oxlint` + `oxfmt`. Both run on commit via `lint-staged`.
- **State management:** signals-based. Avoid `useState`/`useReducer`. See `docs/` for patterns.
- **Design system:** consult `DESIGN.md` before making visual changes.

## Reporting bugs

Open an issue with:

- What you were doing.
- What you expected to happen.
- What actually happened.
- Browser / OS / reproduction steps.

## Suggesting features

Open an issue first to discuss, especially for anything that changes product scope or affects the data model. Small, additive features can usually skip this and go straight to a PR.
