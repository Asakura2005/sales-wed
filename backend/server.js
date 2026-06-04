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

// Init DB
initDatabase();

// --- Auth ---
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const user = userQueries.login(username, password);
    if (user) {
      activityQueries.log(user.id, 'login', 'Đăng nhập thành công');
    }
    res.json({ success: !!user, user: user, error: user ? null : 'Sai tên đăng nhập hoặc mật khẩu' });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Users ---
app.get('/api/users', (req, res) => {
  try { res.json({ success: true, data: userQueries.getAll() }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.post('/api/users', (req, res) => {
  try { const id = userQueries.create(req.body); res.json({ success: true, data: { id } }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.put('/api/users/:id', (req, res) => {
  try { userQueries.update(req.params.id, req.body); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.delete('/api/users/:id', (req, res) => {
  try { userQueries.delete(req.params.id); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Categories ---
app.get('/api/categories', (req, res) => {
  try { res.json({ success: true, data: categoryQueries.getAll() }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.post('/api/categories', (req, res) => {
  try { const id = categoryQueries.create(req.body); res.json({ success: true, data: { id } }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.put('/api/categories/:id', (req, res) => {
  try { categoryQueries.update(req.params.id, req.body); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.delete('/api/categories/:id', (req, res) => {
  try { categoryQueries.delete(req.params.id); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Products ---
app.get('/api/products', (req, res) => {
  try { res.json({ success: true, data: productQueries.getAll(req.query.search, req.query.categoryId) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.get('/api/products/:id', (req, res) => {
  try { res.json({ success: true, data: productQueries.getById(req.params.id) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.post('/api/products', (req, res) => {
  try { const id = productQueries.create(req.body); res.json({ success: true, data: { id } }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.put('/api/products/:id', (req, res) => {
  try { productQueries.update(req.params.id, req.body); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.delete('/api/products/:id', (req, res) => {
  try { productQueries.delete(req.params.id); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

// Sizes
app.get('/api/products/:id/sizes', (req, res) => {
  try { res.json({ success: true, data: sizeQueries.getByProduct(req.params.id) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.put('/api/products/:id/sizes', (req, res) => {
  try { sizeQueries.set(req.params.id, req.body.sizes); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Combos ---
app.get('/api/combos', (req, res) => {
  try { res.json({ success: true, data: comboQueries.getAll(req.query.activeOnly === 'true') }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.get('/api/combos/:id', (req, res) => {
  try { res.json({ success: true, data: comboQueries.getById(req.params.id) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.post('/api/combos', (req, res) => {
  try { const id = comboQueries.create(req.body); res.json({ success: true, data: { id } }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.put('/api/combos/:id', (req, res) => {
  try { comboQueries.update(req.params.id, req.body); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.delete('/api/combos/:id', (req, res) => {
  try { comboQueries.delete(req.params.id); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.patch('/api/combos/:id/toggle-active', (req, res) => {
  try { comboQueries.toggleActive(req.params.id); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Customers ---
app.get('/api/customers', (req, res) => {
  try { res.json({ success: true, data: customerQueries.getAll(req.query.search) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.get('/api/customers/:id', (req, res) => {
  try { res.json({ success: true, data: customerQueries.getById(req.params.id) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.post('/api/customers', (req, res) => {
  try { const id = customerQueries.create(req.body); res.json({ success: true, data: { id } }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.put('/api/customers/:id', (req, res) => {
  try { customerQueries.update(req.params.id, req.body); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.delete('/api/customers/:id', (req, res) => {
  try { customerQueries.delete(req.params.id); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.post('/api/customers/:id/use-points', (req, res) => {
  try { 
    const ok = customerQueries.usePoints(req.params.id, req.body.points); 
    res.json({ success: ok, error: ok ? null : 'Không đủ điểm' }); 
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Orders ---
app.get('/api/orders', (req, res) => {
  try { res.json({ success: true, data: orderQueries.getAll(req.query) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.get('/api/orders/:id', (req, res) => {
  try { res.json({ success: true, data: orderQueries.getById(req.params.id) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.post('/api/orders', (req, res) => {
  try { const id = orderQueries.create(req.body); res.json({ success: true, data: { id } }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.put('/api/orders/:id', (req, res) => {
  try { orderQueries.update(req.params.id, req.body); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.patch('/api/orders/:id/payment', (req, res) => {
  try { orderQueries.updatePaymentMethod(req.params.id, req.body.method); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.delete('/api/orders/:id', (req, res) => {
  try { orderQueries.delete(req.params.id, req.query.userRole); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Stats ---
app.get('/api/stats/dashboard', (req, res) => {
  try { res.json({ success: true, data: statsQueries.getDashboard() }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.get('/api/stats/revenue', (req, res) => {
  try { res.json({ success: true, data: statsQueries.getRevenueByDateRange(req.query.dateFrom, req.query.dateTo) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.get('/api/stats/revenue-by-month', (req, res) => {
  try { res.json({ success: true, data: statsQueries.getRevenueByMonth(req.query.year) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.get('/api/stats/top-products', (req, res) => {
  try { res.json({ success: true, data: statsQueries.getTopProducts(req.query.dateFrom, req.query.dateTo, req.query.limit) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Activity Log ---
app.post('/api/activity/log', (req, res) => {
  try { activityQueries.log(req.body.userId, req.body.action, req.body.details); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.get('/api/activity/recent', (req, res) => {
  try { res.json({ success: true, data: activityQueries.getRecent(req.query.limit) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Shifts ---
app.post('/api/shifts/open', (req, res) => {
  try { const id = shiftQueries.open(req.body.userId, req.body.startAmount); res.json({ success: true, data: { id } }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.post('/api/shifts/:id/close', (req, res) => {
  try { shiftQueries.close(req.params.id, req.body.note); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.get('/api/shifts/current/:userId', (req, res) => {
  try { res.json({ success: true, data: shiftQueries.getCurrent(req.params.userId) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.get('/api/shifts', (req, res) => {
  try { res.json({ success: true, data: shiftQueries.getAll(req.query.limit) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.get('/api/shifts/summary/:id', (req, res) => {
  try { res.json({ success: true, data: shiftQueries.getSummary(req.params.id) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.post('/api/shifts/:id/transactions', (req, res) => {
  try { const id = shiftQueries.addTransaction(req.params.id, req.body.type, req.body.amount, req.body.reason, req.body.note); res.json({ success: true, data: { id } }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.get('/api/shifts/:id/transactions', (req, res) => {
  try { res.json({ success: true, data: shiftQueries.getTransactions(req.params.id) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.delete('/api/shifts/transactions/:id', (req, res) => {
  try { shiftQueries.deleteTransaction(req.params.id); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.get('/api/shifts/by-date', (req, res) => {
  try { res.json({ success: true, data: shiftQueries.getByDate(req.query.from, req.query.to) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
app.get('/api/shifts/last-closed/cash', (req, res) => {
  try { res.json({ success: true, data: shiftQueries.getLastClosed() }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

// --- QR Code ---
app.post('/api/qr/generate', async (req, res) => {
  try {
    const dataUrl = await QRCode.toDataURL(req.body.text, { width: 280, margin: 2, color: { dark: '#000', light: '#fff' } });
    res.json({ success: true, data: dataUrl });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// --- Backup ---
const upload = multer({ dest: 'uploads/' });
app.get('/api/backup/create', (req, res) => {
  try {
    const dbPath = path.join(__dirname, 'data', 'appbanhang.db');
    res.download(dbPath, `backup_appbanhang_${new Date().toISOString().split('T')[0]}.db`);
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.post('/api/backup/restore', upload.single('db'), (req, res) => {
  try {
    if (!req.file) return res.json({ success: false, error: 'No file uploaded' });
    const dbPath = path.join(__dirname, 'data', 'appbanhang.db');
    getDb().close();
    fs.copyFileSync(req.file.path, dbPath);
    initDatabase();
    fs.unlinkSync(req.file.path);
    res.json({ success: true });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
