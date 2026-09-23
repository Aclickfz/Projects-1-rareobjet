const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { asyncHandler } = require('../utils');
const { signToken, setAuthCookie, clearAuthCookie, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!name || !email || password.length < 6) {
    return res.status(400).json({ error: 'Name, email and password (min 6 chars) are required' });
  }

  const [existing] = await pool.execute('SELECT id FROM users WHERE email = :email LIMIT 1', { email });
  if (existing.length) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const [result] = await pool.execute(
    `INSERT INTO users (name, email, password_hash, role) VALUES (:name, :email, :password_hash, 'customer')`,
    { name, email, password_hash }
  );

  const user = { id: result.insertId, name, email, role: 'customer' };

  if (req.sessionId) {
    const [guestCarts] = await pool.execute(
      'SELECT id FROM carts WHERE session_id = :sid LIMIT 1',
      { sid: req.sessionId }
    );
    if (guestCarts.length) {
      const [created] = await pool.execute('INSERT INTO carts (user_id) VALUES (:uid)', { uid: user.id });
      const userCartId = created.insertId;
      const [guestItems] = await pool.execute(
        'SELECT product_id, qty FROM cart_items WHERE cart_id = :id',
        { id: guestCarts[0].id }
      );
      for (const item of guestItems) {
        await pool.execute(
          'INSERT INTO cart_items (cart_id, product_id, qty) VALUES (:cid, :pid, :qty)',
          { cid: userCartId, pid: item.product_id, qty: item.qty }
        );
      }
      await pool.execute('DELETE FROM cart_items WHERE cart_id = :id', { id: guestCarts[0].id });
      await pool.execute('DELETE FROM carts WHERE id = :id', { id: guestCarts[0].id });
    }
  }

  const token = signToken(user);
  setAuthCookie(res, token);
  res.status(201).json({ user, token });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const [rows] = await pool.execute(
    'SELECT id, name, email, role, password_hash FROM users WHERE email = :email LIMIT 1',
    { email }
  );
  const row = rows[0];
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Merge guest session cart into user cart
  if (req.sessionId) {
    const [guestCarts] = await pool.execute(
      'SELECT id FROM carts WHERE session_id = :sid LIMIT 1',
      { sid: req.sessionId }
    );
    if (guestCarts.length) {
      let [userCarts] = await pool.execute('SELECT id FROM carts WHERE user_id = :uid LIMIT 1', {
        uid: row.id
      });
      if (!userCarts.length) {
        const [created] = await pool.execute('INSERT INTO carts (user_id) VALUES (:uid)', { uid: row.id });
        userCarts = [{ id: created.insertId }];
      }
      const guestId = guestCarts[0].id;
      const userCartId = userCarts[0].id;
      const [guestItems] = await pool.execute(
        'SELECT product_id, qty FROM cart_items WHERE cart_id = :id',
        { id: guestId }
      );
      for (const item of guestItems) {
        const [existing] = await pool.execute(
          'SELECT id, qty FROM cart_items WHERE cart_id = :cid AND product_id = :pid LIMIT 1',
          { cid: userCartId, pid: item.product_id }
        );
        if (existing.length) {
          await pool.execute('UPDATE cart_items SET qty = :qty WHERE id = :id', {
            qty: existing[0].qty + item.qty,
            id: existing[0].id
          });
        } else {
          await pool.execute(
            'INSERT INTO cart_items (cart_id, product_id, qty) VALUES (:cid, :pid, :qty)',
            { cid: userCartId, pid: item.product_id, qty: item.qty }
          );
        }
      }
      await pool.execute('DELETE FROM cart_items WHERE cart_id = :id', { id: guestId });
      await pool.execute('DELETE FROM carts WHERE id = :id', { id: guestId });
    }
  }

  const user = { id: row.id, name: row.name, email: row.email, role: row.role };
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ user, token });
}));

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', asyncHandler(async (req, res) => {
  res.json({ user: req.user || null });
}));

module.exports = router;
