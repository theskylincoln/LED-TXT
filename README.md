# LED Animator App

A web-based LED backpack animation editor and renderer for pixel displays (96×128 and 64×64).  
Easily type text, choose backgrounds, apply animations, and export true-motion GIFs.  
Designed for creators, riders, and makers to bring custom LED messages and emoji art to life.

---

## ✨ Features

- Real-time canvas preview (96×128 or 64×64)
- Background presets (A–D), solid colors, or custom uploads
- Emoji picker powered by [OpenMoji](https://openmoji.org)
- Add and edit words or lines directly on canvas
- Centered layout with padding (no text cutoff)
- Undo / Redo (20 steps)
- Inspector panel with:
  - Fonts, colors, spacing, and alignment
  - Word animations (pulse, flicker, wave, jitter, etc.)
  - GIF render controls (FPS, duration, filename)
- Multi-select editing
- Zoom and drag support for desktop and mobile
- JSON and GIF export

---

## 🧠 Tech Stack

- **HTML5 Canvas**
- **JavaScript (ES6)**
- **CSS3 / Tailwind styling**
- **gifuct-js** — GIF decoding / encoding (MIT License)
- **js-binary-schema-parser** — Binary schema parsing (MIT License)
- **OpenMoji** — Emoji artwork (CC BY-SA 4.0)

---

## 🪪 License

This project itself is licensed under the **MIT License** — see [`LICENSES.md`](./LICENSES.md) for details.  
Individual components retain their original open-source licenses (see below).

---

## ⚖️ Third-Party Licenses and Attributions

### `gifuct-js`  
MIT License — Copyright (c) 2016–2023 Matt Way  
<https://github.com/matt-way/gifuct-js>

### `js-binary-schema-parser`  
MIT License — Copyright (c) 2016–2023 Matt Way  
<https://github.com/matt-way/js-binary-schema-parser>

### `OpenMoji`  
Emoji artwork provided by [OpenMoji](https://openmoji.org).  
License: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

---

## 💡 Contributing

Pull requests are welcome!  
If you add new presets, emoji packs, or encoders/decoders, please include proper license and attribution info.

---

## 🚀 Deployment

You can host this project directly on **GitHub Pages** or any static server.

```bash
# Example setup
git clone https://github.com/YOUR_USERNAME/led-animator.git
cd led-animator
