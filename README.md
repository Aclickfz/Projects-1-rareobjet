# JustAclick — dynamic ecommerce

Node.js + MySQL backend with the existing HTML/CSS storefront. Currency is **INR** only. Checkout is **Cash on Delivery**; inventory decreases when an admin **confirms** an order.

## Requirements

- Node.js 18+
- MySQL 8 (local or Docker)

### MySQL via Docker (optional)

```bash
docker run -d --name justaclick-mysql -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -e MYSQL_DATABASE=justaclick -p 3306:3306 mysql:8.0
```

## Setup

```bash
cd server
copy .env.example .env   # Windows; or cp .env.example .env
npm install
npm run migrate
npm run seed
npm start
```

Open [http://localhost:3000](http://localhost:3000).

### Default admin

- Email: `admin@justaclick.local`
- Password: `Admin@12345` (change in `.env`)

Admin panel: [http://localhost:3000/admin/](http://localhost:3000/admin/)

## Customer flow

1. Browse `product.html` (API-loaded cards)
2. Open product details → Add to cart / Buy now
3. Cart → Checkout (`payment.html`) — login required
4. Place COD order → order confirmation + invoice
5. Admin confirms order → stock reduces

## Project layout

- Root HTML + `assets/` — storefront UI (unchanged visual template)
- `server/` — Express API, migrations, seed
- `admin/` — dashboard, products, inventory, orders, invoices, CRM, reports
- `uploads/products/` — admin-uploaded images

## API overview

- `/api/auth/*` — register, login, logout, me
- `/api/products`, `/api/categories`
- `/api/cart`, `/api/wishlist`
- `/api/orders` — place, mine, track, admin status updates
- `/api/admin/*` — products CRUD, inventory, orders, customers, reports
