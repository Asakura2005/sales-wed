const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Auth
  login: (username, password) => ipcRenderer.invoke('auth:login', username, password),

  // Users
  getUsers: () => ipcRenderer.invoke('users:getAll'),
  createUser: (data) => ipcRenderer.invoke('users:create', data),
  updateUser: (id, data) => ipcRenderer.invoke('users:update', id, data),
  deleteUser: (id) => ipcRenderer.invoke('users:delete', id),

  // Categories
  getCategories: () => ipcRenderer.invoke('categories:getAll'),
  createCategory: (data) => ipcRenderer.invoke('categories:create', data),
  updateCategory: (id, data) => ipcRenderer.invoke('categories:update', id, data),
  deleteCategory: (id) => ipcRenderer.invoke('categories:delete', id),

  // Products
  getProducts: (search, categoryId) => ipcRenderer.invoke('products:getAll', search, categoryId),
  getProductById: (id) => ipcRenderer.invoke('products:getById', id),
  createProduct: (data) => ipcRenderer.invoke('products:create', data),
  updateProduct: (id, data) => ipcRenderer.invoke('products:update', id, data),
  deleteProduct: (id) => ipcRenderer.invoke('products:delete', id),

  // Customers
  getCustomers: (search) => ipcRenderer.invoke('customers:getAll', search),
  getCustomerById: (id) => ipcRenderer.invoke('customers:getById', id),
  createCustomer: (data) => ipcRenderer.invoke('customers:create', data),
  updateCustomer: (id, data) => ipcRenderer.invoke('customers:update', id, data),
  deleteCustomer: (id) => ipcRenderer.invoke('customers:delete', id),
  useCustomerPoints: (id, points) => ipcRenderer.invoke('customers:usePoints', id, points),
  // Orders
  getOrders: (filters) => ipcRenderer.invoke('orders:getAll', filters),

  // Product Sizes
  getProductSizes: (productId) => ipcRenderer.invoke('sizes:getByProduct', productId),
  setProductSizes: (productId, sizes) => ipcRenderer.invoke('sizes:set', productId, sizes),

  // Combos
  getCombos: (activeOnly) => ipcRenderer.invoke('combos:getAll', activeOnly),
  getComboById: (id) => ipcRenderer.invoke('combos:getById', id),
  createCombo: (data) => ipcRenderer.invoke('combos:create', data),
  updateCombo: (id, data) => ipcRenderer.invoke('combos:update', id, data),
  deleteCombo: (id) => ipcRenderer.invoke('combos:delete', id),
  toggleComboActive: (id) => ipcRenderer.invoke('combos:toggleActive', id),

  getOrderById: (id) => ipcRenderer.invoke('orders:getById', id),
  createOrder: (data) => ipcRenderer.invoke('orders:create', data),
  updateOrder: (id, data) => ipcRenderer.invoke('orders:update', id, data),
  updateOrderPayment: (id, method) => ipcRenderer.invoke('orders:updatePayment', id, method),
  deleteOrder: (id, userRole) => ipcRenderer.invoke('orders:delete', id, userRole),

  // Stats
  getDashboard: () => ipcRenderer.invoke('stats:dashboard'),
  getRevenue: (dateFrom, dateTo) => ipcRenderer.invoke('stats:revenue', dateFrom, dateTo),
  getRevenueByMonth: (year) => ipcRenderer.invoke('stats:revenueByMonth', year),
  getTopProducts: (dateFrom, dateTo, limit) => ipcRenderer.invoke('stats:topProducts', dateFrom, dateTo, limit),

  // Activity Log
  logActivity: (userId, action, details) => ipcRenderer.invoke('activity:log', userId, action, details),
  getRecentActivity: (limit) => ipcRenderer.invoke('activity:getRecent', limit),

  // Shifts
  openShift: (userId, startAmount) => ipcRenderer.invoke('shifts:open', userId, startAmount),
  closeShift: (shiftId, note) => ipcRenderer.invoke('shifts:close', shiftId, note),
  getCurrentShift: (userId) => ipcRenderer.invoke('shifts:getCurrent', userId),
  getAllShifts: (limit) => ipcRenderer.invoke('shifts:getAll', limit),
  getShiftSummary: (shiftId) => ipcRenderer.invoke('shifts:getSummary', shiftId),
  addShiftTransaction: (shiftId, type, amount, reason, note) => ipcRenderer.invoke('shifts:addTransaction', shiftId, type, amount, reason, note),
  getShiftTransactions: (shiftId) => ipcRenderer.invoke('shifts:getTransactions', shiftId),
  deleteShiftTransaction: (id) => ipcRenderer.invoke('shifts:deleteTransaction', id),
  getShiftsByDate: (from, to) => ipcRenderer.invoke('shifts:getByDate', from, to),
  getLastClosedShiftCash: () => ipcRenderer.invoke('shifts:getLastClosed'),

  // Print
  printBill: (html, printerName) => ipcRenderer.invoke('print:bill', html, printerName || ''),
  printSilent: (html, printerName) => ipcRenderer.invoke('print:silent', html, printerName || ''),
  printLabel: (html, config) => ipcRenderer.invoke('print:label', html, config),
  getPrinters: () => ipcRenderer.invoke('print:getPrinters'),

  // QR Code
  generateQR: (text) => ipcRenderer.invoke('qr:generate', text),

  // Backup
  createBackup: () => ipcRenderer.invoke('backup:create'),
  restoreBackup: () => ipcRenderer.invoke('backup:restore')
});
