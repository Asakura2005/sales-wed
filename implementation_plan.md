# App Bán Hàng - Desktop POS Application

Xây dựng ứng dụng quản lý bán hàng desktop sử dụng **Electron** + **SQLite**. Ứng dụng hỗ trợ 2 vai trò (Admin/Nhân viên), in hóa đơn qua máy in bill, và đóng gói thành file `.exe` installer.

## Yêu Cầu Đã Sắp Xếp

### Phân quyền

| Tính năng | Admin | Nhân viên |
|---|:---:|:---:|
| Đăng nhập | ✅ | ✅ |
| Quản lý sản phẩm (CRUD) | ✅ | ❌ |
| Tạo đơn hàng (POS) | ✅ | ✅ |
| Sửa đơn hàng (chưa thanh toán) | ✅ | ✅ |
| Xóa đơn hàng (chưa thanh toán) | ✅ | ✅ |
| Xóa đơn hàng (đã thanh toán) | ✅ | ❌ |
| Quản lý khách hàng | ✅ | ❌ |
| Xem thống kê doanh thu | ✅ | ✅ (giới hạn) |
| In hóa đơn | ✅ | ✅ |
| Quản lý nhân viên | ✅ | ❌ |
| Sao lưu/khôi phục dữ liệu | ✅ | ❌ |

### Đề xuất bổ sung
- **Quản lý danh mục sản phẩm** (phân loại: đồ ăn, nước uống, v.v.)
- **Sao lưu & khôi phục database** (tránh mất dữ liệu)
- **Lịch sử hoạt động** (audit log - ai làm gì, lúc nào)
- **Tìm kiếm nhanh** sản phẩm bằng tên hoặc mã

---

## Proposed Changes

### Cấu trúc thư mục

```
e:\Code in class\appbanhang\
├── package.json
├── main.js                  # Electron main process
├── preload.js               # Preload script (bridge)
├── database/
│   └── db.js                # SQLite setup & queries
├── src/
│   ├── index.html           # Entry point
│   ├── css/
│   │   └── styles.css       # Global styles
│   ├── js/
│   │   ├── app.js           # Main app router/controller
│   │   ├── auth.js          # Login logic
│   │   ├── products.js      # Product management
│   │   ├── pos.js           # POS / sales screen
│   │   ├── customers.js     # Customer management
│   │   ├── orders.js        # Order management
│   │   ├── stats.js         # Statistics/reports
│   │   ├── employees.js     # Employee management
│   │   ├── printer.js       # Thermal printer integration
│   │   └── utils.js         # Utility functions
│   └── pages/
│       ├── login.html
│       ├── dashboard.html
│       ├── products.html
│       ├── pos.html
│       ├── customers.html
│       ├── orders.html
│       ├── stats.html
│       └── employees.html
└── assets/
    └── icon.png             # App icon
```

---

### 1. Project Foundation

#### [NEW] [package.json](file:///e:/Code%20in%20class/appbanhang/package.json)
- Electron app config, scripts (`dev`, `build`)
- Dependencies: `electron`, `better-sqlite3`, `electron-builder`

#### [NEW] [main.js](file:///e:/Code%20in%20class/appbanhang/main.js)
- Electron main process: tạo BrowserWindow, menu, IPC handlers
- Kết nối database, xử lý print

#### [NEW] [preload.js](file:///e:/Code%20in%20class/appbanhang/preload.js)
- Bridge giữa main process và renderer (contextBridge)
- Expose các API: database queries, print, file system

---

### 2. Database Layer

#### [NEW] [database/db.js](file:///e:/Code%20in%20class/appbanhang/database/db.js)
- Khởi tạo SQLite database
- Tạo tables:

```sql
-- Nhân viên / Tài khoản
users (id, username, password_hash, full_name, role, phone, active, created_at)

-- Danh mục sản phẩm
categories (id, name, description)

-- Sản phẩm
products (id, name, category_id, price, cost_price, stock, unit, barcode, active, created_at)

-- Khách hàng
customers (id, name, phone, address, email, notes, created_at)

-- Đơn hàng
orders (id, customer_id, user_id, total, discount, final_total, payment_method, status, note, created_at)

-- Chi tiết đơn hàng
order_items (id, order_id, product_id, quantity, price, subtotal)

-- Lịch sử hoạt động
activity_log (id, user_id, action, details, created_at)
```

- CRUD functions cho tất cả tables
- Tạo tài khoản admin mặc định (admin/admin123)

---

### 3. UI Screens

#### [NEW] [src/index.html](file:///e:/Code%20in%20class/appbanhang/src/index.html)
- Entry point, load CSS & JS
- Container cho SPA (Single Page Application) routing

#### [NEW] [src/css/styles.css](file:///e:/Code%20in%20class/appbanhang/src/css/styles.css)
- Design system: dark theme với accent colors
- Sidebar navigation, responsive cards, tables
- Modern UI: glassmorphism, smooth transitions, animations

#### Các màn hình chính:
- **Login** - Đăng nhập với username/password
- **Dashboard** - Tổng quan: doanh thu hôm nay, số đơn, sản phẩm bán chạy
- **POS** - Màn hình bán hàng: tìm SP → thêm giỏ → thanh toán → in bill
- **Products** - Bảng sản phẩm + form thêm/sửa/xóa (Admin only)
- **Orders** - Danh sách đơn hàng, filter theo ngày/trạng thái
- **Customers** - Quản lý khách hàng (Admin only)
- **Statistics** - Biểu đồ doanh thu (Chart.js)
- **Employees** - Quản lý nhân viên (Admin only)

---

### 4. Thermal Printer

#### [NEW] [src/js/printer.js](file:///e:/Code%20in%20class/appbanhang/src/js/printer.js)
- Sử dụng `electron` native printing API
- Tạo HTML template cho bill (80mm width)
- Hỗ trợ in qua máy in bill USB (ESC/POS compatible)
- Preview trước khi in

---

### 5. Packaging

#### Cấu hình electron-builder trong `package.json`:
```json
{
  "build": {
    "appId": "com.appbanhang.pos",
    "productName": "App Bán Hàng",
    "win": {
      "target": "nsis",
      "icon": "assets/icon.png"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "installerLanguages": ["vi_VN"]
    }
  }
}
```

---

## Verification Plan

### Automated Tests
- Chạy `npm start` để khởi động app trong dev mode
- Kiểm tra database tự tạo và seed data admin mặc định

### Manual Verification (Browser Subagent)
1. **Đăng nhập**: Login với admin/admin123 → vào dashboard
2. **Thêm sản phẩm**: Tạo 2-3 sản phẩm test
3. **POS**: Tạo đơn hàng, thêm sản phẩm, thanh toán
4. **Phân quyền**: Login nhân viên → kiểm tra không xóa được đơn đã thanh toán
5. **Thống kê**: Xem biểu đồ doanh thu
6. **Build**: Chạy `npm run build` → kiểm tra file `.exe` được tạo

### Yêu cầu người dùng test
- Kết nối máy in bill thật và test in hóa đơn (cần phần cứng)
- Cài đặt file `.exe` trên máy khác để test installer
