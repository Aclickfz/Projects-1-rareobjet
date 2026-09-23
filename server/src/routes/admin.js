const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../db/pool');
const { asyncHandler, slugify } = require('../utils');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { attachImages } = require('../services/products');
const { loadOrder, adjustStock } = require('./orders');

const router = express.Router();
router.use(requireAuth, requireAdmin);

const uploadDir = path.join(__dirname, '../../../uploads/products');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only'));
    cb(null, true);
  }
});

router.get('/dashboard', asyncHandler(async (_req, res) => {
  const [[stats]] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM orders) AS orders_total,
      (SELECT COUNT(*) FROM orders WHERE status = 'pending') AS orders_pending,
      (SELECT COALESCE(SUM(total),0) FROM orders WHERE status IN ('confirmed','shipped','delivered')) AS revenue,
      (SELECT COUNT(*) FROM products WHERE is_active = 1) AS products_active,
      (SELECT COUNT(*) FROM products WHERE stock_qty <= 5 AND is_active = 1) AS low_stock,
      (SELECT COUNT(*) FROM users WHERE role = 'customer') AS customers
  `);

  const [recentOrders] = await pool.execute(
    `SELECT o.id, o.order_number, o.status, o.total, o.created_at, u.name AS customer_name
     FROM orders o JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC LIMIT 8`
  );

  const [lowStock] = await pool.execute(
    `SELECT id, name, sku, stock_qty, price FROM products
     WHERE is_active = 1 AND stock_qty <= 5
     ORDER BY stock_qty ASC LIMIT 10`
  );

  res.json({
    stats: {
      ...stats,
      revenue: Number(stats.revenue)
    },
    recentOrders: recentOrders.map((o) => ({ ...o, total: Number(o.total) })),
    lowStock: lowStock.map((p) => ({ ...p, price: Number(p.price) }))
  });
}));

router.get('/products', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const params = {};
  let where = '1=1';
  if (q) {
    where += ' AND (p.name LIKE :q OR p.sku LIKE :q)';
    params.q = `%${q}%`;
  }
  const [rows] = await pool.execute(
    `SELECT p.*, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE ${where}
     ORDER BY p.updated_at DESC`,
    params
  );
  res.json({ products: await attachImages(rows) });
}));

router.post('/products', upload.array('images', 8), asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name required' });

  let slug = slugify(req.body.slug || name);
  const [clash] = await pool.execute('SELECT id FROM products WHERE slug = :slug', { slug });
  if (clash.length) slug = `${slug}-${Date.now().toString(36)}`;

  const [result] = await pool.execute(
    `INSERT INTO products
      (category_id, name, slug, description, price, compare_at_price, stock_qty, sku, badge, grade_label, is_active)
     VALUES
      (:category_id, :name, :slug, :description, :price, :compare_at_price, :stock_qty, :sku, :badge, :grade_label, :is_active)`,
    {
      category_id: req.body.category_id ? Number(req.body.category_id) : null,
      name,
      slug,
      description: req.body.description || null,
      price: Number(req.body.price) || 0,
      compare_at_price: req.body.compare_at_price ? Number(req.body.compare_at_price) : null,
      stock_qty: Number(req.body.stock_qty) || 0,
      sku: req.body.sku || null,
      badge: req.body.badge || null,
      grade_label: req.body.grade_label || null,
      is_active: req.body.is_active === '0' || req.body.is_active === false ? 0 : 1
    }
  );

  const productId = result.insertId;
  const existingPaths = Array.isArray(req.body.existing_images)
    ? req.body.existing_images
    : req.body.existing_images
      ? [req.body.existing_images]
      : [];

  let sort = 0;
  for (const p of existingPaths) {
    await pool.execute(
      `INSERT INTO product_images (product_id, path, sort_order, is_primary)
       VALUES (:product_id, :path, :sort_order, :is_primary)`,
      { product_id: productId, path: p, sort_order: sort, is_primary: sort === 0 ? 1 : 0 }
    );
    sort += 1;
  }
  for (const file of req.files || []) {
    const rel = `uploads/products/${file.filename}`;
    await pool.execute(
      `INSERT INTO product_images (product_id, path, sort_order, is_primary)
       VALUES (:product_id, :path, :sort_order, :is_primary)`,
      { product_id: productId, path: rel, sort_order: sort, is_primary: sort === 0 ? 1 : 0 }
    );
    sort += 1;
  }

  const [rows] = await pool.execute('SELECT * FROM products WHERE id = :id', { id: productId });
  const [product] = await attachImages(rows);
  res.status(201).json({ product });
}));

router.put('/products/:id', upload.array('images', 8), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await pool.execute('SELECT * FROM products WHERE id = :id', { id });
  if (!existing.length) return res.status(404).json({ error: 'Product not found' });

  const name = String(req.body.name || existing[0].name).trim();
  let slug = slugify(req.body.slug || name);
  const [clash] = await pool.execute('SELECT id FROM products WHERE slug = :slug AND id <> :id', { slug, id });
  if (clash.length) slug = `${slug}-${id}`;

  await pool.execute(
    `UPDATE products SET
      category_id = :category_id,
      name = :name,
      slug = :slug,
      description = :description,
      price = :price,
      compare_at_price = :compare_at_price,
      stock_qty = :stock_qty,
      sku = :sku,
      badge = :badge,
      grade_label = :grade_label,
      is_active = :is_active
     WHERE id = :id`,
    {
      id,
      category_id: req.body.category_id ? Number(req.body.category_id) : null,
      name,
      slug,
      description: req.body.description || null,
      price: Number(req.body.price) || 0,
      compare_at_price: req.body.compare_at_price ? Number(req.body.compare_at_price) : null,
      stock_qty: Number(req.body.stock_qty ?? existing[0].stock_qty),
      sku: req.body.sku || null,
      badge: req.body.badge || null,
      grade_label: req.body.grade_label || null,
      is_active: req.body.is_active === '0' || req.body.is_active === false ? 0 : 1
    }
  );

  if (req.body.replace_images === '1' || (req.files && req.files.length) || req.body.existing_images) {
    await pool.execute('DELETE FROM product_images WHERE product_id = :id', { id });
    const existingPaths = Array.isArray(req.body.existing_images)
      ? req.body.existing_images
      : req.body.existing_images
        ? [req.body.existing_images]
        : [];
    let sort = 0;
    for (const p of existingPaths) {
      await pool.execute(
        `INSERT INTO product_images (product_id, path, sort_order, is_primary)
         VALUES (:product_id, :path, :sort_order, :is_primary)`,
        { product_id: id, path: p, sort_order: sort, is_primary: sort === 0 ? 1 : 0 }
      );
      sort += 1;
    }
    for (const file of req.files || []) {
      const rel = `uploads/products/${file.filename}`;
      await pool.execute(
        `INSERT INTO product_images (product_id, path, sort_order, is_primary)
         VALUES (:product_id, :path, :sort_order, :is_primary)`,
        { product_id: id, path: rel, sort_order: sort, is_primary: sort === 0 ? 1 : 0 }
      );
      sort += 1;
    }
  }

  const [rows] = await pool.execute('SELECT * FROM products WHERE id = :id', { id });
  const [product] = await attachImages(rows);
  res.json({ product });
}));

router.delete('/products/:id', asyncHandler(async (req, res) => {
  await pool.execute('UPDATE products SET is_active = 0 WHERE id = :id', { id: Number(req.params.id) });
  res.json({ ok: true });
}));

router.post('/inventory/adjust', asyncHandler(async (req, res) => {
  const productId = Number(req.body.product_id);
  const change = Number(req.body.change_qty);
  const note = String(req.body.note || '').trim() || null;
  if (!productId || !Number.isFinite(change) || change === 0) {
    return res.status(400).json({ error: 'product_id and non-zero change_qty required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute('SELECT id, stock_qty FROM products WHERE id = :id FOR UPDATE', {
      id: productId
    });
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Product not found' });
    }
    const next = rows[0].stock_qty + change;
    if (next < 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Stock cannot go below zero' });
    }
    await adjustStock(conn, productId, change, 'admin_adjust', null, req.user.id, note);
    await conn.commit();
    const [[product]] = await pool.execute('SELECT id, name, stock_qty FROM products WHERE id = :id', {
      id: productId
    });
    res.json({ product });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

router.get('/categories', asyncHandler(async (_req, res) => {
  const [rows] = await pool.execute('SELECT * FROM categories ORDER BY name ASC');
  res.json({ categories: rows });
}));

router.post('/categories', asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name required' });
  const slug = slugify(req.body.slug || name);
  const [result] = await pool.execute(
    `INSERT INTO categories (name, slug, image, is_active)
     VALUES (:name, :slug, :image, :is_active)`,
    {
      name,
      slug,
      image: req.body.image || null,
      is_active: req.body.is_active === 0 || req.body.is_active === false ? 0 : 1
    }
  );
  const [rows] = await pool.execute('SELECT * FROM categories WHERE id = :id', { id: result.insertId });
  res.status(201).json({ category: rows[0] });
}));

router.put('/categories/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await pool.execute(
    `UPDATE categories SET name = :name, slug = :slug, image = :image, is_active = :is_active WHERE id = :id`,
    {
      id,
      name: String(req.body.name || '').trim(),
      slug: slugify(req.body.slug || req.body.name || ''),
      image: req.body.image || null,
      is_active: req.body.is_active === 0 || req.body.is_active === false ? 0 : 1
    }
  );
  const [rows] = await pool.execute('SELECT * FROM categories WHERE id = :id', { id });
  res.json({ category: rows[0] });
}));

router.get('/orders', asyncHandler(async (req, res) => {
  const status = String(req.query.status || '').trim();
  const params = {};
  let where = '1=1';
  if (status) {
    where += ' AND o.status = :status';
    params.status = status;
  }
  const [rows] = await pool.execute(
    `SELECT o.*, u.name AS customer_name, u.email AS customer_email, inv.invoice_number
     FROM orders o
     JOIN users u ON u.id = o.user_id
     LEFT JOIN invoices inv ON inv.order_id = o.id
     WHERE ${where}
     ORDER BY o.created_at DESC
     LIMIT 200`,
    params
  );
  res.json({
    orders: rows.map((o) => ({
      ...o,
      subtotal: Number(o.subtotal),
      shipping: Number(o.shipping),
      total: Number(o.total)
    }))
  });
}));

router.get('/orders/:id', asyncHandler(async (req, res) => {
  const order = await loadOrder(Number(req.params.id), null, true);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ order });
}));

router.get('/customers', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const params = {};
  let where = `u.role = 'customer'`;
  if (q) {
    where += ' AND (u.name LIKE :q OR u.email LIKE :q OR u.phone LIKE :q)';
    params.q = `%${q}%`;
  }
  const [rows] = await pool.execute(
    `SELECT u.id, u.name, u.email, u.phone, u.notes, u.created_at,
      COUNT(o.id) AS orders_count,
      COALESCE(SUM(CASE WHEN o.status IN ('confirmed','shipped','delivered') THEN o.total ELSE 0 END), 0) AS lifetime_value,
      MAX(o.created_at) AS last_order_at
     FROM users u
     LEFT JOIN orders o ON o.user_id = u.id
     WHERE ${where}
     GROUP BY u.id
     ORDER BY u.created_at DESC`,
    params
  );
  res.json({
    customers: rows.map((c) => ({
      ...c,
      lifetime_value: Number(c.lifetime_value),
      orders_count: Number(c.orders_count)
    }))
  });
}));

router.get('/customers/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const [users] = await pool.execute(
    `SELECT id, name, email, phone, notes, role, created_at FROM users WHERE id = :id LIMIT 1`,
    { id }
  );
  if (!users.length) return res.status(404).json({ error: 'Customer not found' });

  const [orders] = await pool.execute(
    `SELECT id, order_number, status, payment_status, total, created_at
     FROM orders WHERE user_id = :id ORDER BY created_at DESC`,
    { id }
  );

  res.json({
    customer: users[0],
    orders: orders.map((o) => ({ ...o, total: Number(o.total) }))
  });
}));

router.patch('/customers/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await pool.execute(
    'UPDATE users SET notes = :notes, phone = :phone WHERE id = :id AND role = \'customer\'',
    {
      id,
      notes: req.body.notes != null ? String(req.body.notes) : null,
      phone: req.body.phone != null ? String(req.body.phone) : null
    }
  );
  const [rows] = await pool.execute(
    'SELECT id, name, email, phone, notes, created_at FROM users WHERE id = :id',
    { id }
  );
  res.json({ customer: rows[0] });
}));

router.get('/reports/sales', asyncHandler(async (req, res) => {
  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();
  const params = {};
  let where = `o.status IN ('confirmed','shipped','delivered')`;
  if (from) {
    where += ' AND DATE(o.created_at) >= :from';
    params.from = from;
  }
  if (to) {
    where += ' AND DATE(o.created_at) <= :to';
    params.to = to;
  }

  const [daily] = await pool.execute(
    `SELECT DATE(o.created_at) AS day, COUNT(*) AS orders, COALESCE(SUM(o.total),0) AS revenue
     FROM orders o
     WHERE ${where}
     GROUP BY DATE(o.created_at)
     ORDER BY day DESC
     LIMIT 60`,
    params
  );

  const [topProducts] = await pool.execute(
    `SELECT oi.name_snapshot AS name, SUM(oi.qty) AS qty_sold, SUM(oi.line_total) AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE ${where}
     GROUP BY oi.name_snapshot
     ORDER BY qty_sold DESC
     LIMIT 10`,
    params
  );

  res.json({
    daily: daily.map((d) => ({ ...d, revenue: Number(d.revenue), orders: Number(d.orders) })),
    topProducts: topProducts.map((p) => ({
      ...p,
      qty_sold: Number(p.qty_sold),
      revenue: Number(p.revenue)
    }))
  });
}));

module.exports = router;
