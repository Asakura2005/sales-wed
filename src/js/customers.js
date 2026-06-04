// ==================== CUSTOMER MANAGEMENT ====================

async function renderCustomersPage() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input type="text" id="customer-search" placeholder="Tìm khách hàng...">
        </div>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-primary" onclick="showCustomerModal()">
          <i class="fas fa-plus"></i> Thêm khách hàng
        </button>
      </div>
    </div>
    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên khách hàng</th>
              <th>Số điện thoại</th>
              <th>Địa chỉ</th>
              <th>Email</th>
              <th>Ghi chú</th>
              <th><i class="fas fa-star" style="color:#FFC107;"></i> Điểm</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody id="customers-table-body">
            <tr><td colspan="7" class="text-center text-muted">Đang tải...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  await loadCustomers();
  document.getElementById('customer-search').addEventListener('input', debounce(loadCustomers, 300));
}

async function loadCustomers() {
  const search = document.getElementById('customer-search')?.value || '';
  const result = await window.api.getCustomers(search);
  const tbody = document.getElementById('customers-table-body');

  if (!result.success || result.data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-users"></i><h3>Chưa có khách hàng</h3><p>Nhấn "Thêm khách hàng" để bắt đầu</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = result.data.map(c => `
    <tr>
      <td>${c.id}</td>
      <td><strong>${c.name}</strong></td>
      <td>${c.phone || '-'}</td>
      <td>${c.address || '-'}</td>
      <td>${c.email || '-'}</td>
      <td>${c.notes || '-'}</td>
      <td><span style="color:#FFC107;font-weight:bold;"><i class="fas fa-star"></i> ${c.loyalty_points || 0}</span></td>
      <td>
        <div class="btn-group">
          <button class="btn btn-sm btn-secondary" onclick="showCustomerModal(${c.id})"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-danger" onclick="deleteCustomer(${c.id}, '${c.name.replace(/'/g, "\\'")}}')"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function showCustomerModal(customerId = null) {
  let customer = null;
  if (customerId) {
    const result = await window.api.getCustomers();
    if (result.success) customer = result.data.find(c => c.id === customerId);
  }

  showModal(`
    <div class="modal-header">
      <h3>${customer ? 'Sửa khách hàng' : 'Thêm khách hàng'}</h3>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <form id="customer-form">
      <div class="form-group">
        <label>Tên khách hàng *</label>
        <input class="form-control" id="cf-name" value="${customer ? customer.name : ''}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Số điện thoại</label>
          <input class="form-control" id="cf-phone" value="${customer ? customer.phone || '' : ''}">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input class="form-control" type="email" id="cf-email" value="${customer ? customer.email || '' : ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Địa chỉ</label>
        <input class="form-control" id="cf-address" value="${customer ? customer.address || '' : ''}">
      </div>
      <div class="form-group">
        <label>Ghi chú</label>
        <textarea class="form-control" id="cf-notes">${customer ? customer.notes || '' : ''}</textarea>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Hủy</button>
        <button type="submit" class="btn btn-primary">${customer ? 'Cập nhật' : 'Thêm mới'}</button>
      </div>
    </form>
  `);

  document.getElementById('customer-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('cf-name').value.trim(),
      phone: document.getElementById('cf-phone').value.trim(),
      email: document.getElementById('cf-email').value.trim(),
      address: document.getElementById('cf-address').value.trim(),
      notes: document.getElementById('cf-notes').value.trim()
    };

    if (!data.name) {
      showToast('Vui lòng nhập tên khách hàng', 'error');
      return;
    }

    let result;
    if (customer) {
      result = await window.api.updateCustomer(customer.id, data);
    } else {
      result = await window.api.createCustomer(data);
    }

    if (result.success) {
      closeModal();
      showToast(customer ? 'Đã cập nhật' : 'Đã thêm khách hàng', 'success');
      loadCustomers();
    } else {
      showToast('Lỗi: ' + result.error, 'error');
    }
  };
}

function deleteCustomer(id, name) {
  showConfirm(`Xóa khách hàng <strong>"${name}"</strong>?`, async () => {
    const result = await window.api.deleteCustomer(id);
    if (result.success) {
      showToast('Đã xóa', 'success');
      loadCustomers();
    } else {
      showToast('Lỗi: ' + result.error, 'error');
    }
  });
}
