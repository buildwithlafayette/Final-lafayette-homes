// main.js — Lafayette Homes (v9)
// Theme toggle + Lightbox + Builds slider (exact offset logic)

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/* ---------------- THEME TOGGLE ---------------- */
(function themeInit(){
  const root = document.documentElement;
  const btn = $('#theme-toggle');
  const PREF_KEY = 'lh_theme'; // 'light' | 'dark'

  function apply(theme){
    if (theme) root.setAttribute('data-theme', theme);
    // icon/label
    if (!btn) return;
    const isDark = (root.getAttribute('data-theme') || '').toLowerCase() === 'dark';
    btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    btn.querySelector('.label').textContent = isDark ? 'Dark' : 'Light';
    btn.querySelector('.emoji').textContent = isDark ? '🌙' : '☀️';
  }

  // initial: respect saved pref, else respect system
  const saved = localStorage.getItem(PREF_KEY);
  if (saved === 'light' || saved === 'dark'){
    root.setAttribute('data-theme', saved);
  } else {
    // no saved; leave vars as-is (CSS already used prefers-color-scheme)
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    root.setAttribute('data-theme', mql.matches ? 'dark' : 'light');
  }
  apply();

  // click to toggle
  btn?.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem(PREF_KEY, next);
    apply(next);
  });
})();

/* ---------------- A11Y helpers ---------------- */
function getFocusable(container) {
  return Array.from(
    container.querySelectorAll(
      'a, button, input, textarea, select, details, summary, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1 && el.offsetParent !== null);
}
function trapFocusKeydown(e, container) {
  if (e.key !== 'Tab') return;
  const f = getFocusable(container);
  if (!f.length) return e.preventDefault();
  const first = f[0];
  const last = f[f.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
  } else {
    if (document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

/* ---------------- Homepage lightbox ---------------- */
(function initLightbox() {
  const lightbox = $('#lightbox');
  if (!lightbox) return;
  const img = $('img', lightbox);
  const closeBtn = $('.lightbox-close', lightbox);
  let prevFocus = null;

  function open(src, alt) {
    img.src = src; img.alt = alt || '';
    lightbox.classList.add('show');
    document.body.classList.add('modal-open');
    prevFocus = document.activeElement;
    closeBtn.focus();
  }
  function close() {
    lightbox.classList.remove('show');
    document.body.classList.remove('modal-open');
    img.src = '';
    if (prevFocus && prevFocus.focus) prevFocus.focus();
  }

  $$('.glight').forEach((el) => {
    el.style.cursor = 'zoom-in';
    el.addEventListener('click', () => open(el.currentSrc || el.src, el.alt));
  });
  closeBtn.addEventListener('click', close);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) close(); });
  window.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('show')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') trapFocusKeydown(e, lightbox);
  });
})();

/* ---------------- Builds modal + slider (offset-based, clamped) ---------------- */
(function initBuildsModal() {
  const openers = $$('.open-build');
  if (!openers.length) return;

  const modals = new Map();

  function initModal(modal) {
    if (!modal || modals.has(modal)) return modals.get(modal);

    const track = $('.track', modal);
    const slides = $$('.slide', modal);
    const thumbs = $$('.thumb', modal);
    const prevBtn = $('.prev', modal);
    const nextBtn = $('.next', modal);
    const closeBtn = $('.build-close', modal);
    const counter = $('.counter', modal);

    let index = 0;
    let prevFocus = null;
    let offsets = [];

    function computeOffsets(){ offsets = slides.map(s => s.offsetLeft); }
    function setActiveThumb(){ thumbs.forEach((t,i)=>t.classList.toggle('active', i===index)); }
    function updateCounter(){ if (counter) counter.textContent = `${index+1} / ${slides.length}`; }

    function goTo(i, { smooth = true } = {}){
      index = Math.max(0, Math.min(i, slides.length-1));
      const x = offsets[index] || 0;
      track.style.transitionDuration = smooth ? '220ms' : '0ms';
      track.style.transform = `translate3d(${-x}px,0,0)`;
      setActiveThumb(); updateCounter();
      prevBtn?.toggleAttribute('disabled', index===0);
      nextBtn?.toggleAttribute('disabled', index===slides.length-1);
    }

    function open(at=0){
      computeOffsets(); goTo(at, { smooth:false });
      modal.classList.add('show'); document.body.classList.add('modal-open');
      prevFocus = document.activeElement; closeBtn.focus();
      requestAnimationFrame(()=>{ computeOffsets(); goTo(index, {smooth:false}); });
    }
    function close(){
      modal.classList.remove('show'); document.body.classList.remove('modal-open');
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    }

    prevBtn?.addEventListener('click', ()=>goTo(index-1));
    nextBtn?.addEventListener('click', ()=>goTo(index+1));
    closeBtn?.addEventListener('click', close);
    modal.addEventListener('click', (e)=>{ if(e.target===modal) close(); });

    thumbs.forEach((btn,i)=> btn.addEventListener('click', ()=> (modal.classList.contains('show') ? goTo(i) : open(i))));

    window.addEventListener('resize', ()=>{
      if(!modal.classList.contains('show')) return;
      const old = offsets[index]||0; computeOffsets(); const x = offsets[index]||0;
      goTo(index, { smooth: Math.abs(x-old) < 8 });
    });

    modal.addEventListener('keydown',(e)=>{
      if(e.key==='Escape') return close();
      if(e.key==='ArrowLeft') return goTo(index-1);
      if(e.key==='ArrowRight') return goTo(index+1);
      if(e.key==='Tab') return trapFocusKeydown(e, modal);
    });

    const api = { openAt: open, close, goTo };
    modals.set(modal, api); return api;
  }

  openers.forEach((btn)=>{
    const id = btn.getAttribute('data-build');
    const modal = document.getElementById(`build-${id}`);
    const api = initModal(modal);
    btn.addEventListener('click', ()=> api.openAt(0));
  });
})();
/* ==========================================================
   LAFAYETTE HOMES – HAMBURGER HEADER (NO HTML EDITS REQUIRED)
   How to use: paste this at the BOTTOM of main.js
   It will:
     • ensure <meta name="viewport"...> exists
     • inject all CSS for the header/drawer
     • create/replace a mobile-friendly header with a hamburger
     • wire up backdrop tap + Esc to close, lock body scroll
   ========================================================== */
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    ensureViewport();
    injectNavCSS();
    buildOrReplaceHeader();
    wireNav();
  });

  function ensureViewport() {
    const has = !!document.querySelector('meta[name="viewport"]');
    if (!has) {
      const m = document.createElement('meta');
      m.name = 'viewport';
      m.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
      document.head.appendChild(m);
    }
  }

  function injectNavCSS() {
    if (document.getElementById('lh-nav-style')) return;
    const css = `
:root { --gutter: 16px; --nav-w: 86vw; --drawer-bg:#111; }
@media (prefers-color-scheme: light){ :root { --drawer-bg:#fff; } }

html, body { max-width: 100%; overflow-x: hidden; }

/* Buttons (kept generic so it blends with your site) */
.lh-btn { display:inline-flex; align-items:center; justify-content:center; gap:.4rem;
  border-radius:12px; padding:10px 16px; font-weight:600; border:1px solid transparent; text-decoration:none; }
.lh-btn.small { padding:8px 12px; font-size:14px; }
.lh-btn.realtor { background:#0b5; color:#fff; }
.lh-theme-toggle { background:#eee; color:#111; border:1px solid rgba(0,0,0,.1); }
@media (prefers-color-scheme: dark){
  .lh-theme-toggle { background:#1d1d1d; color:#eee; border-color:rgba(255,255,255,.12); }
}

/* Header (desktop) */
.lh-header {
  position:relative; z-index:200; display:grid; grid-template-columns:auto 1fr auto;
  align-items:center; gap:16px; padding:12px var(--gutter); background:transparent;
}
.lh-logo { display:flex; align-items:center; gap:10px; text-decoration:none; color:inherit; }
.lh-logo img { height:32px; width:32px; border-radius:8px; }
.lh-logo-text { font-weight:800; font-size:18px; }
.lh-nav { display:flex; gap:16px; align-items:center; }
.lh-nav a { text-decoration:none; color:inherit; }

/* Hamburger button (hidden on desktop) */
.lh-hamburger { display:none; position:relative; width:42px; height:34px;
  border:1px solid rgba(0,0,0,.15); border-radius:10px; background:transparent; color:inherit; }
.lh-hamburger span { position:absolute; left:8px; right:8px; height:2px; background:currentColor; border-radius:2px; }
.lh-hamburger span:nth-child(1){ top:10px; } .lh-hamburger span:nth-child(2){ top:16px; } .lh-hamburger span:nth-child(3){ top:22px; }

/* Mobile drawer + backdrop + compact header */
@media (max-width: 900px){
  .lh-header { grid-template-columns:auto auto 1fr; padding:8px var(--gutter) 6px; }
  .lh-logo img { height:28px; width:28px; }
  .lh-logo-text { font-size:16px; }

  .lh-hamburger { display:inline-flex; align-items:center; justify-content:center; margin-left:auto; }

  .lh-nav {
    position:fixed; z-index:10001; top:0; right:0; height:100%;
    width:var(--nav-w); max-width:420px; background:var(--drawer-bg);
    border-left:1px solid rgba(255,255,255,.08);
    transform:translateX(100%); transition:transform .25s ease;
    display:flex; flex-direction:column; align-items:stretch; padding:18px;
    box-shadow:-20px 0 50px rgba(0,0,0,.35);
  }
  .lh-nav a { padding:12px 14px; border-radius:12px; font-size:16px; }
  .lh-nav a.lh-active { font-weight:800; }
  .lh-nav .lh-btn, .lh-nav .lh-theme-toggle { margin-top:8px; }

  .lh-nav-backdrop {
    position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:10000; backdrop-filter:blur(2px);
  }
  .lh-nav-backdrop[hidden] { display:none; }

  .lh-nav-open .lh-nav { transform:translateX(0); }
  .lh-no-scroll { overflow:hidden; }
}
    `.trim();
    const style = document.createElement('style');
    style.id = 'lh-nav-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildOrReplaceHeader() {
    // If a header exists, replace its innerHTML. If not, create one at top of body.
    let header = document.querySelector('header');
    const templateHTML = `
      <a class="lh-logo" href="/">
        <img src="/assets/logo.png" alt="Lafayette Homes">
        <span class="lh-logo-text">Lafayette Homes</span>
      </a>

      <button class="lh-hamburger" aria-label="Open menu" aria-expanded="false" aria-controls="lhPrimaryNav">
        <span></span><span></span><span></span>
      </button>

      <nav id="lhPrimaryNav" class="lh-nav" role="navigation" aria-label="Primary">
        <a href="/why.html">Why Lafayette</a>
        <a href="/plans.html">Plans</a>
        <a href="/available.html" class="lh-active">Available Homes</a>
        <a href="/process.html">Process</a>
        <a href="/gallery.html">Gallery</a>
        <a class="lh-btn small realtor" href="/realtor.html">Our Realtor</a>
        <button class="lh-btn small lh-theme-toggle" type="button" id="lhThemeToggle">Light</button>
      </nav>

      <div class="lh-nav-backdrop" hidden></div>
    `;

    if (!header) {
      header = document.createElement('header');
      document.body.prepend(header);
    }
    header.classList.add('lh-header');
    header.innerHTML = templateHTML;
  }

  function wireNav() {
    const html = document.documentElement;
    const btn = document.querySelector('.lh-hamburger');
    const nav = document.getElementById('lhPrimaryNav');
    const backdrop = document.querySelector('.lh-nav-backdrop');
    if (!btn || !nav || !backdrop) return;

    const open = () => {
      html.classList.add('lh-nav-open','lh-no-scroll');
      btn.setAttribute('aria-expanded','true');
      backdrop.hidden = false;
      (nav.querySelector('a,button,input,select,textarea') || btn).focus?.({preventScroll:true});
    };
    const close = () => {
      html.classList.remove('lh-nav-open','lh-no-scroll');
      btn.setAttribute('aria-expanded','false');
      backdrop.hidden = true;
      btn.focus?.({preventScroll:true});
    };

    btn.addEventListener('click', () => (btn.getAttribute('aria-expanded') === 'true' ? close() : open()));
    backdrop.addEventListener('click', close);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    // Close when a nav link (not theme toggle) is clicked
    nav.addEventListener('click', (e) => {
      const t = e.target.closest('a,button'); if (!t) return;
      if (t.id === 'lhThemeToggle') return; // keep drawer open for theme toggle
      close();
    });
  }
})();
