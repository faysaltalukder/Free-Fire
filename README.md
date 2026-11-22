# Free Fire — Survival Arena Prototype

An original browser-based third-person 3D survival shooter prototype rendered with Three.js. This is an independent learning/game-development project and is not affiliated with Garena or the official Free Fire game. It uses original canvas-drawn visuals and no copied game assets.

## Live deployment

This project is a static HTML/CSS/JavaScript game. It has no server-side runtime, build tool, package manager, or external library dependency.

GitHub Pages deployment is automated by [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
1. In **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**.
2. Pushes to `main` automatically upload the repository's static files and deploy them.
3. The workflow can also be started manually from the **Actions** tab.

Expected site URL: https://faysaltalukder.github.io/Free-Fire/

The site is live only after GitHub Pages is enabled and the first deployment workflow succeeds. Check the Actions tab for the deployment result.

## Play locally

Open `index.html` in a modern browser. No build tools or package install are required. Offline caching is enabled after the first HTTPS visit through `sw.js`.

## Controls

- **Move:** W A S D or arrow keys
- **Aim:** Mouse
- **Shoot:** Hold left mouse button
- **Reload:** R
- **Medkit:** Use the on-screen button
- **Mobile:** Left virtual stick to move; drag/shoot on the right side or use FIRE

## Included files

- `index.html` — game entry point and HUD
- `styles.css` — responsive visual design
- `game.js` — input, AI, combat, pickups, and safe-zone logic\n- `render3d.js` — 3D island, third-person camera, aircraft, parachutes, and humanoid character rendering
- `favicon.svg` — browser icon
- `manifest.webmanifest` — installable web-app metadata
- `sw.js` — offline shell cache
- `404.html` — GitHub Pages not-found page
- `robots.txt` — crawler policy
- `.nojekyll` — bypasses Jekyll processing
- `.github/workflows/deploy.yml` — automatic Pages deployment

## Roadmap

1. Tune movement, combat, touch controls, and bot behaviour.
2. Add original character and environment art.
3. Add more maps, weapons, inventory, and settings.
4. Explore multiplayer architecture only after the single-player foundation is stable.

The current build is a single-player 3D prototype. It does not yet include online multiplayer, imported high-detail character assets, or a full animation rig.
