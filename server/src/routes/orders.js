const express = require('express');
const pool = require('../db/pool');
const { asyncHandler, orderNumber, invoiceNumber } = require('../utils');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getOrCreateCart, loadCartPayload } = require('./cart');

const router = express.Router();

const ALLOWED_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: []
};

async function loadOrder(orderId, userId = null, isAdmin = false) {
  const params = { id: orderId };
  let sql = `SELECT o.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
      inv.invoice_number, inv.issued_at
    FROM orders o
    JOIN users u ON u.id = o.user_id
    LEFT JOIN invoices inv ON inv.order_id = o.id
    WHERE o.id = :id`;
  if (!isAdmin && userId) {
    sql += ' AND o.user_id = :uid';
    params.uid = userId;
  }
  sql += ' LIMIT 1';

  const [rows] = await pool.execute(sql, params);
  if (!rows.length) return null;

  const [items] = await pool.execute(
    `SELECT oi.*,
      (SELECT path FROM product_images pi WHERE pi.product_id = oi.product_id ORDER BY is_primary DESC, sort_order ASC LIMIT 1) AS image
     FROM order_items oi
     WHERE oi.order_id = :id`,
    { id: orderId }
  );

  const order = rows[0];
  return {
    ...order,
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping),
    total: Number(order.total),
    items: items.map((i) => ({
      ...i,
      price_snapshot: Number(i.price_snapshot),
      line_total: Number(i.line_total)
    }))
  };
}

async function adjustStock(conn, productId, changeQty, reason, refId, userId, note) {
  await conn.execute(
    'UPDATE products SET stock_qty = stock_qty + :change WHERE id = :id',
    { change: changeQty, id: productId }
  );
  await conn.execute(
    `INSERT INTO inventory_logs (product_id, change_qty, reason, ref_id, created_by, note)
     VALUES (:product_id, :change_qty, :reason, :ref_id, :created_by, :note)`,
    {
      product_id: productId,
      change_qty: changeQty,
      reason,
      ref_id: refId,
      created_by: userId || null,
      note: note || null
    }
  );
}

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const given_name = String(req.body['given-name'] || req.body.given_name || '').trim();
  const family_name = String(req.body['family-name'] || req.body.family_name || '').trim();
  const city = String(req.body['address-level2'] || req.body.city || '').trim();
  const postal_code = String(req.body['postal-code'] || req.body.postal_code || '').trim();
  const street_address = String(req.body['street-address'] || req.body.street_address || '').trim();
  const notes = String(req.body['order-notes'] || req.body.notes || '').trim() || null;

  if (!given_name || !family_name || !city || !postal_code || !street_address) {
    return res.status(400).json({ error: 'Delivery details are incomplete' });
  }

  const cart = await getOrCreateCart(req);
  const payload = await loadCartPayload(cart.id);
  if (!payload.items.length) return res.status(400).json({ error: 'Cart is empty' });

  for (const item of payload.items) {
    if (!item.product?.is_active) {
      return res.status(400).json({ error: `${item.product?.name || 'Item'} is unavailable` });
    }
    if (item.qty > item.product.stock_qty) {
      return res.status(400).json({
        error: `Only ${item.product.stock_qty} left for ${item.product.name}`
      });
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const number = orderNumber();
    const [orderResult] = await conn.execute(
      `INSERT INTO orders
        (order_number, user_id, status, payment_method, payment_status, subtotal, shipping, total,
         given_name, family_name, city, postal_code, street_address, notes, stock_deducted)
       VALUES
        (:order_number, :user_id, 'pending', 'cod', 'unpaid', :subtotal, :shipping, :total,
         :given_name, :family_name, :city, :postal_code, :street_address, :notes, 0)`,
      {
        order_number: number,
        user_id: req.user.id,
        subtotal: payload.subtotal,
        shipping: payload.shipping,
        total: payload.total,
        given_name,
        family_name,
        city,
        postal_code,
        street_address,
        notes
      }
    );

    const orderId = orderResult.insertId;
    for (const item of payload.items) {
      await conn.execute(
        `INSERT INTO order_items (order_id, product_id, name_snapshot, price_snapshot, qty, line_total)
         VALUES (:order_id, :product_id, :name_snapshot, :price_snapshot, :qty, :line_total)`,
        {
          order_id: orderId,
          product_id: item.product_id,
          name_snapshot: item.product.name,
          price_snapshot: item.price,
          qty: item.qty,
          line_total: item.line_total
        }
      );
    }

    await conn.execute(
      `INSERT INTO invoices (order_id, invoice_number) VALUES (:order_id, :invoice_number)`,
      { order_id: orderId, invoice_number: invoiceNumber(orderId) }
    );

    await conn.execute('DELETE FROM cart_items WHERE cart_id = :cartId', { cartId: cart.id });
    await conn.commit();

    const order = await loadOrder(orderId, req.user.id, false);
    res.status(201).json({ order });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

router.get('/mine', requireAuth, asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT o.id, o.order_number, o.status, o.payment_status, o.total, o.created_at,
      inv.invoice_number
     FROM orders o
     LEFT JOIN invoices inv ON inv.order_id = o.id
     WHERE o.user_id = :uid
     ORDER BY o.created_at DESC`,
    { uid: req.user.id }
  );
  res.json({
    orders: rows.map((o) => ({ ...o, total: Number(o.total) }))
  });
}));

router.get('/track/:orderNumber', requireAuth, asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id FROM orders WHERE order_number = :num AND user_id = :uid LIMIT 1',
    { num: req.params.orderNumber, uid: req.user.id }
  );
  if (!rows.length) return res.status(404).json({ error: 'Order not found' });
  const order = await loadOrder(rows[0].id, req.user.id, false);
  res.json({ order });
}));

router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const order = await loadOrder(Number(req.params.id), req.user.id, isAdmin);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ order });
}));

router.patch('/:id/status', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const orderId = Number(req.params.id);
  const nextStatus = String(req.body.status || '').trim();
  const order = await loadOrder(orderId, null, true);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const allowed = ALLOWED_TRANSITIONS[order.status] || [];
  if (!allowed.includes(nextStatus)) {
    return res.status(400).json({
      error: `Cannot move from ${order.status} to ${nextStatus}`
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (nextStatus === 'confirmed' && !order.stock_deducted) {
      for (const item of order.items) {
        if (!item.product_id) continue;
        const [locked] = await conn.execute(
          'SELECT id, stock_qty, name FROM products WHERE id = :id FOR UPDATE',
          { id: item.product_id }
        );
        const product = locked[0];
        if (!product || product.stock_qty < item.qty) {
          throw Object.assign(new Error(`Insufficient stock for ${item.name_snapshot}`), { status: 400 });
        }
        await adjustStock(conn, item.product_id, -item.qty, 'order', orderId, req.user.id, `Order ${order.order_number}`);
      }
      await conn.execute('UPDATE orders SET stock_deducted = 1 WHERE id = :id', { id: orderId });
    }

    if (nextStatus === 'cancelled' && order.stock_deducted) {
      for (const item of order.items) {
        if (!item.product_id) continue;
        await adjustStock(conn, item.product_id, item.qty, 'cancel', orderId, req.user.id, `Cancel ${order.order_number}`);
      }
      await conn.execute('UPDATE orders SET stock_deducted = 0 WHERE id = :id', { id: orderId });
    }

    let paymentStatus = order.payment_status;
    if (nextStatus === 'confirmed' || nextStatus === 'shipped' || nextStatus === 'delivered') {
      // COD remains unpaid until delivered unless admin marks paid
      if (req.body.payment_status === 'paid') paymentStatus = 'paid';
      if (nextStatus === 'delivered' && req.body.mark_paid !== false) paymentStatus = 'paid';
    }
    if (nextStatus === 'cancelled' && paymentStatus === 'paid') paymentStatus = 'refunded';

    await conn.execute(
      'UPDATE orders SET status = :status, payment_status = :payment_status WHERE id = :id',
      { status: nextStatus, payment_status: paymentStatus, id: orderId }
    );

    await conn.commit();
    const updated = await loadOrder(orderId, null, true);
    res.json({ order: updated });
  } catch (err) {
    await conn.rollback();
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  } finally {
    conn.release();
  }
}));

module.exports = router;
module.exports.loadOrder = loadOrder;
module.exports.adjustStock = adjustStock;
