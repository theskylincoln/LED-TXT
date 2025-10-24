# LED Animator App
v1.0

A web-based LED text animator editor and renderer for pixel displays (96×128 and 64×64) optimized for LED backpacks.  
Easily type text, choose backgrounds, apply animations, and export true-motion GIFs.  
Designed for riders, creators, and makers to bring custom LED messages and emoji art to life.

---


## ✨ Features

- Real-time canvas preview (96×128 or 64×64)  
- Background presets, solid colors, or custom uploads  
- Emoji picker powered by [OpenMoji](https://openmoji.org)  
- Animated emoji support using [Google Noto Animated Emoji](https://github.com/googlefonts/noto-emoji)  
- Add and edit words, emojis, and lines directly on the canvas  
- Centered layout with padding (no text cutoff)  
- Undo / Redo (20 steps)  
- Inspector panel with:  
  - Fonts, colors, spacing, and alignment  
  - Word animations (pulse, flicker, wave, jitter, etc.)  
  - GIF render controls (FPS, duration, filename)  
- Multi-select editing  
- Zoom and drag support for desktop and mobile  
- JSON file and GIF export  

---

## 🧠 Tech Stack

- **HTML5 Canvas**  
- **JavaScript (ES6)**  
- **CSS3 / Tailwind styling**  
- **gifuct-js** — GIF decoding / encoding (MIT License)  
- **js-binary-schema-parser** — Binary schema parsing (MIT License)  
- **OpenMoji** — Emoji artwork (CC BY-SA 4.0)  
- **Google Noto Animated Emoji** — Animated emoji via Lottie (Apache 2.0)

---

## 🪪 License

This project is licensed under the **MIT License** — see [`LICENSES.md`](./LICENSES.md) for details.  
Individual libraries and assets retain their respective open-source licenses.

---

## ⚖️ Third-Party Licenses and Attributions

### gifuct-js  
MIT License — Copyright (c) 2016–2023 Matt Way  
<https://github.com/matt-way/gifuct-js>

### js-binary-schema-parser  
MIT License — Copyright (c) 2016–2023 Matt Way  
<https://github.com/matt-way/js-binary-schema-parser>

### OpenMoji  
Emoji artwork provided by [OpenMoji](https://openmoji.org).  
License: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

### Google Noto Animated Emoji  
Animated emoji data and artwork provided by the [Noto Emoji project](https://github.com/googlefonts/noto-emoji), part of [Google Fonts](https://fonts.google.com/noto).  
© 2024 Google LLC. Licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

---

## 🚀 Deployment

You can host this project on **GitHub Pages** or any static web server.

**Example setup:**

```
git clone https://github.com/theskylincoln/led-animator.git
cd led-animator
```

Open `index.html` in your browser or deploy to:  
https://theskylincoln.github.io/led-animator/

---

## 💬 Creator

Instagram: [@theskylincoln](https://instagram.com/theskylincoln)

_Created with the assitence of ChatGPT (openAI)_

---

## ❤️ Acknowledgments

- [OpenMoji Team](https://openmoji.org) — for open-source emoji artwork  
- [Matt Way](https://github.com/matt-way) — for gifuct-js and js-binary-schema-parser  
- [ChatGPT (GPT-5)](https://openai.com) — for collaborative coding and documentation support  
- The open-source community that made this project possible  
