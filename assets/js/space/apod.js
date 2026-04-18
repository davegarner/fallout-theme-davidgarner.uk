(() => {
  const API_BASE = 'https://api.nasa.gov/planetary/apod';
  const STORAGE_KEY = 'nasa_apod_api_key';
  const DEFAULT_KEY = 'DEMO_KEY';
  const el = {};
  const state = { lastUrl: '' };
  const byId = (id) => document.getElementById(id);
  const currentKey = () => (el.apiKey.value || '').trim() || DEFAULT_KEY;
  const buildUrl = (params = {}) => `${API_BASE}?${new URLSearchParams({ api_key: currentKey(), thumbs: 'true', ...params }).toString()}`;
  function setStatus(message, kind = 'info') { el.status.textContent = message; el.status.dataset.kind = kind; }
  function setMeta(id, value) { const target = byId(id); if (target) target.textContent = value || '—'; }
  function formatMetaLine(data) { return [data.date, data.media_type && data.media_type.toUpperCase(), data.copyright && `© ${data.copyright}`].filter(Boolean).join(' • ') || 'API response loaded.'; }
  async function fetchApod(params = {}) {
    const url = buildUrl(params); state.lastUrl = url; setStatus('Querying NASA APOD API directly…', 'working');
    try {
      const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`NASA APOD request failed (${response.status})`);
      const payload = await response.json(); const data = Array.isArray(payload) ? payload[0] : payload; renderApod(data); setStatus('APOD response loaded successfully.', 'success');
    } catch (error) {
      setStatus(error.message, 'error'); el.mediaWrap.innerHTML = `<div class="apod-empty">${error.message}</div>`; el.explanation.innerHTML = '<p class="apod-empty">No APOD explanation available.</p>'; el.title.textContent = 'Astronomy Picture of the Day'; el.metaLine.textContent = 'Request failed.';
    }
  }
  function renderApod(data) {
    el.title.textContent = data.title || 'Astronomy Picture of the Day'; el.metaLine.textContent = formatMetaLine(data);
    setMeta('apodDateValue', data.date); setMeta('apodMediaType', data.media_type); setMeta('apodCopyright', data.copyright); setMeta('apodServiceVersion', data.service_version); setMeta('apodUrl', data.url);
    el.explanation.innerHTML = `<p>${(data.explanation || 'No explanation provided.').replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
    const hdOrSource = data.hdurl || data.url || '#'; el.hdLink.href = hdOrSource; el.hdLink.textContent = data.media_type === 'video' ? 'Open Video / Source' : 'Open HD / Source';
    if (data.media_type === 'video') {
      const thumb = data.thumbnail_url ? `<a class="btn" href="${data.url}" target="_blank" rel="noopener noreferrer">Open Original Video</a><img class="apod-thumb" src="${data.thumbnail_url}" alt="APOD video thumbnail">` : '';
      el.mediaWrap.innerHTML = `<div class="apod-video-shell"><iframe class="apod-video-frame" src="${data.url}" title="${data.title || 'APOD video'}" allowfullscreen loading="lazy"></iframe>${thumb}</div>`;
    } else {
      el.mediaWrap.innerHTML = `<figure class="apod-figure"><img class="apod-image" src="${data.url}" alt="${data.title || 'Astronomy Picture of the Day'}" loading="eager"></figure>`;
    }
  }
  function saveKey() { const key = (el.apiKey.value || '').trim(); if (!key) { localStorage.removeItem(STORAGE_KEY); setStatus('No key entered. Using DEMO_KEY until you save a real key.', 'info'); return; } localStorage.setItem(STORAGE_KEY, key); setStatus('NASA API key saved locally in this browser.', 'success'); }
  function clearKey() { localStorage.removeItem(STORAGE_KEY); el.apiKey.value = ''; setStatus('Saved NASA API key cleared. Page will use DEMO_KEY.', 'success'); }
  function copyApiUrl() { if (!state.lastUrl) { setStatus('No API URL available yet.', 'error'); return; } navigator.clipboard.writeText(state.lastUrl).then(() => setStatus('Current APOD API URL copied to clipboard.', 'success')).catch(() => setStatus('Could not copy the APOD API URL automatically.', 'error')); }
  function loadToday() { el.date.value = new Date().toISOString().slice(0, 10); fetchApod({ date: el.date.value }); }
  function loadRandom() { fetchApod({ count: '1' }); }
  function loadCurrentDate() { const date = (el.date.value || '').trim(); fetchApod(date ? { date } : {}); }
  function bindEvents() { el.loadBtn.addEventListener('click', loadCurrentDate); el.todayBtn.addEventListener('click', loadToday); el.randomBtn.addEventListener('click', loadRandom); el.saveKeyBtn.addEventListener('click', saveKey); el.clearKeyBtn.addEventListener('click', clearKey); el.copyLinkBtn.addEventListener('click', copyApiUrl); [el.apiKey, el.date].forEach((node) => node.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); loadCurrentDate(); } })); }
  function init() { el.apiKey = byId('apodApiKey'); el.date = byId('apodDate'); el.loadBtn = byId('apodLoadBtn'); el.todayBtn = byId('apodTodayBtn'); el.randomBtn = byId('apodRandomBtn'); el.saveKeyBtn = byId('apodSaveKeyBtn'); el.clearKeyBtn = byId('apodClearKeyBtn'); el.copyLinkBtn = byId('apodCopyLinkBtn'); el.title = byId('apodTitle'); el.metaLine = byId('apodMetaLine'); el.mediaWrap = byId('apodMediaWrap'); el.hdLink = byId('apodHdLink'); el.status = byId('apodStatus'); el.explanation = byId('apodExplanation'); const savedKey = localStorage.getItem(STORAGE_KEY); if (savedKey) el.apiKey.value = savedKey; bindEvents(); loadToday(); }
  document.addEventListener('DOMContentLoaded', init);
})();