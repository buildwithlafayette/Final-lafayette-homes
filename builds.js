(function () {
  let current = null;

  /* ---------------- Init ---------------- */
  async function init() {
    // Kill any stuck overlays (lightbox/modal) on first paint
    killStuckOverlays();

    const res = await fetch('availableHomes.json', { cache: 'no-store' });
    const homes = await res.json();

    const order = { "Available": 0, "Under Contract": 1, "Sold": 2 };
    homes.sort((a, b) => {
      const s = (order[a.status] ?? 9) - (order[b.status] ?? 9);
      if (s !== 0) return s;
      return ((b.price ?? -Infinity) - (a.price ?? -Infinity));
    });

    const grid = document.querySelector('.lh-grid');
    grid.innerHTML = homes.map(renderCard).join('');

    attachSliders();
    attachCardClicks(homes);
    attachScheduleButtons(homes);
    wireForm();

    // Also clear overlays when returning from external pages (e.g. Zillow)
    window.addEventListener('pageshow', killStuckOverlays);
  }

  /* ---------------- Utils ---------------- */
  function money(n) {
    if (n === null || n === undefined || n === false) return 'TBD';
    const num = Number(n);
    if (Number.isNaN(num)) return 'TBD';
    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }
  function plural(n, w) { return (n == null) ? '' : `${n} ${w}${n === 1 ? '' : 's'}`; }

  function killStuckOverlays() {
    const lb = document.getElementById('lightbox');
    if (lb) {
      lb.classList.remove('open', 'is-open', 'active');
      const img = lb.querySelector('img, .lightbox-img');
      if (img) img.removeAttribute('src');
    }
    const modal = document.getElementById('lh-modal');
    if (modal) modal.classList.remove('open', 'is-open', 'active');
    document.body.classList.remove('modal-open', 'no-scroll');
  }

  /* ---------------- Card renderer ---------------- */
  function renderCard(h) {
    const photos = (h.photos || []).slice(0, 6);
    const first = photos[0] || '';
    return `
    <article class="lh-card" data-id="${h.id || ''}" tabindex="0" role="button" aria-label="View details for ${h.address || ''}">
      <div class="lh-status">${h.status || ''}</div>

      <div class="lh-photo-wrap" data-index="0" data-count="${photos.length}">
        ${first
          ? `<img class="lh-photo glight" src="${first}" alt="Photo 1 of ${h.address || ''}">`
          : `<div class="lh-photo">No photos</div>`}
        ${photos.length > 1 ? `
          <button class="lh-arrow left" aria-label="Previous photo">‹</button>
          <button class="lh-arrow right" aria-label="Next photo">›</button>
          <div class="lh-counter">1/${photos.length}</div>
        ` : ''}
        <template class="lh-photos">${photos.map(p => `<span>${p}</span>`).join('')}</template>
      </div>

      <div class="lh-body">
        <div class="lh-price">${money(h.price)}</div>
        <div class="lh-title">${h.address || ''}</div>
        <div class="lh-subtitle">${h.city || ''}, ${h.state || ''} ${h.zipcode || ''}</div>

        <div class="lh-meta">
          ${h.beds != null ? `<span>${plural(h.beds, 'Bed')}</span><span>•</span>` : ``}
          ${h.baths != null ? `<span>${plural(h.baths, 'Bath')}</span><span>•</span>` : ``}
          ${h.sqft != null ? `<span>${Number(h.sqft).toLocaleString()} sqft</span>` : ``}
        </div>

        <div class="lh-links">
          ${h.mlsNumber ? `<span class="lh-chip">MLS #${h.mlsNumber}</span>` : ``}
          ${h.zillowUrl ? `<a class="lh-link" href="${h.zillowUrl}" target="_blank" rel="noreferrer">View on Zillow</a>` : ``}
          <button class="btn primary small schedule-card-btn" type="button">Schedule a Tour</button>
        </div>
      </div>
    </article>`;
  }

  /* ---------------- Slider (fixed) ---------------- */
  function attachSliders() {
    document.querySelectorAll('.lh-photo-wrap').forEach(wrap => {
      let spans = [];
      const tpl = wrap.querySelector('template.lh-photos');
      if (tpl && tpl.content) spans = Array.from(tpl.content.querySelectorAll('span'));
      else spans = Array.from(wrap.querySelectorAll('.lh-photos span'));
      const photos = spans.map(s => (s.textContent || '').trim()).filter(Boolean);
      if (photos.length < 2) {
        // still stop card clicks from hijacking image
        const imgSolo = wrap.querySelector('.lh-photo');
        if (imgSolo) imgSolo.addEventListener('click', e => e.stopPropagation());
        return;
      }

      const img = wrap.querySelector('.lh-photo');
      const counter = wrap.querySelector('.lh-counter');
      let i = 0;

      const update = () => {
        if (!img) return;
        img.src = photos[i];
        img.classList.add('glight');
        img.alt = `Photo ${i + 1}`;
        if (counter) counter.textContent = `${i + 1}/${photos.length}`;
      };

      const prev = (e) => { if (e) e.stopPropagation(); i = (i - 1 + photos.length) % photos.length; update(); };
      const next = (e) => { if (e) e.stopPropagation(); i = (i + 1) % photos.length; update(); };

      const leftBtn = wrap.querySelector('.left');
      const rightBtn = wrap.querySelector('.right');
      if (leftBtn) leftBtn.addEventListener('click', prev);
      if (rightBtn) rightBtn.addEventListener('click', next);

      // Prevent clicks inside the photo area from bubbling to the card
      wrap.addEventListener('click', e => {
        const t = e.target;
        if (t.closest('.lh-arrow') || t.classList.contains('lh-photo')) {
          e.stopPropagation();
        }
      });

      // Keyboard support
      wrap.setAttribute('tabindex', '0');
      wrap.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
        if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      });
    });
  }

  /* ---------------- Card clicks (guarded) ---------------- */
  function attachCardClicks(homes) {
    const modalExists = !!document.getElementById('lh-modal');
    const byId = Object.fromEntries(homes.map(h => [h.id, h]));

    document.querySelectorAll('.lh-card').forEach(card => {
      // Stop bubbling from controls so they don't trigger the card click
      card.querySelectorAll('a, button, .lh-arrow, .lh-photo').forEach(el => {
        el.addEventListener('click', e => e.stopPropagation());
      });

      if (!modalExists) return; // no modal on this page

      card.addEventListener('click', (e) => {
        const target = e.target;
        // Ignore clicks on controls/images
        if (target.closest('a') || target.closest('button') || target.closest('.lh-arrow') || target.classList.contains('lh-photo')) {
          return;
        }
        const id = card.getAttribute('data-id');
        openModal(byId[id]);
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          // Only open if not on a control
          const active = document.activeElement;
          if (active && (active.closest('a') || active.closest('button'))) return;
          if (!modalExists) return;
          e.preventDefault();
          const id = card.getAttribute('data-id');
          openModal(byId[id]);
        }
      });
    });
  }

  function openModal(home) {
    current = home;
    const modal = document.getElementById('lh-modal');
    if (!modal) return;
    modal.classList.add('open');
    const close = modal.querySelector('.build-close,.lh-modal-close,[data-close]');
    if (close) close.addEventListener('click', () => modal.classList.remove('open'), { once: true });
  }

  /* ---------------- Schedule button ---------------- */
  function attachScheduleButtons(homes) {
    const byId = Object.fromEntries(homes.map(h => [h.id, h]));
    document.querySelectorAll('.schedule-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); // don’t let the card click fire
        const card = btn.closest('.lh-card');
        const id = card && card.getAttribute('data-id');

        const panel = document.getElementById('schedule-tour');
        const toggle = document.getElementById('schedule-toggle');
        if (toggle && panel && panel.classList.contains('is-collapsed')) {
          toggle.click();
        }

        const ref = document.getElementById('listing-ref');
        const h = id && byId[id];
        if (ref && h) {
          ref.value = `${h.id} — ${h.address}, ${h.city || ''} ${h.state || ''}`.trim();
        }

        if (panel) setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      });
    });
  }

  /* ---------------- Realtor form ---------------- */
  function wireForm() {
    const form = document.querySelector('.realtor-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      // Netlify handles posts if data-netlify attrs are present.
    });
  }

  /* ---------------- Start ---------------- */
  document.addEventListener('DOMContentLoaded', init);
})();
