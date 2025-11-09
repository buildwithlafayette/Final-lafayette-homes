/* ===== Hamburger Nav logic ===== */
(function () {
  const html = document.documentElement;
  const btn = document.querySelector('.hamburger');
  const nav = document.getElementById('primaryNav');
  const backdrop = document.querySelector('.nav-backdrop');
  if (!btn || !nav || !backdrop) return;

  const open = () => {
    html.classList.add('nav-open');
    html.classList.add('no-scroll');
    btn.setAttribute('aria-expanded', 'true');
    backdrop.hidden = false;
    // focus first interactive element
    (nav.querySelector('a,button,input,select,textarea') || btn).focus({ preventScroll:true });
  };

  const close = () => {
    html.classList.remove('nav-open');
    html.classList.remove('no-scroll');
    btn.setAttribute('aria-expanded', 'false');
    backdrop.hidden = true;
    btn.focus({ preventScroll:true });
  };

  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    expanded ? close() : open();
  });

  // Tap backdrop to close
  backdrop.addEventListener('click', close);

  // ESC to close
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  // Close when a nav link (not theme toggle) is clicked
  nav.addEventListener('click', (e) => {
    const t = e.target.closest('a,button');
    if (!t) return;
    if (t.id === 'themeToggle') return; // keep drawer if toggling theme
    close();
  });
})();
