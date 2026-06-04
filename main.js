const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const {
  initDatabase, getDb,
  userQueries, categoryQueries, productQueries, sizeQueries,
  customerQueries, orderQueries, statsQueries, activityQueries, shiftQueries, comboQueries
} = require('./database/db');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'App Bán Hàng',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    frame: true,
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();
  registerIpcHandlers();
  setupCloseHandler();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Check for open shifts before closing
let forceQuit = false;

function setupCloseHandler() {
  if (!mainWindow) return;
  mainWindow.on('close', (e) => {
    if (forceQuit) return;
    try {
      const openShifts = getDb().prepare("SELECT s.*, u.full_name FROM shifts s LEFT JOIN users u ON s.user_id = u.id WHERE s.status = 'open'").all();
      if (openShifts.length > 0) {
        e.preventDefault();
        const names = openShifts.map(s => s.full_name || 'N/A').join(', ');
        const response = dialog.showMessageBoxSync(mainWindow, {
          type: 'warning',
          buttons: ['Quay lại đóng ca', 'Đóng luôn'],
          defaultId: 0,
          title: 'Ca chưa đóng!',
          message: `Còn ca đang mở (${names}).\nVui lòng đóng ca trước khi tắt ứng dụng.`,
        });
        if (response === 1) {
          forceQuit = true;
          mainWindow.close();
        }
      }
    } catch (err) {
      // If DB error, allow closing
    }
  });
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ==================== IPC HANDLERS ====================
function registerIpcHandlers() {
  // Auth
  ipcMain.handle('auth:login', (_, username, password) => {
    try {
      const user = userQueries.login(username, password);
      if (user) {
        activityQueries.log(user.id, 'login', `Đăng nhập thành công`);
      }
      return { success: !!user, user, error: user ? null : 'Sai tên đăng nhập hoặc mật khẩu' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Product Sizes
  ipcMain.handle('sizes:getByProduct', (_, productId) => {
    try { return { success: true, data: sizeQueries.getByProduct(productId) }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('sizes:set', (_, productId, sizes) => {
    try { sizeQueries.set(productId, sizes); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  });

  // Combos
  ipcMain.handle('combos:getAll', (_, activeOnly) => {
    try { return { success: true, data: comboQueries.getAll(activeOnly) }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('combos:getById', (_, id) => {
    try { return { success: true, data: comboQueries.getById(id) }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('combos:create', (_, data) => {
    try { const id = comboQueries.create(data); return { success: true, data: { id } }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('combos:update', (_, id, data) => {
    try { comboQueries.update(id, data); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('combos:delete', (_, id) => {
    try { comboQueries.delete(id); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('combos:toggleActive', (_, id) => {
    try { comboQueries.toggleActive(id); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  });

  // Users
  ipcMain.handle('users:getAll', () => {
    try { return { success: true, data: userQueries.getAll() }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('users:create', (_, data) => {
    try {
      const id = userQueries.create(data);
      return { success: true, data: { id } };
    } catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('users:update', (_, id, data) => {
    try { userQueries.update(id, data); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('users:delete', (_, id) => {
    try { userQueries.delete(id); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  });

  // Categories
  ipcMain.handle('categories:getAll', () => {
    try { return { success: true, data: categoryQueries.getAll() }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('categories:create', (_, data) => {
    try {
      const id = categoryQueries.create(data);
      return { success: true, data: { id } };
    } catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('categories:update', (_, id, data) => {
    try { categoryQueries.update(id, data); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('categories:delete', (_, id) => {
    try { categoryQueries.delete(id); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  });

  // Products
  ipcMain.handle('products:getAll', (_, search, categoryId) => {
    try { return { success: true, data: productQueries.getAll(search, categoryId) }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('products:getById', (_, id) => {
    try { return { success: true, data: productQueries.getById(id) }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('products:create', (_, data) => {
    try {
      const id = productQueries.create(data);
      return { success: true, data: { id } };
    } catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('products:update', (_, id, data) => {
    try { productQueries.update(id, data); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('products:delete', (_, id) => {
    try { productQueries.delete(id); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  });

  // Customers
  ipcMain.handle('customers:getAll', (_, search) => {
    try { return { success: true, data: customerQueries.getAll(search) }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('customers:getById', (_, id) => {
    try { return { success: true, data: customerQueries.getById(id) }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('customers:create', (_, data) => {
    try {
      const id = customerQueries.create(data);
      return { success: true, data: { id } };
    } catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('customers:update', (_, id, data) => {
    try { customerQueries.update(id, data); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('customers:delete', (_, id) => {
    try { customerQueries.delete(id); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('customers:usePoints', (_, id, points) => {
    try {
      const ok = customerQueries.usePoints(id, points);
      return { success: ok, error: ok ? null : 'Không đủ điểm' };
    } catch (err) { return { success: false, error: err.message }; }
  });

  // Orders
  ipcMain.handle('orders:getAll', (_, filters) => {
    try { return { success: true, data: orderQueries.getAll(filters) }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('orders:getById', (_, id) => {
    try { return { success: true, data: orderQueries.getById(id) }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('orders:create', (_, data) => {
    try {
      const id = orderQueries.create(data);
      return { success: true, data: { id } };
    } catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('orders:update', (_, id, data) => {
    try { orderQueries.update(id, data); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('orders:updatePayment', (_, id, method) => {
    try { orderQueries.updatePaymentMethod(id, method); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('orders:delete', (_, id, userRole) => {
    try { orderQueries.delete(id, userRole); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  });

  // Stats
  ipcMain.handle('stats:dashboard', () => {
    try { return { success: true, data: statsQueries.getDashboard() }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('stats:revenue', (_, dateFrom, dateTo) => {
    try { return { success: true, data: statsQueries.getRevenueByDateRange(dateFrom, dateTo) }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('stats:revenueByMonth', (_, year) => {
    try { return { success: true, data: statsQueries.getRevenueByMonth(year) }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('stats:topProducts', (_, dateFrom, dateTo, limit) => {
    try { return { success: true, data: statsQueries.getTopProducts(dateFrom, dateTo, limit) }; }
    catch (err) { return { success: false, error: err.message }; }
  });

  // Activity Log
  ipcMain.handle('activity:log', (_, userId, action, details) => {
    try { activityQueries.log(userId, action, details); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('activity:getRecent', (_, limit) => {
    try { return { success: true, data: activityQueries.getRecent(limit) }; }
    catch (err) { return { success: false, error: err.message }; }
  });

  // Shifts
  ipcMain.handle('shifts:open', (_, userId, startAmount) => {
    try { const id = shiftQueries.open(userId, startAmount); return { success: true, data: { id } }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('shifts:close', (_, shiftId, note) => {
    try { shiftQueries.close(shiftId, note); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('shifts:getCurrent', (_, userId) => {
    try { return { success: true, data: shiftQueries.getCurrent(userId) }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('shifts:getAll', (_, limit) => {
    try { return { success: true, data: shiftQueries.getAll(limit) }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('shifts:getSummary', (_, shiftId) => {
    try { return { success: true, data: shiftQueries.getSummary(shiftId) }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('shifts:addTransaction', (_, shiftId, type, amount, reason, note) => {
    try { const id = shiftQueries.addTransaction(shiftId, type, amount, reason, note); return { success: true, data: { id } }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('shifts:getTransactions', (_, shiftId) => {
    try { return { success: true, data: shiftQueries.getTransactions(shiftId) }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('shifts:deleteTransaction', (_, id) => {
    try { shiftQueries.deleteTransaction(id); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('shifts:getByDate', (_, dateFrom, dateTo) => {
    try { return { success: true, data: shiftQueries.getByDate(dateFrom, dateTo) }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('shifts:getLastClosed', () => {
    try { return { success: true, data: shiftQueries.getLastClosed() }; }
    catch (err) { return { success: false, error: err.message }; }
  });

  // Print
  ipcMain.handle('print:bill', (_, html, printerName) => {
    // Máy in ảo (PDF, OneNote, XPS...) → dùng printToPDF + save dialog
    const isVirtualPrinter = printerName && /pdf|onenote|xps|fax/i.test(printerName);

    if (isVirtualPrinter) {
      return new Promise(async (resolve) => {
        const printWindow = new BrowserWindow({
          width: 400, height: 800, show: false,
          webPreferences: { nodeIntegration: false, contextIsolation: true }
        });

        printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        printWindow.webContents.on('did-finish-load', async () => {
          try {
            const pdfBuffer = await printWindow.webContents.printToPDF({
              printBackground: true,
              margins: { marginType: 'none' },
              pageSize: { width: 80, height: 297 }, // 80mm width, mm units for printToPDF
              scale: 1
            });
            printWindow.close();

            const { filePath } = await dialog.showSaveDialog(mainWindow, {
              title: 'Lưu hóa đơn PDF',
              defaultPath: `hoadon_${Date.now()}.pdf`,
              filters: [{ name: 'PDF', extensions: ['pdf'] }]
            });

            if (filePath) {
              fs.writeFileSync(filePath, pdfBuffer);
              resolve({ success: true });
            } else {
              resolve({ success: false, error: 'Đã hủy lưu file' });
            }
          } catch (err) {
            try { printWindow.close(); } catch(e) {}
            resolve({ success: false, error: err.message });
          }
        });
      });
    }

    // Máy in thật → in silent như cũ
    return new Promise((resolve) => {
      const printWindow = new BrowserWindow({
        width: 400, height: 800, show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      });

      const timeout = setTimeout(() => {
        try { printWindow.close(); } catch(e) {}
        resolve({ success: false, error: 'Print timeout' });
      }, 10000);

      printWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        clearTimeout(timeout);
        try { printWindow.close(); } catch(e) {}
        resolve({ success: false, error: 'Load failed: ' + errorDescription });
      });

      printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      printWindow.webContents.on('did-finish-load', () => {
        const opts = {
          silent: !!printerName,
          printBackground: true,
          margins: { marginType: 'none' },
          scaleFactor: 100,
          pageSize: { width: 80000, height: 300000 }
        };
        if (printerName) opts.deviceName = printerName;
        printWindow.webContents.print(opts, (success, failureReason) => {
          clearTimeout(timeout);
          printWindow.close();
          resolve({ success, error: failureReason });
        });
      });
    });
  });

  // Print Silent to specific device (for labels)
  ipcMain.handle('print:silent', (_, html, printerName) => {
    return new Promise((resolve) => {
      const printWindow = new BrowserWindow({
        width: 320, height: 1200, show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      });
      printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      printWindow.webContents.on('did-finish-load', () => {
        const opts = {
          silent: true,
          printBackground: true,
          margins: { marginType: 'none' },
          scaleFactor: 100,
          pageSize: { width: 80000, height: 300000 }
        };
        if (printerName) opts.deviceName = printerName;
        printWindow.webContents.print(opts, (success, failureReason) => {
          printWindow.close();
          resolve({ success, error: failureReason });
        });
      });
    });
  });

  // Print Label (thermal sticker)
  ipcMain.handle('print:label', (_, html, config) => {
    return new Promise((resolve) => {
      // Lấy kích thước tem từ config (mm), mặc định 40×30mm
      const labelW = (config && config.paperWidth) || 40;
      const labelH = (config && config.paperHeight) || 30;
      const printWindow = new BrowserWindow({
        width: Math.round(labelW * 3.78), height: Math.round(labelH * 3.78), show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      });
      printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      printWindow.webContents.on('did-finish-load', () => {
        const printOpts = {
          silent: true,
          printBackground: true,
          landscape: false,
          margins: { marginType: 'none' },
          // Kích thước tính bằng microns (mm × 1000)
          pageSize: { width: labelW * 1000, height: labelH * 1000 }
        };
        if (config && config.printerName) {
          printOpts.deviceName = config.printerName;
        }
        printWindow.webContents.print(printOpts, (success, failureReason) => {
          printWindow.close();
          resolve({ success, error: failureReason });
        });
      });
    });
  });

  // Get available printers
  ipcMain.handle('print:getPrinters', async () => {
    try {
      const printers = await mainWindow.webContents.getPrintersAsync();
      return { success: true, data: printers };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // QR Code Generation
  ipcMain.handle('qr:generate', async (_, text) => {
    try {
      const dataUrl = await QRCode.toDataURL(text, { width: 280, margin: 2, color: { dark: '#000', light: '#fff' } });
      return { success: true, data: dataUrl };
    } catch (err) { return { success: false, error: err.message }; }
  });

  // Backup
  ipcMain.handle('backup:create', async () => {
    try {
      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Sao lưu dữ liệu',
        defaultPath: `backup_appbanhang_${new Date().toISOString().split('T')[0]}.db`,
        filters: [{ name: 'Database', extensions: ['db'] }]
      });
      if (!filePath) return { success: false, error: 'Đã hủy' };

      const dbObj = getDb();
      dbObj.backup(filePath);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('backup:restore', async () => {
    try {
      const { filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Khôi phục dữ liệu',
        filters: [{ name: 'Database', extensions: ['db'] }],
        properties: ['openFile']
      });
      if (!filePaths || filePaths.length === 0) return { success: false, error: 'Đã hủy' };

      const dbPath = getDb().name;
      getDb().close();
      fs.copyFileSync(filePaths[0], dbPath);
      initDatabase(dbPath);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  });
}
