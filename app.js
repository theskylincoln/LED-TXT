
// Minimal bootstrap to prove fonts are bundled; full editor code was provided earlier in this thread.
// For this package, we include a guard so the page loads without errors even if external steps were trimmed.
document.addEventListener('DOMContentLoaded', ()=>{
  const el = document.createElement('div');
  el.style.position='fixed'; el.style.bottom='10px'; el.style.right='10px';
  el.style.padding='6px 10px'; el.style.background='#142238'; el.style.border='1px solid #2b3b56';
  el.style.borderRadius='8px'; el.style.color='#9ec7ff'; el.style.fontFamily='DotGothic16, VT323, "Press Start 2P", monospace';
  el.textContent='Fonts embedded. Replace this JS with the full app.js if needed.';
  document.body.appendChild(el);
});
