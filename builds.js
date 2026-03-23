/* builds.js v4 — Lafayette Homes
   Google Sheets CSV sync + local JSON fallback
   ─────────────────────────────────────────────────────────────────
   SETUP: Paste your published Google Sheet CSV URL into sheetUrl below.
   Leave empty to use availableHomes.json instead.
   ───────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const CONFIG = {
    sheetUrl: '',   // ← PASTE YOUR GOOGLE SHEET CSV URL HERE
    photoSep: '|',
  };
  const STATUS_ORDER = { 'for sale':0, 'available':0, 'under contract':1, 'sold':2 };

  async function loadHomes() {
    if (CONFIG.sheetUrl) {
      try { return await fetchSheet(CONFIG.sheetUrl); }
      catch (err) { console.warn('[Lafayette] Sheet failed, using JSON:', err); }
    }
    const res = await fetch('availableHomes.json', { cache:'no-store' });
    if (!res.ok) throw new Error('JSON fetch failed: ' + res.status);
    return res.json();
  }
  async function fetchSheet(url) {
    const res = await fetch(url, { cache:'no-store' });
    if (!res.ok) throw new Error('Sheet fetch ' + res.status);
    return parseCSV(await res.text());
  }
  function parseCSV(text) {
    const lines = text.split(/\r?\n/);
    const headers = parseLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g,''));
    const homes = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const vals = parseLine(line);
      const raw = {};
      headers.forEach((h, idx) => { raw[h] = (vals[idx] || '').trim(); });
      if (!raw.address) continue;
      const pn = v => { const n=Number(String(v||'').replace(/[^0-9.]/g,'')); return (isNaN(n)||String(v||'')==='') ? null : n; };
      homes.push({
        id: raw.id||'', address: raw.address, city: raw.city||'', state: raw.state||'',
        zipcode: raw.zipcode||'', beds: pn(raw.beds), baths: pn(raw.baths), sqft: pn(raw.sqft),
        price: pn(raw.price), status: raw.status||'',
        zillowUrl: raw.zillowurl||raw.zillow_url||'', mlsNumber: raw.mlsnumber||raw.mls_number||'',
        photos: raw.photos ? raw.photos.split(CONFIG.photoSep).map(p=>p.trim()).filter(Boolean) : [],
      });
    }
    return homes;
  }
  function parseLine(line) {
    const result=[]; let cur='', inQ=false;
    for (let i=0;i<line.length;i++) {
      const c=line[i];
      if (c==='"') { if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ; }
      else if (c===','&&!inQ) { result.push(cur); cur=''; }
      else cur+=c;
    }
    result.push(cur); return result;
  }
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  function money(n){if(n===null||n===undefined||isNaN(Number(n)))return 'Price TBD';return Number(n).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});}
  function statusInfo(raw){
    const s=(raw||'').toLowerCase().trim();
    if(s==='for sale'||s==='available') return {cls:'status-available',label:'For Sale'};
    if(s.includes('contract')) return {cls:'status-contract',label:'Under Contract'};
    if(s==='sold') return {cls:'status-sold',label:'Sold'};
    return {cls:'status-other',label:raw||''};
  }
  function sortHomes(homes){
    return [...homes].sort((a,b)=>{
      const sa=STATUS_ORDER[(a.status||'').toLowerCase()]??9;
      const sb=STATUS_ORDER[(b.status||'').toLowerCase()]??9;
      if(sa!==sb) return sa-sb;
      return (b.price??-Infinity)-(a.price??-Infinity);
    });
  }

  function renderCard(h){
    const photos=(h.photos||[]).slice(0,8), si=statusInfo(h.status);
    return `<article class="lh-card" data-id="${esc(h.id)}" tabindex="0" role="button" aria-label="View details for ${esc(h.address)}">
  <div class="lh-photo-wrap" data-index="0">
    ${photos[0]?`<img class="lh-photo" src="${esc(photos[0])}" alt="Front of ${esc(h.address)}" loading="lazy" />`:`<div class="lh-photo lh-photo--empty" aria-hidden="true"><span>No photo</span></div>`}
    ${photos.length>1?`<button class="lh-arrow lh-arrow--left" aria-label="Previous photo" type="button">&#8249;</button><button class="lh-arrow lh-arrow--right" aria-label="Next photo" type="button">&#8250;</button><div class="lh-dot-track" aria-hidden="true">${photos.map((_,i)=>`<span class="lh-dot${i===0?' active':''}"></span>`).join('')}</div>`:''}
    <template class="lh-photo-list">${photos.map(p=>`<span>${esc(p)}</span>`).join('')}</template>
    <div class="lh-status-badge ${si.cls}">${esc(si.label)}</div>
  </div>
  <div class="lh-card-body">
    <div class="lh-price">${money(h.price)}</div>
    <div class="lh-address">${esc(h.address)}</div>
    <div class="lh-city">${esc(h.city)}${h.state?`, ${esc(h.state)}`:''}${h.zipcode?` ${esc(h.zipcode)}`:''}</div>
    ${(h.beds!=null||h.baths!=null||h.sqft!=null)?`<ul class="lh-specs" aria-label="Property specs">${h.beds!=null?`<li>${h.beds} bed${h.beds===1?'':'s'}</li>`:''}${h.baths!=null?`<li>${h.baths} bath${h.baths===1?'':'s'}</li>`:''}${h.sqft!=null?`<li>${Number(h.sqft).toLocaleString()} sqft</li>`:''}</ul>`:''}
    <div class="lh-card-footer">
      ${h.mlsNumber?`<span class="lh-chip">MLS #${esc(h.mlsNumber)}</span>`:''}
      <div class="lh-card-links">
        ${h.zillowUrl?`<a class="lh-zillow-link" href="${esc(h.zillowUrl)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" aria-label="View on Zillow (opens in new tab)">Zillow ↗</a>`:''}
        <button class="lh-tour-btn btn primary small" type="button" aria-label="Schedule a tour for ${esc(h.address)}">Tour</button>
      </div>
    </div>
  </div>
</article>`;
  }

  function initSliders(){
    document.querySelectorAll('.lh-photo-wrap').forEach(wrap=>{
      const tpl=wrap.querySelector('.lh-photo-list'); if(!tpl) return;
      const photos=Array.from(tpl.querySelectorAll('span')).map(s=>s.textContent);
      if(photos.length<2) return;
      const img=wrap.querySelector('.lh-photo'), dots=wrap.querySelectorAll('.lh-dot'); let idx=0;
      function goTo(n){ idx=(n+photos.length)%photos.length; img.src=photos[idx]; img.alt=`Photo ${idx+1} of listing`; dots.forEach((d,i)=>d.classList.toggle('active',i===idx)); }
      wrap.querySelector('.lh-arrow--left')?.addEventListener('click',e=>{e.stopPropagation();goTo(idx-1);});
      wrap.querySelector('.lh-arrow--right')?.addEventListener('click',e=>{e.stopPropagation();goTo(idx+1);});
    });
  }

  function prefillAndOpenSchedule(id,byId){
    const panel=document.getElementById('schedule-tour'), toggle=document.getElementById('schedule-toggle');
    if(toggle&&panel?.classList.contains('is-collapsed')) toggle.click();
    const ref=document.getElementById('listing-ref'), h=id&&byId[id];
    if(ref&&h) ref.value=`${h.id} — ${h.address}, ${h.city} ${h.state}`;
    setTimeout(()=>panel?.scrollIntoView({behavior:'smooth',block:'start'}),80);
  }

  function initTourButtons(byId){
    document.querySelectorAll('.lh-tour-btn').forEach(btn=>{
      btn.addEventListener('click',e=>{ e.stopPropagation(); e.preventDefault(); const id=btn.closest('[data-id]')?.getAttribute('data-id'); prefillAndOpenSchedule(id,byId); });
    });
  }

  function initCardClicks(byId){
    document.querySelectorAll('.lh-card').forEach(card=>{
      const id=card.getAttribute('data-id'), open=()=>openModal(byId[id]);
      card.addEventListener('click',open);
      card.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault();open();} });
    });
  }

  function openModal(h){
    const modal=document.getElementById('lh-modal'); if(!modal||!h) return;
    const body=modal.querySelector('.lh-modal-body'), si=statusInfo(h.status), photos=h.photos||[];
    body.innerHTML=`<div class="lh-modal-media">
      ${photos[0]?`<img class="lh-modal-photo" src="${esc(photos[0])}" alt="Photo 1 of ${esc(h.address)}">`:`<div class="lh-modal-no-photo" aria-hidden="true"></div>`}
      ${photos.length>1?`<button class="lh-marrow lh-marrow--left" type="button" aria-label="Previous photo">&#8249;</button><button class="lh-marrow lh-marrow--right" type="button" aria-label="Next photo">&#8250;</button><div class="lh-mcounter" aria-live="polite">1 / ${photos.length}</div><template class="lh-mphotos">${photos.map(p=>`<span>${esc(p)}</span>`).join('')}</template>`:''}
    </div>
    <div class="lh-modal-info">
      <span class="lh-status-badge ${si.cls}">${esc(si.label)}</span>
      <h2 class="lh-m-address">${esc(h.address)}</h2>
      <p class="lh-m-city">${esc(h.city)}, ${esc(h.state)} ${esc(h.zipcode||'')}</p>
      <p class="lh-m-price">${money(h.price)}</p>
      ${(h.beds!=null||h.baths!=null||h.sqft!=null)?`<ul class="lh-specs lh-m-specs" aria-label="Property specs">${h.beds!=null?`<li>${h.beds} bed${h.beds===1?'':'s'}</li>`:''}${h.baths!=null?`<li>${h.baths} bath${h.baths===1?'':'s'}</li>`:''}${h.sqft!=null?`<li>${Number(h.sqft).toLocaleString()} sqft</li>`:''}</ul>`:''}
      ${h.mlsNumber?`<p class="lh-m-mls">MLS # ${esc(h.mlsNumber)}</p>`:''}
      <div class="lh-m-actions btn-row">
        ${h.zillowUrl?`<a class="btn outline" href="${esc(h.zillowUrl)}" target="_blank" rel="noopener noreferrer">View on Zillow ↗</a>`:''}
        <button class="btn primary" id="lh-m-schedule" type="button">Schedule a Tour</button>
      </div>
    </div>`;
    const mWrap=body.querySelector('.lh-modal-media'), mTpl=mWrap?.querySelector('.lh-mphotos');
    if(mTpl){ const mP=Array.from(mTpl.querySelectorAll('span')).map(s=>s.textContent), mImg=mWrap.querySelector('.lh-modal-photo'), mCtr=mWrap.querySelector('.lh-mcounter'); let mi=0;
      const mGo=dir=>{mi=(mi+dir+mP.length)%mP.length;mImg.src=mP[mi];mImg.alt=`Photo ${mi+1} of ${h.address}`;if(mCtr)mCtr.textContent=`${mi+1} / ${mP.length}`;};
      mWrap.querySelector('.lh-marrow--left')?.addEventListener('click',()=>mGo(-1));
      mWrap.querySelector('.lh-marrow--right')?.addEventListener('click',()=>mGo(1));
    }
    const ref=document.getElementById('listing-ref'); if(ref) ref.value=`${h.id} — ${h.address}, ${h.city} ${h.state}`;
    body.querySelector('#lh-m-schedule')?.addEventListener('click',()=>{ closeModal(); prefillAndOpenSchedule(h.id,{[h.id]:h}); });
    modal.classList.add('open'); modal.removeAttribute('aria-hidden'); document.body.style.overflow='hidden';
    modal.querySelector('.lh-modal-close')?.focus();
  }

  function closeModal(){ const modal=document.getElementById('lh-modal'); if(!modal)return; modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }

  function wireModal(){ const modal=document.getElementById('lh-modal'); if(!modal)return; modal.querySelector('.lh-modal-close')?.addEventListener('click',closeModal); modal.addEventListener('click',e=>{if(e.target===modal)closeModal();}); document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closeModal();}); }

  function initScheduleToggle(){
    const btn=document.getElementById('schedule-toggle'), panel=document.getElementById('schedule-tour'); if(!btn||!panel)return;
    const openPanel=()=>{ panel.classList.remove('is-collapsed'); panel.classList.add('is-open'); btn.setAttribute('aria-expanded','true'); if(location.hash!=='#schedule')history.replaceState(null,'','#schedule'); setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'start'}),50); };
    const closePanel=()=>{ panel.classList.remove('is-open'); panel.classList.add('is-collapsed'); btn.setAttribute('aria-expanded','false'); };
    btn.addEventListener('click',e=>{e.preventDefault();panel.classList.contains('is-open')?closePanel():openPanel();});
    if(location.hash==='#schedule') openPanel();
  }

  function showSkeleton(grid,count=3){ grid.innerHTML=Array(count).fill(0).map(()=>`<div class="lh-card lh-skeleton" aria-hidden="true"><div class="lh-photo-wrap"><div class="lh-photo skel-block"></div></div><div class="lh-card-body"><div class="skel-line skel-line--wide"></div><div class="skel-line"></div><div class="skel-line skel-line--narrow"></div></div></div>`).join(''); }

  async function init(){
    const grid=document.querySelector('.lh-grid'); if(!grid)return;
    showSkeleton(grid); wireModal(); initScheduleToggle();
    let homes;
    try { homes=await loadHomes(); }
    catch(err){ grid.innerHTML=`<p class="lh-error" role="alert">Unable to load listings right now. Please try again shortly.</p>`; console.error('[Lafayette] loadHomes:',err); return; }
    const sorted=sortHomes(homes);
    if(!sorted.length){ grid.innerHTML=`<p class="lh-empty">No listings at this time — check back soon.</p>`; return; }
    grid.innerHTML=sorted.map(renderCard).join('');
    const byId=Object.fromEntries(sorted.map(h=>[h.id,h]));
    initSliders(); initCardClicks(byId); initTourButtons(byId);
    grid.querySelectorAll('.lh-card').forEach((card,i)=>{ card.style.animationDelay=`${i*60}ms`; card.classList.add('lh-card--entering'); });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
