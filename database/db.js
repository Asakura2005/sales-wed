const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

let db;

function getDbPath() {
  const { app } = require('electron');
  return path.join(app.getPath('userData'), 'appbanhang.db');
}

function initDatabase(dbPath) {
  db = new Database(dbPath || getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createTables();
  seedDefaultData();
  return db;
}

function getDb() {
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee' CHECK(role IN ('admin', 'employee')),
      phone TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER,
      price REAL NOT NULL DEFAULT 0,
      cost_price REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      unit TEXT DEFAULT 'cái',
      barcode TEXT,
      image TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      email TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      user_id INTEGER NOT NULL,
      total REAL NOT NULL DEFAULT 0,
      discount REAL DEFAULT 0,
      final_total REAL NOT NULL DEFAULT 0,
      payment_method TEXT DEFAULT 'cash' CHECK(payment_method IN ('cash', 'transfer', 'card')),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'cancelled')),
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price REAL NOT NULL,
      subtotal REAL NOT NULL,
      note TEXT DEFAULT '',
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      start_amount REAL DEFAULT 0,
      end_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed')),
      note TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS shift_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('in', 'out')),
      amount REAL NOT NULL,
      reason TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS product_sizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      size_name TEXT NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS combos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS combo_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      combo_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (combo_id) REFERENCES combos(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);

  // Migrations for existing databases
  try { db.prepare("ALTER TABLE order_items ADD COLUMN note TEXT DEFAULT ''").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE orders ADD COLUMN points_earned INTEGER DEFAULT 0").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE orders ADD COLUMN points_used INTEGER DEFAULT 0").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE order_items ADD COLUMN size_name TEXT DEFAULT ''").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE order_items ADD COLUMN toppings TEXT DEFAULT ''").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE customers ADD COLUMN loyalty_points INTEGER DEFAULT 0").run(); } catch(e) {}
}

function seedDefaultData() {
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, phone)
      VALUES (?, ?, ?, ?, ?)
    `).run('admin', hash, 'Quản trị viên', 'admin', '0000000000');
  }

  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (catCount.count === 0) {
    const insertCat = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
    insertCat.run('Đồ ăn', 'Các loại đồ ăn');
    insertCat.run('Nước uống', 'Các loại nước uống');
    insertCat.run('Khác', 'Sản phẩm khác');
  }

  // Seed 20 sample products
  const prodCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
  if (prodCount.count === 0) {
    const insertProd = db.prepare(`
      INSERT INTO products (name, category_id, price, cost_price, stock, unit, barcode)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    // Đồ ăn (category_id = 1)
    insertProd.run('Cơm gà xối mỡ',       1, 45000,  25000, 100, 'phần', 'DA001');
    insertProd.run('Cơm sườn nướng',       1, 50000,  28000, 80,  'phần', 'DA002');
    insertProd.run('Phở bò tái',           1, 55000,  30000, 60,  'tô',   'DA003');
    insertProd.run('Bún bò Huế',           1, 50000,  27000, 70,  'tô',   'DA004');
    insertProd.run('Mì xào hải sản',       1, 60000,  32000, 50,  'dĩa',  'DA005');
    insertProd.run('Bánh mì thịt',         1, 25000,  12000, 150, 'ổ',    'DA006');
    insertProd.run('Gỏi cuốn tôm thịt',   1, 35000,  18000, 40,  'phần', 'DA007');
    // Nước uống (category_id = 2)
    insertProd.run('Trà sữa trân châu',    2, 35000,  15000, 200, 'ly',   'NU001');
    insertProd.run('Cà phê sữa đá',        2, 25000,  10000, 300, 'ly',   'NU002');
    insertProd.run('Cà phê đen đá',        2, 20000,  8000,  300, 'ly',   'NU003');
    insertProd.run('Nước cam tươi',         2, 30000,  12000, 100, 'ly',   'NU004');
    insertProd.run('Sinh tố bơ',           2, 35000,  15000, 80,  'ly',   'NU005');
    insertProd.run('Nước mía',             2, 15000,  5000,  200, 'ly',   'NU006');
    insertProd.run('Trà đào cam sả',       2, 30000,  12000, 150, 'ly',   'NU007');
    insertProd.run('Coca Cola',            2, 15000,  8000,  500, 'lon',  'NU008');
    insertProd.run('Nước suối',            2, 10000,  3000,  500, 'chai', 'NU009');
    // Khác (category_id = 3)
    insertProd.run('Khăn giấy',            3, 5000,   2000,  300, 'gói',  'KH001');
    insertProd.run('Tăm tre',              3, 3000,   1000,  200, 'hộp',  'KH002');
    insertProd.run('Kẹo cao su',           3, 10000,  5000,  100, 'hộp',  'KH003');
    insertProd.run('Snack khoai tây',      3, 15000,  8000,  120, 'gói',  'KH004');
  }
}

// ==================== USER QUERIES ====================
const userQueries = {
  login(username, password) {
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
    if (!user) return null;
    if (!bcrypt.compareSync(password, user.password_hash)) return null;
    const { password_hash, ...safeUser } = user;
    return safeUser;
  },

  getAll() {
    return db.prepare('SELECT id, username, full_name, role, phone, active, created_at FROM users ORDER BY created_at DESC').all();
  },

  getById(id) {
    return db.prepare('SELECT id, username, full_name, role, phone, active, created_at FROM users WHERE id = ?').get(id);
  },

  create(data) {
    const hash = bcrypt.hashSync(data.password, 10);
    const stmt = db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, phone)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(data.username, hash, data.full_name, data.role || 'employee', data.phone || '');
    return result.lastInsertRowid;
  },

  update(id, data) {
    let sql = 'UPDATE users SET full_name = ?, role = ?, phone = ?, active = ? WHERE id = ?';
    let params = [data.full_name, data.role, data.phone, data.active !== undefined ? data.active : 1, id];

    if (data.password) {
      sql = 'UPDATE users SET full_name = ?, role = ?, phone = ?, active = ?, password_hash = ? WHERE id = ?';
      const hash = bcrypt.hashSync(data.password, 10);
      params = [data.full_name, data.role, data.phone, data.active !== undefined ? data.active : 1, hash, id];
    }

    return db.prepare(sql).run(...params);
  },

  delete(id) {
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(id);
    if (user && user.username === 'admin') throw new Error('Không thể xóa tài khoản admin');
    return db.prepare('DELETE FROM users WHERE id = ? AND username != ?').run(id, 'admin');
  }
};

// ==================== CATEGORY QUERIES ====================
const categoryQueries = {
  getAll() {
    return db.prepare('SELECT * FROM categories ORDER BY name').all();
  },
  create(data) {
    const result = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)').run(data.name, data.description || '');
    return result.lastInsertRowid;
  },
  update(id, data) {
    return db.prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?').run(data.name, data.description || '', id);
  },
  delete(id) {
    return db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  }
};

// ==================== PRODUCT QUERIES ====================
const productQueries = {
  getAll(search = '', categoryId = null) {
    let sql = `SELECT p.*, c.name as category_name
               FROM products p
               LEFT JOIN categories c ON p.category_id = c.id
               WHERE p.active = 1`;
    const params = [];

    if (search) {
      sql += ' AND (p.name LIKE ? OR p.barcode LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (categoryId) {
      sql += ' AND p.category_id = ?';
      params.push(categoryId);
    }
    sql += ' ORDER BY p.name';
    return db.prepare(sql).all(...params);
  },

  getById(id) {
    return db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(id);
  },

  create(data) {
    const result = db.prepare(`
      INSERT INTO products (name, category_id, price, cost_price, stock, unit, barcode)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(data.name, data.category_id || null, data.price, data.cost_price || 0, data.stock || 0, data.unit || 'cái', data.barcode || '');
    return result.lastInsertRowid;
  },

  update(id, data) {
    return db.prepare(`
      UPDATE products SET name = ?, category_id = ?, price = ?, cost_price = ?, stock = ?, unit = ?, barcode = ?
      WHERE id = ?
    `).run(data.name, data.category_id || null, data.price, data.cost_price || 0, data.stock || 0, data.unit || 'cái', data.barcode || '', id);
  },

  delete(id) {
    return db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(id);
  },

  updateStock(id, quantity) {
    return db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(quantity, id);
  }
};

// ==================== SIZE QUERIES ====================
const sizeQueries = {
  getByProduct(productId) {
    return db.prepare('SELECT * FROM product_sizes WHERE product_id = ? ORDER BY price').all(productId);
  },

  set(productId, sizes) {
    // sizes = [{size_name, price}, ...]
    db.prepare('DELETE FROM product_sizes WHERE product_id = ?').run(productId);
    const insert = db.prepare('INSERT INTO product_sizes (product_id, size_name, price) VALUES (?, ?, ?)');
    for (const s of sizes) {
      if (s.size_name && s.price > 0) {
        insert.run(productId, s.size_name, s.price);
      }
    }
  },

  delete(productId) {
    db.prepare('DELETE FROM product_sizes WHERE product_id = ?').run(productId);
  }
};

// ==================== CUSTOMER QUERIES ====================
const customerQueries = {
  getAll(search = '') {
    let sql = 'SELECT * FROM customers';
    const params = [];
    if (search) {
      sql += ' WHERE name LIKE ? OR phone LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY name';
    return db.prepare(sql).all(...params);
  },

  getById(id) {
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  },

  create(data) {
    const result = db.prepare(`
      INSERT INTO customers (name, phone, address, email, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(data.name, data.phone || '', data.address || '', data.email || '', data.notes || '');
    return result.lastInsertRowid;
  },

  update(id, data) {
    return db.prepare(`
      UPDATE customers SET name = ?, phone = ?, address = ?, email = ?, notes = ?
      WHERE id = ?
    `).run(data.name, data.phone || '', data.address || '', data.email || '', data.notes || '', id);
  },

  delete(id) {
    return db.prepare('DELETE FROM customers WHERE id = ?').run(id);
  },

  addPoints(id, points) {
    return db.prepare('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?').run(points, id);
  },

  usePoints(id, points) {
    const customer = db.prepare('SELECT loyalty_points FROM customers WHERE id = ?').get(id);
    if (!customer || customer.loyalty_points < points) return false;
    db.prepare('UPDATE customers SET loyalty_points = loyalty_points - ? WHERE id = ?').run(points, id);
    return true;
  }
};

// ==================== ORDER QUERIES ====================
const orderQueries = {
  getAll(filters = {}) {
    let sql = `SELECT o.*, u.full_name as user_name, c.name as customer_name
               FROM orders o
               LEFT JOIN users u ON o.user_id = u.id
               LEFT JOIN customers c ON o.customer_id = c.id
               WHERE 1=1`;
    const params = [];

    if (filters.status) {
      sql += ' AND o.status = ?';
      params.push(filters.status);
    }
    if (filters.dateFrom) {
      sql += ' AND DATE(o.created_at) >= ?';
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      sql += ' AND DATE(o.created_at) <= ?';
      params.push(filters.dateTo);
    }
    if (filters.userId) {
      sql += ' AND o.user_id = ?';
      params.push(filters.userId);
    }
    if (filters.search) {
      const s = filters.search.replace('#', '');
      sql += ' AND (CAST(o.id AS TEXT) LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
      params.push(`%${s}%`, `%${s}%`, `%${s}%`);
    }
    sql += ' ORDER BY o.created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }
    return db.prepare(sql).all(...params);
  },

  getById(id) {
    const order = db.prepare(`
      SELECT o.*, u.full_name as user_name, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `).get(id);

    if (order) {
      order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
    }
    return order;
  },

  create(data) {
    const insertOrder = db.prepare(`
      INSERT INTO orders (customer_id, user_id, total, discount, final_total, payment_method, status, note, points_earned, points_used)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, quantity, price, subtotal, note, size_name, toppings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');

    const transaction = db.transaction((orderData) => {
      let pointsEarned = 0;
      if (orderData.customer_id && (orderData.status === 'completed' || !orderData.status) && !orderData.pointsUsed) {
        pointsEarned = Math.floor(orderData.final_total / 10000);
      }

      const result = insertOrder.run(
        orderData.customer_id || null,
        orderData.user_id,
        orderData.total,
        orderData.discount || 0,
        orderData.final_total,
        orderData.payment_method || 'cash',
        orderData.status || 'completed',
        orderData.note || '',
        pointsEarned,
        orderData.pointsUsed || 0
      );
      const orderId = result.lastInsertRowid;

      // Expand combo items into real products
      const expandedItems = [];
      for (const item of orderData.items) {
        if (typeof item.product_id === 'string' && item.product_id.startsWith('combo_')) {
          const comboId = parseInt(item.product_id.replace('combo_', ''));
          const combo = db.prepare('SELECT * FROM combos WHERE id = ?').get(comboId);
          if (combo) {
            const comboItems = db.prepare('SELECT ci.*, p.price as original_price FROM combo_items ci LEFT JOIN products p ON ci.product_id = p.id WHERE ci.combo_id = ?').all(comboId);
            if (comboItems.length > 0) {
              const originalTotal = comboItems.reduce((s, ci) => s + (ci.original_price || 0) * (ci.quantity || 1), 0);
              for (const ci of comboItems) {
                const ratio = originalTotal > 0 ? ((ci.original_price || 0) * (ci.quantity || 1)) / originalTotal : 1 / comboItems.length;
                expandedItems.push({
                  product_id: ci.product_id,
                  product_name: ci.product_name,
                  quantity: (ci.quantity || 1) * item.quantity,
                  price: Math.round(combo.price * ratio / (ci.quantity || 1)),
                  subtotal: Math.round(combo.price * ratio * item.quantity),
                  note: `[Combo: ${combo.name}]`,
                  size_name: ''
                });
              }
            }
          }
        } else {
          expandedItems.push(item);
        }
      }

      for (const item of expandedItems) {
        insertItem.run(orderId, item.product_id, item.product_name, item.quantity, item.price, item.subtotal, item.note || '', item.size_name || '', item.toppings || '');
        if (orderData.status === 'completed') {
          const stockResult = updateStock.run(item.quantity, item.product_id, item.quantity);
          if (stockResult.changes === 0) {
            throw new Error(`Sản phẩm "${item.product_name}" không đủ tồn kho`);
          }
        }
      }

      // Earn loyalty points
      if (pointsEarned > 0) {
        db.prepare('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?').run(pointsEarned, orderData.customer_id);
      }

      return orderId;
    });

    return transaction(data);
  },

  update(id, data) {
    return db.prepare(`
      UPDATE orders SET status = ?, note = ?, discount = ?, final_total = ?
      WHERE id = ?
    `).run(data.status, data.note || '', data.discount || 0, data.final_total, id);
  },

  updatePaymentMethod(id, method) {
    return db.prepare('UPDATE orders SET payment_method = ? WHERE id = ?').run(method, id);
  },

  delete(id, userRole) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) throw new Error('Đơn hàng không tồn tại');
    if (order.status === 'completed' && userRole !== 'admin') {
      throw new Error('Chỉ Admin mới có thể xóa đơn hàng đã thanh toán');
    }

    const restoreStock = db.transaction(() => {
      if (order.status === 'completed') {
        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
        for (const item of items) {
          db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, item.product_id);
        }

        if (order.customer_id) {
          const ptsEarned = order.points_earned !== undefined ? order.points_earned : Math.floor(order.final_total / 10000);
          const ptsUsed = order.points_used || 0;
          
          if (ptsEarned > 0) {
            db.prepare('UPDATE customers SET loyalty_points = MAX(0, loyalty_points - ?) WHERE id = ?').run(ptsEarned, order.customer_id);
          }
          if (ptsUsed > 0) {
            db.prepare('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?').run(ptsUsed, order.customer_id);
          }
        }
      }
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(id);
      db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    });

    return restoreStock();
  }
};

// ==================== STATISTICS QUERIES ====================
const statsQueries = {
  getDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const todayRevenue = db.prepare(`
      SELECT COALESCE(SUM(final_total), 0) as revenue, COUNT(*) as count
      FROM orders WHERE DATE(created_at) = ? AND status = 'completed'
    `).get(today);

    const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE active = 1').get();
    const totalCustomers = db.prepare('SELECT COUNT(*) as count FROM customers').get();
    const lowStock = db.prepare('SELECT COUNT(*) as count FROM products WHERE active = 1 AND stock <= 5').get();

    const topProducts = db.prepare(`
      SELECT oi.product_name, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'completed' AND DATE(o.created_at) = ?
      GROUP BY oi.product_id
      ORDER BY total_qty DESC
      LIMIT 5
    `).all(today);

    const recentOrders = db.prepare(`
      SELECT o.*, u.full_name as user_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `).all();

    return {
      todayRevenue: todayRevenue.revenue,
      todayOrders: todayRevenue.count,
      totalProducts: totalProducts.count,
      totalCustomers: totalCustomers.count,
      lowStockCount: lowStock.count,
      topProducts,
      recentOrders
    };
  },

  getRevenueByDateRange(dateFrom, dateTo) {
    return db.prepare(`
      SELECT DATE(created_at) as date, SUM(final_total) as revenue, COUNT(*) as orders
      FROM orders
      WHERE status = 'completed' AND DATE(created_at) BETWEEN ? AND ?
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all(dateFrom, dateTo);
  },

  getRevenueByMonth(year) {
    return db.prepare(`
      SELECT strftime('%m', created_at) as month, SUM(final_total) as revenue, COUNT(*) as orders
      FROM orders
      WHERE status = 'completed' AND strftime('%Y', created_at) = ?
      GROUP BY strftime('%m', created_at)
      ORDER BY month
    `).all(String(year));
  },

  getTopProducts(dateFrom, dateTo, limit = 10) {
    return db.prepare(`
      SELECT oi.product_name, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'completed' AND DATE(o.created_at) BETWEEN ? AND ?
      GROUP BY oi.product_id
      ORDER BY total_revenue DESC
      LIMIT ?
    `).all(dateFrom, dateTo, limit);
  }
};

// ==================== ACTIVITY LOG ====================
const activityQueries = {
  log(userId, action, details = '') {
    return db.prepare('INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)').run(userId, action, details);
  },
  getRecent(limit = 50) {
    return db.prepare(`
      SELECT al.*, u.full_name as user_name
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT ?
    `).all(limit);
  }
};

// ==================== SHIFT QUERIES ====================
const shiftQueries = {
  open(userId, startAmount = 0) {
    const existing = db.prepare("SELECT id FROM shifts WHERE user_id = ? AND status = 'open'").get(userId);
    if (existing) throw new Error('Đã có ca đang mở');
    const result = db.prepare('INSERT INTO shifts (user_id, start_amount) VALUES (?, ?)').run(userId, startAmount);
    return result.lastInsertRowid;
  },

  close(shiftId, note = '') {
    return db.prepare("UPDATE shifts SET end_time = CURRENT_TIMESTAMP, status = 'closed', note = ? WHERE id = ?").run(note, shiftId);
  },

  getCurrent(userId) {
    return db.prepare("SELECT * FROM shifts WHERE user_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1").get(userId);
  },

  getAll(limit = 30) {
    return db.prepare(`
      SELECT s.*, u.full_name as user_name
      FROM shifts s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.start_time DESC
      LIMIT ?
    `).all(limit);
  },

  getByDate(dateFrom, dateTo) {
    return db.prepare(`
      SELECT s.*, u.full_name as user_name
      FROM shifts s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE date(s.start_time) >= ? AND date(s.start_time) <= ?
      ORDER BY s.start_time DESC
    `).all(dateFrom, dateTo);
  },

  getLastClosed() {
    const lastShift = db.prepare("SELECT * FROM shifts WHERE status = 'closed' ORDER BY end_time DESC LIMIT 1").get();
    if (!lastShift) return 0;
    const endTime = lastShift.end_time || new Date().toISOString();
    const orders = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN final_total ELSE 0 END), 0) as cash_total
      FROM orders WHERE user_id = ? AND status = 'completed'
        AND created_at >= ? AND created_at <= ?
    `).get(lastShift.user_id, lastShift.start_time, endTime);
    const txns = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'in' THEN amount ELSE 0 END), 0) as total_cash_in,
        COALESCE(SUM(CASE WHEN type = 'out' THEN amount ELSE 0 END), 0) as total_cash_out
      FROM shift_transactions WHERE shift_id = ?
    `).get(lastShift.id);
    return (lastShift.start_amount || 0) + (orders.cash_total || 0) + (txns.total_cash_in || 0) - (txns.total_cash_out || 0);
  },

  getSummary(shiftId) {
    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId);
    if (!shift) return null;

    const endTime = shift.end_time || new Date().toISOString();
    const orders = db.prepare(`
      SELECT 
        COUNT(*) as order_count,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN final_total ELSE 0 END), 0) as cash_total,
        COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN final_total ELSE 0 END), 0) as transfer_total,
        COALESCE(SUM(final_total), 0) as total_revenue
      FROM orders
      WHERE user_id = ? AND status = 'completed'
        AND created_at >= ? AND created_at <= ?
    `).get(shift.user_id, shift.start_time, endTime);

    const txns = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'in' THEN amount ELSE 0 END), 0) as total_cash_in,
        COALESCE(SUM(CASE WHEN type = 'out' THEN amount ELSE 0 END), 0) as total_cash_out
      FROM shift_transactions WHERE shift_id = ?
    `).get(shiftId);

    return { ...shift, ...orders, ...txns };
  },

  addTransaction(shiftId, type, amount, reason, note = '') {
    const result = db.prepare('INSERT INTO shift_transactions (shift_id, type, amount, reason, note) VALUES (?, ?, ?, ?, ?)').run(shiftId, type, amount, reason, note);
    return result.lastInsertRowid;
  },

  getTransactions(shiftId) {
    return db.prepare('SELECT * FROM shift_transactions WHERE shift_id = ? ORDER BY created_at DESC').all(shiftId);
  },

  deleteTransaction(id) {
    return db.prepare('DELETE FROM shift_transactions WHERE id = ?').run(id);
  }
};

// ==================== COMBO QUERIES ====================
const comboQueries = {
  getAll(activeOnly = false) {
    let sql = 'SELECT * FROM combos';
    if (activeOnly) sql += ' WHERE active = 1';
    sql += ' ORDER BY created_at DESC';
    const combos = db.prepare(sql).all();
    for (const c of combos) {
      c.items = db.prepare('SELECT ci.*, p.price as original_price FROM combo_items ci LEFT JOIN products p ON ci.product_id = p.id WHERE ci.combo_id = ?').all(c.id);
    }
    return combos;
  },

  getById(id) {
    const combo = db.prepare('SELECT * FROM combos WHERE id = ?').get(id);
    if (combo) {
      combo.items = db.prepare('SELECT ci.*, p.price as original_price FROM combo_items ci LEFT JOIN products p ON ci.product_id = p.id WHERE ci.combo_id = ?').all(id);
    }
    return combo;
  },

  create(data) {
    const result = db.prepare('INSERT INTO combos (name, price, description) VALUES (?, ?, ?)').run(data.name, data.price, data.description || '');
    const comboId = result.lastInsertRowid;
    const insert = db.prepare('INSERT INTO combo_items (combo_id, product_id, product_name, quantity) VALUES (?, ?, ?, ?)');
    for (const item of (data.items || [])) {
      insert.run(comboId, item.product_id, item.product_name, item.quantity || 1);
    }
    return comboId;
  },

  update(id, data) {
    db.prepare('UPDATE combos SET name = ?, price = ?, description = ? WHERE id = ?').run(data.name, data.price, data.description || '', id);
    db.prepare('DELETE FROM combo_items WHERE combo_id = ?').run(id);
    const insert = db.prepare('INSERT INTO combo_items (combo_id, product_id, product_name, quantity) VALUES (?, ?, ?, ?)');
    for (const item of (data.items || [])) {
      insert.run(id, item.product_id, item.product_name, item.quantity || 1);
    }
  },

  delete(id) {
    db.prepare('DELETE FROM combo_items WHERE combo_id = ?').run(id);
    db.prepare('DELETE FROM combos WHERE id = ?').run(id);
  },

  toggleActive(id) {
    db.prepare('UPDATE combos SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?').run(id);
  }
};

module.exports = {
  initDatabase,
  getDb,
  userQueries,
  categoryQueries,
  productQueries,
  sizeQueries,
  customerQueries,
  orderQueries,
  statsQueries,
  activityQueries,
  shiftQueries,
  comboQueries
};
