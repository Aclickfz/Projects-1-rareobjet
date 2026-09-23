function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 200);
}

function formatInr(amount) {
  const n = Number(amount) || 0;
  return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function orderNumber() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const rand = Math.floor(Math.random() * 900 + 100);
  return `JAC-${stamp}-${rand}`;
}

function invoiceNumber(orderId) {
  return `INV-${String(orderId).padStart(6, '0')}`;
}

module.exports = { asyncHandler, slugify, formatInr, orderNumber, invoiceNumber };
