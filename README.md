# LED Backpack Text Animator (Upload‑Only Version)

This version requires **no npm, no build**. Just upload to GitHub and enable Pages.

## How to deploy on GitHub Pages
1. Create an empty repo (or open your existing one).
2. Upload **all files** from this ZIP at the repo root (`index.html`, `styles.css`, `app.js`, `assets/`).
3. Go to **Settings → Pages** → Source: **Deploy from branch**, Branch: **main**, Folder: **/** (root).
4. Save, wait 1‑2 minutes, then open your Pages URL.

## Features (simplified)
- Live canvas preview with animated text.
- Preset backgrounds A/B (96×128), C/D (64×64) + Solid color + Custom upload.
- Up to 5 lines, per‑word color, add/delete lines & words.
- Timing (seconds, FPS), basic animation (breath/scale/wave).
- **Render & Download GIF** via CDN (gif.js).
- Save/Load state as `.json`.

> For the full-featured editor (guides, rulers, snapping, owners tools, etc.), use the “Phase 7” packages with npm build.
