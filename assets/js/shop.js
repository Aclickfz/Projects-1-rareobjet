(function () {
  const JA = window.JustAclick;
  if (!JA) return;

  function productCardHtml(product) {
    const images = (product.images && product.images.length)
      ? product.images
      : [{ path: product.primary_image?.path || 'assets/images/img2.jpeg' }];
    const imgs = images
      .map(
        (img) =>
          `<img decoding="async" loading="lazy" src="${JA.imgSrc(img.path)}" class="img-fluid" alt="${escapeAttr(product.name)}">`
      )
      .join('');
    const badge = product.badge ? `<h6>${escapeHtml(product.badge)}</h6>` : '<h6>&nbsp;</h6>';
    const grade = product.grade_label ? `<p>${escapeHtml(product.grade_label)}</p>` : '';
    return `
      <div class="col-xl-4 col-sm-6" data-product-id="${product.id}">
        <div class="card__inner">
          <div class="card--img">
            <div class="media_hover">${imgs}</div>
            <div class="favorites">
              <button type="button" class="catalog-heart heart" data-wishlist-id="${product.id}" aria-label="Save to favourites" aria-pressed="false">
                <i class="bx bx-heart" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          <div class="card__inner_content">
            ${badge}
            <a href="product-details.html?slug=${encodeURIComponent(product.slug)}">${escapeHtml(product.name)}</a>
            <span>${JA.formatInr(product.price)}</span>
            ${grade}
          </div>
        </div>
      </div>`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, '&#39;');
  }

  async function loadProductsPage() {
    const grid = JA.qs('.product_box__content > .row');
    if (!grid) return;
    const params = new URLSearchParams(location.search);
    const q = params.get('q') || '';
    const category = params.get('category') || '';
    const sortSelect = JA.qs('.product_row__right select');
    const sort = sortSelect?.value || params.get('sort') || 'newest';

    JA.qsa('input[name="q"]').forEach((input) => {
      if (q) input.value = q;
    });

    grid.innerHTML = '<div class="col-12"><p class="ui-status" role="status">Loading products…</p></div>';
    try {
      const query = new URLSearchParams({ limit: '24', sort });
      if (q) query.set('q', q);
      if (category) query.set('category', category);
      const data = await JA.api(`/api/products?${query}`);
      if (!data.products.length) {
        grid.innerHTML = '<div class="col-12"><p class="ui-status" role="status">No products found.</p></div>';
        return;
      }
      grid.innerHTML = data.products.map(productCardHtml).join('');
      if (window.jQuery && jQuery.fn.slick) {
        jQuery('.media_hover').each(function () {
          if (jQuery(this).children().length > 1 && !jQuery(this).hasClass('slick-initialized')) {
            jQuery(this).slick({
              dots: false,
              arrows: false,
              autoplay: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
              autoplaySpeed: 2500
            });
          }
        });
      }
      const heading = JA.qs('.product_heading');
      if (heading && q) {
        JA.status(heading, `${data.pagination.total} results for “${q}”`);
      }
      bindWishlistButtons(grid);
    } catch (err) {
      grid.innerHTML = `<div class="col-12"><p class="ui-status" role="status">${escapeHtml(err.message)}</p></div>`;
    }

    if (sortSelect && !sortSelect.dataset.bound) {
      sortSelect.dataset.bound = '1';
      sortSelect.addEventListener('change', () => loadProductsPage());
    }
  }

  function bindWishlistButtons(root) {
    JA.qsa('[data-wishlist-id]', root).forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!JA.user) {
          location.href = 'login.html';
          return;
        }
        try {
          const data = await JA.api('/api/wishlist/toggle', {
            method: 'POST',
            body: { product_id: Number(btn.dataset.wishlistId) }
          });
          btn.setAttribute('aria-pressed', String(data.wished));
          JA.qsa('.menu a[href="whishlist.html"] + span').forEach((badge) => {
            badge.textContent = `(${data.count})`;
          });
          JA.status(btn.closest('.card__inner') || btn.parentElement, data.wished ? 'Saved to favourites' : 'Removed from favourites');
        } catch (err) {
          JA.status(btn.parentElement, err.message);
        }
      });
    });
  }

  async function loadProductDetails() {
    if (!document.body.classList.contains('page-product-details')) return;

    const params = new URLSearchParams(location.search);
    let slug = params.get('slug') || params.get('id');
    const content = JA.qs('.purchasing_wrapper__content');

    if (!slug) {
      try {
        const data = await JA.api('/api/products?limit=1');
        if (data.products?.[0]?.slug) {
          location.replace(`product-details.html?slug=${encodeURIComponent(data.products[0].slug)}`);
          return;
        }
      } catch {
        /* fall through */
      }
      if (content?.querySelector('h1')) {
        content.querySelector('h1').textContent = 'No product selected';
      }
      const priceEl = content?.querySelector('.price') || content?.querySelector('p');
      if (priceEl) priceEl.textContent = '';
      const orderNow = JA.qs('.order-now');
      if (orderNow) {
        orderNow.innerHTML = '<a class="global_btn" href="product.html">Browse products</a>';
      }
      return;
    }

    try {
      const { product } = await JA.api(`/api/products/${encodeURIComponent(slug)}`);
      JA.currentProduct = product;

      const h1 = content?.querySelector('h1');
      if (h1) h1.textContent = product.name;

      const priceEl = content?.querySelector('.price') || content?.querySelector('p');
      if (priceEl) priceEl.textContent = JA.formatInr(product.price);

      const imgBox = document.getElementById('imgBox');
      const images = product.images?.length ? product.images : [{ path: 'assets/images/img2.jpeg' }];
      if (imgBox) {
        imgBox.src = JA.imgSrc(images[0].path);
        imgBox.alt = product.name;
      }

      const thumbsWrap = JA.qs('.purchasing_wrapper .col-lg-7 .row, .vertical_img')?.closest('.row') 
        || JA.qs('.purchasing_big__img')?.parentElement;
      const thumbButtons = JA.qsa('.vertical_img');
      if (thumbButtons.length) {
        const parent = thumbButtons[0].parentElement;
        parent.innerHTML = images
          .map(
            (img, i) => `
            <div class="vertical_img">
              <button type="button" aria-label="View product image ${i + 1}" aria-pressed="${i === 0}">
                <img decoding="async" loading="lazy" src="${JA.imgSrc(img.path)}" class="img-fluid" alt="${escapeAttr(product.name)}">
              </button>
            </div>`
          )
          .join('');
        parent.querySelectorAll('button').forEach((button) =>
          button.addEventListener('click', () => {
            myFunction(button.querySelector('img'));
            parent.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
          })
        );
      }

      const orderNow = JA.qs('.order-now');
      if (orderNow) {
        orderNow.innerHTML = `
          <button type="button" class="global_btn" data-add-cart><i class='bx bxs-shopping-bag'></i> add to cart</button>
          <button type="button" class="global_btn" data-buy-now><i class='bx bxs-cart-alt'></i>buy now</button>
          <button type="button" class="catalog-heart heart" data-wishlist-id="${product.id}" aria-label="Save to favourites"><i class="bx bx-heart"></i></button>`;
        bindWishlistButtons(orderNow);

        const qtyInput = JA.qs('.purchase-quantity input');
        const add = async (goCheckout) => {
          const qty = Math.max(1, Number(qtyInput?.value) || 1);
          try {
            await JA.api('/api/cart/items', { method: 'POST', body: { product_id: product.id, qty } });
            await JA.refreshHeader?.();
            if (goCheckout) location.href = 'payment.html';
            else JA.status(orderNow, 'Added to cart');
          } catch (err) {
            JA.status(orderNow, err.message);
          }
        };
        orderNow.querySelector('[data-add-cart]')?.addEventListener('click', () => add(false));
        orderNow.querySelector('[data-buy-now]')?.addEventListener('click', () => add(true));
      }
    } catch (err) {
      if (content?.querySelector('h1')) content.querySelector('h1').textContent = 'Product not found';
      JA.status(content || document.body, err.message);
    }
  }

  async function loadCartPage() {
    const container = JA.qs('.cart_wrapper__content-details');
    if (!container) return;

    container.innerHTML = '<p class="ui-status" role="status">Loading cart…</p>';
    try {
      const { cart } = await JA.api('/api/cart');
      if (!cart.items.length) {
        container.innerHTML =
          '<div class="cart-empty ui-status" role="status"><p>Your cart is empty.</p><a href="product.html" class="global_btn">Continue shopping</a></div>';
        const checkout = JA.qs('.checkout-section');
        if (checkout) checkout.hidden = true;
        return;
      }

      container.innerHTML = cart.items
        .map(
          (item) => `
        <div class="table_flax" data-item-id="${item.id}">
          <div class="product">
            <div class="product-img">
              <img decoding="async" src="${JA.imgSrc(item.product?.primary_image?.path)}" class="img-fluid" alt="">
            </div>
            <div class="product_details">
              <h3><a href="product-details.html?slug=${encodeURIComponent(item.product.slug)}">${escapeHtml(item.product.name)}</a></h3>
              <p>${JA.formatInr(item.price)}</p>
            </div>
          </div>
          <div class="cart-quantity">
            <form action="">
              <div class="cart-quantity__flax">
                <div class="cart-quantity__num">
                  <button type="button" class="quantity-button" data-step="-1" aria-label="Decrease quantity">−</button>
                  <input type="number" min="1" max="99" step="1" value="${item.qty}" aria-label="Quantity">
                  <button type="button" class="quantity-button" data-step="1" aria-label="Increase quantity">+</button>
                </div>
                <div class="del-btn">
                  <button type="button" aria-label="Remove item"><i class="bx bx-trash"></i></button>
                </div>
              </div>
            </form>
          </div>
          <div class="cart_total"><h6>${JA.formatInr(item.line_total)}</h6></div>
        </div>`
        )
        .join('');

      const total = JA.qs('.checkout-section_content h6');
      if (total) total.textContent = JA.formatInr(cart.subtotal);
      const checkout = JA.qs('.checkout-section');
      if (checkout) checkout.hidden = false;

      container.querySelectorAll('.table_flax').forEach((row) => {
        const input = row.querySelector('input');
        const itemId = row.dataset.itemId;
        const syncQty = async () => {
          try {
            const data = await JA.api(`/api/cart/items/${itemId}`, {
              method: 'PATCH',
              body: { qty: Number(input.value) }
            });
            const updated = data.cart.items.find((i) => String(i.id) === String(itemId));
            if (updated) row.querySelector('.cart_total h6').textContent = JA.formatInr(updated.line_total);
            if (total) total.textContent = JA.formatInr(data.cart.subtotal);
            await JA.refreshHeader?.();
          } catch (err) {
            JA.status(container, err.message);
            loadCartPage();
          }
        };
        row.querySelectorAll('[data-step]').forEach((button) =>
          button.addEventListener('click', () => {
            input.value = Math.min(99, Math.max(1, Number(input.value) + Number(button.dataset.step)));
            syncQty();
          })
        );
        input.addEventListener('change', syncQty);
        row.querySelector('.del-btn button')?.addEventListener('click', async () => {
          await JA.api(`/api/cart/items/${itemId}`, { method: 'DELETE' });
          await JA.refreshHeader?.();
          loadCartPage();
        });
      });
    } catch (err) {
      container.innerHTML = `<p class="ui-status" role="status">${escapeHtml(err.message)}</p>`;
    }
  }

  async function loadCheckoutPage() {
    if (!document.body.classList.contains('page-payment')) return;

    try {
      if (!JA.user) {
        const me = await JA.api('/api/auth/me').catch(() => null);
        if (!me?.user) {
          location.href = 'login.html?next=payment.html';
          return;
        }
        JA.user = me.user;
      }
    } catch {
      location.href = 'login.html?next=payment.html';
      return;
    }

    const { cart } = await JA.api('/api/cart');
    if (!cart.items.length) {
      location.href = 'cart.html';
      return;
    }

    const right = JA.qs('#checkout-summary') || JA.qs('.payment_right');
    if (right) {
      right.innerHTML = `
        <div class="checkout-live-summary">
          ${cart.items
            .map(
              (item) => `
            <div class="payment_img" style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
              <div class="customer_product">
                <img src="${JA.imgSrc(item.product?.primary_image?.path)}" class="img-fluid" alt="" style="width:64px;height:64px;object-fit:cover;">
                <div class="cart_number"><p>${item.qty}</p></div>
              </div>
              <div class="product_name">
                <h6>${escapeHtml(item.product.name)}</h6>
                <div class="product_price"><h3>${JA.formatInr(item.line_total)}</h3></div>
              </div>
            </div>`
            )
            .join('')}
          <div class="subtotal">
            <div class="subtotal_box"><h6>subtotal</h6><p>${JA.formatInr(cart.subtotal)}</p></div>
            <div class="subtotal_box"><h6>shipping</h6><p>${JA.formatInr(cart.shipping)}</p></div>
            <div class="subtotal_box"><h6>total</h6><p>${JA.formatInr(cart.total)}</p></div>
            <div class="subtotal_box"><h6>payment</h6><p>Cash on Delivery</p></div>
          </div>
        </div>`;
    }

    const checkoutForm = JA.qs('#checkout-form') || JA.qs('.payment_left form');
    if (!checkoutForm) return;
    checkoutForm.removeAttribute('data-static-form');
    checkoutForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fd = new FormData(checkoutForm);
      const body = Object.fromEntries(fd.entries());
      try {
        const data = await JA.api('/api/orders', { method: 'POST', body });
        location.href = `order-details.html?id=${data.order.id}`;
      } catch (err) {
        JA.status(checkoutForm, err.message);
      }
    });
  }

  async function loadWishlistPage() {
    const content = JA.qs('.whishlist_content');
    if (!content) return;
    if (!JA.getToken()) {
      location.href = 'login.html?next=whishlist.html';
      return;
    }
    try {
      const data = await JA.api('/api/wishlist');
      const countEl = JA.qs('.whishlist_header__left p');
      if (countEl) countEl.textContent = `${data.count} ${data.count === 1 ? 'item' : 'items'}`;
      if (!data.items.length) {
        content.innerHTML = '<p class="ui-status" role="status">Your favourites list is empty. Browse the collection for more inspiration.</p>';
        return;
      }
      content.innerHTML = `<div class="row">${data.items
        .map(
          (p) => `
        <div class="col-md-3 col-sm-6">
          <div class="whishlist-box" data-product-id="${p.id}">
            <div class="whishlist-box-img">
              <img src="${JA.imgSrc(p.primary_image?.path)}" class="img-fluid" alt="">
              <button type="button" class="heart" data-remove-wish="${p.id}" aria-label="Remove"><i class="bx bxs-heart"></i></button>
            </div>
            <div class="whishlist-box-content">
              <p>${escapeHtml(p.name)}</p>
              <a href="product-details.html?slug=${encodeURIComponent(p.slug)}">view details</a>
            </div>
          </div>
        </div>`
        )
        .join('')}</div>`;
      content.querySelectorAll('[data-remove-wish]').forEach((btn) =>
        btn.addEventListener('click', async () => {
          await JA.api(`/api/wishlist/${btn.dataset.removeWish}`, { method: 'DELETE' });
          loadWishlistPage();
          JA.refreshHeader?.();
        })
      );
    } catch (err) {
      content.innerHTML = `<p class="ui-status">${escapeHtml(err.message)}</p>`;
    }
  }

  async function loadCategoriesPage() {
    if (!document.body.classList.contains('page-categories')) return;
    try {
      const { categories } = await JA.api('/api/categories');
      const listHost = JA.qs('.categories_wrapper__left');
      if (listHost && categories.length) {
        listHost.innerHTML = `
          <h2 class="sr-only">Furniture categories</h2>
          <div class="categories-list">
            ${categories
              .map(
                (c) =>
                  `<a href="product.html?category=${encodeURIComponent(c.slug)}">${escapeHtml(c.name)} <i class='bx bx-chevron-right'></i></a>`
              )
              .join('')}
            <a href="product.html">Shop all <i class='bx bx-chevron-right'></i></a>
          </div>`;
      }
      const tiles = JA.qs('.categories_wrapper__right .row') || JA.qs('.categories_wrapper .row.g-4, .categories_wrapper__flex .col-xl-10 .row');
      const tileParent = JA.qs('.categories_wrapper__right') || JA.qs('.col-xl-10');
      if (tileParent && categories.length) {
        const existingRow = tileParent.querySelector('.row');
        const target = existingRow || tileParent;
        if (existingRow) {
          existingRow.innerHTML = categories
            .map(
              (c) => `
            <div class="col-md-4 col-sm-6">
              <a href="product.html?category=${encodeURIComponent(c.slug)}" class="category-tile">
                <img src="${JA.imgSrc(c.image || 'assets/images/furniture1.jpeg')}" class="img-fluid" alt="">
                <div class="category-caption"><span>${escapeHtml(c.name)}</span></div>
              </a>
            </div>`
            )
            .join('');
        }
      }
    } catch {
      /* keep static markup */
    }
  }

  async function loadOrdersPage() {
    const list = JA.qs('#orders-list');
    if (!list) return;
    if (!JA.getToken()) {
      location.href = 'login.html?next=orders.html';
      return;
    }
    try {
      const { orders } = await JA.api('/api/orders/mine');
      if (!orders.length) {
        list.innerHTML = '<p class="ui-status">No orders yet. <a href="product.html">Start shopping</a></p>';
        return;
      }
      list.innerHTML = `
        <div class="table-responsive">
          <table class="table">
            <thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Total</th><th></th></tr></thead>
            <tbody>
              ${orders
                .map(
                  (o) => `<tr>
                    <td>${escapeHtml(o.order_number)}</td>
                    <td>${escapeHtml(String(o.created_at).slice(0, 10))}</td>
                    <td>${escapeHtml(o.status)}</td>
                    <td>${JA.formatInr(o.total)}</td>
                    <td><a href="order-details.html?id=${o.id}">View</a></td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;
    } catch (err) {
      list.innerHTML = `<p class="ui-status">${escapeHtml(err.message)}</p>`;
    }
  }

  async function loadOrderDetailsPage() {
    const host = JA.qs('#order-details');
    if (!host) return;
    const id = new URLSearchParams(location.search).get('id');
    const orderNumber = new URLSearchParams(location.search).get('order');
    if (!JA.getToken()) {
      location.href = 'login.html';
      return;
    }
    try {
      const data = id
        ? await JA.api(`/api/orders/${id}`)
        : await JA.api(`/api/orders/track/${encodeURIComponent(orderNumber)}`);
      const o = data.order;
      host.innerHTML = `
        <h1>Order ${escapeHtml(o.order_number)}</h1>
        <p>Status: <strong>${escapeHtml(o.status)}</strong> · Payment: ${escapeHtml(o.payment_status)} (COD)</p>
        <p>Invoice: ${escapeHtml(o.invoice_number || '—')}</p>
        <p>Ship to: ${escapeHtml(o.given_name)} ${escapeHtml(o.family_name)}, ${escapeHtml(o.street_address)}, ${escapeHtml(o.city)} ${escapeHtml(o.postal_code)}</p>
        <ul>
          ${o.items
            .map((i) => `<li>${escapeHtml(i.name_snapshot)} × ${i.qty} — ${JA.formatInr(i.line_total)}</li>`)
            .join('')}
        </ul>
        <p>Subtotal ${JA.formatInr(o.subtotal)} · Shipping ${JA.formatInr(o.shipping)} · <strong>Total ${JA.formatInr(o.total)}</strong></p>
        <p><a class="global_btn" href="invoice.html?id=${o.id}">View invoice</a>
           <button type="button" class="global_btn" id="logout-btn" style="margin-left:8px;">Log out</button></p>`;
      JA.qs('#logout-btn')?.addEventListener('click', async () => {
        await JA.api('/api/auth/logout', { method: 'POST' });
        JA.setToken(null);
        location.href = 'index.html';
      });
    } catch (err) {
      host.innerHTML = `<p class="ui-status">${escapeHtml(err.message)}</p>`;
    }
  }

  async function bindAuthForms() {
    const loginForm = document.querySelector('body.page-login form.sign_form');
    if (loginForm) {
      loginForm.setAttribute('action', '/api/auth/login');
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fd = new FormData(loginForm);
        try {
          const data = await JA.api('/api/auth/login', {
            method: 'POST',
            body: { email: fd.get('email'), password: fd.get('password') }
          });
          JA.setToken(data.token);
          const next = new URLSearchParams(location.search).get('next');
          if (data.user.role === 'admin') location.href = 'admin/index.html';
          else location.href = next || 'orders.html';
        } catch (err) {
          JA.status(loginForm, err.message);
        }
      });
    }

    const signupForm = document.querySelector('body.page-signup form.sign_form');
    if (signupForm) {
      signupForm.setAttribute('action', '/api/auth/register');
      signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fd = new FormData(signupForm);
        try {
          const data = await JA.api('/api/auth/register', {
            method: 'POST',
            body: { name: fd.get('name'), email: fd.get('email'), password: fd.get('password') }
          });
          JA.setToken(data.token);
          location.href = 'product.html';
        } catch (err) {
          JA.status(signupForm, err.message);
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindAuthForms();
    loadProductsPage();
    loadProductDetails();
    loadCartPage();
    loadCheckoutPage();
    loadWishlistPage();
    loadCategoriesPage();
    loadOrdersPage();
    loadOrderDetailsPage();
  });
})();
