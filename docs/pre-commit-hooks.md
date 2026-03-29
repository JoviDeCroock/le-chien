# Pre-Commit Hooks

## What we install

The repo uses a small `prepare` script to install a shared `pre-commit` hook and
`lint-staged` to run file-level checks only on staged files.

Current hook behavior:

- staged `*.{js,jsx,ts,tsx,mjs,cjs}` files run through `oxlint --fix` and `oxfmt --write`
- staged `*.{json,jsonc}` files run through `oxfmt --write`

## Why this setup

- It keeps pre-commit fast by avoiding a full-repo lint/format pass.
- It avoids staging unrelated local edits, because only already-staged files are rewritten.
- It works across git worktrees because the hook is installed through the repo's shared git hooks directory.

## Local setup

Run `pnpm install` after pulling the branch so the `prepare` script installs the hook.
