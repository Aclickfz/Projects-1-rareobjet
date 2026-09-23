const express = require('express');
const pool = require('../db/pool');
const { asyncHandler } = require('../utils');
const { requireAuth } = require('../middleware/auth');
const { attachImages } = require('../services/products');

const router = express.Router();

router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT p.*
     FROM wishlists w
     JOIN products p ON p.id = w.product_id
     WHERE w.user_id = :uid AND p.is_active = 1
     ORDER BY w.created_at DESC`,
    { uid: req.user.id }
  );
  const products = await attachImages(rows);
  res.json({ items: products, count: products.length });
}));

router.post('/toggle', asyncHandler(async (req, res) => {
  const productId = Number(req.body.product_id);
  if (!productId) return res.status(400).json({ error: 'product_id required' });

  const [products] = await pool.execute(
    'SELECT id FROM products WHERE id = :id AND is_active = 1 LIMIT 1',
    { id: productId }
  );
  if (!products.length) return res.status(404).json({ error: 'Product not found' });

  const [existing] = await pool.execute(
    'SELECT id FROM wishlists WHERE user_id = :uid AND product_id = :pid LIMIT 1',
    { uid: req.user.id, pid: productId }
  );

  let wished = false;
  if (existing.length) {
    await pool.execute('DELETE FROM wishlists WHERE id = :id', { id: existing[0].id });
  } else {
    await pool.execute('INSERT INTO wishlists (user_id, product_id) VALUES (:uid, :pid)', {
      uid: req.user.id,
      pid: productId
    });
    wished = true;
  }

  const [[{ count }]] = await pool.execute(
    'SELECT COUNT(*) AS count FROM wishlists WHERE user_id = :uid',
    { uid: req.user.id }
  );

  res.json({ wished, count: Number(count) });
}));

router.delete('/:productId', asyncHandler(async (req, res) => {
  await pool.execute('DELETE FROM wishlists WHERE user_id = :uid AND product_id = :pid', {
    uid: req.user.id,
    pid: Number(req.params.productId)
  });
  const [[{ count }]] = await pool.execute(
    'SELECT COUNT(*) AS count FROM wishlists WHERE user_id = :uid',
    { uid: req.user.id }
  );
  res.json({ ok: true, count: Number(count) });
}));

module.exports = router;
