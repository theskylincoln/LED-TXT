/* animatedEmoji.js — drop-in helper (no bundler)
   Exposes window.AnimatedEmoji with:
   - init({useLocal, localBase})
   - ensure(code)   -> loads/cache Lottie
   - draw(ctx, el)  -> preview drawing (time-based)
   - drawAtFrame(ctx, el, exportFrameIndex, exportFps) -> deterministic frame for GIF export
   - filterIndex(q) -> simple search over NOTO_INDEX
   - NOTO_INDEX     -> starter list; add more as needed
*/
(function (global) {
  const NOTO_CDN_BASE = 'https://fonts.gstatic.com/s/e/notoemoji/latest';
  let USE_LOCAL = false, LOCAL_BASE = '/assets/noto'; // if you later hardwire JSON files

  function urlFor(code) {
    return USE_LOCAL ? `${LOCAL_BASE}/${code}/lottie.json`
                     : `${NOTO_CDN_BASE}/${code}/lottie.json`;
  }

  const Cache = new Map(); // code -> {anim, holder, mirror, ctx, totalFrames, fps, blit}

  async function ensure(code) {
    code = code.toLowerCase();
    if (Cache.has(code)) return Cache.get(code);

    const holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:-99999px;top:-99999px;width:512px;height:512px;';
    document.body.appendChild(holder);

    const mirror = document.createElement('canvas');
    mirror.width = 512; mirror.height = 512;
    const ctx = mirror.getContext('2d');

    const anim = lottie.loadAnimation({
      container: holder,
      renderer: 'canvas',
      loop: true,
      autoplay: false,
      path: urlFor(code)
    });

    await new Promise(res => anim.addEventListener('DOMLoaded', res));

    const fps = anim.frameRate || 30;
    const totalFrames = Math.round(anim.getDuration(true));

    function blit() {
      const src = holder.querySelector('canvas');
      if (!src) return;
      ctx.clearRect(0,0,mirror.width,mirror.height);
      ctx.drawImage(src, 0, 0);
    }

    const entry = { anim, holder, mirror, ctx, totalFrames, fps, blit };
    Cache.set(code, entry);
    return entry;
  }

  async function draw(ctx, el) { // preview/live
    const node = await ensure(el.codepoint);
    const now = performance.now() * 0.001;
    const fps = node.fps * (el.speed || 1);
    const frameIndex = Math.floor(now * fps) % node.totalFrames;
    node.anim.goToAndStop(frameIndex, true);
    node.blit();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(node.mirror, el.x, el.y, el.w, el.h);
  }

  async function drawAtFrame(ctx, el, exportFrameIndex, exportFps) {
    const node = await ensure(el.codepoint);
    const efps = node.fps * (el.speed || 1);
    const emojiFrame = Math.floor((exportFrameIndex * efps) / exportFps) % node.totalFrames;
    node.anim.goToAndStop(emojiFrame, true);
    node.blit();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(node.mirror, el.x, el.y, el.w, el.h);
  }

  function init(opts = {}) {
    USE_LOCAL = !!opts.useLocal;
    if (opts.localBase) LOCAL_BASE = opts.localBase;
  }

  // Minimal searchable index (grow this list anytime)
  const NOTO_INDEX = [
    { cp:'1f389', ch:'🎉', name:'Party popper' },
    { cp:'1f60a', ch:'😊', name:'Smiling face with smiling eyes' },
    { cp:'1f602', ch:'😂', name:'Face with tears of joy' },
    { cp:'1f525', ch:'🔥', name:'Fire' },
    { cp:'2764',  ch:'❤️', name:'Red heart' },
    { cp:'1f4a5', ch:'💥', name:'Collision' },
    { cp:'1f389', ch:'🎉', name:'Party' },
    // add more favorites as you go
  ];

  function filterIndex(q) {
    q = (q || '').toLowerCase().trim();
    if (!q) return NOTO_INDEX;
    return NOTO_INDEX.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.cp.includes(q) ||
      e.ch.includes(q)
    );
  }

  global.AnimatedEmoji = { init, ensure, draw, drawAtFrame, NOTO_INDEX, filterIndex };
})(window);
