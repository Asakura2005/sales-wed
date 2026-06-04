const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const multer = require('multer');

const {
  initDatabase, getDb,
  userQueries, categoryQueries, productQueries, sizeQueries,
  customerQueries, orderQueries, statsQueries, activityQueries,
  shiftQueries, comboQueries
} = require('./database/db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Init DB before handling requests
const dbInitPromise = initDatabase().then(() => console.log('Database initialized')).catch(e => {
  console.error('DB Init Error', e);
  throw e;
});

app.use(async (req, res, next) => {
  try {
    await dbInitPromise;
    next();
  } catch (err) {
    res.status(500).json({ success: false, error: 'Database initialization failed: ' + err.message });
  }
});

const apiRouter = express.Router();

// --- Auth ---
apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await userQueries.login(username, password);
    if (user) {
      await activityQueries.log(user.id, 'login', 'Đăng nhập thành công');
    }
    res.json({ success: !!user, user: user, error: user ? null : 'Sai tên đăng nhập hoặc mật khẩu' });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Users ---
apiRouter.get('/users', async (req, res) => {
  try { res.json({ success: true, data: await userQueries.getAll() }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.post('/users', async (req, res) => {
  try { const id = await userQueries.create(req.body); res.json({ success: true, data: { id } }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.put('/users/:id', async (req, res) => {
  try { await userQueries.update(req.params.id, req.body); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.delete('/users/:id', async (req, res) => {
  try { await userQueries.delete(req.params.id); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Categories ---
apiRouter.get('/categories', async (req, res) => {
  try { res.json({ success: true, data: await categoryQueries.getAll() }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.post('/categories', async (req, res) => {
  try { const id = await categoryQueries.create(req.body); res.json({ success: true, data: { id } }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.put('/categories/:id', async (req, res) => {
  try { await categoryQueries.update(req.params.id, req.body); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.delete('/categories/:id', async (req, res) => {
  try { await categoryQueries.delete(req.params.id); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Products ---
apiRouter.get('/products', async (req, res) => {
  try { res.json({ success: true, data: await productQueries.getAll(req.query.search, req.query.categoryId) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.get('/products/:id', async (req, res) => {
  try { res.json({ success: true, data: await productQueries.getById(req.params.id) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.post('/products', async (req, res) => {
  try { const id = await productQueries.create(req.body); res.json({ success: true, data: { id } }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.put('/products/:id', async (req, res) => {
  try { await productQueries.update(req.params.id, req.body); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.delete('/products/:id', async (req, res) => {
  try { await productQueries.delete(req.params.id); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

// Sizes
apiRouter.get('/products/:id/sizes', async (req, res) => {
  try { res.json({ success: true, data: await sizeQueries.getByProduct(req.params.id) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.put('/products/:id/sizes', async (req, res) => {
  try { await sizeQueries.set(req.params.id, req.body.sizes); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Combos ---
apiRouter.get('/combos', async (req, res) => {
  try { res.json({ success: true, data: await comboQueries.getAll(req.query.activeOnly === 'true') }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.get('/combos/:id', async (req, res) => {
  try { res.json({ success: true, data: await comboQueries.getById(req.params.id) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.post('/combos', async (req, res) => {
  try { const id = await comboQueries.create(req.body); res.json({ success: true, data: { id } }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.put('/combos/:id', async (req, res) => {
  try { await comboQueries.update(req.params.id, req.body); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.delete('/combos/:id', async (req, res) => {
  try { await comboQueries.delete(req.params.id); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.patch('/combos/:id/toggle-active', async (req, res) => {
  try { await comboQueries.toggleActive(req.params.id); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Customers ---
apiRouter.get('/customers', async (req, res) => {
  try { res.json({ success: true, data: await customerQueries.getAll(req.query.search) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.get('/customers/:id', async (req, res) => {
  try { res.json({ success: true, data: await customerQueries.getById(req.params.id) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.post('/customers', async (req, res) => {
  try { const id = await customerQueries.create(req.body); res.json({ success: true, data: { id } }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.put('/customers/:id', async (req, res) => {
  try { await customerQueries.update(req.params.id, req.body); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.delete('/customers/:id', async (req, res) => {
  try { await customerQueries.delete(req.params.id); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.post('/customers/:id/use-points', async (req, res) => {
  try { 
    const ok = await customerQueries.usePoints(req.params.id, req.body.points); 
    res.json({ success: ok, error: ok ? null : 'Không đủ điểm' }); 
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Orders ---
apiRouter.get('/orders', async (req, res) => {
  try { res.json({ success: true, data: await orderQueries.getAll(req.query) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.get('/orders/:id', async (req, res) => {
  try { res.json({ success: true, data: await orderQueries.getById(req.params.id) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.post('/orders', async (req, res) => {
  try { const id = await orderQueries.create(req.body); res.json({ success: true, data: { id } }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.put('/orders/:id', async (req, res) => {
  try { await orderQueries.update(req.params.id, req.body); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.patch('/orders/:id/payment', async (req, res) => {
  try { await orderQueries.updatePaymentMethod(req.params.id, req.body.method); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.delete('/orders/:id', async (req, res) => {
  try { await orderQueries.delete(req.params.id, req.query.userRole); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Stats ---
apiRouter.get('/stats/dashboard', async (req, res) => {
  try { res.json({ success: true, data: await statsQueries.getDashboard() }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.get('/stats/revenue', async (req, res) => {
  try { res.json({ success: true, data: await statsQueries.getRevenueByDateRange(req.query.dateFrom, req.query.dateTo) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.get('/stats/revenue-by-month', async (req, res) => {
  try { res.json({ success: true, data: await statsQueries.getRevenueByMonth(req.query.year) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.get('/stats/top-products', async (req, res) => {
  try { res.json({ success: true, data: await statsQueries.getTopProducts(req.query.dateFrom, req.query.dateTo, req.query.limit) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Activity Log ---
apiRouter.post('/activity/log', async (req, res) => {
  try { await activityQueries.log(req.body.userId, req.body.action, req.body.details); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.get('/activity/recent', async (req, res) => {
  try { res.json({ success: true, data: await activityQueries.getRecent(req.query.limit) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Shifts ---
apiRouter.post('/shifts/open', async (req, res) => {
  try { const id = await shiftQueries.open(req.body.userId, req.body.startAmount); res.json({ success: true, data: { id } }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.post('/shifts/:id/close', async (req, res) => {
  try { await shiftQueries.close(req.params.id, req.body.note); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.get('/shifts/current/:userId', async (req, res) => {
  try { res.json({ success: true, data: await shiftQueries.getCurrent(req.params.userId) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.get('/shifts', async (req, res) => {
  try { res.json({ success: true, data: await shiftQueries.getAll(req.query.limit) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.get('/shifts/summary/:id', async (req, res) => {
  try { res.json({ success: true, data: await shiftQueries.getSummary(req.params.id) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.post('/shifts/:id/transactions', async (req, res) => {
  try { const id = await shiftQueries.addTransaction(req.params.id, req.body.type, req.body.amount, req.body.reason, req.body.note); res.json({ success: true, data: { id } }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.get('/shifts/:id/transactions', async (req, res) => {
  try { res.json({ success: true, data: await shiftQueries.getTransactions(req.params.id) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.delete('/shifts/transactions/:id', async (req, res) => {
  try { await shiftQueries.deleteTransaction(req.params.id); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.get('/shifts/by-date', async (req, res) => {
  try { res.json({ success: true, data: await shiftQueries.getByDate(req.query.from, req.query.to) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
apiRouter.get('/shifts/last-closed/cash', async (req, res) => {
  try { res.json({ success: true, data: await shiftQueries.getLastClosed() }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

// --- QR Code ---
apiRouter.post('/qr/generate', async (req, res) => {
  try {
    const dataUrl = await QRCode.toDataURL(req.body.text, { width: 280, margin: 2, color: { dark: '#000', light: '#fff' } });
    res.json({ success: true, data: dataUrl });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Backup ---
const upload = multer({ storage: multer.memoryStorage() });
apiRouter.get('/backup/create', async (req, res) => {
  try {
    // Cannot backup Postgres easily via file download like SQLite.
    // Return error or handle pg_dump
    res.status(500).json({ success: false, error: "Backup file is not supported for Postgres" });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
apiRouter.post('/backup/restore', upload.single('db'), async (req, res) => {
  try {
    res.json({ success: false, error: "Restore file is not supported for Postgres" });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// Mount router on both /_/backend/api and /api (for local dev fallback)
app.use('/_/backend/api', apiRouter);
app.use('/api', apiRouter);

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production' || require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}
module.exports = app;
