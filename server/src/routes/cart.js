const express = require('express');
const pool = require('../db/pool');
const { asyncHandler } = require('../utils');
const { attachImages } = require('../services/products');

const router = express.Router();

async function getOrCreateCart(req) {
  if (req.user) {
    const [rows] = await pool.execute('SELECT * FROM carts WHERE user_id = :uid LIMIT 1', { uid: req.user.id });
    if (rows.length) return rows[0];
    const [result] = await pool.execute('INSERT INTO carts (user_id) VALUES (:uid)', { uid: req.user.id });
    return { id: result.insertId, user_id: req.user.id, session_id: null };
  }

  const [rows] = await pool.execute('SELECT * FROM carts WHERE session_id = :sid LIMIT 1', { sid: req.sessionId });
  if (rows.length) return rows[0];
  const [result] = await pool.execute('INSERT INTO carts (session_id) VALUES (:sid)', { sid: req.sessionId });
  return { id: result.insertId, user_id: null, session_id: req.sessionId };
}

async function loadCartPayload(cartId) {
  const [items] = await pool.execute(
    `SELECT ci.id, ci.qty, ci.product_id, p.name, p.slug, p.price, p.stock_qty, p.is_active
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.cart_id = :cartId
     ORDER BY ci.id DESC`,
    { cartId }
  );

  const withImages = await attachImages(
    items.map((i) => ({
      id: i.product_id,
      name: i.name,
      slug: i.slug,
      price: i.price,
      stock_qty: i.stock_qty,
      is_active: i.is_active
    }))
  );
  const byId = Object.fromEntries(withImages.map((p) => [p.id, p]));

  let subtotal = 0;
  let count = 0;
  const mapped = items.map((item) => {
    const product = byId[item.product_id];
    const price = Number(item.price);
    const line_total = price * item.qty;
    subtotal += line_total;
    count += item.qty;
    return {
      id: item.id,
      product_id: item.product_id,
      qty: item.qty,
      price,
      line_total,
      product
    };
  });

  const shipping = mapped.length ? Number(process.env.SHIPPING_FLAT_INR || 99) : 0;
  return {
    items: mapped,
    count,
    subtotal,
    shipping,
    total: subtotal + shipping
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req);
  const payload = await loadCartPayload(cart.id);
  res.json({ cart: payload });
}));

router.post('/items', asyncHandler(async (req, res) => {
  const productId = Number(req.body.product_id);
  const qty = Math.max(1, Math.min(99, Number(req.body.qty) || 1));
  if (!productId) return res.status(400).json({ error: 'product_id required' });

  const [products] = await pool.execute(
    'SELECT id, stock_qty, is_active FROM products WHERE id = :id LIMIT 1',
    { id: productId }
  );
  const product = products[0];
  if (!product || !product.is_active) return res.status(404).json({ error: 'Product not available' });
  if (product.stock_qty < 1) return res.status(400).json({ error: 'Out of stock' });

  const cart = await getOrCreateCart(req);
  const [existing] = await pool.execute(
    'SELECT id, qty FROM cart_items WHERE cart_id = :cartId AND product_id = :pid LIMIT 1',
    { cartId: cart.id, pid: productId }
  );

  const nextQty = (existing[0]?.qty || 0) + qty;
  if (nextQty > product.stock_qty) {
    return res.status(400).json({ error: `Only ${product.stock_qty} in stock` });
  }

  if (existing.length) {
    await pool.execute('UPDATE cart_items SET qty = :qty WHERE id = :id', { qty: nextQty, id: existing[0].id });
  } else {
    await pool.execute(
      'INSERT INTO cart_items (cart_id, product_id, qty) VALUES (:cartId, :pid, :qty)',
      { cartId: cart.id, pid: productId, qty }
    );
  }

  const payload = await loadCartPayload(cart.id);
  res.status(201).json({ cart: payload });
}));

router.patch('/items/:id', asyncHandler(async (req, res) => {
  const itemId = Number(req.params.id);
  const qty = Math.max(1, Math.min(99, Number(req.body.qty) || 1));
  const cart = await getOrCreateCart(req);

  const [rows] = await pool.execute(
    `SELECT ci.*, p.stock_qty, p.is_active
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.id = :id AND ci.cart_id = :cartId
     LIMIT 1`,
    { id: itemId, cartId: cart.id }
  );
  if (!rows.length) return res.status(404).json({ error: 'Cart item not found' });
  if (!rows[0].is_active) return res.status(400).json({ error: 'Product no longer available' });
  if (qty > rows[0].stock_qty) return res.status(400).json({ error: `Only ${rows[0].stock_qty} in stock` });

  await pool.execute('UPDATE cart_items SET qty = :qty WHERE id = :id', { qty, id: itemId });
  res.json({ cart: await loadCartPayload(cart.id) });
}));

router.delete('/items/:id', asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req);
  await pool.execute('DELETE FROM cart_items WHERE id = :id AND cart_id = :cartId', {
    id: Number(req.params.id),
    cartId: cart.id
  });
  res.json({ cart: await loadCartPayload(cart.id) });
}));

router.delete('/', asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req);
  await pool.execute('DELETE FROM cart_items WHERE cart_id = :cartId', { cartId: cart.id });
  res.json({ cart: await loadCartPayload(cart.id) });
}));

module.exports = router;
module.exports.getOrCreateCart = getOrCreateCart;
module.exports.loadCartPayload = loadCartPayload;
