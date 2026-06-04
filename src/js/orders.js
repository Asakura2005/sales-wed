// ==================== ORDER MANAGEMENT ====================

async function renderOrdersPage() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <select class="filter-select" id="order-status-filter">
          <option value="">Tất cả trạng thái</option>
          <option value="completed">Đã thanh toán</option>
          <option value="pending">Chờ xử lý</option>
          <option value="cancelled">Đã hủy</option>
        </select>
        <div class="date-filter">
          <input type="date" id="order-date-from" value="${getFirstDayOfMonth()}">
          <span class="text-muted">đến</span>
          <input type="date" id="order-date-to" value="${getToday()}">
          <button class="btn btn-sm btn-secondary" onclick="loadOrders()"><i class="fas fa-filter"></i> Lọc</button>
        </div>
      </div>
      <div class="toolbar-right">
        <div class="search-box" style="position:relative;">
          <i class="fas fa-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-secondary);"></i>
          <input type="text" id="order-search" class="form-control" placeholder="Tìm mã đơn, tên khách, SĐT..." style="padding-left:32px;width:250px;" oninput="loadOrders()">
        </div>
      </div>
    </div>
    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Mã ĐH</th>
              <th>Thời gian</th>
              <th>Khách hàng</th>
              <th>Nhân viên</th>
              <th>Tổng tiền</th>
              <th>Giảm giá</th>
              <th>Thanh toán</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody id="orders-table-body">
            <tr><td colspan="9" class="text-center text-muted">Đang tải...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  await loadOrders();
  document.getElementById('order-status-filter').addEventListener('change', loadOrders);
}

async function loadOrders() {
  const filters = {
    status: document.getElementById('order-status-filter')?.value || '',
    dateFrom: document.getElementById('order-date-from')?.value || '',
    dateTo: document.getElementById('order-date-to')?.value || '',
    search: document.getElementById('order-search')?.value.trim() || ''
  };

  const result = await window.api.getOrders(filters);
  const tbody = document.getElementById('orders-table-body');

  if (!result.success || result.data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-receipt"></i><h3>Không có đơn hàng</h3></div></td></tr>`;
    return;
  }

  tbody.innerHTML = result.data.map(o => `
    <tr>
      <td><strong>#${o.id}</strong></td>
      <td>${formatDateTime(o.created_at)}</td>
      <td>${o.customer_name || 'Khách lẻ'}</td>
      <td>${o.user_name}</td>
      <td class="text-success text-bold">${formatCurrency(o.final_total)}</td>
      <td>${o.discount > 0 ? formatCurrency(o.discount) : '-'}</td>
      <td>${getPaymentBadge(o.payment_method)}</td>
      <td>${getStatusBadge(o.status)}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-sm btn-secondary" onclick="viewOrderDetail(${o.id})" title="Xem chi tiết">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn btn-sm btn-secondary" onclick="changePaymentMethod(${o.id}, '${o.payment_method}')" title="Đổi PTTT" style="color:#FFC107;">
            <i class="fas fa-exchange-alt"></i>
          </button>
          <button class="btn btn-sm btn-primary" onclick="printOrderBill(${o.id})" title="In hóa đơn">
            <i class="fas fa-print"></i>
          </button>
          ${canDeleteOrder(o) ? `
            <button class="btn btn-sm btn-danger" onclick="deleteOrder(${o.id}, '${o.status}')" title="Xóa">
              <i class="fas fa-trash"></i>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function canDeleteOrder(order) {
  const user = getCurrentUser();
  if (user.role === 'admin') return true;
  if (order.status !== 'completed') return true;
  return false;
}

async function viewOrderDetail(orderId) {
  const result = await window.api.getOrderById(orderId);
  if (!result.success) {
    showToast('Không tìm thấy đơn hàng', 'error');
    return;
  }

  const order = result.data;
  showModal(`
    <div class="modal-header">
      <h3>Chi tiết đơn hàng #${order.id}</h3>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="order-detail-grid">
      <div class="order-detail-item">
        <label>Thời gian</label>
        <span>${formatDateTime(order.created_at)}</span>
      </div>
      <div class="order-detail-item">
        <label>Trạng thái</label>
        <span>${getStatusBadge(order.status)}</span>
      </div>
      <div class="order-detail-item">
        <label>Khách hàng</label>
        <span>${order.customer_name || 'Khách lẻ'} ${order.customer_phone ? '- ' + order.customer_phone : ''}</span>
      </div>
      <div class="order-detail-item">
        <label>Nhân viên</label>
        <span>${order.user_name}</span>
      </div>
      <div class="order-detail-item">
        <label>Thanh toán</label>
        <span>${getPaymentBadge(order.payment_method)}</span>
      </div>
      <div class="order-detail-item">
        <label>Ghi chú</label>
        <span>${order.note || '-'}</span>
      </div>
    </div>
    <div class="table-container mb-4">
      <table>
        <thead><tr><th>Sản phẩm</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
        <tbody>
          ${order.items.map(item => {
            const toppings = item.toppings ? (function(){ try { return JSON.parse(item.toppings); } catch(e) { return []; } })() : [];
            const toppingLine = toppings.length > 0 ? `<div style="font-size:11px;color:#4caf50;font-style:italic;">+ ${toppings.map(t => t.name).join(', ')}</div>` : '';
            return `
            <tr>
              <td>${item.product_name}${toppingLine}${item.note ? `<div style="font-size:11px;color:#ff9800;font-style:italic;">→ ${item.note}</div>` : ''}</td>
              <td>${item.quantity}</td>
              <td>${formatCurrency(item.price)}</td>
              <td class="text-bold">${formatCurrency(item.subtotal)}</td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    </div>
    <div style="text-align:right;">
      <p>Tạm tính: <strong>${formatCurrency(order.total)}</strong></p>
      ${order.discount > 0 ? `<p>Giảm giá: <strong class="text-danger">-${formatCurrency(order.discount)}</strong></p>` : ''}
      <p style="font-size:18px;color:var(--secondary);">Tổng cộng: <strong>${formatCurrency(order.final_total)}</strong></p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Đóng</button>
      <button class="btn btn-primary" onclick="closeModal(); printOrderBill(${order.id});">
        <i class="fas fa-print"></i> In hóa đơn
      </button>
    </div>
  `, true);
}

function deleteOrder(orderId, status) {
  const user = getCurrentUser();
  if (status === 'completed' && user.role !== 'admin') {
    showToast('Chỉ Admin mới có thể xóa đơn đã thanh toán', 'error');
    return;
  }

  showConfirm(`Bạn có chắc muốn xóa đơn hàng <strong>#${orderId}</strong>?`, async () => {
    const result = await window.api.deleteOrder(orderId, user.role);
    if (result.success) {
      showToast('Đã xóa đơn hàng', 'success');
      await window.api.logActivity(user.id, 'delete_order', `Xóa đơn #${orderId}`);
      loadOrders();
    } else {
      showToast('Lỗi: ' + result.error, 'error');
    }
  });
}

function changePaymentMethod(orderId, currentMethod) {
  const newMethod = currentMethod === 'cash' ? 'transfer' : 'cash';
  const newLabel = newMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản';
  const icon = newMethod === 'cash' ? 'fa-money-bill-wave' : 'fa-university';

  showConfirm(`Đổi phương thức thanh toán đơn <strong>#${orderId}</strong> sang <strong><i class="fas ${icon}"></i> ${newLabel}</strong>?`, async () => {
    const result = await window.api.updateOrderPayment(orderId, newMethod);
    if (result.success) {
      showToast(`Đã đổi sang ${newLabel}`, 'success');
      loadOrders();
    } else {
      showToast('Lỗi: ' + result.error, 'error');
    }
  });
}
