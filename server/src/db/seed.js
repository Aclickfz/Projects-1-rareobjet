const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('./pool');

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 200);
}

const seedProducts = [
  {
    name: 'Aptos Square Coffee Table (44")',
    price: 74999,
    stock: 12,
    badge: 'New',
    grade: 'Contract Grade',
    category: 'living-room',
    images: [
      'assets/images/aptos-square-coffee-table-44-c.jpg',
      'assets/images/img3m.jpg',
      'assets/images/img10m.jpg',
      'assets/images/img1m.jpg'
    ],
    description: 'Solid wood square coffee table with clean lines for living rooms.'
  },
  {
    name: 'Diamond Cable Knit Pillow',
    price: 2499,
    stock: 40,
    badge: 'New',
    grade: 'Soft Home',
    category: 'living-room',
    images: [
      'assets/images/diamond-cable-knit-pillow-3-c.jpg',
      'assets/images/img2m.jpg',
      'assets/images/img3m.jpg',
      'assets/images/img4.jpeg'
    ],
    description: 'Textured cable-knit throw pillow for sofas and beds.'
  },
  {
    name: 'Aptos Side Table (22")',
    price: 32999,
    stock: 18,
    badge: 'New',
    grade: 'Contract Grade',
    category: 'living-room',
    images: [
      'assets/images/aptos-side-table-22-c.jpg',
      'assets/images/img1.avif',
      'assets/images/img3m.jpg',
      'assets/images/img4.jpeg'
    ],
    description: 'Compact side table for accent seating and bedrooms.'
  },
  {
    name: 'Modern Lounge Sofa',
    price: 89999,
    stock: 8,
    badge: 'Bestseller',
    grade: 'Contract Grade',
    category: 'living-room',
    images: [
      'assets/images/sofa1.webp',
      'assets/images/sofa2.webp',
      'assets/images/sofa3.webp'
    ],
    description: 'Deep-seat lounge sofa with durable upholstery.'
  },
  {
    name: 'Bedroom Storage Chest',
    price: 45999,
    stock: 10,
    badge: 'Featured',
    grade: 'Hardwood',
    category: 'bedroom',
    images: [
      'assets/images/img2.jpeg',
      'assets/images/img4.jpeg',
      'assets/images/furniture2.jpeg'
    ],
    description: 'Spacious bedroom chest with soft-close drawers.'
  },
  {
    name: 'Dining Bench Set',
    price: 54999,
    stock: 6,
    badge: 'New',
    grade: 'Contract Grade',
    category: 'dining',
    images: [
      'assets/images/collection1.avif',
      'assets/images/collection2.avif',
      'assets/images/img10m.jpg'
    ],
    description: 'Solid dining bench set for family kitchens.'
  }
];

async function seed() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@justaclick.local';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
    const adminName = process.env.ADMIN_NAME || 'Store Admin';
    const hash = await bcrypt.hash(adminPassword, 10);

    await conn.execute(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (:name, :email, :hash, 'admin')
       ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role = 'admin'`,
      { name: adminName, email: adminEmail, hash }
    );

    const categories = [
      { name: 'Living Room Furniture', slug: 'living-room', image: 'assets/images/furniture2.jpeg' },
      { name: 'Bedroom Furniture', slug: 'bedroom', image: 'assets/images/furniture2.jpeg' },
      { name: 'Dining & Kitchen', slug: 'dining', image: 'assets/images/furniture3.jpeg' },
      { name: 'New & Featured', slug: 'new-featured', image: 'assets/images/collection1.avif' }
    ];

    for (const cat of categories) {
      await conn.execute(
        `INSERT INTO categories (name, slug, image, is_active)
         VALUES (:name, :slug, :image, 1)
         ON DUPLICATE KEY UPDATE name = VALUES(name), image = VALUES(image), is_active = 1`,
        cat
      );
    }

    const [catRows] = await conn.query('SELECT id, slug FROM categories');
    const catMap = Object.fromEntries(catRows.map((c) => [c.slug, c.id]));

    for (const product of seedProducts) {
      const slug = slugify(product.name);
      await conn.execute(
        `INSERT INTO products
          (category_id, name, slug, description, price, stock_qty, badge, grade_label, is_active, sku)
         VALUES
          (:category_id, :name, :slug, :description, :price, :stock, :badge, :grade, 1, :sku)
         ON DUPLICATE KEY UPDATE
          category_id = VALUES(category_id),
          description = VALUES(description),
          price = VALUES(price),
          stock_qty = VALUES(stock_qty),
          badge = VALUES(badge),
          grade_label = VALUES(grade_label),
          is_active = 1`,
        {
          category_id: catMap[product.category] || null,
          name: product.name,
          slug,
          description: product.description,
          price: product.price,
          stock: product.stock,
          badge: product.badge,
          grade: product.grade,
          sku: `JAC-${slug.slice(0, 12).toUpperCase()}`
        }
      );

      const [[{ id: productId }]] = await conn.query('SELECT id FROM products WHERE slug = :slug', { slug });
      await conn.execute('DELETE FROM product_images WHERE product_id = :id', { id: productId });
      for (let i = 0; i < product.images.length; i++) {
        await conn.execute(
          `INSERT INTO product_images (product_id, path, sort_order, is_primary)
           VALUES (:product_id, :path, :sort_order, :is_primary)`,
          {
            product_id: productId,
            path: product.images[i],
            sort_order: i,
            is_primary: i === 0 ? 1 : 0
          }
        );
      }
    }

    await conn.commit();
    console.log('Seed complete.');
    console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
