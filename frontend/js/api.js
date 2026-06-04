// Web API Shim to replace Electron's window.api

async function apiCall(method, endpoint, body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const res = await fetch(`/_/backend/api${endpoint}`, options);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`API Error on ${method} ${endpoint}:`, err);
    return { success: false, error: err.message };
  }
}

window.api = {
  // Auth
  login: (username, password) => apiCall('POST', '/auth/login', { username, password }),

  // Users
  getUsers: () => apiCall('GET', '/users'),
  createUser: (data) => apiCall('POST', '/users', data),
  updateUser: (id, data) => apiCall('PUT', `/users/${id}`, data),
  deleteUser: (id) => apiCall('DELETE', `/users/${id}`),

  // Categories
  getCategories: () => apiCall('GET', '/categories'),
  createCategory: (data) => apiCall('POST', '/categories', data),
  updateCategory: (id, data) => apiCall('PUT', `/categories/${id}`, data),
  deleteCategory: (id) => apiCall('DELETE', `/categories/${id}`),

  // Products
  getProducts: (search, categoryId) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (categoryId) params.append('categoryId', categoryId);
    return apiCall('GET', `/products?${params.toString()}`);
  },
  getProductById: (id) => apiCall('GET', `/products/${id}`),
  createProduct: (data) => apiCall('POST', '/products', data),
  updateProduct: (id, data) => apiCall('PUT', `/products/${id}`, data),
  deleteProduct: (id) => apiCall('DELETE', `/products/${id}`),
  getProductSizes: (productId) => apiCall('GET', `/products/${productId}/sizes`),
  setProductSizes: (productId, sizes) => apiCall('PUT', `/products/${productId}/sizes`, { sizes }),

  // Combos
  getCombos: (activeOnly) => apiCall('GET', `/combos?activeOnly=${activeOnly ? 'true' : 'false'}`),
  getComboById: (id) => apiCall('GET', `/combos/${id}`),
  createCombo: (data) => apiCall('POST', '/combos', data),
  updateCombo: (id, data) => apiCall('PUT', `/combos/${id}`, data),
  deleteCombo: (id) => apiCall('DELETE', `/combos/${id}`),
  toggleComboActive: (id) => apiCall('PATCH', `/combos/${id}/toggle-active`),

  // Customers
  getCustomers: (search) => apiCall('GET', `/customers?search=${search || ''}`),
  getCustomerById: (id) => apiCall('GET', `/customers/${id}`),
  createCustomer: (data) => apiCall('POST', '/customers', data),
  updateCustomer: (id, data) => apiCall('PUT', `/customers/${id}`, data),
  deleteCustomer: (id) => apiCall('DELETE', `/customers/${id}`),
  useCustomerPoints: (id, points) => apiCall('POST', `/customers/${id}/use-points`, { points }),

  // Orders
  getOrders: (filters) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.keys(filters).forEach(k => {
        if (filters[k] !== undefined && filters[k] !== null) params.append(k, filters[k]);
      });
    }
    return apiCall('GET', `/orders?${params.toString()}`);
  },
  getOrderById: (id) => apiCall('GET', `/orders/${id}`),
  createOrder: (data) => apiCall('POST', '/orders', data),
  updateOrder: (id, data) => apiCall('PUT', `/orders/${id}`, data),
  updateOrderPayment: (id, method) => apiCall('PATCH', `/orders/${id}/payment`, { method }),
  deleteOrder: (id, userRole) => apiCall('DELETE', `/orders/${id}?userRole=${userRole || ''}`),

  // Stats
  getDashboard: () => apiCall('GET', '/stats/dashboard'),
  getRevenue: (dateFrom, dateTo) => apiCall('GET', `/stats/revenue?dateFrom=${dateFrom}&dateTo=${dateTo}`),
  getRevenueByMonth: (year) => apiCall('GET', `/stats/revenue-by-month?year=${year}`),
  getTopProducts: (dateFrom, dateTo, limit) => apiCall('GET', `/stats/top-products?dateFrom=${dateFrom}&dateTo=${dateTo}&limit=${limit || 10}`),

  // Activity Log
  logActivity: (userId, action, details) => apiCall('POST', '/activity/log', { userId, action, details }),
  getRecentActivity: (limit) => apiCall('GET', `/activity/recent?limit=${limit || 50}`),

  // Shifts
  openShift: (userId, startAmount) => apiCall('POST', '/shifts/open', { userId, startAmount }),
  closeShift: (shiftId, note) => apiCall('POST', `/shifts/${shiftId}/close`, { note }),
  getCurrentShift: (userId) => apiCall('GET', `/shifts/current/${userId}`),
  getAllShifts: (limit) => apiCall('GET', `/shifts?limit=${limit || 30}`),
  getShiftSummary: (shiftId) => apiCall('GET', `/shifts/summary/${shiftId}`),
  addShiftTransaction: (shiftId, type, amount, reason, note) => apiCall('POST', `/shifts/${shiftId}/transactions`, { type, amount, reason, note }),
  getShiftTransactions: (shiftId) => apiCall('GET', `/shifts/${shiftId}/transactions`),
  deleteShiftTransaction: (id) => apiCall('DELETE', `/shifts/transactions/${id}`),
  getShiftsByDate: (from, to) => apiCall('GET', `/shifts/by-date?from=${from}&to=${to}`),
  getLastClosedShiftCash: () => apiCall('GET', '/shifts/last-closed/cash'),

  // Print (Web Browser specific implementation)
  printBill: async (html, printerName) => {
    return new Promise((resolve) => {
      const printWin = window.open('', '_blank', 'width=400,height=800');
      if (!printWin) {
        resolve({ success: false, error: 'Popup blocked by browser. Please allow popups to print.' });
        return;
      }
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
      // wait a bit for styles/images to load
      setTimeout(() => {
        printWin.print();
        printWin.close();
        resolve({ success: true });
      }, 500);
    });
  },
  printSilent: async (html, printerName) => {
    // In browser, silent print is not possible without native extensions.
    // We fallback to standard print.
    return window.api.printBill(html, printerName);
  },
  printLabel: async (html, config) => {
    return window.api.printBill(html, config?.printerName);
  },
  getPrinters: async () => {
    return { success: true, data: [] }; // Browsers cannot enumerate local printers easily
  },

  // QR Code (Generate on backend)
  generateQR: (text) => apiCall('POST', '/qr/generate', { text }),

  // Backup
  createBackup: async () => {
    window.location.href = '/_/backend/api/backup/create';
    return { success: true };
  },
  restoreBackup: async (file) => {
    if (!file) return { success: false, error: 'No file selected' };
    const formData = new FormData();
    formData.append('db', file);
    try {
      const res = await fetch('/_/backend/api/backup/restore', {
        method: 'POST',
        body: formData
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
