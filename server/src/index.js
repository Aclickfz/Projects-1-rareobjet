const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { attachUser, ensureSessionId } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const cartRoutes = require('./routes/cart');
const wishlistRoutes = require('./routes/wishlist');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');

const app = express();
const rootDir = path.join(__dirname, '../..');
const port = Number(process.env.PORT || 3000);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(attachUser);
app.use(ensureSessionId);

app.get('/api/health', (_req, res) => res.json({ ok: true, currency: 'INR' }));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.use('/uploads', express.static(path.join(rootDir, 'uploads')));
app.use('/assets', express.static(path.join(rootDir, 'assets')));
app.use('/admin', express.static(path.join(rootDir, 'admin')));

// Avoid "Cannot POST /signup.html" if a form submits without JS
app.post(/^\/.*\.html$/i, (req, res) => {
  res.redirect(303, req.path);
});

app.use(express.static(rootDir));

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Server error' });
});

app.listen(port, () => {
  console.log(`JustAclick server running at http://localhost:${port}`);
});
