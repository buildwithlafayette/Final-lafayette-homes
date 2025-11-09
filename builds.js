/* ==========================
   Lafayette Homes – builds.js
   Layout: big image left, details right, single lightbox
   Status colors: Available=green, Under Contract=yellow, Sold=red
   Mobile: swipe left/right, backdrop tap to close, fixed close button
   CTA: bottom Schedule button always navigates to schedule.html
   Zillow button: brand blue so it stands out in Light mode
   ========================== */

(function () {
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    injectCSS(); // modal styles + mobile tweaks + Zillow button

    // Load listings
    const res = await fetch('availableHomes.json', { cache: 'no-store' });
    const homes = await res.json();

    // Sort: Available → Under Contract → Sold, then price desc
    const order = { 'Available': 0, 'Under Contract': 1, 'Sold': 2 };
    homes.sort((a, b) => {
      const s = (order[a.status] ?? 9) - (order[b.status] ?? 9);
      if (s !== 0) return s;
      return (b.price ?? 0) - (a.price ?? 0);
    });

    // Render cards
    const grid = document.querySelector('.lh-grid');
    if (!grid) return;
    grid.innerHTML = homes.map(renderCard).join('');

    // Wire cards → open modal at image 0
    const idMap = Object.fromEntries(homes.map(h => [String(h.id), h]));
    grid.querySelectorAll('.lh-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const home = idMap[id];
        if (!home) return;
        openModal(home, 0);
      });
      // View Photos button (stops click-through to card)
      card.querySelector('.view-photos')?.addEventListener('click', e => {
        e.stopPropagation();
        const id = card.getAttribute('data-id');
        const home = idMap[id];
        if (!home) return;
        openModal(home, 0);
      });
    });

    // Keep the bottom-page CTA reliable
    wireScheduleCTAs();
  }

  function wireScheduleCTAs() {
    // anything that looks like the bottom CTA will just go to schedule.html
    document.querySelectorAll(
      '#schedule-toggle, .schedule-cta, .cta-schedule, a[href="#schedule"]'
    ).forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = 'schedule.html';
      });
    });
  }

  /* ---------- card markup ---------- */
  function getStatusClass(status) {
    const s = (status || '').toLowerCase();
    if (s === 'sold') return 'sold';
    if (s === 'under contract' || s === 'under-contract') return 'under-contract';
    return 'available';
  }

  function renderCard(h) {
    const photos = (h.photos || []).slice();
    const first = photos[0] || '';
    const statusClass = h.status ? getStatusClass(h.status) : '';

    return `
      <article class="lh-card" data-id="${h.id || ''}" tabindex="0" aria-label="${h.address || ''}">
        ${h.status ? `<div class="lh-status ${statusClass}">${h.status}</div>` : ``}

        <div class="lh-card-media">
          <div class="lh-thumb aspect-16x9">
            ${first ? `<img src="${first}" alt="${h.address || ''}" class="fit-cover">`
                     : `<div class="fit-cover"></div>`}
          </div>
        </div>

        <div class="lh-card-body">
          <h3 class="lh-card-title">${h.address || ''}</h3>
          <div class="lh-card-sub">${[h.city, h.state].filter(Boolean).join(', ')} ${h.zipcode || ''}</div>
          <div class="lh-card-meta">
            <strong>${money(h.price)}</strong>
            ${h.beds != null ? ` • ${h.beds} bd` : ``}
            ${h.baths != null ? ` • ${h.baths} ba` : ``}
            ${h.sqft  != null ? ` • ${Number(h.sqft).toLocaleString()} sqft` : ``}
          </div>

          <div class="lh-card-actions">
            ${h.zillowUrl ? `<a class="btn zillow" href="${h.zillowUrl}" target="_blank" rel="noreferrer">View on Zillow</a>` : ``}
            <button class="btn primary view-photos" type="button">View Photos</button>
          </div>
        </div>
      </article>
    `;
  }

  function money(n) {
    if (n == null || n === false) return 'TBD';
    const x = Number(n);
    return Number.isNaN(x) ? 'TBD' :
      x.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }

  /* ----------------------- modal ----------------------- */
  function openModal(home, startIndex) {
    closeModal(); // ensure only one

    const photos = (home.photos || []).slice();
    const count = Math.max(photos.length, 1);
    let index = Math.min(Math.max(startIndex || 0, 0), count - 1);

    const root = document.createElement('div');
    root.id = 'lh-lightbox';
    root.innerHTML = `
      <div class="lb-overlay" data-close="1"></div>

      <!-- fixed close button (viewport top-right) -->
      <button class="lb-close-fixed" aria-label="Close" data-close="1">×</button>

      <div class="lb-shell" role="dialog" aria-modal="true" aria-label="${home.address || 'Listing'}">
        <!-- LEFT: image stage -->
        <div class="lb-stage">
          <div class="lb-stage-inner aspect-16x9">
            ${count ? `<img class="lb-img fit-cover" src="${photos[index]}" alt="Photo ${index + 1}">`
                    : `<div class="lb-img fit-cover"></div>`}
            ${count > 1 ? `
              <button class="lb-arrow lb-left" aria-label="Previous">‹</button>
              <button class="lb-arrow lb-right" aria-label="Next">›</button>
              <div class="lb-counter">${index + 1}/${count}</div>
            ` : ``}
          </div>
        </div>

        <!-- RIGHT: details panel -->
        <aside class="lb-panel">
          <h2 class="lb-title">${home.address || ''}</h2>
          <div class="lb-sub">${[home.city, home.state].filter(Boolean).join(', ')} ${home.zipcode || ''}</div>
          <div class="lb-meta">
            <div class="lb-price">${money(home.price)}</div>
            <div class="lb-specs">
              ${home.beds != null ? `<span>${home.beds} bd</span>` : ``}
              ${home.baths != null ? `<span>• ${home.baths} ba</span>` : ``}
              ${home.sqft  != null ? `<span>• ${Number(home.sqft).toLocaleString()} sqft</span>` : ``}
            </div>
          </div>
          <div class="lb-actions">
            ${home.zillowUrl ? `<a class="btn zillow" href="${home.zillowUrl}" target="_blank" rel="noreferrer">View on Zillow</a>` : ``}
            <a class="btn primary" href="schedule.html">Schedule a Tour</a>
          </div>
        </aside>
      </div>
    `;

    document.body.appendChild(root);
    document.documentElement.classList.add('lb-noscroll');

    const imgEl = root.querySelector('.lb-img');
    const ctrEl = root.querySelector('.lb-counter');
    const left  = root.querySelector('.lb-left');
    const right = root.querySelector('.lb-right');
    const stage = root.querySelector('.lb-stage-inner');

    function show(i) {
      index = (i + count) % count;
      if (imgEl) imgEl.src = photos[index] || '';
      if (ctrEl) ctrEl.textContent = `${index + 1}/${count}`;
    }

    left?.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); show(index - 1); });
    right?.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); show(index + 1); });

    // close on overlay or fixed X tap
    root.querySelectorAll('[data-close="1"]').forEach(el =>
      el.addEventListener('click', closeModal)
    );

    // keyboard
    const keyHandler = (e) => {
      if (!document.getElementById('lh-lightbox')) {
        window.removeEventListener('keydown', keyHandler);
        return;
      }
      if (e.key === 'Escape') closeModal();
      if (e.key === 'ArrowRight' && count > 1) show(index + 1);
      if (e.key === 'ArrowLeft'  && count > 1) show(index - 1);
    };
    window.addEventListener('keydown', keyHandler);

    // --- TOUCH / SWIPE on mobile (and pointer fallback) ---
    if (stage && count > 1) {
      let startX = 0, lastX = 0, active = false, startTime = 0;

      const getX = (ev) =>
        ev.touches && ev.touches.length ? ev.touches[0].clientX : ev.clientX;

      const onStart = (ev) => {
        active = true;
        startX = lastX = getX(ev);
        startTime = Date.now();
      };
      const onMove = (ev) => {
        if (!active) return;
        lastX = getX(ev);
      };
      const onEnd = () => {
        if (!active) return;
        active = false;
        const dx = lastX - startX;
        const dt = Date.now() - startTime;

        const fast = Math.abs(dx) > 25 && dt < 250;
        const long = Math.abs(dx) > 60;
        if (fast || long) {
          if (dx < 0) show(index + 1);
          else show(index - 1);
        }
      };

      stage.addEventListener('touchstart', onStart, { passive: true });
      stage.addEventListener('touchmove', onMove,  { passive: true });
      stage.addEventListener('touchend',  onEnd,   { passive: true });

      stage.addEventListener('pointerdown', onStart);
      stage.addEventListener('pointermove', onMove);
      stage.addEventListener('pointerup',   onEnd);
      stage.addEventListener('pointercancel', onEnd);
    }
  }

  function closeModal() {
    document.getElementById('lh-lightbox')?.remove();
    document.documentElement.classList.remove('lb-noscroll');
  }

  /* ----------------------- CSS injector ----------------------- */
  function injectCSS() {
    if (document.getElementById('lb-style')) return;
    const css = `
      /* basic buttons */
      .btn { display:inline-flex; align-items:center; justify-content:center; border-radius:12px; padding:10px 16px; font-weight:600; border:1px solid transparent; }
      .btn.primary { background:#fff; color:#0c0c0c; }

      /* Zillow brand button (pops in light mode, still strong in dark) */
      .btn.zillow {
        background:#006AFF;           /* Zillow blue */
        color:#fff;
        border-color:rgba(0,0,0,0); 
      }
      .btn.zillow:hover { filter:brightness(0.95); }
      .btn.zillow:active { transform: translateY(1px); }
      .btn.zillow:focus { outline:2px solid rgba(0,106,255,.35); outline-offset:2px; }

      /* legacy ghost kept for other places, but not used for Zillow anymore */
      .btn.ghost { background:transparent; border-color:rgba(255,255,255,.12); color:#cfcfcf; }
      @media (prefers-color-scheme: light) {
        .btn.ghost { border-color:rgba(0,0,0,.12); color:#333; }
      }

      /* grid thumbs */
      .aspect-16x9 { position:relative; width:100%; padding-top:56.25%; overflow:hidden; border-radius:20px; }
      .fit-cover { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; background:#111; }

      .lh-card { position:relative; background:#121212; border:1px solid rgba(255,255,255,.08); border-radius:22px; overflow:hidden; cursor:pointer; box-shadow:0 10px 30px rgba(0,0,0,.25); }
      .lh-card-body { padding:16px; }
      .lh-card-title { font-size:20px; font-weight:800; color:#fff; margin:0 0 4px; }
      .lh-card-sub { color:#bbb; font-size:14px; margin-bottom:6px; }
      .lh-card-meta { color:#cfcfcf; font-size:14px; margin-bottom:12px; }
      .lh-card-actions { display:flex; gap:10px; flex-wrap:wrap; }

      /* Status badge */
      .lh-status { position:absolute; top:10px; left:10px; z-index:1; padding:6px 10px; border-radius:999px; font-size:12px; font-weight:800; border:1px solid transparent; }
      .lh-status.available { background:rgba(20,175,90,.18); border-color:rgba(20,175,90,.25); color:#9cf0bd; }
      .lh-status.under-contract { background:rgba(255,213,0,.18); border-color:rgba(255,213,0,.35); color:#ffe37a; }
      .lh-status.sold { background:rgba(255,60,60,.18); border-color:rgba(255,60,60,.35); color:#ff9a9a; }

      /* Lightbox root */
      .lb-noscroll { overflow:hidden; }
      #lh-lightbox { position:fixed; inset:0; z-index:9999; }
      #lh-lightbox .lb-overlay { position:absolute; inset:0; background:rgba(0,0,0,.75); backdrop-filter:blur(2px); }

      /* Fixed close button (viewport) */
      .lb-close-fixed {
        position:fixed; top:14px; right:14px; z-index:10000;
        width:40px; height:40px; border-radius:999px;
        border:1px solid rgba(255,255,255,.22);
        background:rgba(0,0,0,.60); color:#fff; font-size:22px; line-height:36px; text-align:center;
      }

      #lh-lightbox .lb-shell { position:absolute; inset:40px; display:flex; gap:24px; }

      /* Left: image */
      .lb-stage { flex: 2 1 66%; min-width: 0; display:flex; align-items:center; justify-content:center; }
      .lb-stage-inner { position:relative; width:100%; max-height:calc(100vh - 160px); border-radius:20px; overflow:hidden; background:#0b0b0b; touch-action: pan-y; }
      .lb-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }

      /* Arrows + counter on image */
      .lb-arrow { position:absolute; top:50%; transform:translateY(-50%); width:44px; height:44px; border-radius:999px; border:1px solid rgba(255,255,255,.18); background:rgba(0,0,0,.35); color:#fff; font-size:26px; line-height:40px; text-align:center; cursor:pointer; }
      .lb-left  { left:12px; }
      .lb-right { right:12px; }
      .lb-counter { position:absolute; right:12px; bottom:12px; background:rgba(0,0,0,.5); color:#fff; font-weight:700; padding:6px 10px; border-radius:999px; font-size:12px; border:1px solid rgba(255,255,255,.18); }

      /* Right: panel */
      .lb-panel { flex:1 1 34%; background:#1a1a1a; border:1px solid rgba(255,255,255,.09); border-radius:20px; padding:22px; color:#eaeaea; position:relative; }
      .lb-title { font-size:28px; font-weight:900; margin:4px 0 6px; color:#fff; }
      .lb-sub { color:#bdbdbd; margin-bottom:12px; }
      .lb-meta { margin:12px 0 18px; }
      .lb-price { font-size:20px; font-weight:800; margin-bottom:6px; }
      .lb-specs span { color:#d0d0d0; margin-right:8px; }
      .lb-actions { display:flex; gap:10px; flex-wrap:wrap; }

      /* Mobile modal polish */
      @media (max-width: 1024px) {
        #lh-lightbox .lb-shell { inset:20px; flex-direction:column; gap:16px; }
        .lb-stage-inner { max-height:calc(100vh - 240px); border-radius:16px; }
        .lb-panel { width:100%; padding:16px; border-radius:16px; }
        .lb-title { font-size:24px; }
        .btn { padding:9px 14px; }
      }
      @media (max-width: 480px) {
        #lh-lightbox .lb-shell { inset:12px; }
        .lb-close-fixed { top:10px; right:10px; width:36px; height:36px; font-size:20px; line-height:34px; }
        .lb-arrow { width:38px; height:38px; font-size:22px; }
        .lb-counter { font-size:11px; padding:5px 9px; }
      }
    `.trim();
    const style = document.createElement('style');
    style.id = 'lb-style';
    style.textContent = css;
    document.head.appendChild(style);
  }
})();
