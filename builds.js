(function () {
  /* ===================== INIT ===================== */
  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('pageshow', clearStuckOverlays);

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

    attachCardPhotoSliders();     // on-grid photo carousel
    attachCardModal(homes);       // FULL-SCREEN modal (restored)
    attachScheduleButtons(homes); // per-card schedule button
    attachBottomScheduleCta();    // bottom page schedule CTA
    wireForm();
  }

  /* ===================== UTIL ===================== */
  function money(n) {
    if (n === null || n === undefined || n === false) return 'TBD';
    const num = Number(n);
    if (Number.isNaN(num)) return 'TBD';
    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }
  function plural(n, w) { return (n == null) ? '' : `${n} ${w}${n === 1 ? '' : 's'}`; }

  function clearStuckOverlays() {
    const modal = document.getElementById('lh-modal');
    if (modal) modal.remove();
    document.body.classList.remove('modal-open', 'no-scroll');
  }

  /* ===================== CARD RENDER ===================== */
  function renderCard(h) {
    const photos = (h.photos || []).slice(0, 6);
    const first = photos[0] || '';
    return `
    <article class="lh-card" data-id="${h.id || ''}" tabindex="0" aria-label="Open details for ${h.address || ''}">
      <div class="lh-status">${h.status || ''}</div>

      <div class="lh-photo-wrap" data-index="0" data-count="${photos.length}">
        ${first
          ? `<img class="lh-photo" src="${first}" alt="Photo 1 of ${h.address || ''}">`
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
          ${h.zillowUrl ? `<a class="btn ghost small lh-zillow" href="${h.zillowUrl}" target="_blank" rel="noreferrer">View on Zillow</a>` : ``}
          <button class="btn primary small schedule-card-btn" type="button">Schedule a Tour</button>
        </div>
      </div>
    </article>`;
  }

  /* ===================== GRID SLIDER ===================== */
  function attachCardPhotoSliders() {
    document.querySelectorAll('.lh-photo-wrap').forEach(wrap => {
      let spans = [];
      const tpl = wrap.querySelector('template.lh-photos');
      if (tpl && tpl.content) spans = Array.from(tpl.content.querySelectorAll('span'));
      else spans = Array.from(wrap.querySelectorAll('.lh-photos span'));
      const photos = spans.map(s => (s.textContent || '').trim()).filter(Boolean);

      const img = wrap.querySelector('.lh-photo');
      const counter = wrap.querySelector('.lh-counter');

      wrap.addEventListener('click', (e) => {
        if (e.target.closest('.lh-arrow') || e.target.classList.contains('lh-photo')) e.stopPropagation();
      });

      if (photos.length < 2) return;

      let i = 0;
      const update = () => {
        if (!img) return;
        img.src = photos[i];
        img.alt = `Photo ${i + 1}`;
        if (counter) counter.textContent = `${i + 1}/${photos.length}`;
      };
      const prev = (e) => { if (e) e.stopPropagation(); i = (i - 1 + photos.length) % photos.length; update(); };
      const next = (e) => { if (e) e.stopPropagation(); i = (i + 1) % photos.length; update(); };

      wrap.querySelector('.left')?.addEventListener('click', prev);
      wrap.querySelector('.right')?.addEventListener('click', next);

      wrap.setAttribute('tabindex', '0');
      wrap.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
        if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      });
    });
  }

  /* ===================== FULL SCREEN MODAL ===================== */
  function attachCardModal(homes) {
    const byId = Object.fromEntries(homes.map(h => [h.id, h]));

    document.querySelectorAll('.lh-card').forEach(card => {
      // Don’t let inner controls trigger modal
      card.querySelectorAll('a, button, .lh-arrow, .lh-photo').forEach(el => {
        el.addEventListener('click', e => e.stopPropagation());
      });

      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const home = byId[id];
        if (home) openModal(home);
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const id = card.getAttribute('data-id');
          const home = byId[id];
          if (home) openModal(home);
        }
      });
    });
  }

  function openModal(home) {
    closeModal(); // clean slate

    const photos = (home.photos || []).slice();
    const count = photos.length || 1;
    let index = 0;

    const modal = document.createElement('div');
    modal.id = 'lh-modal';
    modal.className = 'lh-modal open';
    modal.innerHTML = `
      <div class="lh-modal-backdrop"></div>
      <div class="lh-modal-panel" role="dialog" aria-modal="true" aria-label="${home.address || 'Listing'}">
        <button class="lh-modal-close" aria-label="Close">×</button>

        <div class="lh-modal-grid">
          <div class="lh-modal-photo-wrap">
            <img class="lh-modal-photo" src="${photos[0] || ''}" alt="Photo 1">
            ${count > 1 ? `
              <button class="lh-arrow left" aria-label="Previous photo">‹</button>
              <button class="lh-arrow right" aria-label="Next photo">›</button>
              <div class="lh-counter">${1}/${count}</div>
            ` : ``}
          </div>

          <aside class="lh-modal-details">
            <h2 class="lh-modal-title">${home.address || ''}</h2>
            <div class="lh-modal-sub">${[home.city, home.state].filter(Boolean).join(', ')}${home.zipcode ? ' ' + home.zipcode : ''}</div>
            <div class="lh-modal-price">${money(home.price)}</div>
            <div class="lh-modal-meta">
              ${home.beds != null ? `<span>${plural(home.beds, 'bd')}</span>` : ``}
              ${home.baths != null ? `<span>• ${plural(home.baths, 'ba')}</span>` : ``}
              ${home.sqft != null ? `<span>• ${Number(home.sqft).toLocaleString()} sqft</span>` : ``}
            </div>
            <div class="lh-modal-links">
              ${home.zillowUrl ? `<a class="btn ghost" href="${home.zillowUrl}" target="_blank" rel="noreferrer">View on Zillow</a>` : ``}
              <button class="btn primary schedule-modal-btn" type="button">Schedule a Tour</button>
            </div>
          </aside>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    const img = modal.querySelector('.lh-modal-photo');
    const counter = modal.querySelector('.lh-counter');

    const update = () => {
      if (!img) return;
      img.src = photos[index] || '';
      img.alt = `Photo ${index + 1}`;
      if (counter) counter.textContent = `${index + 1}/${count}`;
    };
    const prev = () => { index = (index - 1 + count) % count; update(); };
    const next = () => { index = (index + 1) % count; update(); };

    modal.querySelector('.left')?.addEventListener('click', (e) => { e.stopPropagation(); prev(); });
    modal.querySelector('.right')?.addEventListener('click', (e) => { e.stopPropagation(); next(); });

    // Close handlers
    modal.querySelector('.lh-modal-close')?.addEventListener('click', closeModal);
    modal.querySelector('.lh-modal-backdrop')?.addEventListener('click', closeModal);
    document.addEventListener('keydown', escHandler);

    // Schedule from modal
    modal.querySelector('.schedule-modal-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      openSchedulePanel(home);
      closeModal();
    });

    function escHandler(e) {
      if (e.key === 'Escape') {
        closeModal();
      } else if (e.key === 'ArrowLeft') {
        prev();
      } else if (e.key === 'ArrowRight') {
        next();
      }
    }
  }

  function closeModal() {
    const modal = document.getElementById('lh-modal');
    if (modal) modal.remove();
    document.body.classList.remove('modal-open');
  }

  /* ===================== SCHEDULE BUTTONS ===================== */
  function attachScheduleButtons(homes) {
    const byId = Object.fromEntries(homes.map(h => [h.id, h]));
    document.querySelectorAll('.schedule-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const card = btn.closest('.lh-card');
        const id = card && card.getAttribute('data-id');
        const home = id && byId[id];
        openSchedulePanel(home);
      });
    });
  }

  function attachBottomScheduleCta() {
    // Prefer explicit hooks
    let ctas = Array.from(document.querySelectorAll('#schedule-cta, .schedule-cta, [data-schedule], a[href="#schedule"]'));
    if (ctas.length === 0) {
      // Fallback: any "Schedule a Tour" button/link NOT inside a card/modal
      ctas = Array.from(document.querySelectorAll('button, a')).filter(el => {
        if (el.closest('.lh-card') || el.closest('#lh-modal')) return false;
        const t = (el.textContent || el.innerText || '').trim().toLowerCase();
        return t === 'schedule a tour';
      });
    }
    ctas.forEach(cta => {
      cta.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openSchedulePanel(null);
      });
    });
  }

  function openSchedulePanel(home) {
    const panel = document.getElementById('schedule-tour')
               || document.querySelector('[data-section="schedule"]')
               || document.querySelector('#schedule');
    const toggle = document.getElementById('schedule-toggle')
               || document.querySelector('[data-toggle="schedule"]');

    if (toggle && panel && (panel.classList.contains('is-collapsed') || panel.hidden)) {
      toggle.click();
    }
    if (panel) {
      panel.classList.remove('is-collapsed', 'hidden');
      panel.hidden = false;
    }

    const ref = document.getElementById('listing-ref')
              || document.querySelector('input[name="listing"], input[name="listingRef"]');
    if (ref) {
      if (home) {
        ref.value = `${home.id || ''} — ${home.address || ''}${home.city ? ', ' + home.city : ''} ${home.state || ''}`.trim();
      } else if (!ref.value) {
        ref.value = '';
      }
    }

    const firstInput = panel && panel.querySelector('input,textarea,select,button');
    if (firstInput) firstInput.focus({ preventScroll: true });
    if (panel) setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  /* ===================== FORM (noop) ===================== */
  function wireForm() {
    const form = document.querySelector('.realtor-form');
    if (!form) return;
    form.addEventListener('submit', async () => {});
  }
})();
