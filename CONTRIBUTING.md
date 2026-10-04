# Contributing to Paper Fury

## Development loop

1. Fork the repository and create a focused branch.
2. Run `npm install` and `npm test` before changing gameplay.
3. Run `npm run dev` and test with a real keyboard at desktop and mobile widths.
4. Run `npm run check` before opening a pull request.

## Where changes belong

- Add combat rules to `src/engine.js` and cover them in `tests/engine.test.js`.
- Add attacks, enemies, words, stages, or lessons to `src/content.js`.
- Keep drawing and effects in `src/renderer.js`.
- Keep browser and UI wiring in `game.js`.
- Keep external assets out of the repository unless their license and attribution are documented.

## Pull requests

Describe the player-facing change, the controls involved, and how you tested it. Gameplay changes should include a short recording or screenshots when possible. Keep original names, logos, screenshots, sounds, and copy out of new assets.
