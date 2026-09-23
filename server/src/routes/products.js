const express = require('express');
const pool = require('../db/pool');
const { asyncHandler } = require('../utils');
const { attachImages } = require('../services/products');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const category = String(req.query.category || '').trim();
  const sort = String(req.query.sort || 'newest');
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 24));
  const offset = (page - 1) * limit;
  const admin = req.query.all === '1' && req.user?.role === 'admin';

  const where = [];
  const params = {};

  if (!admin) where.push('p.is_active = 1');
  if (q) {
    where.push('(p.name LIKE :q OR p.description LIKE :q OR p.sku LIKE :q)');
    params.q = `%${q}%`;
  }
  if (category) {
    where.push('(c.slug = :category OR c.id = :categoryId)');
    params.category = category;
    params.categoryId = Number(category) || 0;
  }

  let orderBy = 'p.created_at DESC';
  if (sort === 'price-low') orderBy = 'p.price ASC';
  if (sort === 'price-high') orderBy = 'p.price DESC';
  if (sort === 'name') orderBy = 'p.name ASC';

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ${whereSql}`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ${whereSql}
     ORDER BY ${orderBy}
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  const products = await attachImages(rows);
  res.json({
    products,
    pagination: {
      page,
      limit,
      total: Number(countRows[0].total),
      pages: Math.ceil(Number(countRows[0].total) / limit)
    }
  });
}));

router.get('/:slugOrId', asyncHandler(async (req, res) => {
  const key = req.params.slugOrId;
  const isId = /^\d+$/.test(key);
  const [rows] = await pool.execute(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE ${isId ? 'p.id = :key' : 'p.slug = :key'}
     LIMIT 1`,
    { key: isId ? Number(key) : key }
  );
  if (!rows.length || (!rows[0].is_active && req.user?.role !== 'admin')) {
    return res.status(404).json({ error: 'Product not found' });
  }
  const [product] = await attachImages(rows);
  res.json({ product });
}));

module.exports = router;
