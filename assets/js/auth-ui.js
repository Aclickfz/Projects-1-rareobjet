(function () {
  const JA = window.JustAclick;
  if (!JA) return;

  async function refreshHeader() {
    let user = null;
    try {
      const data = await JA.api('/api/auth/me');
      user = data.user;
      JA.user = user;
    } catch {
      JA.user = null;
      JA.setToken(null);
    }

    JA.qsa('.menu a[href="login.html"], .menu_mob .user a').forEach((link) => {
      if (user) {
        if (user.role === 'admin') {
          link.href = 'admin/index.html';
          link.innerHTML = `<i class='bx bx-user-circle text-lg'></i>${user.name.split(' ')[0]}`;
        } else {
          link.href = 'orders.html';
          link.innerHTML = `<i class='bx bx-user-circle text-lg'></i>${user.name.split(' ')[0]}`;
        }
      } else {
        link.href = 'login.html';
        if (link.closest('.menu')) {
          link.innerHTML = `<i class='bx bx-user-circle text-lg'></i>account`;
        }
      }
    });

    JA.qsa('a[href="#"]').forEach((a) => {
      const label = (a.textContent || '').toLowerCase();
      if (label.includes('track order')) {
        a.href = 'orders.html';
      }
    });

    try {
      const cart = await JA.api('/api/cart');
      const count = cart.cart?.count || 0;
      JA.qsa('.menu .cart-no a[href="cart.html"] + span, .menu_mob .cart span').forEach((badge) => {
        badge.textContent = `(${count})`;
      });
    } catch {
      JA.qsa('.menu .cart-no a[href="cart.html"] + span, .menu_mob .cart span').forEach((badge) => {
        badge.textContent = '(0)';
      });
    }

    if (JA.user) {
      try {
        const wish = await JA.api('/api/wishlist');
        JA.qsa('.menu a[href="whishlist.html"] + span').forEach((badge) => {
          badge.textContent = `(${wish.count || 0})`;
        });
      } catch {
        JA.qsa('.menu a[href="whishlist.html"] + span').forEach((badge) => {
          badge.textContent = '(0)';
        });
      }
    } else {
      JA.qsa('.menu a[href="whishlist.html"] + span').forEach((badge) => {
        badge.textContent = '(0)';
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    refreshHeader();
  });

  JA.refreshHeader = refreshHeader;
})();
