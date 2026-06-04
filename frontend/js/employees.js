// ==================== EMPLOYEE MANAGEMENT ====================

async function renderEmployeesPage() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <h3 style="color:var(--text-secondary)"><i class="fas fa-user-shield"></i> Quản lý tài khoản nhân viên</h3>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-primary" onclick="showEmployeeModal()">
          <i class="fas fa-user-plus"></i> Thêm nhân viên
        </button>
      </div>
    </div>
    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên đăng nhập</th>
              <th>Họ tên</th>
              <th>Vai trò</th>
              <th>Số ĐT</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody id="employees-table-body">
            <tr><td colspan="8" class="text-center text-muted">Đang tải...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  await loadEmployees();
}

async function loadEmployees() {
  const result = await window.api.getUsers();
  const tbody = document.getElementById('employees-table-body');

  if (!result.success || result.data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Không có dữ liệu</td></tr>';
    return;
  }

  tbody.innerHTML = result.data.map(u => `
    <tr>
      <td>${u.id}</td>
      <td><strong>${u.username}</strong></td>
      <td>${u.full_name}</td>
      <td>${getRoleBadge(u.role)}</td>
      <td>${u.phone || '-'}</td>
      <td>${u.active ? '<span class="badge badge-success">Hoạt động</span>' : '<span class="badge badge-danger">Đã khóa</span>'}</td>
      <td>${formatDate(u.created_at)}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-sm btn-secondary" onclick="showEmployeeModal(${u.id})"><i class="fas fa-edit"></i></button>
          ${u.username !== 'admin' ? `
            <button class="btn btn-sm btn-danger" onclick="deactivateEmployee(${u.id}, '${u.full_name.replace(/'/g, "\\'")}')" title="${u.active ? 'Khóa' : 'Mở khóa'}">
              <i class="fas fa-${u.active ? 'lock' : 'unlock'}"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteEmployee(${u.id}, '${u.full_name.replace(/'/g, "\\'")}')" title="Xóa" style="background:#dc3545;">
              <i class="fas fa-trash"></i>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

async function showEmployeeModal(userId = null) {
  let user = null;
  if (userId) {
    const result = await window.api.getUsers();
    if (result.success) user = result.data.find(u => u.id === userId);
  }

  showModal(`
    <div class="modal-header">
      <h3>${user ? 'Sửa nhân viên' : 'Thêm nhân viên mới'}</h3>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <form id="employee-form">
      <div class="form-row">
        <div class="form-group">
          <label>Tên đăng nhập *</label>
          <input class="form-control" id="ef-username" value="${user ? user.username : ''}" ${user ? 'readonly style="opacity:0.6"' : ''} required>
        </div>
        <div class="form-group">
          <label>${user ? 'Mật khẩu mới (bỏ trống nếu không đổi)' : 'Mật khẩu *'}</label>
          <input class="form-control" type="password" id="ef-password" ${user ? '' : 'required'}>
        </div>
      </div>
      <div class="form-group">
        <label>Họ tên *</label>
        <input class="form-control" id="ef-fullname" value="${user ? user.full_name : ''}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Vai trò</label>
          <select class="form-control" id="ef-role">
            <option value="employee" ${user && user.role === 'employee' ? 'selected' : ''}>Nhân viên</option>
            <option value="admin" ${user && user.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </div>
        <div class="form-group">
          <label>Số điện thoại</label>
          <input class="form-control" id="ef-phone" value="${user ? user.phone || '' : ''}">
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Hủy</button>
        <button type="submit" class="btn btn-primary">${user ? 'Cập nhật' : 'Thêm mới'}</button>
      </div>
    </form>
  `);

  document.getElementById('employee-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      username: document.getElementById('ef-username').value.trim(),
      password: document.getElementById('ef-password').value,
      full_name: document.getElementById('ef-fullname').value.trim(),
      role: document.getElementById('ef-role').value,
      phone: document.getElementById('ef-phone').value.trim()
    };

    if (!data.full_name) {
      showToast('Vui lòng nhập họ tên', 'error');
      return;
    }

    let result;
    if (user) {
      result = await window.api.updateUser(user.id, data);
    } else {
      if (!data.username || !data.password) {
        showToast('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu', 'error');
        return;
      }
      result = await window.api.createUser(data);
    }

    if (result.success) {
      closeModal();
      showToast(user ? 'Đã cập nhật' : 'Đã thêm nhân viên', 'success');
      loadEmployees();
    } else {
      showToast('Lỗi: ' + result.error, 'error');
    }
  };
}

function deactivateEmployee(id, name) {
  showConfirm(`Bạn có chắc muốn thay đổi trạng thái nhân viên <strong>"${name}"</strong>?`, async () => {
    const users = await window.api.getUsers();
    if (!users.success) return;
    const user = users.data.find(u => u.id === id);
    if (!user) return;

    const result = await window.api.updateUser(id, {
      full_name: user.full_name,
      role: user.role,
      phone: user.phone,
      active: user.active ? 0 : 1
    });

    if (result.success) {
      showToast(user.active ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản', 'success');
      loadEmployees();
    } else {
      showToast('Lỗi: ' + result.error, 'error');
    }
  });
}

function deleteEmployee(id, name) {
  showConfirm(`Bạn có chắc muốn <strong style="color:#dc3545;">XÓA VĨNH VIỄN</strong> nhân viên <strong>"${name}"</strong>?<br><small class="text-muted">Hành động này không thể hoàn tác!</small>`, async () => {
    const result = await window.api.deleteUser(id);
    if (result.success) {
      showToast('Đã xóa nhân viên', 'success');
      loadEmployees();
    } else {
      showToast('Lỗi: ' + result.error, 'error');
    }
  });
}
