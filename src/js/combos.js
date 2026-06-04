// ==================== COMBO MANAGEMENT ====================

async function renderCombosPage() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <h4 style="margin:0;color:var(--text-secondary);"><i class="fas fa-gift"></i> Quản lý combo & khuyến mãi</h4>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-primary" onclick="showComboModal()">
          <i class="fas fa-plus"></i> Tạo combo mới
        </button>
      </div>
    </div>
    <div id="combos-list" class="stat-cards" style="grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));"></div>
  `;
  await loadCombos();
}

async function loadCombos() {
  const result = await window.api.getCombos();
  const container = document.getElementById('combos-list');

  if (!result.success || result.data.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-gift"></i><h3>Chưa có combo nào</h3><p>Nhấn "Tạo combo mới" để bắt đầu</p></div>`;
    return;
  }

  container.innerHTML = result.data.map(c => {
    const originalPrice = c.items.reduce((sum, it) => sum + (it.original_price || 0) * (it.quantity || 1), 0);
    const savedAmount = originalPrice - c.price;
    const savedPercent = originalPrice > 0 ? Math.round((savedAmount / originalPrice) * 100) : 0;

    return `
      <div class="card" style="padding:16px;position:relative;${!c.active ? 'opacity:0.5;' : ''}">
        ${!c.active ? '<div style="position:absolute;top:8px;right:8px;background:var(--danger);color:white;padding:2px 8px;border-radius:6px;font-size:10px;">Tắt</div>' : ''}
        <div style="display:flex;justify-content:space-between;align-items:start;">
          <div>
            <h3 style="margin:0 0 4px;"><i class="fas fa-gift" style="color:var(--primary);"></i> ${c.name}</h3>
            ${c.description ? `<p style="font-size:12px;color:var(--text-secondary);margin:0 0 8px;">${c.description}</p>` : ''}
          </div>
        </div>
        <div style="margin:8px 0;">
          ${c.items.map(it => `
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px solid var(--border);">
              <span>${it.product_name} × ${it.quantity}</span>
              <span style="color:var(--text-secondary);text-decoration:line-through;font-size:11px;">${formatCurrency((it.original_price || 0) * it.quantity)}</span>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <div>
            <span style="font-size:18px;font-weight:bold;color:var(--secondary);">${formatCurrency(c.price)}</span>
            ${savedAmount > 0 ? `<span style="font-size:11px;color:var(--success);margin-left:6px;">Tiết kiệm ${savedPercent}%</span>` : ''}
          </div>
          <div class="btn-group">
            <button class="btn btn-sm btn-secondary" onclick="toggleComboStatus(${c.id})" title="${c.active ? 'Tắt' : 'Bật'}">
              <i class="fas fa-${c.active ? 'pause' : 'play'}"></i>
            </button>
            <button class="btn btn-sm btn-secondary" onclick="showComboModal(${c.id})" title="Sửa">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteCombo(${c.id}, '${c.name.replace(/'/g, "\\'")}')" title="Xóa">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function showComboModal(comboId = null) {
  let combo = null;
  if (comboId) {
    const result = await window.api.getComboById(comboId);
    if (result.success) combo = result.data;
  }

  // Get all products for selection
  const prodResult = await window.api.getProducts('', null);
  const products = prodResult.success ? prodResult.data : [];
  const prodOptions = products.map(p => `<option value="${p.id}" data-name="${p.name}" data-price="${p.price}">${p.name} (${formatCurrency(p.price)})</option>`).join('');

  const existingItems = combo ? combo.items.map((it, i) => `
    <div class="combo-item-row" style="display:flex;gap:6px;margin-bottom:4px;align-items:center;">
      <select class="form-control combo-product" style="flex:1;" onchange="updateComboItemName(this)">
        <option value="">Chọn sản phẩm</option>
        ${products.map(p => `<option value="${p.id}" data-name="${p.name}" data-price="${p.price}" ${p.id === it.product_id ? 'selected' : ''}>${p.name} (${formatCurrency(p.price)})</option>`).join('')}
      </select>
      <input class="form-control combo-qty" type="number" value="${it.quantity}" min="1" style="width:60px;" placeholder="SL">
      <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    </div>
  `).join('') : '';

  showModal(`
    <div class="modal-header">
      <h3>${combo ? 'Sửa combo' : 'Tạo combo mới'}</h3>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <form id="combo-form">
      <div class="form-group">
        <label>Tên combo *</label>
        <input class="form-control" id="cf-name" value="${combo ? combo.name : ''}" placeholder="VD: Combo bữa sáng" required>
      </div>
      <div class="form-group">
        <label>Mô tả</label>
        <input class="form-control" id="cf-desc" value="${combo ? combo.description : ''}" placeholder="Mô tả ngắn về combo...">
      </div>
      <div class="form-group" style="border-top:1px solid var(--border);padding-top:12px;">
        <label><i class="fas fa-list"></i> Sản phẩm trong combo</label>
        <div id="combo-items">${existingItems}</div>
        <button type="button" class="btn btn-sm btn-secondary" onclick="addComboItemRow()" style="margin-top:4px;">
          <i class="fas fa-plus"></i> Thêm sản phẩm
        </button>
      </div>
      <div class="form-row" style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px;">
        <div class="form-group">
          <label>Giá gốc (tham khảo)</label>
          <div id="cf-original-price" style="font-size:16px;font-weight:bold;color:var(--text-secondary);padding:8px 0;">0 đ</div>
        </div>
        <div class="form-group">
          <label>Giá combo * <span style="color:var(--success);font-size:11px;">(giá bán thực tế)</span></label>
          <input class="form-control" type="number" id="cf-price" value="${combo ? combo.price : ''}" min="0" required style="font-size:16px;font-weight:bold;">
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Hủy</button>
        <button type="submit" class="btn btn-primary">${combo ? 'Cập nhật' : 'Tạo combo'}</button>
      </div>
    </form>
  `);

  // Store products data for item rows
  window._comboProducts = products;

  document.getElementById('combo-form').onsubmit = async (e) => {
    e.preventDefault();
    const items = [];
    document.querySelectorAll('#combo-items .combo-item-row').forEach(row => {
      const sel = row.querySelector('.combo-product');
      const qty = parseInt(row.querySelector('.combo-qty').value) || 1;
      if (sel.value) {
        const opt = sel.selectedOptions[0];
        items.push({
          product_id: parseInt(sel.value),
          product_name: opt.dataset.name,
          quantity: qty
        });
      }
    });

    const data = {
      name: document.getElementById('cf-name').value.trim(),
      price: parseFloat(document.getElementById('cf-price').value) || 0,
      description: document.getElementById('cf-desc').value.trim(),
      items
    };

    if (!data.name || data.price < 0 || items.length === 0) {
      showToast('Vui lòng nhập đầy đủ tên, giá và thêm ít nhất 1 sản phẩm', 'error');
      return;
    }

    let result;
    if (combo) {
      result = await window.api.updateCombo(combo.id, data);
    } else {
      result = await window.api.createCombo(data);
    }

    if (result.success) {
      closeModal();
      showToast(combo ? 'Đã cập nhật combo' : 'Đã tạo combo mới', 'success');
      loadCombos();
    } else {
      showToast('Lỗi: ' + result.error, 'error');
    }
  };

  updateComboOriginalPrice();
}

function addComboItemRow() {
  const container = document.getElementById('combo-items');
  const products = window._comboProducts || [];
  const prodOptions = products.map(p => `<option value="${p.id}" data-name="${p.name}" data-price="${p.price}">${p.name} (${formatCurrency(p.price)})</option>`).join('');

  const row = document.createElement('div');
  row.className = 'combo-item-row';
  row.style.cssText = 'display:flex;gap:6px;margin-bottom:4px;align-items:center;';
  row.innerHTML = `
    <select class="form-control combo-product" style="flex:1;" onchange="updateComboItemName(this)">
      <option value="">Chọn sản phẩm</option>
      ${prodOptions}
    </select>
    <input class="form-control combo-qty" type="number" value="1" min="1" style="width:60px;" placeholder="SL">
    <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove(); updateComboOriginalPrice()"><i class="fas fa-times"></i></button>
  `;
  container.appendChild(row);
}

function updateComboItemName(sel) {
  updateComboOriginalPrice();
}

function updateComboOriginalPrice() {
  let total = 0;
  document.querySelectorAll('#combo-items .combo-item-row').forEach(row => {
    const sel = row.querySelector('.combo-product');
    const qty = parseInt(row.querySelector('.combo-qty').value) || 1;
    if (sel.value && sel.selectedOptions[0]) {
      total += (parseFloat(sel.selectedOptions[0].dataset.price) || 0) * qty;
    }
  });
  const el = document.getElementById('cf-original-price');
  if (el) el.textContent = formatCurrency(total);
}

async function toggleComboStatus(id) {
  const result = await window.api.toggleComboActive(id);
  if (result.success) {
    showToast('Đã cập nhật trạng thái combo', 'success');
    loadCombos();
  }
}

function deleteCombo(id, name) {
  showConfirm(`Bạn có chắc muốn xóa combo <strong>"${name}"</strong>?`, async () => {
    const result = await window.api.deleteCombo(id);
    if (result.success) {
      showToast('Đã xóa combo', 'success');
      loadCombos();
    } else {
      showToast('Lỗi: ' + result.error, 'error');
    }
  });
}
