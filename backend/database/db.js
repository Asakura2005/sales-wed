require('dotenv').config();
const { db } = require('@vercel/postgres');
const bcrypt = require('bcryptjs');

// Helper to convert ? to $1, $2 etc.
function pgSql(text) {
  let i = 1;
  return text.replace(/\?/g, () => `$${i++}`);
}

async function query(text, params = []) {
  return await db.query(pgSql(text), params);
}

async function get(text, ...params) {
  const res = await query(text, params);
  return res.rows[0] || null;
}

async function all(text, ...params) {
  const res = await query(text, params);
  return res.rows;
}

async function run(text, ...params) {
  return await query(text, params);
}

async function initDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'employee' CHECK(role IN ('admin', 'employee')),
      phone VARCHAR(50),
      active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      cost_price DECIMAL(10,2) DEFAULT 0,
      stock INTEGER DEFAULT 0,
      unit VARCHAR(50) DEFAULT 'cái',
      barcode VARCHAR(255),
      image TEXT,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      address TEXT,
      email VARCHAR(255),
      notes TEXT,
      loyalty_points INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      total DECIMAL(10,2) NOT NULL DEFAULT 0,
      discount DECIMAL(10,2) DEFAULT 0,
      final_total DECIMAL(10,2) NOT NULL DEFAULT 0,
      payment_method VARCHAR(50) DEFAULT 'cash' CHECK(payment_method IN ('cash', 'transfer', 'card')),
      status VARCHAR(50) DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'cancelled')),
      note TEXT,
      points_earned INTEGER DEFAULT 0,
      points_used INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name VARCHAR(255) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price DECIMAL(10,2) NOT NULL,
      subtotal DECIMAL(10,2) NOT NULL,
      note TEXT DEFAULT '',
      size_name VARCHAR(255) DEFAULT '',
      toppings TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      action VARCHAR(255) NOT NULL,
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      end_time TIMESTAMP,
      start_amount DECIMAL(10,2) DEFAULT 0,
      end_amount DECIMAL(10,2) DEFAULT 0,
      status VARCHAR(50) DEFAULT 'open' CHECK(status IN ('open', 'closed')),
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS shift_transactions (
      id SERIAL PRIMARY KEY,
      shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL CHECK(type IN ('in', 'out')),
      amount DECIMAL(10,2) NOT NULL,
      reason TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_sizes (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      size_name VARCHAR(255) NOT NULL,
      price DECIMAL(10,2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS combos (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      description TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS combo_items (
      id SERIAL PRIMARY KEY,
      combo_id INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      product_name VARCHAR(255) NOT NULL,
      quantity INTEGER DEFAULT 1
    );
  `);

  await seedDefaultData();
}

async function seedDefaultData() {
  const adminCountRes = await get('SELECT COUNT(*) as count FROM users WHERE username = ?', 'admin');
  if (parseInt(adminCountRes.count) === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await run(`
      INSERT INTO users (username, password_hash, full_name, role, phone)
      VALUES (?, ?, ?, ?, ?)
    `, 'admin', hash, 'Quản trị viên', 'admin', '0000000000');
  }

  const catCountRes = await get('SELECT COUNT(*) as count FROM categories');
  if (parseInt(catCountRes.count) === 0) {
    await run('INSERT INTO categories (name, description) VALUES (?, ?)', 'Đồ ăn', 'Các loại đồ ăn');
    await run('INSERT INTO categories (name, description) VALUES (?, ?)', 'Nước uống', 'Các loại nước uống');
    await run('INSERT INTO categories (name, description) VALUES (?, ?)', 'Khác', 'Sản phẩm khác');
  }

  const prodCountRes = await get('SELECT COUNT(*) as count FROM products');
  if (parseInt(prodCountRes.count) === 0) {
    // Seed some products
    const seed = async (name, cat, price, cost, stock, unit, barcode) => {
      await run(`
        INSERT INTO products (name, category_id, price, cost_price, stock, unit, barcode)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, name, cat, price, cost, stock, unit, barcode);
    };
    await seed('Cơm gà xối mỡ',       1, 45000,  25000, 100, 'phần', 'DA001');
    await seed('Trà sữa trân châu',    2, 35000,  15000, 200, 'ly',   'NU001');
    await seed('Khăn giấy',            3, 5000,   2000,  300, 'gói',  'KH001');
  }
}

// ==================== USER QUERIES ====================
const userQueries = {
  async login(username, password) {
    const user = await get('SELECT * FROM users WHERE username = ? AND active = 1', username);
    if (!user) return null;
    if (!bcrypt.compareSync(password, user.password_hash)) return null;
    const { password_hash, ...safeUser } = user;
    return safeUser;
  },
  async getAll() {
    return await all('SELECT id, username, full_name, role, phone, active, created_at FROM users ORDER BY created_at DESC');
  },
  async getById(id) {
    return await get('SELECT id, username, full_name, role, phone, active, created_at FROM users WHERE id = ?', id);
  },
  async create(data) {
    const hash = bcrypt.hashSync(data.password, 10);
    const res = await query(`
      INSERT INTO users (username, password_hash, full_name, role, phone)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [data.username, hash, data.full_name, data.role || 'employee', data.phone || '']);
    return res.rows[0].id;
  },
  async update(id, data) {
    if (data.password) {
      const hash = bcrypt.hashSync(data.password, 10);
      await run('UPDATE users SET full_name = ?, role = ?, phone = ?, active = ?, password_hash = ? WHERE id = ?',
        data.full_name, data.role, data.phone, data.active !== undefined ? data.active : 1, hash, id);
    } else {
      await run('UPDATE users SET full_name = ?, role = ?, phone = ?, active = ? WHERE id = ?',
        data.full_name, data.role, data.phone, data.active !== undefined ? data.active : 1, id);
    }
  },
  async delete(id) {
    const user = await get('SELECT username FROM users WHERE id = ?', id);
    if (user && user.username === 'admin') throw new Error('Không thể xóa tài khoản admin');
    await run('DELETE FROM users WHERE id = ? AND username != ?', id, 'admin');
  }
};

// ==================== CATEGORY QUERIES ====================
const categoryQueries = {
  async getAll() {
    return await all('SELECT * FROM categories ORDER BY name');
  },
  async create(data) {
    const res = await query('INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING id', [data.name, data.description || '']);
    return res.rows[0].id;
  },
  async update(id, data) {
    await run('UPDATE categories SET name = ?, description = ? WHERE id = ?', data.name, data.description || '', id);
  },
  async delete(id) {
    await run('DELETE FROM categories WHERE id = ?', id);
  }
};

// ==================== PRODUCT QUERIES ====================
const productQueries = {
  async getAll(search = '', categoryId = null) {
    let text = `SELECT p.*, c.name as category_name
               FROM products p
               LEFT JOIN categories c ON p.category_id = c.id
               WHERE p.active = 1`;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      text += ` AND (p.name ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`;
    }
    if (categoryId) {
      params.push(categoryId);
      text += ` AND p.category_id = $${params.length}`;
    }
    text += ' ORDER BY p.name';
    return await all(text, ...params);
  },
  async getById(id) {
    return await get(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `, id);
  },
  async create(data) {
    const res = await query(`
      INSERT INTO products (name, category_id, price, cost_price, stock, unit, barcode)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [data.name, data.category_id || null, data.price, data.cost_price || 0, data.stock || 0, data.unit || 'cái', data.barcode || '']);
    return res.rows[0].id;
  },
  async update(id, data) {
    await run(`
      UPDATE products SET name = ?, category_id = ?, price = ?, cost_price = ?, stock = ?, unit = ?, barcode = ?
      WHERE id = ?
    `, data.name, data.category_id || null, data.price, data.cost_price || 0, data.stock || 0, data.unit || 'cái', data.barcode || '', id);
  },
  async delete(id) {
    await run('UPDATE products SET active = 0 WHERE id = ?', id);
  },
  async updateStock(id, quantity) {
    await run('UPDATE products SET stock = stock - ? WHERE id = ?', quantity, id);
  }
};

// ==================== SIZE QUERIES ====================
const sizeQueries = {
  async getByProduct(productId) {
    return await all('SELECT * FROM product_sizes WHERE product_id = ? ORDER BY price', productId);
  },
  async set(productId, sizes) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM product_sizes WHERE product_id = $1', [productId]);
      for (const s of sizes) {
        if (s.size_name && s.price > 0) {
          await client.query('INSERT INTO product_sizes (product_id, size_name, price) VALUES ($1, $2, $3)', [productId, s.size_name, s.price]);
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
  async delete(productId) {
    await run('DELETE FROM product_sizes WHERE product_id = ?', productId);
  }
};

// ==================== CUSTOMER QUERIES ====================
const customerQueries = {
  async getAll(search = '') {
    if (search) {
      return await all('SELECT * FROM customers WHERE name ILIKE ? OR phone ILIKE ? ORDER BY name', `%${search}%`, `%${search}%`);
    }
    return await all('SELECT * FROM customers ORDER BY name');
  },
  async getById(id) {
    return await get('SELECT * FROM customers WHERE id = ?', id);
  },
  async create(data) {
    const res = await query(`
      INSERT INTO customers (name, phone, address, email, notes)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [data.name, data.phone || '', data.address || '', data.email || '', data.notes || '']);
    return res.rows[0].id;
  },
  async update(id, data) {
    await run(`UPDATE customers SET name = ?, phone = ?, address = ?, email = ?, notes = ? WHERE id = ?`,
      data.name, data.phone || '', data.address || '', data.email || '', data.notes || '', id);
  },
  async delete(id) {
    await run('DELETE FROM customers WHERE id = ?', id);
  },
  async addPoints(id, points) {
    await run('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?', points, id);
  },
  async usePoints(id, points) {
    const customer = await get('SELECT loyalty_points FROM customers WHERE id = ?', id);
    if (!customer || customer.loyalty_points < points) return false;
    await run('UPDATE customers SET loyalty_points = loyalty_points - ? WHERE id = ?', points, id);
    return true;
  }
};

// ==================== ORDER QUERIES ====================
const orderQueries = {
  async getAll(filters = {}) {
    let sqlText = `SELECT o.*, u.full_name as user_name, c.name as customer_name
               FROM orders o
               LEFT JOIN users u ON o.user_id = u.id
               LEFT JOIN customers c ON o.customer_id = c.id
               WHERE 1=1`;
    const params = [];
    if (filters.status) { params.push(filters.status); sqlText += ` AND o.status = $${params.length}`; }
    if (filters.dateFrom) { params.push(filters.dateFrom); sqlText += ` AND DATE(o.created_at) >= $${params.length}`; }
    if (filters.dateTo) { params.push(filters.dateTo); sqlText += ` AND DATE(o.created_at) <= $${params.length}`; }
    if (filters.userId) { params.push(filters.userId); sqlText += ` AND o.user_id = $${params.length}`; }
    if (filters.search) {
      const s = filters.search.replace('#', '');
      params.push(`%${s}%`);
      sqlText += ` AND (CAST(o.id AS TEXT) ILIKE $${params.length} OR c.name ILIKE $${params.length} OR c.phone ILIKE $${params.length})`;
    }
    sqlText += ' ORDER BY o.created_at DESC';
    if (filters.limit) { params.push(filters.limit); sqlText += ` LIMIT $${params.length}`; }
    return await all(sqlText, ...params);
  },
  async getById(id) {
    const order = await get(`
      SELECT o.*, u.full_name as user_name, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `, id);
    if (order) {
      order.items = await all('SELECT * FROM order_items WHERE order_id = ?', id);
    }
    return order;
  },
  async create(orderData) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      let pointsEarned = 0;
      if (orderData.customer_id && (orderData.status === 'completed' || !orderData.status) && !orderData.pointsUsed) {
        pointsEarned = Math.floor(orderData.final_total / 10000);
      }
      const orderRes = await client.query(`
        INSERT INTO orders (customer_id, user_id, total, discount, final_total, payment_method, status, note, points_earned, points_used)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
      `, [
        orderData.customer_id || null, orderData.user_id, orderData.total, orderData.discount || 0,
        orderData.final_total, orderData.payment_method || 'cash', orderData.status || 'completed',
        orderData.note || '', pointsEarned, orderData.pointsUsed || 0
      ]);
      const orderId = orderRes.rows[0].id;

      for (const item of orderData.items) {
        await client.query(`
          INSERT INTO order_items (order_id, product_id, product_name, quantity, price, subtotal, note, size_name, toppings)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          orderId, item.product_id, item.product_name, item.quantity, item.price, item.subtotal,
          item.note || '', item.size_name || '', item.toppings || ''
        ]);
        if (orderData.status === 'completed') {
          const stockRes = await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1', [item.quantity, item.product_id]);
          if (stockRes.rowCount === 0) throw new Error(`Sản phẩm "${item.product_name}" không đủ tồn kho`);
        }
      }

      if (pointsEarned > 0) {
        await client.query('UPDATE customers SET loyalty_points = loyalty_points + $1 WHERE id = $2', [pointsEarned, orderData.customer_id]);
      }
      await client.query('COMMIT');
      return orderId;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
  async update(id, data) {
    await run(`UPDATE orders SET status = ?, note = ?, discount = ?, final_total = ? WHERE id = ?`,
      data.status, data.note || '', data.discount || 0, data.final_total, id);
  },
  async updatePaymentMethod(id, method) {
    await run('UPDATE orders SET payment_method = ? WHERE id = ?', method, id);
  },
  async delete(id, userRole) {
    const order = await get('SELECT * FROM orders WHERE id = ?', id);
    if (!order) throw new Error('Đơn hàng không tồn tại');
    if (order.status === 'completed' && userRole !== 'admin') throw new Error('Chỉ Admin mới có thể xóa đơn hàng đã thanh toán');

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      if (order.status === 'completed') {
        const items = await client.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
        for (const item of items.rows) {
          await client.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [item.quantity, item.product_id]);
        }
        if (order.customer_id) {
          const ptsEarned = order.points_earned !== undefined ? order.points_earned : Math.floor(order.final_total / 10000);
          const ptsUsed = order.points_used || 0;
          if (ptsEarned > 0) await client.query('UPDATE customers SET loyalty_points = GREATEST(0, loyalty_points - $1) WHERE id = $2', [ptsEarned, order.customer_id]);
          if (ptsUsed > 0) await client.query('UPDATE customers SET loyalty_points = loyalty_points + $1 WHERE id = $2', [ptsUsed, order.customer_id]);
        }
      }
      await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);
      await client.query('DELETE FROM orders WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
};

// ==================== STATISTICS QUERIES ====================
const statsQueries = {
  async getDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const todayRevenue = await get(`
      SELECT COALESCE(SUM(final_total), 0) as revenue, COUNT(*) as count
      FROM orders WHERE DATE(created_at) = DATE($1) AND status = 'completed'
    `, today);
    const totalProducts = await get('SELECT COUNT(*) as count FROM products WHERE active = 1');
    const totalCustomers = await get('SELECT COUNT(*) as count FROM customers');
    const lowStock = await get('SELECT COUNT(*) as count FROM products WHERE active = 1 AND stock <= 5');
    const topProducts = await all(`
      SELECT oi.product_name, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'completed' AND DATE(o.created_at) = DATE($1)
      GROUP BY oi.product_id, oi.product_name
      ORDER BY total_qty DESC LIMIT 5
    `, today);
    const recentOrders = await all(`
      SELECT o.*, u.full_name as user_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC LIMIT 10
    `);
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
  async getRevenueByDateRange(dateFrom, dateTo) {
    return await all(`
      SELECT DATE(created_at) as date, SUM(final_total) as revenue, COUNT(*) as orders
      FROM orders
      WHERE status = 'completed' AND DATE(created_at) BETWEEN DATE($1) AND DATE($2)
      GROUP BY DATE(created_at) ORDER BY date
    `, dateFrom, dateTo);
  },
  async getRevenueByMonth(year) {
    return await all(`
      SELECT EXTRACT(MONTH FROM created_at) as month, SUM(final_total) as revenue, COUNT(*) as orders
      FROM orders
      WHERE status = 'completed' AND EXTRACT(YEAR FROM created_at) = $1
      GROUP BY EXTRACT(MONTH FROM created_at) ORDER BY month
    `, year);
  },
  async getTopProducts(dateFrom, dateTo, limit = 10) {
    return await all(`
      SELECT oi.product_name, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'completed' AND DATE(o.created_at) BETWEEN DATE($1) AND DATE($2)
      GROUP BY oi.product_id, oi.product_name
      ORDER BY total_revenue DESC LIMIT $3
    `, dateFrom, dateTo, limit);
  }
};

// ==================== ACTIVITY LOG ====================
const activityQueries = {
  async log(userId, action, details = '') {
    await run('INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)', userId, action, details);
  },
  async getRecent(limit = 50) {
    return await all(`
      SELECT al.*, u.full_name as user_name
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC LIMIT ?
    `, limit);
  }
};

// ==================== SHIFT QUERIES ====================
const shiftQueries = {
  async open(userId, startAmount = 0) {
    const existing = await get("SELECT id FROM shifts WHERE user_id = ? AND status = 'open'", userId);
    if (existing) throw new Error('Đã có ca đang mở');
    const res = await query('INSERT INTO shifts (user_id, start_amount) VALUES ($1, $2) RETURNING id', [userId, startAmount]);
    return res.rows[0].id;
  },
  async close(shiftId, note = '') {
    await run("UPDATE shifts SET end_time = CURRENT_TIMESTAMP, status = 'closed', note = ? WHERE id = ?", note, shiftId);
  },
  async getCurrent(userId) {
    return await get("SELECT * FROM shifts WHERE user_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1", userId);
  },
  async getAll(limit = 30) {
    return await all(`
      SELECT s.*, u.full_name as user_name
      FROM shifts s LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.start_time DESC LIMIT ?
    `, limit);
  },
  async getByDate(dateFrom, dateTo) {
    return await all(`
      SELECT s.*, u.full_name as user_name
      FROM shifts s LEFT JOIN users u ON s.user_id = u.id
      WHERE DATE(s.start_time) >= DATE($1) AND DATE(s.start_time) <= DATE($2)
      ORDER BY s.start_time DESC
    `, dateFrom, dateTo);
  },
  async getLastClosed() {
    const lastShift = await get("SELECT * FROM shifts WHERE status = 'closed' ORDER BY end_time DESC LIMIT 1");
    if (!lastShift) return 0;
    const endTime = lastShift.end_time || new Date().toISOString();
    const orders = await get(`
      SELECT COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN final_total ELSE 0 END), 0) as cash_total
      FROM orders WHERE user_id = $1 AND status = 'completed' AND created_at >= $2 AND created_at <= $3
    `, lastShift.user_id, lastShift.start_time, endTime);
    const txns = await get(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'in' THEN amount ELSE 0 END), 0) as total_cash_in,
        COALESCE(SUM(CASE WHEN type = 'out' THEN amount ELSE 0 END), 0) as total_cash_out
      FROM shift_transactions WHERE shift_id = $1
    `, lastShift.id);
    return parseFloat(lastShift.start_amount || 0) + parseFloat(orders.cash_total || 0) + parseFloat(txns.total_cash_in || 0) - parseFloat(txns.total_cash_out || 0);
  },
  async getSummary(shiftId) {
    const shift = await get('SELECT * FROM shifts WHERE id = ?', shiftId);
    if (!shift) return null;
    const endTime = shift.end_time || new Date().toISOString();
    const orders = await get(`
      SELECT 
        COUNT(*) as order_count,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN final_total ELSE 0 END), 0) as cash_total,
        COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN final_total ELSE 0 END), 0) as transfer_total,
        COALESCE(SUM(final_total), 0) as total_revenue
      FROM orders WHERE user_id = $1 AND status = 'completed' AND created_at >= $2 AND created_at <= $3
    `, shift.user_id, shift.start_time, endTime);
    const txns = await get(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'in' THEN amount ELSE 0 END), 0) as total_cash_in,
        COALESCE(SUM(CASE WHEN type = 'out' THEN amount ELSE 0 END), 0) as total_cash_out
      FROM shift_transactions WHERE shift_id = $1
    `, shiftId);
    return { ...shift, ...orders, ...txns };
  },
  async addTransaction(shiftId, type, amount, reason, note = '') {
    const res = await query('INSERT INTO shift_transactions (shift_id, type, amount, reason, note) VALUES ($1, $2, $3, $4, $5) RETURNING id', [shiftId, type, amount, reason, note]);
    return res.rows[0].id;
  },
  async getTransactions(shiftId) {
    return await all('SELECT * FROM shift_transactions WHERE shift_id = ? ORDER BY created_at DESC', shiftId);
  },
  async deleteTransaction(id) {
    await run('DELETE FROM shift_transactions WHERE id = ?', id);
  }
};

// ==================== COMBO QUERIES ====================
const comboQueries = {
  async getAll(activeOnly = false) {
    let sqlText = 'SELECT * FROM combos';
    if (activeOnly) sqlText += ' WHERE active = 1';
    sqlText += ' ORDER BY created_at DESC';
    const combos = await all(sqlText);
    for (const c of combos) {
      c.items = await all('SELECT ci.*, p.price as original_price FROM combo_items ci LEFT JOIN products p ON ci.product_id = p.id WHERE ci.combo_id = ?', c.id);
    }
    return combos;
  },
  async getById(id) {
    const combo = await get('SELECT * FROM combos WHERE id = ?', id);
    if (combo) {
      combo.items = await all('SELECT ci.*, p.price as original_price FROM combo_items ci LEFT JOIN products p ON ci.product_id = p.id WHERE ci.combo_id = ?', id);
    }
    return combo;
  },
  async create(data) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query('INSERT INTO combos (name, price, description, active) VALUES ($1, $2, $3, $4) RETURNING id', [data.name, data.price, data.description || '', data.active !== undefined ? data.active : 1]);
      const comboId = res.rows[0].id;
      for (const item of data.items) {
        await client.query('INSERT INTO combo_items (combo_id, product_id, product_name, quantity) VALUES ($1, $2, $3, $4)', [comboId, item.product_id, item.product_name, item.quantity || 1]);
      }
      await client.query('COMMIT');
      return comboId;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
  async update(id, data) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE combos SET name = $1, price = $2, description = $3, active = $4 WHERE id = $5', [data.name, data.price, data.description || '', data.active !== undefined ? data.active : 1, id]);
      await client.query('DELETE FROM combo_items WHERE combo_id = $1', [id]);
      if (data.items) {
        for (const item of data.items) {
          await client.query('INSERT INTO combo_items (combo_id, product_id, product_name, quantity) VALUES ($1, $2, $3, $4)', [id, item.product_id, item.product_name, item.quantity || 1]);
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
  async delete(id) {
    await run('DELETE FROM combos WHERE id = ?', id);
  },
  async toggleActive(id) {
    await run('UPDATE combos SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?', id);
  }
};

module.exports = {
  initDatabase,
  getDb: () => db,
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
