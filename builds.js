/* Lafayette Homes – builds.js (single-file drop-in) */
(function () {
  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('pageshow', clearStuckOverlays);

  async function init() {
    clearStuckOverlays();

    const res = await fetch('availableHomes.json', { cache: 'no-store' });
    const homes = await res.json();

    // Order: Available → Under Contract → Sold; then by price desc
    const order = { "Available": 0, "Under Contract": 1, "Sold": 2 };
    homes.sort((a, b) => {
      const s = (order[a.status] ?? 9) - (order[b.status] ?? 9);
      if (s !== 0) return s;
      return (b.price ?? 0) - (a.price ?? 0);
    });

    const grid = document.querySelector('.lh-grid');
    grid.innerHTML = homes.map(renderCard).join('');

    // IMPORTANT: stop any image <a> / third-party lightbox from firing
    disableImageAnchors();

    attachCardPhotoSliders();
    attachCardModal(homes);
    attachScheduleButtons(homes);
    attachBottomScheduleCta();
    wireForm();
  }

  /* ---------------------- utilities ---------------------- */
  function money(n) {
    if (n === null || n === undefined || n === false) return 'TBD';
    const num = Number(n);
    if (Number.isNaN(num)) return 'TBD';
    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }
  function plural(n, w) { return (
    `${n} ${w}${Number(n) === 1 ? '' : 's'}`
  );}

  function clearStuckOverlays() {
    document.body.classList.remove('modal-open', 'no-scroll');
    closeModal();
  }

  /* -------------------- render cards --------------------- */
  function renderCard(h) {
    const photos = (h.photos || []).slice(0, 6);
    const first = photos[0] || '';
    return `
    <article class="lh-card" data-id="${h.id || ''}" tabindex="0" aria-label="Open details for ${h.address || ''}">
      ${h.status ? `<div class="lh-status">${h.status}</div>` : ``}

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
        <div class="lh-subtitle">${[h.city, h.state].filter(Boolean).join(', ')} ${h.zipcode || ''}</div>

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

  /* --------- block native image/lightbox behaviour -------- */
  function disableImageAnchors() {
    // 1) If images are wrapped in anchors to image files, unwrap them
    document.querySelectorAll('.lh-card .lh-photo-wrap a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (/\.(jpe?g|png|webp|gif|svg)(\?.*)?$/i.test(href)) {
        const kid = a.firstElementChild || a.firstChild;
        if (kid) a.replaceWith(kid); // keep the IMG, remove anchor
      }
    });

    // 2) Strip common lightbox data attributes
    document.querySelectorAll('.lh-card [data-lightbox],[data-fslightbox],[data-lity]').forEach(el => {
      el.removeAttribute('data-lightbox');
      el.removeAttribute('data-fslightbox');
      el.removeAttribute('data-lity');
    });

    // 3) Capture-phase guard: prevent any leftover image anchors in cards
    document.addEventListener('click', (e) => {
      const a = e.target.closest('.lh-card a[href]');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (/\.(jpe?g|png|webp|gif|svg)(\?.*)?$/i.test(href)) {
        e.preventDefault();
        e.stopPropagation();
        a.blur();
      }
    }, true);
  }

  /* ----------------- card photo slider ------------------- */
  function attachCardPhotoSliders() {
    document.querySelectorAll('.lh-card .lh-photo-wrap').forEach(wrap => {
      const list = Array.from(wrap.querySelectorAll('.lh-photos > span')).map(s => s.textContent || '');
      if (list.length <= 1) return;

      const img = wrap.querySelector('.lh-photo');
      const left = wrap.querySelector('.lh-arrow.left');
      const right = wrap.querySelector('.lh-arrow.right');
      const counter = wrap.querySelector('.lh-counter');

      let index = 0;
      function show(i) {
        index = (i + list.length) % list.length;
        if (img) img.src = list[index];
        if (counter) counter.textContent = `${index + 1}/${list.length}`;
        wrap.setAttribute('data-index', String(index));
      }

      left && left.addEventListener('click', (e) => {
        e.stopPropagation(); e.preventDefault(); show(index - 1);
      });
      right && right.addEventListener('click', (e) => {
        e.stopPropagation(); e.preventDefault(); show(index + 1);
      });

      // Click on image opens modal starting at current index
      wrap.addEventListener('click', (e) => {
        const card = wrap.closest('.lh-card');
        if (!card) return;
        const id = card.getAttribute('data-id');
        const home = findHomeById(id);
        if (!home) return;
        openModal(home, index);
      });

      function findHomeById(id) {
        const el = document.querySelector(`.lh-card[data-id="${id}"]`);
        if (!el) return null;
        // not storing globally here; actual openModal uses provided home object from attachCardModal map
        return null;
      }
    });
  }

  /* ------------------ open card modal -------------------- */
  function attachCardModal(homes) {
    const byId = Object.fromEntries(homes.map(h => [h.id, h]));

    // Click anywhere on card opens modal at image 0
    document.querySelectorAll('.lh-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const id = card.getAttribute('data-id');
        const home = byId[id];
        if (home) openModal(home, 0);
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

  function openModal(home, startIndex) {
    closeModal(); // clean slate

    const photos = (home.photos || []).slice();
    const count = photos.length || 1;
    let index = Math.max(0, Math.min(startIndex || 0, count - 1));

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
            <div class="lh-modal-subtitle">${[home.city, home.state].filter(Boolean).join(', ')} ${home.zipcode || ''}</div>
            <div class="lh-modal-price">${money(home.price)}</div>

            <ul class="lh-modal-meta">
              ${home.beds != null ? `<li>${plural(home.beds, 'Bed')}</li>` : ``}
              ${home.baths != null ? `<li>${plural(home.baths, 'Bath')}</li>` : ``}
              ${home.sqft != null ? `<li>${Number(home.sqft).toLocaleString()} sqft</li>` : ``}
            </ul>

            <div class="lh-modal-actions">
              ${home.zillowUrl ? `<a class="btn ghost" href="${home.zillowUrl}" target="_blank" rel="noreferrer">View on Zillow</a>` : ``}
              <a class="btn primary" href="schedule.html">Schedule a Tour</a>
            </div>
          </aside>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add('modal-open', 'no-scroll');

    // Keyboard + buttons
    modal.querySelector('.lh-modal-close')?.addEventListener('click', closeModal);
    modal.querySelector('.lh-modal-backdrop')?.addEventListener('click', closeModal);

    const img = modal.querySelector('.lh-modal-photo');
    const left = modal.querySelector('.lh-arrow.left');
    const right = modal.querySelector('.lh-arr
