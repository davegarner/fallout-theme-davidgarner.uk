(function () {
  const ALLOWED_MODES = ["tube", "elizabeth-line", "dlr", "overground"];
  const QUICK_PICKS = [
    { id: "HUBKGX", name: "King's Cross & St Pancras International" },
    { id: "940GZZLUPAC", name: "Paddington Underground Station" },
    { id: "HUBBDS", name: "Bond Street" },
    { id: "940GZZLUBXN", name: "Brixton Underground Station" },
    { id: "HUBVIC", name: "Victoria" }
  ];

  const lineColours = {
    bakerloo: "#b26300",
    central: "#dc241f",
    circle: "#ffc80a",
    district: "#007d32",
    "elizabeth-line": "#60399e",
    elizabeth: "#60399e",
    "hammersmith-city": "#f589a6",
    jubilee: "#838d93",
    metropolitan: "#9b0058",
    northern: "#000000",
    piccadilly: "#0019a8",
    victoria: "#039be5",
    "waterloo-city": "#76d0bd",
    dlr: "#00afad",
    lioness: "#ef9600",
    mildmay: "#2774ae",
    windrush: "#d22730",
    weaver: "#893b67",
    suffragette: "#5ba763",
    liberty: "#606667",
    overground: "#e87722"
  };

  function getConfig() {
    return window.TransportConfig || { tfl: { appKey: "", appId: "" }, tickernet: { apiKey: "" }, refreshMs: 30000 };
  }

  function buildUrl(path, params) {
    const cfg = getConfig();
    const url = new URL("https://api.tfl.gov.uk" + path);
    if (cfg.tfl && cfg.tfl.appKey) url.searchParams.set("app_key", cfg.tfl.appKey);
    if (cfg.tfl && cfg.tfl.appId) url.searchParams.set("app_id", cfg.tfl.appId);
    if (params) {
      Object.keys(params).forEach(function (key) {
        if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
          url.searchParams.set(key, params[key]);
        }
      });
    }
    return url.toString();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>\"]/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char];
    });
  }

  function cleanDestinationName(value) {
    return String(value || "")
      .replace(/\s+Underground Station$/i, "")
      .replace(/\s+Rail Station$/i, "")
      .replace(/\s+DLR Station$/i, "")
      .replace(/\s+Station$/i, "")
      .trim();
  }

  function formatRelative(seconds) {
    if (seconds <= 30) return "Due";
    var minutes = Math.round(seconds / 60);
    return minutes + " min" + (minutes === 1 ? "" : "s");
  }

  function formatClock(value) {
    try {
      return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "--:--";
    }
  }

  function getLineColour(prediction) {
    return lineColours[prediction.lineId] || lineColours[prediction.modeName] || "#99ff80";
  }

  function classifyStationModes(stop) {
    var modes = (stop.modes || []).filter(function (mode) { return ALLOWED_MODES.indexOf(mode) !== -1; });
    return modes.length ? modes : ["tube"];
  }

  function byId(id) { return document.getElementById(id); }

  var state = {
    selected: null,
    predictions: [],
    refreshTimer: null,
    searchTimer: null,
    lastQuery: "",
    candidateStopIds: []
  };

  async function fetchJson(url) {
    var response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("TfL request failed (" + response.status + ")");
    return response.json();
  }

  function renderConfigNote() {
    var cfg = getConfig();
    var target = byId("routesConfigStatus");
    if (!target) return;
    var tflOk = !!(cfg.tfl && cfg.tfl.appKey);
    var tickernetOk = !!(cfg.tickernet && cfg.tickernet.apiKey);
    target.innerHTML = '<span class="status-pill">TfL key: ' + (tflOk ? 'loaded' : 'missing') + '</span>' +
      '<span class="status-pill">Tickernet key: ' + (tickernetOk ? 'loaded' : 'missing') + '</span>' +
      '<span class="status-pill">Mode: pure client-side TfL fetch</span>';
  }

  function setNotice(message, isError) {
    var target = byId("routesNotice");
    if (!target) return;
    if (!message) {
      target.innerHTML = "";
      return;
    }
    target.innerHTML = '<div class="notice"' + (isError ? ' style="border-left-color:#ff8a7d"' : '') + '>' + message + '</div>';
  }

  function renderQuickPicks() {
    var target = byId("quickPickButtons");
    if (!target) return;
    target.innerHTML = QUICK_PICKS.map(function (pick) {
      return '<button type="button" class="quick-pick-btn" data-station-id="' + pick.id + '" data-station-name="' + escapeHtml(pick.name) + '">' + escapeHtml(cleanDestinationName(pick.name)) + '</button>';
    }).join('');
    target.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-station-id]');
      if (!btn) return;
      var station = { id: btn.getAttribute('data-station-id'), name: btn.getAttribute('data-station-name'), modes: ["tube"] };
      selectStation(station).catch(function (error) { setNotice(escapeHtml(error.message), true); });
    });
  }

  async function searchStations(query) {
    if (!query || query.trim().length < 2) return [];
    var url = buildUrl('/StopPoint/Search/' + encodeURIComponent(query.trim()), {
      modes: ALLOWED_MODES.join(','),
      maxResults: 12
    });
    var data = await fetchJson(url);
    return (data.matches || []).filter(function (match) {
      return (match.modes || []).some(function (mode) { return ALLOWED_MODES.indexOf(mode) !== -1; });
    });
  }

  function renderSearchResults(matches) {
    var list = byId('stationSearchResults');
    if (!list) return;
    if (!matches.length) {
      list.innerHTML = '';
      list.classList.remove('open');
      return;
    }
    list.innerHTML = matches.map(function (match) {
      var modes = (match.modes || []).filter(function (mode) { return ALLOWED_MODES.indexOf(mode) !== -1; }).join(' · ');
      return '<button type="button" class="station-result" data-station-id="' + escapeHtml(match.id) + '" data-station-name="' + escapeHtml(match.name) + '" data-station-modes="' + escapeHtml((match.modes || []).join(',')) + '">' +
        '<strong>' + escapeHtml(cleanDestinationName(match.name)) + '</strong>' +
        '<span class="station-result-meta">' + escapeHtml(match.id) + (modes ? ' · ' + escapeHtml(modes) : '') + '</span>' +
      '</button>';
    }).join('');
    list.classList.add('open');
  }

  function bindSearch() {
    var input = byId('stationSearchInput');
    var list = byId('stationSearchResults');
    if (!input || !list) return;

    input.addEventListener('input', function () {
      var query = input.value.trim();
      state.lastQuery = query;
      clearTimeout(state.searchTimer);
      if (query.length < 2) {
        renderSearchResults([]);
        return;
      }
      state.searchTimer = setTimeout(function () {
        searchStations(query).then(function (matches) {
          if (state.lastQuery === query) renderSearchResults(matches);
        }).catch(function (error) {
          setNotice(escapeHtml(error.message), true);
        });
      }, 180);
    });

    list.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-station-id]');
      if (!btn) return;
      var station = {
        id: btn.getAttribute('data-station-id'),
        name: btn.getAttribute('data-station-name'),
        modes: (btn.getAttribute('data-station-modes') || '').split(',').filter(Boolean)
      };
      input.value = cleanDestinationName(station.name);
      renderSearchResults([]);
      selectStation(station).catch(function (error) { setNotice(escapeHtml(error.message), true); });
    });

    document.addEventListener('click', function (event) {
      if (!event.target.closest('.station-search-shell')) renderSearchResults([]);
    });
  }

  async function fetchStationDetail(stationId) {
    return fetchJson(buildUrl('/StopPoint/' + encodeURIComponent(stationId)));
  }

  function addRailRelevantId(set, value) {
    if (!value) return;
    set.add(String(value));
  }

  function collectCandidateStopIds(stop, set) {
    if (!stop || typeof stop !== 'object') return;

    addRailRelevantId(set, stop.id);
    addRailRelevantId(set, stop.naptanId);

    (stop.lineGroup || []).forEach(function (group) {
      addRailRelevantId(set, group.stationAtcoCode);
      addRailRelevantId(set, group.naptanIdReference);
    });

    (stop.children || []).forEach(function (child) {
      collectCandidateStopIds(child, set);
    });
  }

  function resolveCandidateStopIds(stop) {
    var set = new Set();
    collectCandidateStopIds(stop, set);
    return Array.from(set);
  }

  async function fetchPredictionsForId(stopId) {
    try {
      var data = await fetchJson(buildUrl('/StopPoint/' + encodeURIComponent(stopId) + '/Arrivals'));
      return (data || []).filter(function (item) {
        return ALLOWED_MODES.indexOf(item.modeName) !== -1;
      });
    } catch (error) {
      return [];
    }
  }

  function dedupePredictions(predictions) {
    var seen = new Set();
    return predictions.filter(function (item) {
      var key = [
        item.id || '',
        item.lineId || '',
        item.platformName || '',
        item.expectedArrival || '',
        item.destinationName || '',
        item.towards || ''
      ].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function fetchPredictionsForStation(stop) {
    var ids = state.candidateStopIds && state.candidateStopIds.length ? state.candidateStopIds : [stop.id];
    var results = await Promise.all(ids.map(fetchPredictionsForId));
    return dedupePredictions([].concat.apply([], results)).sort(function (a, b) {
      if (a.platformName !== b.platformName) return String(a.platformName).localeCompare(String(b.platformName));
      return (a.timeToStation || 0) - (b.timeToStation || 0);
    });
  }

  function renderSelectedStation(stop) {
    var target = byId('selectedStationMeta');
    if (!target) return;
    if (!stop) {
      target.innerHTML = '<div class="notice">Select a station to load live departure boards.</div>';
      return;
    }

    var modePills = classifyStationModes(stop).map(function (mode) {
      return '<span class="status-pill">' + escapeHtml(mode) + '</span>';
    }).join('');

    var lines = ((stop.lines || []).map(function (line) { return line.name; }).filter(Boolean)).slice(0, 12);
    var candidateCount = state.candidateStopIds.length;

    target.innerHTML = '<div class="station-meta-grid">' +
      '<div class="metric-box"><div class="metric-label">Selected station</div><div class="metric-value station-name-value">' + escapeHtml(cleanDestinationName(stop.commonName || stop.name || stop.id)) + '</div><div class="small">' + escapeHtml(stop.id || '') + '</div></div>' +
      '<div class="metric-box"><div class="metric-label">Modes</div><div class="metric-value inline-pills">' + modePills + '</div><div class="small">Resolved stop IDs: ' + escapeHtml(String(candidateCount)) + '</div></div>' +
      '<div class="metric-box"><div class="metric-label">Lines / services</div><div class="small station-lines-list">' + (lines.length ? escapeHtml(lines.join(' · ')) : 'No line metadata available') + '</div></div>' +
    '</div>';
  }

  function renderSummaryBoard(predictions) {
    var target = byId('summaryBoards');
    var empty = byId('summaryEmpty');
    if (!target || !empty) return;
    if (!predictions.length) {
      target.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    var grouped = {};
    predictions.forEach(function (item) {
      var key = item.platformName || 'Platform unavailable';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    target.innerHTML = Object.keys(grouped).sort().map(function (platform) {
      var items = grouped[platform].slice(0, 4);
      return '<section class="summary-board-card">' +
        '<h3>' + escapeHtml(platform) + '</h3>' +
        '<ul class="summary-board-list">' + items.map(function (item) {
          var lineColour = getLineColour(item);
          return '<li class="summary-board-item">' +
            '<div class="summary-main">' +
              '<div class="summary-line-name"><span class="line-swatch" style="background:' + lineColour + '"></span>' + escapeHtml(item.lineName || item.lineId || '') + '</div>' +
              '<div class="summary-destination">' + escapeHtml(cleanDestinationName(item.destinationName || item.towards || 'Destination unavailable')) + '</div>' +
            '</div>' +
            '<div class="summary-time">' + escapeHtml(formatRelative(item.timeToStation || 0)) + '</div>' +
          '</li>';
        }).join('') + '</ul>' +
      '</section>';
    }).join('');
  }

  function renderDetailedTable(predictions) {
    var tbody = byId('detailedPredictionBody');
    var count = byId('detailedPredictionCount');
    if (!tbody || !count) return;
    count.textContent = predictions.length ? String(predictions.length) + ' live predictions' : '0 live predictions';
    if (!predictions.length) {
      tbody.innerHTML = '<tr><td colspan="7">No live predictions were returned for the selected station.</td></tr>';
      return;
    }

    tbody.innerHTML = predictions.map(function (item) {
      var lineColour = getLineColour(item);
      return '<tr>' +
        '<td><div class="line-name" style="color:' + (item.lineId === 'northern' || item.lineId === 'liberty' ? '#f4f4f4' : lineColour) + '"><span class="line-swatch" style="background:' + lineColour + '"></span><span>' + escapeHtml(item.lineName || item.lineId || '') + '</span></div></td>' +
        '<td>' + escapeHtml(item.platformName || '—') + '</td>' +
        '<td>' + escapeHtml(item.destinationName || item.towards || '—') + '</td>' +
        '<td>' + escapeHtml(item.currentLocation || '—') + '</td>' +
        '<td>' + escapeHtml(formatRelative(item.timeToStation || 0)) + '</td>' +
        '<td>' + escapeHtml(formatClock(item.expectedArrival)) + '</td>' +
        '<td>' + escapeHtml(item.towards || item.direction || '—') + '</td>' +
      '</tr>';
    }).join('');
  }

  function clearRefresh() {
    if (state.refreshTimer) {
      clearInterval(state.refreshTimer);
      state.refreshTimer = null;
    }
  }

  function startRefreshLoop() {
    clearRefresh();
    var cfg = getConfig();
    var intervalMs = Math.max(15000, Number(cfg.refreshMs) || 30000);
    state.refreshTimer = setInterval(function () {
      if (document.hidden || !state.selected) return;
      refreshSelectedStation(false).catch(function (error) { setNotice(escapeHtml(error.message), true); });
    }, intervalMs);
  }

  async function refreshSelectedStation(showNotice) {
    if (!state.selected) return;
    if (showNotice) setNotice('Refreshing live predictions…', false);
    var predictions = await fetchPredictionsForStation(state.selected);
    state.predictions = predictions;
    renderSummaryBoard(predictions);
    renderDetailedTable(predictions);
    var updated = byId('routesLastUpdated');
    if (updated) updated.textContent = new Date().toLocaleTimeString();
    if (showNotice) setNotice('', false);
  }

  async function selectStation(station) {
    setNotice('Loading station and departure boards…', false);
    var detail = await fetchStationDetail(station.id);
    state.selected = detail || station;
    state.candidateStopIds = resolveCandidateStopIds(state.selected);
    renderSelectedStation(state.selected);
    await refreshSelectedStation(false);
    startRefreshLoop();
    setNotice('', false);
  }

  function bindRefreshButton() {
    var btn = byId('refreshRoutesPredictions');
    if (!btn) return;
    btn.addEventListener('click', function () {
      refreshSelectedStation(true).catch(function (error) { setNotice(escapeHtml(error.message), true); });
    });
  }

  function bindKeyboardShortcut() {
    var input = byId('stationSearchInput');
    document.addEventListener('keydown', function (event) {
      if (event.key === '/' && input && document.activeElement !== input && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        event.preventDefault();
        input.focus();
      }
    });
  }

  async function init() {
    if (!byId('stationSearchInput')) return;
    renderConfigNote();
    renderQuickPicks();
    bindSearch();
    bindRefreshButton();
    bindKeyboardShortcut();
    renderSelectedStation(null);

    var cfg = getConfig();
    if (!cfg.tfl || !cfg.tfl.appKey) {
      setNotice('Add your TfL <code>app_key</code> to <code>/assets/js/config/transport-config.js</code>. The page performs pure client-side TfL Unified API requests.', false);
      return;
    }

    selectStation(QUICK_PICKS[0]).catch(function (error) {
      setNotice(escapeHtml(error.message), true);
    });
  }

  window.TravelRoutesPage = { init: init };
})();
