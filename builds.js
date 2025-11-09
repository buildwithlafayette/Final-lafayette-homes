(function () {
  /* ---------------- Init ---------------- */
  async function init() {
    clearStuckOverlays();

    const res = await fetch('availableHomes.json', { cache: 'no-store' });
    const homes = await res.json();

    // Sort: Available → Under Contract → Sold; then by price desc
    const order = { "Available": 0, "Under Contract": 1, "Sold": 2 };
    homes.sort((a, b) => {
      const s = (order[a.status] ?? 9) - (order[b.status] ?? 9);
      if (s !== 0) return s;
      return ((b.price ?? -Infinity) - (a.price ?? -Infinity));
    });

    const grid = document.querySelector('.lh-grid');
    grid.innerHTML = homes.map(renderCard).join('');

    attachSliders();               // photo arrows + keyboard + lightbox on photo
    attachScheduleButtons(homes);  // per-card Schedule buttons
    attachBottomScheduleCta();     // bottom page Schedule button (generic)
    wireForm();

    window.addEventListener('pageshow', clearStuckOverlays);
  }

  /* ---------------- Utils ---------------- */
  function money(n) {
    if (n === null || n === undefined || n === false) return 'TBD';
    const num = Number(n);
    if (Number.isNaN(num)) return 'TBD';
    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }
  function plural(n, w) { return (n == null) ? '' : `${n} ${w}${n === 1 ? '' : 's'}`; }

  function clearStuckOverlays() {
    const lb = document.getElementById('lightbox');
    if (lb) {
      lb.classList.remove('open', 'is-open', 'active');
      const img = lb.querySelector('img, .lightbox-img');
      if (img) img.removeAttribute('src');
    }
    // Nuke any generic modal classes just in case
    const modal = document.getElementById('lh-modal');
    if (modal) modal.classList.remove('open', 'is-open', 'active');
    document.body.classList.remove('modal-open', 'no-scroll');
  }

  /* ---------------- Card renderer ---------------- */
  function renderCard(h) {
    const photos = (h.photos || []).slice(0, 6);
    const first = photos[0] || '';
    return `
    <article class="lh-card" data-id="${h.id || ''}">
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

  /* ---------------- Slider (NO card modal at all) ---------------- */
  function attachSliders() {
    document.querySelectorAll('.lh-photo-wrap').forEach(wrap => {
      // Read photo URLs from the template
      let spans = [];
      const tpl = wrap.querySelector('template.lh-photos');
      if (tpl && tpl.content) spans = Array.from(tpl.content.querySelectorAll('span'));
      else spans = Array.from(wrap.querySelectorAll('.lh-photos span'));
      const photos = spans.map(s => (s.textContent || '').trim()).filter(Boolean);

      const img = wrap.querySelector('.lh-photo');
      const counter = wrap.querySelector('.lh-counter');

      // Don’t let slider clicks trigger anything else
      wrap.addEventListener('click', (e) => {
        if (e.target.closest('.lh-arrow') || e.target.classList.contains('lh-photo')) e.stopPropagation();
      });

      if (photos.length < 2) {
        if (img) img.addEventListener('click', e => e.stopPropagation()); // allow lightbox only
        return;
      }

      let i = 0;
      const update = () => {
        if (!img) return;
        img.src = photos[i];
        img.classList.add('glight'); // keep lightbox
        img.alt = `Photo ${i + 1}`;
        if (counter) counter.textContent = `${i + 1}/${photos.length}`;
      };
      const prev = (e) => { if (e) e.stopPropagation(); i = (i - 1 + photos.length) % photos.length; update(); };
      const next = (e) => { if (e) e.stopPropagation(); i = (i + 1) % photos.length; update(); };

      const leftBtn = wrap.querySelector('.left');
      const rightBtn = wrap.querySelector('.right');
      if (leftBtn) leftBtn.addEventListener('click', prev);
      if (rightBtn) rightBtn.addEventListener('click', next);

      // Keyboard support
      wrap.setAttribute('tabindex', '0');
      wrap.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
        if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      });
    });
  }

  /* ---------------- Per-card “Schedule a Tour” ---------------- */
  function attachScheduleButtons(homes) {
    const byId = Object.fromEntries(homes.map(h => [h.id, h]));

    document.querySelectorAll('.schedule-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const card = btn.closest('.lh-card');
        const id = card && card.getAttribute('data-id');
        const h = id && byId[id];

        openSchedulePanel(h);
      });
    });
  }

  /* ---------------- Bottom-page Schedule CTA (fixed) ---------------- */
  function attachBottomScheduleCta() {
    // 1) Try specific selectors if you add one later
    let ctas = Array.from(document.querySelectorAll('#schedule-cta, .schedule-cta, [data-schedule], a[href="#schedule"]'));

    // 2) Fallback: any visible button/link with text "Schedule a Tour" that is NOT inside a card
    if (ctas.length === 0) {
      ctas = Array.from(document.querySelectorAll('button, a')).filter(el => {
        if (el.closest('.lh-card')) return false;                   // not a card button
        const t = (el.textContent || el.innerText || '').trim().toLowerCase();
        return t === 'schedule a tour';
      });
    }

    ctas.forEach(cta => {
      cta.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openSchedulePanel(null); // generic CTA (no listing prefill)
      });
    });
  }

  /* ---------------- Open/scroll/prefill schedule section ---------------- */
  function openSchedulePanel(home) {
    const panel = document.getElementById('schedule-tour')
               || document.querySelector('[data-section="schedule"]')
               || document.querySelector('#schedule');
    const toggle = document.getElementById('schedule-toggle')
               || document.querySelector('[data-toggle="schedule"]');

    // Open collapsible if needed
    if (toggle && panel && (panel.classList.contains('is-collapsed') || panel.hidden)) {
      toggle.click();
    }
    if (panel) {
      panel.classList.remove('is-collapsed', 'hidden');
      panel.hidden = false;
    }

    // Prefill reference if we have a listing
    const ref = document.getElementById('listing-ref')
              || document.querySelector('input[name="listing"], input[name="listingRef"]');
    if (ref) {
      if (home) {
        ref.value = `${home.id} — ${home.address}, ${home.city || ''} ${home.state || ''}`.trim();
      } else if (!ref.value) {
        ref.value = '';
      }
    }

    // Focus first field & scroll into view
    const firstInput = panel && panel.querySelector('input,textarea,select');
    if (firstInput) firstInput.focus({ preventScroll: true });
    if (panel) setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  /* ---------------- Realtor form ---------------- */
  function wireForm() {
    const form = document.querySelector('.realtor-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      // Netlify / backend handles submission if configured.
    });
  }

  /* ---------------- Start ---------------- */
  document.addEventListener('DOMContentLoaded', init);
})();
