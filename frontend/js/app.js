// ==================== MAIN APP CONTROLLER ====================

const pageTitles = {
  dashboard: 'Tổng quan',
  pos: 'Bán hàng',
  orders: 'Đơn hàng',
  products: 'Sản phẩm',
  customers: 'Khách hàng',
  stats: 'Thống kê',
  employees: 'Nhân viên',
  shifts: 'Ca làm việc',
  combos: 'Combo / Khuyến mãi'
};

let currentPage = 'dashboard';

function initApp() {
  // Navigation
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      navigateTo(page);
    });
  });

  // Sidebar toggle
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', () => {
    showConfirm('Bạn có chắc muốn đăng xuất?', () => {
      logout();
    });
  });

  // Backup button
  const backupBtn = document.getElementById('btn-backup');
  if (backupBtn) {
    backupBtn.addEventListener('click', () => {
      showBackupModal();
    });
  }

  // Clock
  updateClock();
  setInterval(updateClock, 1000);

  // Load dashboard
  navigateTo('dashboard');
}

function navigateTo(page) {
  currentPage = page;

  // Update active menu
  document.querySelectorAll('.menu-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Update page title
  document.getElementById('page-title').textContent = pageTitles[page] || page;

  // Render page
  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'pos': renderPosPage(); break;
    case 'orders': renderOrdersPage(); break;
    case 'products': renderProductsPage(); break;
    case 'customers': renderCustomersPage(); break;
    case 'stats': renderStatsPage(); break;
    case 'employees': renderEmployeesPage(); break;
    case 'shifts': renderShiftsPage(); break;
    case 'combos': renderCombosPage(); break;
  }
}

async function renderDashboard() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="stat-cards" id="dashboard-stats">
      <div class="stat-card revenue">
        <div class="stat-icon"><i class="fas fa-money-bill-trend-up"></i></div>
        <div class="stat-info"><h3><span class="spinner"></span></h3><p>Doanh thu hôm nay</p></div>
      </div>
      <div class="stat-card orders">
        <div class="stat-icon"><i class="fas fa-receipt"></i></div>
        <div class="stat-info"><h3><span class="spinner"></span></h3><p>Đơn hàng hôm nay</p></div>
      </div>
      <div class="stat-card products">
        <div class="stat-icon"><i class="fas fa-boxes-stacked"></i></div>
        <div class="stat-info"><h3><span class="spinner"></span></h3><p>Sản phẩm</p></div>
      </div>
      <div class="stat-card customers">
        <div class="stat-icon"><i class="fas fa-users"></i></div>
        <div class="stat-info"><h3><span class="spinner"></span></h3><p>Khách hàng</p></div>
      </div>
      <div class="stat-card warning">
        <div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
        <div class="stat-info"><h3><span class="spinner"></span></h3><p>Sắp hết hàng</p></div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-trophy"></i> Sản phẩm bán chạy hôm nay</h3>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>Sản phẩm</th><th>SL bán</th><th>Doanh thu</th></tr></thead>
            <tbody id="dashboard-top-products">
              <tr><td colspan="3" class="text-center text-muted">Đang tải...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-history"></i> Đơn hàng gần đây</h3>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>Mã</th><th>Tổng</th><th>TT</th></tr></thead>
            <tbody id="dashboard-recent-orders">
              <tr><td colspan="3" class="text-center text-muted">Đang tải...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const result = await window.api.getDashboard();
  if (!result.success) return;

  const data = result.data;
  document.getElementById('dashboard-stats').innerHTML = `
    <div class="stat-card revenue">
      <div class="stat-icon"><i class="fas fa-money-bill-trend-up"></i></div>
      <div class="stat-info">
        <h3>${formatCurrency(data.todayRevenue)}</h3>
        <p>Doanh thu hôm nay</p>
      </div>
    </div>
    <div class="stat-card orders">
      <div class="stat-icon"><i class="fas fa-receipt"></i></div>
      <div class="stat-info">
        <h3>${data.todayOrders}</h3>
        <p>Đơn hàng hôm nay</p>
      </div>
    </div>
    <div class="stat-card products">
      <div class="stat-icon"><i class="fas fa-boxes-stacked"></i></div>
      <div class="stat-info">
        <h3>${data.totalProducts}</h3>
        <p>Sản phẩm</p>
      </div>
    </div>
    <div class="stat-card customers">
      <div class="stat-icon"><i class="fas fa-users"></i></div>
      <div class="stat-info">
        <h3>${data.totalCustomers}</h3>
        <p>Khách hàng</p>
      </div>
    </div>
    <div class="stat-card warning">
      <div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
      <div class="stat-info">
        <h3>${data.lowStockCount}</h3>
        <p>Sắp hết hàng</p>
      </div>
    </div>
  `;

  // Top products
  const topTbody = document.getElementById('dashboard-top-products');
  if (data.topProducts.length === 0) {
    topTbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Chưa có dữ liệu</td></tr>';
  } else {
    topTbody.innerHTML = data.topProducts.map(p => `
      <tr>
        <td>${p.product_name}</td>
        <td class="text-bold">${p.total_qty}</td>
        <td class="text-success">${formatCurrency(p.total_revenue)}</td>
      </tr>
    `).join('');
  }

  // Recent orders
  const recentTbody = document.getElementById('dashboard-recent-orders');
  if (data.recentOrders.length === 0) {
    recentTbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Chưa có đơn hàng</td></tr>';
  } else {
    recentTbody.innerHTML = data.recentOrders.slice(0, 8).map(o => `
      <tr>
        <td><strong>#${o.id}</strong></td>
        <td class="text-success">${formatCurrency(o.final_total)}</td>
        <td>${getStatusBadge(o.status)}</td>
      </tr>
    `).join('');
  }
}

function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const el = document.getElementById('current-time');
  if (el) el.textContent = timeStr;
}

function showBackupModal() {
  showModal(`
    <div class="modal-header">
      <h3>Sao lưu & Khôi phục</h3>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;padding:20px 0;">
      <button class="btn btn-primary" onclick="doBackup()" style="padding:16px;">
        <i class="fas fa-download"></i> Sao lưu dữ liệu
      </button>
      <button class="btn btn-warning" onclick="doRestore()" style="padding:16px;">
        <i class="fas fa-upload"></i> Khôi phục dữ liệu
      </button>
    </div>
    <p class="text-muted" style="font-size:12px;text-align:center;">
      Sao lưu thường xuyên để tránh mất dữ liệu.
    </p>
  `);
}

async function doBackup() {
  const result = await window.api.createBackup();
  if (result.success) {
    showToast('Sao lưu thành công!', 'success');
    closeModal();
  } else if (result.error !== 'Đã hủy') {
    showToast('Lỗi: ' + result.error, 'error');
  }
}

async function doRestore() {
  showConfirm('Khôi phục sẽ thay thế toàn bộ dữ liệu hiện tại. Bạn có chắc chắn?', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.db';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const result = await window.api.restoreBackup(file);
      if (result.success) {
        showToast('Khôi phục thành công! Ứng dụng sẽ tải lại...', 'success');
        setTimeout(() => location.reload(), 1500);
      } else {
        showToast('Lỗi: ' + result.error, 'error');
      }
    };
    input.click();
  });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});
