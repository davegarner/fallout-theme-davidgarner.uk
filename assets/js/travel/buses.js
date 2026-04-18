(function () {
  const SEARCH_MODES = ["bus", "tube", "elizabeth-line", "dlr", "overground"];
  const QUICK_PICKS = [
    { id: "HUBKGX", name: "King's Cross & St Pancras International" },
    { id: "HUBLST", name: "Liverpool Street" },
    { id: "HUBBDS", name: "Bond Street" },
    { id: "HUBNGW", name: "North Greenwich" }
  ];

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

  function cleanName(value) {
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

  function byId(id) { return document.getElementById(id); }

  var state = {
    selected: null,
    predictions: [],
    filteredPredictions: [],
    refreshTimer: null,
    searchTimer: null,
    lastQuery: "",
    candidateStopIds: [],
    stopLabelMap: {},
    routeFilter: '',
    searchDetailCache: {}
  };

  async function fetchJson(url) {
    var response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("TfL request failed (" + response.status + ")");
    return response.json();
  }

  function setNotice(message, isError) {
    var target = byId("busNotice");
    if (!target) return;
    target.innerHTML = message ? '<div class="notice"' + (isError ? ' style="border-left-color:#ff8a7d"' : '') + '>' + message + '</div>' : '';
  }

  function renderConfigNote() {
    var cfg = getConfig();
    var target = byId("busConfigStatus");
    if (!target) return;
    var tflOk = !!(cfg.tfl && cfg.tfl.appKey);
    var tickernetOk = !!(cfg.tickernet && cfg.tickernet.apiKey);
    target.innerHTML = '<span class="status-pill">TfL key: ' + (tflOk ? 'loaded' : 'missing') + '</span>' +
      '<span class="status-pill">Tickernet key: ' + (tickernetOk ? 'loaded' : 'missing') + '</span>' +
      '<span class="status-pill">Mode: pure client-side TfL fetch</span>';
  }

  function renderQuickPicks() {
    var target = byId("busQuickPickButtons");
    if (!target) return;
    target.innerHTML = QUICK_PICKS.map(function (pick) {
      return '<button type="button" class="quick-pick-btn" data-stop-id="' + pick.id + '" data-stop-name="' + escapeHtml(pick.name) + '">' + escapeHtml(cleanName(pick.name)) + '</button>';
    }).join('');
    target.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-stop-id]');
      if (!btn) return;
      selectLocation({ id: btn.getAttribute('data-stop-id'), name: btn.getAttribute('data-stop-name') }).catch(function (error) {
        setNotice(escapeHtml(error.message), true);
      });
    });
  }

  async function searchStops(query) {
    if (!query || query.trim().length < 2) return [];
    var url = buildUrl('/StopPoint/Search/' + encodeURIComponent(query.trim()), {
      modes: SEARCH_MODES.join(','),
      maxResults: 12
    });
    var data = await fetchJson(url);
    return (data.matches || []).filter(function (match) {
      return (match.modes || []).some(function (mode) { return SEARCH_MODES.indexOf(mode) !== -1; });
    });
  }

  function getAdditionalProp(stop, key) {
    var props = stop && stop.additionalProperties ? stop.additionalProperties : [];
    var found = props.find(function (item) { return String(item.key || '').toLowerCase() === String(key).toLowerCase(); });
    return found ? found.value : '';
  }

  function getRoutesFromStop(stop) {
    var routes = ((stop.lines || []).map(function (line) { return line.name; }).filter(Boolean));
    return Array.from(new Set(routes));
  }

  async function fetchSearchDetail(id) {
    if (state.searchDetailCache[id]) return state.searchDetailCache[id];
    try {
      var detail = await fetchJson(buildUrl('/StopPoint/' + encodeURIComponent(id)));
      state.searchDetailCache[id] = detail;
      return detail;
    } catch (error) {
      state.searchDetailCache[id] = null;
      return null;
    }
  }

  function getModeBadges(modes) {
    return (modes || []).filter(Boolean).map(function (mode) {
      var labelMap = {
        bus: 'BUS',
        tube: 'TUBE',
        'elizabeth-line': 'ELIZABETH',
        dlr: 'DLR',
        overground: 'OVERGROUND'
      };
      var label = labelMap[mode] || String(mode).toUpperCase();
      return { mode: mode, label: label };
    });
  }

  function buildFriendlyMatch(match, detail) {
    var modes = (match.modes || []).filter(function (mode) { return SEARCH_MODES.indexOf(mode) !== -1; });
    var isBus = modes.indexOf('bus') !== -1;
    var primary = cleanName(match.name);
    var secondary = modes.join(' · ');

    if (isBus && detail) {
      var specificStopLetter = detail.stopLetter || '';
      var indicator = detail.indicator || '';
      var towards = getAdditionalProp(detail, 'Towards');
      var routes = getRoutesFromStop(detail).slice(0, 6);
      var childBusStops = (detail.children || []).filter(function (child) {
        return (child.modes || []).indexOf('bus') !== -1;
      });

      if (specificStopLetter) {
        primary = cleanName(detail.commonName || match.name) + ' · Stop ' + specificStopLetter;
      } else if (indicator && /^stop\s+/i.test(indicator)) {
        primary = cleanName(detail.commonName || match.name) + ' · ' + indicator;
      } else if (childBusStops.length > 1) {
        primary = cleanName(detail.commonName || match.name);
      }

      if (childBusStops.length > 1 && !specificStopLetter) {
        secondary = childBusStops.length + ' bus stops nearby';
        if (routes.length) secondary += ' · Routes ' + routes.join(' · ');
      } else {
        var parts = [];
        if (towards) parts.push('Towards ' + towards);
        if (routes.length) parts.push('Routes ' + routes.join(' · '));
        if (!parts.length) parts.push('bus');
        secondary = parts.join(' · ');
      }
    } else {
      var zone = match.zone ? 'Zone ' + match.zone : '';
      secondary = [zone, modes.join(' · ')].filter(Boolean).join(' · ');
    }

    return {
      id: match.id,
      name: match.name,
      primary: primary,
      secondary: secondary,
      modes: modes,
      badges: getModeBadges(modes)
    };
  }

  async function enrichMatches(matches) {
    var detailed = await Promise.all(matches.map(async function (match) {
      var detail = null;
      if ((match.modes || []).indexOf('bus') !== -1) {
        detail = await fetchSearchDetail(match.id);
      }
      return buildFriendlyMatch(match, detail);
    }));
    return detailed;
  }

  function renderSearchResults(matches) {
    var list = byId('busSearchResults');
    if (!list) return;
    if (!matches.length) {
      list.innerHTML = '';
      list.classList.remove('open');
      return;
    }
    list.innerHTML = matches.map(function (match) {
      var badges = (match.badges || []).map(function (badge) {
        return '<span class="status-pill station-mode-badge station-mode-badge-' + escapeHtml(badge.mode) + '">' + escapeHtml(badge.label) + '</span>';
      }).join('');
      return '<button type="button" class="station-result" data-stop-id="' + escapeHtml(match.id) + '" data-stop-name="' + escapeHtml(match.name) + '">' +
        '<strong>' + escapeHtml(match.primary) + '</strong>' +
        '<span class="station-result-meta">' +
          (badges ? '<span class="station-result-badges">' + badges + '</span>' : '') +
          '<span class="station-result-secondary">' + escapeHtml(match.secondary) + '</span>' +
        '</span>' +
      '</button>';
    }).join('');
    list.classList.add('open');
  }

  function bindSearch() {
    var input = byId('busSearchInput');
    var list = byId('busSearchResults');
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
        searchStops(query).then(function (matches) {
          return enrichMatches(matches).then(function (friendly) {
            if (state.lastQuery === query) renderSearchResults(friendly);
          });
        }).catch(function (error) {
          setNotice(escapeHtml(error.message), true);
        });
      }, 180);
    });

    list.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-stop-id]');
      if (!btn) return;
      var place = { id: btn.getAttribute('data-stop-id'), name: btn.getAttribute('data-stop-name') };
      input.value = cleanName(place.name);
      renderSearchResults([]);
      selectLocation(place).catch(function (error) { setNotice(escapeHtml(error.message), true); });
    });

    document.addEventListener('click', function (event) {
      if (!event.target.closest('.station-search-shell')) renderSearchResults([]);
    });
  }

  async function fetchStopDetail(stopId) {
    return fetchJson(buildUrl('/StopPoint/' + encodeURIComponent(stopId)));
  }

  function makeBusStopLabel(stop) {
    var parts = [];
    if (stop.commonName || stop.name) parts.push(cleanName(stop.commonName || stop.name));
    if (stop.stopLetter) parts.push('Stop ' + stop.stopLetter);
    else if (stop.indicator) parts.push(stop.indicator);
    return parts.join(' · ') || String(stop.id || stop.naptanId || 'Bus stop');
  }

  function collectBusStopCandidates(stop, idSet, labelMap) {
    if (!stop || typeof stop !== 'object') return;

    var hasBusMode = (stop.modes || []).indexOf('bus') !== -1;
    if (hasBusMode) {
      var label = makeBusStopLabel(stop);
      if (stop.id) { idSet.add(String(stop.id)); labelMap[String(stop.id)] = label; }
      if (stop.naptanId) { idSet.add(String(stop.naptanId)); labelMap[String(stop.naptanId)] = label; }
      (stop.lineGroup || []).forEach(function (group) {
        if (group.naptanIdReference) { idSet.add(String(group.naptanIdReference)); labelMap[String(group.naptanIdReference)] = label; }
        if (group.stationAtcoCode) { idSet.add(String(group.stationAtcoCode)); labelMap[String(group.stationAtcoCode)] = label; }
      });
    }

    (stop.children || []).forEach(function (child) {
      collectBusStopCandidates(child, idSet, labelMap);
    });
  }

  function resolveBusStopIds(stop) {
    var ids = new Set();
    var labels = {};
    collectBusStopCandidates(stop, ids, labels);
    return { ids: Array.from(ids), labels: labels };
  }

  async function fetchBusArrivalsForId(stopId) {
    try {
      var data = await fetchJson(buildUrl('/StopPoint/' + encodeURIComponent(stopId) + '/Arrivals'));
      return (data || []).filter(function (item) { return item.modeName === 'bus'; });
    } catch (error) {
      return [];
    }
  }

  function dedupePredictions(predictions) {
    var seen = new Set();
    return predictions.filter(function (item) {
      var key = [item.id || '', item.lineId || '', item.naptanId || '', item.expectedArrival || '', item.destinationName || ''].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getRouteName(item) {
    return String(item.lineName || item.lineId || '').trim();
  }

  function applyRouteFilter(predictions) {
    if (!state.routeFilter) return predictions.slice();
    return predictions.filter(function (item) {
      return getRouteName(item) === state.routeFilter;
    });
  }

  function renderRouteFilterOptions(predictions) {
    var select = byId('busRouteFilter');
    if (!select) return;
    var routes = Array.from(new Set(predictions.map(getRouteName).filter(Boolean))).sort(function (a, b) {
      var an = Number(a), bn = Number(b);
      var bothNumeric = !isNaN(an) && !isNaN(bn);
      if (bothNumeric) return an - bn;
      return a.localeCompare(b);
    });

    var previous = state.routeFilter;
    select.innerHTML = '<option value="">All routes</option>' + routes.map(function (route) {
      return '<option value="' + escapeHtml(route) + '">' + escapeHtml(route) + '</option>';
    }).join('');

    if (previous && routes.indexOf(previous) !== -1) {
      select.value = previous;
    } else {
      state.routeFilter = '';
      select.value = '';
    }

    var wrap = byId('busRouteFilterWrap');
    if (wrap) wrap.style.display = routes.length ? 'block' : 'none';
  }

  function updateRenderedPredictions() {
    state.filteredPredictions = applyRouteFilter(state.predictions);
    renderSummary(state.filteredPredictions);
    renderDetailed(state.filteredPredictions, state.predictions.length);
  }

  async function fetchPredictionsForSelection() {
    var ids = state.candidateStopIds.length ? state.candidateStopIds : (state.selected ? [state.selected.id] : []);
    var resultSets = await Promise.all(ids.map(fetchBusArrivalsForId));
    return dedupePredictions([].concat.apply([], resultSets)).sort(function (a, b) {
      if ((a.naptanId || '') !== (b.naptanId || '')) return String(a.naptanId || '').localeCompare(String(b.naptanId || ''));
      var ar = getRouteName(a), br = getRouteName(b);
      if (ar !== br) return ar.localeCompare(br);
      return (a.timeToStation || 0) - (b.timeToStation || 0);
    });
  }

  function renderSelectedLocation(stop) {
    var target = byId('busSelectedMeta');
    if (!target) return;
    if (!stop) {
      target.innerHTML = '<div class="notice">Select a stop, station or interchange to load live bus departures.</div>';
      return;
    }
    var modes = (stop.modes || []).filter(function (mode) { return SEARCH_MODES.indexOf(mode) !== -1; }).map(function (mode) { return '<span class="status-pill">' + escapeHtml(mode) + '</span>'; }).join('');
    var lines = ((stop.lines || []).map(function (line) { return line.name; }).filter(Boolean)).slice(0, 16);
    target.innerHTML = '<div class="station-meta-grid">' +
      '<div class="metric-box"><div class="metric-label">Selected place</div><div class="metric-value station-name-value">' + escapeHtml(cleanName(stop.commonName || stop.name || stop.id)) + '</div><div class="small">' + escapeHtml(stop.id || '') + '</div></div>' +
      '<div class="metric-box"><div class="metric-label">Resolved bus stop IDs</div><div class="metric-value">' + escapeHtml(String(state.candidateStopIds.length)) + '</div><div class="small">Bus departures are fetched from the underlying stop-level IDs.</div></div>' +
      '<div class="metric-box"><div class="metric-label">Modes / lines</div><div class="metric-value inline-pills">' + modes + '</div><div class="small station-lines-list">' + (lines.length ? escapeHtml(lines.join(' · ')) : 'No line metadata available') + '</div></div>' +
    '</div>';
  }

  function stopLabelForPrediction(item) {
    return state.stopLabelMap[item.naptanId] || cleanName(item.stationName || item.platformName || item.naptanId || 'Bus stop');
  }

  function renderSummary(predictions) {
    var target = byId('busSummaryBoards');
    var empty = byId('busSummaryEmpty');
    if (!target || !empty) return;
    if (!predictions.length) {
      target.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    var grouped = {};
    predictions.forEach(function (item) {
      var key = stopLabelForPrediction(item);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    target.innerHTML = Object.keys(grouped).sort().map(function (stopLabel) {
      return '<section class="summary-board-card">' +
        '<h3>' + escapeHtml(stopLabel) + '</h3>' +
        '<ul class="summary-board-list">' + grouped[stopLabel].slice(0, 4).map(function (item) {
          return '<li class="summary-board-item">' +
            '<div class="summary-main">' +
              '<div class="summary-line-name"><span class="status-pill">' + escapeHtml(getRouteName(item) || '—') + '</span></div>' +
              '<div class="summary-destination">' + escapeHtml(cleanName(item.destinationName || item.towards || 'Destination unavailable')) + '</div>' +
            '</div>' +
            '<div class="summary-time">' + escapeHtml(formatRelative(item.timeToStation || 0)) + '</div>' +
          '</li>';
        }).join('') + '</ul>' +
      '</section>';
    }).join('');
  }

  function renderDetailed(predictions, totalCount) {
    var tbody = byId('busDetailedBody');
    var count = byId('busDetailedCount');
    if (!tbody || !count) return;
    if (state.routeFilter) {
      count.textContent = predictions.length + ' filtered / ' + totalCount + ' live bus predictions';
    } else {
      count.textContent = totalCount ? String(totalCount) + ' live bus predictions' : '0 live bus predictions';
    }

    if (!predictions.length) {
      tbody.innerHTML = '<tr><td colspan="6">No live bus predictions were returned for the current filter.</td></tr>';
      return;
    }
    tbody.innerHTML = predictions.map(function (item) {
      return '<tr>' +
        '<td><strong>' + escapeHtml(getRouteName(item) || '—') + '</strong></td>' +
        '<td>' + escapeHtml(stopLabelForPrediction(item)) + '</td>' +
        '<td>' + escapeHtml(item.destinationName || item.towards || '—') + '</td>' +
        '<td>' + escapeHtml(formatRelative(item.timeToStation || 0)) + '</td>' +
        '<td>' + escapeHtml(formatClock(item.expectedArrival)) + '</td>' +
        '<td>' + escapeHtml(item.currentLocation || item.towards || '—') + '</td>' +
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
      refreshCurrent(false).catch(function (error) { setNotice(escapeHtml(error.message), true); });
    }, intervalMs);
  }

  async function refreshCurrent(showNotice) {
    if (!state.selected) return;
    if (showNotice) setNotice('Refreshing live bus predictions…', false);
    var predictions = await fetchPredictionsForSelection();
    state.predictions = predictions;
    renderRouteFilterOptions(predictions);
    updateRenderedPredictions();
    var updated = byId('busLastUpdated');
    if (updated) updated.textContent = new Date().toLocaleTimeString();
    if (showNotice) setNotice('', false);
  }

  async function selectLocation(place) {
    setNotice('Loading place and bus departures…', false);
    var detail = await fetchStopDetail(place.id);
    state.selected = detail || place;
    var resolved = resolveBusStopIds(state.selected);
    state.candidateStopIds = resolved.ids;
    state.stopLabelMap = resolved.labels;
    state.routeFilter = '';
    renderSelectedLocation(state.selected);
    await refreshCurrent(false);
    startRefreshLoop();
    setNotice('', false);
  }

  function bindRefreshButton() {
    var btn = byId('refreshBusPredictions');
    if (!btn) return;
    btn.addEventListener('click', function () {
      refreshCurrent(true).catch(function (error) { setNotice(escapeHtml(error.message), true); });
    });
  }

  function bindRouteFilter() {
    var select = byId('busRouteFilter');
    if (!select) return;
    select.addEventListener('change', function () {
      state.routeFilter = select.value || '';
      updateRenderedPredictions();
    });
  }

  function bindKeyboardShortcut() {
    var input = byId('busSearchInput');
    document.addEventListener('keydown', function (event) {
      if (event.key === '/' && input && document.activeElement !== input && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        event.preventDefault();
        input.focus();
      }
    });
  }

  async function init() {
    if (!byId('busSearchInput')) return;
    renderConfigNote();
    renderQuickPicks();
    bindSearch();
    bindRefreshButton();
    bindRouteFilter();
    bindKeyboardShortcut();
    renderSelectedLocation(null);

    var cfg = getConfig();
    if (!cfg.tfl || !cfg.tfl.appKey) {
      setNotice('Add your TfL <code>app_key</code> to <code>/assets/js/config/transport-config.js</code>. This page uses pure client-side TfL requests and resolves bus departures from child stop IDs where needed.', false);
      return;
    }

    selectLocation(QUICK_PICKS[0]).catch(function (error) {
      setNotice(escapeHtml(error.message), true);
    });
  }

  window.TravelBusesPage = { init: init };
})();
