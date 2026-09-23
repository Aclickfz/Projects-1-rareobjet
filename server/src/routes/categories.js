const express = require('express');
const pool = require('../db/pool');
const { asyncHandler } = require('../utils');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT c.*,
      (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) AS product_count
     FROM categories c
     WHERE c.is_active = 1
     ORDER BY c.name ASC`
  );
  res.json({ categories: rows });
}));

router.get('/:slug', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM categories WHERE slug = :slug AND is_active = 1 LIMIT 1',
    { slug: req.params.slug }
  );
  if (!rows.length) return res.status(404).json({ error: 'Category not found' });
  res.json({ category: rows[0] });
}));

module.exports = router;
