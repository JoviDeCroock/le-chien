# Tamagotchi dog — mood-variant SVG design

## Learning: silhouette > stroke for same-character feel

The original `TamagotchiDog` drew each mood with thin strokes on a 24×24 grid
and varied the entire body pose per mood (standing, sitting, lying, curled).
At 36px this rendered ~1px strokes and produced six visually distinct creatures
rather than one dog in six states.

The rewrite uses **filled silhouettes** with a shared anatomical skeleton
across moods. What changes per mood:

- Ear orientation (perky, floppy-drooped, very drooped, flat-curled)
- Eye shape (round, squinted, half-closed, sleeping arcs)
- Mouth / tongue presence
- Tail position (wagging, up, resting, down, tucked)
- Body position only when required (upright, lying, curled)

What stays constant: head radius (~5.2), eye placement, nose position,
overall character proportions. This is what sells "the same puppy" across
mood transitions.

## Rules of thumb for mood-variant iconography

- Filled silhouettes render readably at small sizes; 1px strokes do not.
- Worried/sad eyebrows slant with **inner corners up**, not down. Inner-down
  reads as angry. Easy to get wrong — re-render and sanity-check.
- Floppy ears should hang down from **above** each side of the head, not flare
  sideways like wings. Teardrop path anchored near the top of the head, curving
  down-and-outward.
- Keep feature colors constant (`#0a0a0a` on neutral-900 bg gives enough
  contrast on both the `text-violet-500` ecstatic state and the
  `text-neutral-400` default state).

## Verification workflow

For pure SVG components with enumerable states, skip driving the live app —
render all variants into a standalone HTML file under `.context/` and screenshot
with the browse skill. Faster than auth + state manipulation, and you see every
mood side-by-side.
