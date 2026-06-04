// ==================== AUTHENTICATION ====================
let currentUser = null;

function getCurrentUser() {
  return currentUser;
}

function isAdmin() {
  return currentUser && currentUser.role === 'admin';
}

function initAuth() {
  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');

    if (!username || !password) {
      errorEl.textContent = 'Vui lòng nhập đầy đủ thông tin';
      errorEl.style.display = 'block';
      return;
    }

    try {
      const result = await window.api.login(username, password);
      if (result.success) {
        currentUser = result.user;
        errorEl.style.display = 'none';
        onLoginSuccess();
      } else {
        errorEl.textContent = result.error || 'Đăng nhập thất bại';
        errorEl.style.display = 'block';
      }
    } catch (err) {
      errorEl.textContent = 'Lỗi hệ thống: ' + err.message;
      errorEl.style.display = 'block';
    }
  });
}

function onLoginSuccess() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'flex';

  document.getElementById('user-display-name').textContent = currentUser.full_name;
  document.getElementById('user-display-role').textContent = currentUser.role === 'admin' ? 'Quản trị viên' : 'Nhân viên';

  // Show/hide admin-only items
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin() ? '' : 'none';
  });

  initApp();
}

function logout() {
  currentUser = null;
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = '';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('login-username').focus();
}
