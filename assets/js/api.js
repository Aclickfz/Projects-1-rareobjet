window.JustAclick = window.JustAclick || {};

(function (JA) {
  const TOKEN_KEY = 'jac_token';

  // Hit Node server even if page opened via Live Server / file:// / other port
  JA.API_BASE = (function () {
    if (typeof location === 'undefined') return 'http://localhost:3000';
    if (location.protocol === 'file:') return 'http://localhost:3000';
    if (location.port && location.port !== '3000') return 'http://localhost:3000';
    return '';
  })();

  JA.formatInr = function formatInr(amount) {
    const n = Number(amount) || 0;
    return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  JA.getToken = function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  };

  JA.setToken = function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  };

  JA.api = async function api(path, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
    const token = JA.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const url = path.startsWith('http')
      ? path
      : `${JA.API_BASE}${path.startsWith('/api') ? path : `/api${path}`}`;

    let res;
    try {
      res = await fetch(url, {
        credentials: 'include',
        ...options,
        headers,
        body:
          options.body && !(options.body instanceof FormData) && typeof options.body !== 'string'
            ? JSON.stringify(options.body)
            : options.body
      });
    } catch (networkErr) {
      const err = new Error('Cannot reach server. Start it with: cd server && npm start');
      err.status = 0;
      err.cause = networkErr;
      throw err;
    }

    let data = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: text || 'Invalid response' };
    }

    if (!res.ok) {
      const err = new Error((data && data.error) || res.statusText || 'Request failed');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  };

  JA.qs = function qs(sel, root = document) {
    return root.querySelector(sel);
  };

  JA.qsa = function qsa(sel, root = document) {
    return [...root.querySelectorAll(sel)];
  };

  JA.imgSrc = function imgSrc(path) {
    if (!path) return 'assets/images/img2.jpeg';
    if (/^https?:\/\//i.test(path) || path.startsWith('/') || path.startsWith('assets/') || path.startsWith('uploads/')) {
      return path.startsWith('/') ? path.slice(1) : path;
    }
    return path;
  };

  JA.status = function status(el, message) {
    if (window.SiteUI && typeof SiteUI.status === 'function' && el) {
      SiteUI.status(el, message);
      return;
    }
    if (el) el.textContent = message;
  };
})(window.JustAclick);
