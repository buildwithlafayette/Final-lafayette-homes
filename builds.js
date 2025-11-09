(function () {
  let current = null; // selected home for modal (if you use one)

  /* ---------------- Init ---------------- */
  async function init() {
    const res = await fetch('availableHomes.json', { cache: 'no-store' });
    const homes = await res.json();

    // Sort by status then price (Available → Under Contract → Sold; high → low)
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
  }

  /* ---------------- Utils ---------------- */
  function money(n) {
    if (n === null || n === undefined || n === false) return 'TBD';
    const num = Number(n);
    if (Number.isNaN(num)) return 'TBD';
    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }
  function plural(n, w) { return (n == null) ? '' : `${n} ${w}${n === 1 ? '' : 's'}`; }

  /* ---------------- Card renderer ---------------- */
  function renderCard(h) {
    const photos = (h.photos || []).slice(0, 6);
    const first = photos[0] || '';
    return `
    <article class="lh-card" data-id="${h.id || ''}" tabindex="0" role="button" aria-label="View details for ${h.address || ''}">
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
          ${h.zillowUrl ? `<a class="lh-link" href="${h.zillowUrl}" target="_blank" rel="noreferrer">View on Zillow</a>` : ``}
          <button class="btn primary small schedule-card-btn" type="button">Schedule a Tour</button>
        </div>
      </div>
    </article>`;
  }

  /* ---------------- FIXED: Slider/Lightbox on each card ---------------- */
  function attachSliders() {
    document.querySelectorAll('.lh-photo-wrap').forEach(wrap => {
      // Read photo URLs from <template class="lh-photos"> so we get the actual nodes
      let spans = [];
      const tpl = wrap.querySelector('template.lh-photos');
      if (tpl && tpl.content) {
        spans = Array.from(tpl.content.querySelectorAll('span'));
      } else {
        // Fallback (older markup)
        spans = Array.from(wrap.querySelectorAll('.lh-photos span'));
      }
      const photos = spans.map(s => (s.textContent || '').trim()).filter(Boolean);
      if (photos.length < 2) return;

      const img = wrap.querySelector('.lh-photo');
      const counter = wrap.querySelector('.lh-counter');
      let i = 0;

      const update = () => {
        if (!img) return;
        img.src = photos[i];
        img.alt = `Photo ${i + 1}`;
        if (counter) counter.textContent = `${i + 1}/${photos.length}`;
      };

      const prev = (e) => { if (e) e.stopPropagation(); i = (i - 1 + photos.length) % photos.length; update(); };
      const next = (e) => { if (e) e.stopPropagation(); i = (i + 1) % photos.length; update(); };

      const leftBtn = wrap.querySelector('.left');
      const rightBtn = wrap.querySelector('.right');
      if (leftBtn) leftBtn.addEventListener('click', prev);
      if (rightBtn) rightBtn.addEventListener('click', next);

      // Keyboard support when the slider has focus
      wrap.setAttribute('tabindex', '0');
      wrap.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
        if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      });
    });
  }

  /* ---------------- Open card (optional modal) ---------------- */
  function attachCardClicks(homes) {
    const byId = Object.fromEntries(homes.map(h => [h.id, h]));
    document.querySelectorAll('.lh-card').forEach(card => {
      const id = card.getAttribute('data-id');
      card.addEventListener('click', () => openModal(byId[id]));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(byId[id]); }
      });
    });
  }

  // If you have a modal with id="lh-modal", wire it here. Otherwise this is a no-op.
  function openModal(home) {
    current = home;
    const modal = document.getElementById('lh-modal');
    if (!modal) return; // nothing to do if you don't use a modal
    // Example minimal behavior:
    modal.classList.add('open');
    const close = modal.querySelector('.build-close');
    if (close) {
      close.addEventListener('click', () => modal.classList.remove('open'), { once: true });
    }
  }

  /* ---------------- Schedule button per card ---------------- */
  function attachScheduleButtons(homes) {
    const byId = Object.fromEntries(homes.map(h => [h.id, h]));
    document.querySelectorAll('.schedule-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const card = btn.closest('.lh-card');
        const id = card && card.getAttribute('data-id');

        // open collapsible schedule panel if present
        const panel = document.getElementById('schedule-tour');
        const toggle = document.getElementById('schedule-toggle');
        if (toggle && panel && panel.classList.contains('is-collapsed')) {
          toggle.click();
        }

        // prefill listing reference
        const ref = document.getElementById('listing-ref');
        const h = id && byId[id];
        if (ref && h) {
          ref.value = `${h.id} — ${h.address}, ${h.city || ''} ${h.state || ''}`.trim();
        }

        if (panel) {
          setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        }
      });
    });
  }

  /* ---------------- Realtor form (Netlify or custom) ---------------- */
  function wireForm() {
    const form = document.querySelector('.realtor-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      // Netlify forms will handle it if data-netlify="true" + proper attributes
      // If you want AJAX, implement here and preventDefault().
    });
  }

  /* ---------------- Start ---------------- */
  document.addEventListener('DOMContentLoaded', init);
})();
