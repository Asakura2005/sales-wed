// ==================== UTILITY FUNCTIONS ====================

function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  // SQLite CURRENT_TIMESTAMP is UTC, append Z so JS converts to local time
  if (!dateStr.endsWith('Z') && !dateStr.includes('+')) dateStr = dateStr.replace(' ', 'T') + 'Z';
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  if (!dateStr.endsWith('Z') && !dateStr.includes('+')) dateStr = dateStr.replace(' ', 'T') + 'Z';
  const d = new Date(dateStr);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getFirstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

// Toast notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-exclamation-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="${icons[type]}"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Modal
function showModal(html, isLarge = false) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  content.className = `modal-content ${isLarge ? 'modal-lg' : ''}`;
  content.innerHTML = html;
  overlay.style.display = 'flex';

  overlay.onclick = (e) => {
    if (e.target === overlay) closeModal();
  };
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// Confirm dialog
function showConfirm(message, onConfirm) {
  showModal(`
    <div class="confirm-body">
      <i class="fas fa-exclamation-triangle"></i>
      <p>${message}</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-danger" id="confirm-btn">Xác nhận</button>
    </div>
  `);

  document.getElementById('confirm-btn').onclick = () => {
    closeModal();
    onConfirm();
  };
}

// Status badge
function getStatusBadge(status) {
  const map = {
    completed: { class: 'badge-success', text: 'Đã thanh toán' },
    pending: { class: 'badge-warning', text: 'Chờ xử lý' },
    cancelled: { class: 'badge-danger', text: 'Đã hủy' }
  };
  const s = map[status] || { class: 'badge-info', text: status };
  return `<span class="badge ${s.class}">${s.text}</span>`;
}

function getRoleBadge(role) {
  return role === 'admin'
    ? '<span class="badge badge-primary">Admin</span>'
    : '<span class="badge badge-info">Nhân viên</span>';
}

function getPaymentBadge(method) {
  const map = {
    cash: 'Tiền mặt',
    transfer: 'Chuyển khoản',
    card: 'Thẻ'
  };
  return map[method] || method;
}

// Debounce
function debounce(fn, delay = 300) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
