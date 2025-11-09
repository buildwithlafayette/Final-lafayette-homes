
(function(){
  let current = null; // selected home for modal

  async function init(){
    const res = await fetch('availableHomes.json', {cache:'no-store'});
    const homes = await res.json();
    const order = { "Available": 0, "Under Contract": 1, "Sold": 2 };
    homes.sort((a,b)=>{
      const s=(order[a.status]??9)-(order[b.status]??9);
      if(s!==0) return s;
      // Prices may be null; push 'TBD' to the end within same status
      return ((b.price??-Infinity) - (a.price??-Infinity));
    });
    const grid = document.querySelector('.lh-grid');
    grid.innerHTML = homes.map(renderCard).join('');
    attachSliders();
    attachCardClicks(homes);
    attachScheduleButtons(homes);
    wireForm();
  }

  function money(n){
    if(n===null || n===undefined || n===false) return 'TBD';
    const num = Number(n);
    if(Number.isNaN(num)) return 'TBD';
    return num.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
  }
  function plural(n,w){ return (n==null) ? '' : `${n} ${w}${n===1?'':'s'}`; }

  function renderCard(h){
    const photos=(h.photos||[]).slice(0,6), first=photos[0]||'';
    return `
    <article class="lh-card" data-id="${h.id||''}" tabindex="0" role="button" aria-label="View details for ${h.address||''}">
      <div class="lh-status">${h.status||''}</div>
      <div class="lh-photo-wrap" data-index="0" data-count="${photos.length}">
        ${first? `<img class="lh-photo" src="${first}" alt="Photo 1 of ${h.address||''}">` : `<div class="lh-photo">No photos</div>`}
        ${photos.length>1?`
          <button class="lh-arrow left" aria-label="Previous photo">‹</button>
          <button class="lh-arrow right" aria-label="Next photo">›</button>
          <div class="lh-counter">1/${photos.length}</div>
        `:''}
        <template class="lh-photos">${photos.map(p=>`<span>${p}</span>`).join('')}</template>
      </div>
      <div class="lh-body">
        <div class="lh-price">${money(h.price)}</div>
        <div class="lh-title">${h.address||''}</div>
        <div class="lh-subtitle">${h.city||''}, ${h.state||''} ${h.zipcode||''}</div>
        <div class="lh-meta">
          ${h.beds!=null? `<span>${plural(h.beds,'Bed')}</span><span>•</span>` : ``}
          ${h.baths!=null? `<span>${plural(h.baths,'Bath')}</span><span>•</span>` : ``}
          ${h.sqft!=null? `<span>${Number(h.sqft).toLocaleString()} sqft</span>` : ``}
        </div>
        <div class="lh-links">
          ${h.mlsNumber? `<span class="lh-chip">MLS #${h.mlsNumber}</span>`:''}
          ${h.zillowUrl? `<a class="lh-link" href="${h.zillowUrl}" target="_blank" rel="noreferrer">View on Zillow</a>`:''}
          <button class="btn primary small schedule-card-btn" type="button">Schedule a Tour</button>
        </div>
      </div>
    </article>`;
  }

  function attachSliders(){
    document.querySelectorAll('.lh-photo-wrap').forEach(wrap=>{
      const spans = wrap.querySelectorAll('.lh-photos span');
      const photos = Array.from(spans).map(s=>s.textContent);
      if(photos.length<2) return;
      const img = wrap.querySelector('.lh-photo');
      const counter = wrap.querySelector('.lh-counter');
      let i=0;
      const update = ()=>{ img.src = photos[i]; img.alt = `Photo ${i+1}`; counter.textContent = `${i+1}/${photos.length}`; };
      wrap.querySelector('.left').addEventListener('click', (e)=>{ e.stopPropagation(); i=(i-1+photos.length)%photos.length; update(); });
      wrap.querySelector('.right').addEventListener('click', (e)=>{ e.stopPropagation(); i=(i+1)%photos.length; update(); });
    });
  }

  
  // Per-card "Schedule a Tour" button opens the collapsible panel and pre-fills the listing
  function attachScheduleButtons(homes){
    const byId = Object.fromEntries(homes.map(h=>[h.id, h]));
    document.querySelectorAll('.lh-card .schedule-card-btn').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        e.preventDefault();
        const card = btn.closest('.lh-card');
        const id = card && card.getAttribute('data-id');
        const panel = document.getElementById('schedule-tour');
        const toggle = document.getElementById('schedule-toggle');
        if(toggle && panel && panel.classList.contains('is-collapsed')){
          toggle.click();
        }
        // prefill listing reference
        const ref = document.getElementById('listing-ref');
        const h = id && byId[id];
        if(ref && h){
          ref.value = `${h.id} — ${h.address}, ${h.city} ${h.state}`;
        }
        if(panel){ setTimeout(()=>panel.scrollIntoView({behavior:'smooth', block:'start'}), 50); }
      });
    });
  }

function attachCardClicks(homes){
    const byId = Object.fromEntries(homes.map(h=>[h.id, h]));
    document.querySelectorAll('.lh-card').forEach(card=>{
      const id = card.getAttribute('data-id');
      card.addEventListener('click', ()=>openModal(byId[id]));
      card.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); openModal(byId[id]); } });
    });
  }

  // Modal logic
  function openModal(home){
    current = home;
    const modal = document.getElementById('lh-modal');
    const body = modal.querySelector('.lh-modal-body');
    const photos = (home.photos||[]);
    const first = photos[0]||'';
    body.innerHTML = `
      <div class="lh-modal-media">
        ${first? `<img class="lh-modal-photo" src="${first}" alt="Photo 1 of ${home.address||''}">` : ''}
        ${photos.length>1?`
          <button class="lh-marrow left" aria-label="Previous photo">‹</button>
          <button class="lh-marrow right" aria-label="Next photo">›</button>
          <div class="lh-mcounter">1/${photos.length}</div>
        `:''}
        <template class="lh-mphotos">${photos.map(p=>`<span>${p}</span>`).join('')}</template>
      </div>
      <div class="lh-modal-info">
        <h2>${home.address||''}</h2>
        <p class="lh-m-sub">${home.city||''}, ${home.state||''} ${home.zipcode||''}</p>
        <p class="lh-m-price">${money(home.price)}${home.beds!=null?` • ${home.beds} bd`:``}${home.baths!=null?` • ${home.baths} ba`:``}${home.sqft!=null?` • ${Number(home.sqft).toLocaleString()} sqft`:``}</p>
        <div class="lh-m-actions">
          
          ${home.zillowUrl? `<a class="btn outline" href="${home.zillowUrl}" target="_blank" rel="noreferrer">View on Zillow</a>`:''}
        </div>
      </div>
    `;
    // slider for modal
    const wrap = modal.querySelector('.lh-modal-media');
    const spans = wrap.querySelectorAll('.lh-mphotos span');
    const photosArr = Array.from(spans).map(s=>s.textContent);
    if(photosArr.length>1){
      const img = wrap.querySelector('.lh-modal-photo');
      const counter = wrap.querySelector('.lh-mcounter');
      let i=0;
      const update = ()=>{ img.src = photosArr[i]; img.alt = `Photo ${i+1}`; counter.textContent = `${i+1}/${photosArr.length}`; };
      wrap.querySelector('.left').addEventListener('click', ()=>{ i=(i-1+photosArr.length)%photosArr.length; update(); });
      wrap.querySelector('.right').addEventListener('click', ()=>{ i=(i+1)%photosArr.length; update(); });
    }
    // pre-fill form reference
    const ref = document.getElementById('listing-ref');
    if(ref){ ref.value = `${home.id} — ${home.address}, ${home.city} ${home.state}`; }
    // open
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    // schedule button scroll
    modal.querySelector('#lh-m-schedule').addEventListener('click', (e)=>{
      closeModal();
      const el = document.getElementById('schedule-tour');
      if(el){ el.scrollIntoView({behavior:'smooth', block:'start'}); }
    });
  }
  function closeModal(){
    const modal = document.getElementById('lh-modal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  function wireForm(){
    const modal = document.getElementById('lh-modal');
    modal.querySelector('.lh-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e)=>{ if(e.target===modal) closeModal(); });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

/* --- Toggle Schedule a Tour --- */
(function (){
  const btn = document.getElementById('schedule-toggle');
  const panel = document.getElementById('schedule-tour');
  if(!btn || !panel) return;
  const open = ()=>{
    panel.classList.remove('is-collapsed');
    panel.classList.add('is-open');
    btn.setAttribute('aria-expanded','true');
    // update hash for deep link
    if(location.hash !== '#schedule'){ history.replaceState(null,'', '#schedule'); }
    // scroll into view after expand
    setTimeout(()=>panel.scrollIntoView({behavior:'smooth', block:'start'}), 50);
  };
  const close = ()=>{
    panel.classList.remove('is-open');
    panel.classList.add('is-collapsed');
    btn.setAttribute('aria-expanded','false');
  };
  btn.addEventListener('click', (e)=>{
    e.preventDefault();
    if(panel.classList.contains('is-open')) close(); else open();
  });
  // Auto-open if #schedule is in URL
  if(location.hash === '#schedule'){ open(); }
})();

