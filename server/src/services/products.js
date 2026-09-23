const pool = require('../db/pool');

async function attachImages(products) {
  if (!products.length) return products;
  const ids = products.map((p) => p.id);
  const [images] = await pool.query(
    `SELECT id, product_id, path, sort_order, is_primary
     FROM product_images
     WHERE product_id IN (${ids.map(() => '?').join(',')})
     ORDER BY sort_order ASC, id ASC`,
    ids
  );
  const map = {};
  for (const img of images) {
    (map[img.product_id] ||= []).push(img);
  }
  return products.map((p) => ({
    ...p,
    price: Number(p.price),
    compare_at_price: p.compare_at_price != null ? Number(p.compare_at_price) : null,
    images: map[p.id] || [],
    primary_image: (map[p.id] || []).find((i) => i.is_primary) || (map[p.id] || [])[0] || null
  }));
}

module.exports = { attachImages };
