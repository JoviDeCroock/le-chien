# WCAG Contrast Audit

This audit covers the dark-mode palette currently used by the chat UI. The goal is to lock down which text/background combinations are safe for WCAG 2.1 AA and to stop reintroducing the low-contrast helper text that had already crept into the app.

## Approved pairings

| Pairing                        | Ratio   | Outcome |
| ------------------------------ | ------- | ------- |
| `neutral-300` on `neutral-950` | 13.36:1 | Pass    |
| `neutral-400` on `neutral-950` | 8.29:1  | Pass    |
| `neutral-400` on `neutral-900` | 6.91:1  | Pass    |
| `neutral-400` on `neutral-800` | 5.83:1  | Pass    |
| `white` on `violet-600`        | 5.88:1  | Pass    |
| `red-400` on `red-950`         | 5.58:1  | Pass    |
| `green-400` on `green-900`     | 5.11:1  | Pass    |

## Pairings to avoid

| Pairing                        | Ratio  | Why it fails                                                         |
| ------------------------------ | ------ | -------------------------------------------------------------------- |
| `violet-600` on `neutral-800`  | 2.57:1 | Accent works as a fill/background, not as body text on dark surfaces |
| `neutral-500` on `neutral-950` | 4.18:1 | Misses the 4.5:1 AA floor for body copy                              |
| `neutral-500` on `neutral-900` | 3.79:1 | Too dim for helper text on cards and bars                            |
| `neutral-600` on `neutral-950` | 2.54:1 | Fails even for small helper copy                                     |
| `neutral-600` on `neutral-900` | 2.30:1 | Too low-contrast for empty states and secondary affordances          |

## Current UI fixes

The audit found several live components using `neutral-500` and `neutral-600` against dark surfaces:

- `web/src/components/EmptyState.tsx`
- `web/src/components/ChatInput.tsx`
- `web/src/components/Sidebar.tsx`
- `web/src/components/ui/Input.tsx`
- `web/src/components/ui/Layout.tsx`
- `web/src/components/ui/TextLink.tsx`

These components now use `neutral-400` for helper copy, placeholders, and quiet top-bar text. That keeps them muted without dropping below AA.

## Guardrail

Run `pnpm --dir web audit:contrast` to verify the approved pairings and the live UI pairings. The script intentionally prints the known failing combinations as warnings so future token decisions do not drift back toward them.
