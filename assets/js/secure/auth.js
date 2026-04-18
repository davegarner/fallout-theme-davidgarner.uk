(function () {
  function byId(id) { return document.getElementById(id); }
  function getSecureConfig() {
    return window.SecureConfig || {
      tenantId: '',
      clientId: '',
      authorityBase: 'https://login.microsoftonline.com',
      redirectPath: '/secure/login.html',
      postLogoutRedirectPath: '/secure/login.html',
      cacheLocation: 'sessionStorage',
      loginRequest: { scopes: ['openid', 'profile', 'email'] },
      allowedRoles: []
    };
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>\"]/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char];
    });
  }
  function setNotice(message, isError) {
    var target = byId('secureNotice');
    if (!target) return;
    target.innerHTML = message ? '<div class="notice"' + (isError ? ' style="border-left-color:#ff8a7d"' : '') + '>' + message + '</div>' : '';
  }
  function getAbsoluteUrl(path) { return new URL(path, window.location.origin).toString(); }
  function loadMsalScript() {
    if (window.msal) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = '/assets/js/vendor/msal-browser.min.js';
      script.async = true;
      script.onload = function () {
        if (window.msal) resolve();
        else reject(new Error('MSAL loaded without exposing window.msal.'));
      };
      script.onerror = function () {
        reject(new Error('MSAL browser bundle not found at /assets/js/vendor/msal-browser.min.js'));
      };
      document.head.appendChild(script);
    });
  }
  function buildMsalConfig() {
    var cfg = getSecureConfig();
    return {
      auth: {
        clientId: cfg.clientId,
        authority: cfg.authorityBase.replace(/\/$/, '') + '/' + cfg.tenantId,
        redirectUri: getAbsoluteUrl(cfg.redirectPath),
        postLogoutRedirectUri: getAbsoluteUrl(cfg.postLogoutRedirectPath)
      },
      cache: {
        cacheLocation: cfg.cacheLocation || 'sessionStorage',
        storeAuthStateInCookie: false
      }
    };
  }

  var state = {
    msalInstance: null,
    account: null,
    rolesOk: true,
    initPromise: null,
    initialized: false
  };

  function persistReturnUrl(url) { try { sessionStorage.setItem('secure:returnUrl', url); } catch (e) {} }
  function popReturnUrl() {
    try {
      var value = sessionStorage.getItem('secure:returnUrl');
      sessionStorage.removeItem('secure:returnUrl');
      return value;
    } catch (e) {
      return '';
    }
  }
  function isProtectedPage() { return document.body.hasAttribute('data-secure-protected'); }
  function isLoginPage() { return document.body.hasAttribute('data-secure-login'); }
  function getActiveAccount() {
    if (!state.msalInstance) return null;
    var active = state.msalInstance.getActiveAccount();
    if (active) return active;
    var accounts = state.msalInstance.getAllAccounts();
    return accounts && accounts.length ? accounts[0] : null;
  }
  function applyRoleGate(account) {
    var cfg = getSecureConfig();
    var allowed = (cfg.allowedRoles || []).filter(Boolean);
    if (!allowed.length) {
      state.rolesOk = true;
      return true;
    }
    var roles = (((account || {}).idTokenClaims || {}).roles || []);
    state.rolesOk = allowed.some(function (role) { return roles.indexOf(role) !== -1; });
    return state.rolesOk;
  }
  function syncSecureSubnav() {
    if (!document.body.hasAttribute('data-secure-page')) return;
    var shouldShow = !!state.account && state.rolesOk;
    document.body.classList.toggle('secure-nav-authenticated', shouldShow);
  }
  function renderUserState() {
    var userBox = byId('secureUserState');
    var authBox = byId('secureAuthButtons');
    if (!userBox) return;
    var account = state.account;
    if (!account) {
      userBox.innerHTML = '<div class="secure-user-card"><div class="metric-label">Authentication state</div><div class="metric-value">Signed out</div><div class="small">Sign in with Microsoft Entra ID to access the Secure subsite.</div></div>';
      if (authBox) {
        authBox.innerHTML = '<button type="button" id="secureLoginBtn">Sign in with Entra ID</button>';
        var loginBtn = byId('secureLoginBtn');
        if (loginBtn) loginBtn.addEventListener('click', login);
      }
      syncSecureSubnav();
      return;
    }
    var name = account.name || account.username || 'Authenticated user';
    var username = account.username || '';
    var tenantId = account.tenantId || (((account.idTokenClaims || {}).tid) || '');
    var roles = (((account.idTokenClaims || {}).roles) || []).join(' · ') || 'No app roles in token';
    userBox.innerHTML = '<div class="secure-user-card"><div class="metric-label">Authentication state</div><div class="metric-value">Signed in</div><div class="small"><strong>' + escapeHtml(name) + '</strong></div><div class="small">' + escapeHtml(username) + '</div><div class="small">Tenant: ' + escapeHtml(tenantId) + '</div><div class="small">Roles: ' + escapeHtml(roles) + '</div><div class="small">Role check: ' + escapeHtml(state.rolesOk ? 'passed' : 'blocked') + '</div></div>';
    if (authBox) {
      authBox.innerHTML = '<button type="button" id="secureLogoutBtn">Sign out</button>';
      var logoutBtn = byId('secureLogoutBtn');
      if (logoutBtn) logoutBtn.addEventListener('click', logout);
    }
    syncSecureSubnav();
  }
  function renderProtectedContentState() {
    var gate = byId('securePageGate');
    if (!gate) return;
    if (!state.account) {
      gate.innerHTML = '<div class="notice">Authentication required. Redirecting to the Secure login page…</div>';
      return;
    }
    if (!state.rolesOk) {
      gate.innerHTML = '<div class="notice" style="border-left-color:#ff8a7d">You are signed in, but your token does not contain one of the required app roles for this section.</div>';
      return;
    }
    gate.innerHTML = '<div class="notice">Authenticated. Protected page unlocked.</div>';
  }
  function renderLoginState() {
    var loginInfo = byId('secureLoginState');
    if (!loginInfo) return;
    if (state.account && state.rolesOk) {
      loginInfo.innerHTML = '<div class="notice">Authentication successful. Redirecting to the Secure area…</div>';
    } else if (state.account && !state.rolesOk) {
      loginInfo.innerHTML = '<div class="notice" style="border-left-color:#ff8a7d">Signed in, but missing the configured app role(s).</div>';
    } else {
      loginInfo.innerHTML = '<div class="notice">Sign in with Microsoft Entra ID to access the Secure subsite.</div>';
    }
  }
  async function ensureInitialized() {
    if (state.initialized) return;
    if (state.initPromise) return state.initPromise;
    state.initPromise = (async function () {
      var cfg = getSecureConfig();
      if (!cfg.tenantId || !cfg.clientId || cfg.tenantId.indexOf('PASTE_') === 0 || cfg.clientId.indexOf('PASTE_') === 0) {
        throw new Error('SecureConfig is not populated yet. Add tenantId and clientId in /assets/js/config/secure-config.js');
      }
      await loadMsalScript();
      state.msalInstance = new window.msal.PublicClientApplication(buildMsalConfig());
      if (typeof state.msalInstance.initialize === 'function') {
        await state.msalInstance.initialize();
      }
      var result = await state.msalInstance.handleRedirectPromise();
      if (result && result.account) {
        state.msalInstance.setActiveAccount(result.account);
      }
      state.account = getActiveAccount();
      if (state.account) {
        state.msalInstance.setActiveAccount(state.account);
        applyRoleGate(state.account);
      }
      state.initialized = true;
    })();
    return state.initPromise;
  }
  async function login() {
    try {
      await ensureInitialized();
      if (!state.msalInstance) return;
      persistReturnUrl(window.location.pathname === '/secure/login.html' ? '/secure/index.html' : window.location.pathname);
      await state.msalInstance.loginRedirect(getSecureConfig().loginRequest || { scopes: ['openid', 'profile', 'email'] });
    } catch (error) {
      setNotice(escapeHtml(error.message || String(error)), true);
      console.error(error);
    }
  }
  async function logout() {
    try {
      await ensureInitialized();
      if (!state.msalInstance) return;
      await state.msalInstance.logoutRedirect();
    } catch (error) {
      setNotice(escapeHtml(error.message || String(error)), true);
      console.error(error);
    }
  }
  function redirectToLogin() {
    persistReturnUrl(window.location.pathname);
    window.location.href = '/secure/login.html';
  }
  function redirectAfterLogin() {
    var target = popReturnUrl() || '/secure/index.html';
    window.location.replace(target);
  }
  function renderSecureConfigStatus() {
    var target = byId('secureConfigStatus');
    if (!target) return;
    var cfg = getSecureConfig();
    var configured = !!(cfg.tenantId && cfg.clientId && cfg.tenantId.indexOf('PASTE_') !== 0 && cfg.clientId.indexOf('PASTE_') !== 0);
    target.innerHTML = '<span class="status-pill">Secure config: ' + (configured ? 'configured' : 'placeholder values') + '</span><span class="status-pill">Tenant restricted</span><span class="status-pill">Auth: Entra ID via MSAL</span>';
  }
  async function init() {
    if (!document.body.hasAttribute('data-secure-page')) return;
    syncSecureSubnav();
    renderSecureConfigStatus();
    try {
      await ensureInitialized();
    } catch (error) {
      setNotice(escapeHtml(error.message || String(error)), true);
      renderUserState();
      renderLoginState();
      renderProtectedContentState();
      return;
    }
    renderUserState();
    renderLoginState();
    renderProtectedContentState();
    if (isLoginPage()) {
      if (state.account && state.rolesOk) {
        redirectAfterLogin();
        return;
      }
      var loginBtn = byId('securePrimaryLogin');
      if (loginBtn) loginBtn.addEventListener('click', login);
      return;
    }
    if (isProtectedPage() && (!state.account || !state.rolesOk)) {
      redirectToLogin();
      return;
    }
  }
  window.SecureAuthPage = { init: init };
})();
