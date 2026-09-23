window.AdminApp = (function () {
  const TOKEN_KEY = 'jac_token';

  function token() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function formatInr(amount) {
    return `Rs. ${(Number(amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  async function api(path, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const t = token();
    if (t) headers.Authorization = `Bearer ${t}`;
    const res = await fetch(path, {
      credentials: 'include',
      ...options,
      headers,
      body:
        options.body && !(options.body instanceof FormData) && typeof options.body !== 'string'
          ? JSON.stringify(options.body)
          : options.body
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  }

  async function requireAdmin() {
    try {
      const { user } = await api('/api/auth/me');
      if (user.role !== 'admin') throw new Error('Admin only');
      return user;
    } catch {
      location.href = '../login.html?next=admin/index.html';
      throw new Error('redirect');
    }
  }

  function nav(active) {
    const items = [
      ['index.html', 'Dashboard'],
      ['products.html', 'Products'],
      ['inventory.html', 'Inventory'],
      ['orders.html', 'Orders'],
      ['customers.html', 'Customers'],
      ['reports.html', 'Reports'],
      ['../index.html', 'Storefront']
    ];
    return `
      <aside class="admin-sidebar">
        <h1>JustAclick Admin</h1>
        ${items
          .map(
            ([href, label]) =>
              `<a href="${href}" class="${active === href ? 'active' : ''}">${label}</a>`
          )
          .join('')}
        <a href="#" id="admin-logout">Log out</a>
      </aside>`;
  }

  function bindLogout() {
    document.getElementById('admin-logout')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await api('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem(TOKEN_KEY);
      location.href = '../login.html';
    });
  }

  return { api, requireAdmin, nav, bindLogout, formatInr, token };
})();
