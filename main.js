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