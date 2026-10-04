# Paper Fury

**Your keyboard. Their problem.**

Paper Fury is an open-source typing beat 'em up built as a dependency-light browser game. Type words to attack, choose your next move, launch and juggle paper fighters, dash through incoming swings, and build a stylish run through three original desktop-inspired worlds.

The project is a clean-room implementation of gameplay ideas in the typing-action and stick-fighter genres. It does not use the source code, assets, branding, copy, or private APIs of any other game.

## Play locally

The game is a static site, but ES modules need an HTTP server:

```bash
npm install
npm run dev
```

Open <http://localhost:4173>. A production build is simply the repository root and is deployed by the included GitHub Pages workflow.

## Controls

| Input | Action |
| --- | --- |
| A-Z | Type the current attack word |
| 1 / 2 / 3 / 4 | Rush, Breaker, Skyward, Full stop |
| Left / Right | Move and choose a direction |
| Space | Dodge; hold a direction to choose the dash direction |
| Shift | Guard while held |
| Tab | Cycle the target |
| Escape | Pause |
| Theme button | Switch dark/light desktop theme |

The **dojo** teaches the combat loop without damage or a time limit. **Arcade** has nine waves across three intensity levels. **90-second rush** scores as much style as possible before time expires. **2-player local** gives each player a 45-second pass-and-play turn, while **Online room** uses a peer-to-peer 45-second race with an invite code. Online results are saved locally and are not a globally verified leaderboard.

## Architecture

- `src/engine.js` is the deterministic, fixed-step combat simulation.
- `src/renderer.js` draws all environments, paper fighters, effects, and HUD art locally on a canvas.
- `src/audio.js` synthesizes layered sound effects with Web Audio. No local media files are required.
- `src/content.js` contains data-driven stages, attacks, enemy types, words, and lessons.
- `game.js` connects the simulation to the browser UI, keyboard, touch controls, dialogs, local/online competition, records, and theme preferences.
- Online rooms load PeerJS only when requested; peer matches require an internet connection and report scores from the players' browsers.

Gameplay rules are independent of rendering, so contributors can add moves and enemy behaviors without rewriting the art layer.

## Test and check

```bash
npm test
npm run check
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Small changes are welcome: new words, move definitions, enemy patterns, environment motifs, accessibility improvements, and performance fixes.

## License

Code and original assets are released under the MIT License. See [LICENSE](LICENSE).
