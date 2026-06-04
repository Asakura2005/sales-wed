// ==================== PRODUCT MANAGEMENT ====================

async function renderProductsPage() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input type="text" id="product-search" placeholder="Tìm sản phẩm..." />
        </div>
        <select class="filter-select" id="product-category-filter">
          <option value="">Tất cả danh mục</option>
        </select>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-secondary" onclick="openLabelSettings()" title="Cài đặt in tem khi thanh toán">
          <i class="fas fa-cog"></i> Cài đặt tem
        </button>
        <button class="btn btn-secondary" onclick="showCategoryModal()">
          <i class="fas fa-tags"></i> Danh mục
        </button>
        <button class="btn btn-primary" onclick="showProductModal()">
          <i class="fas fa-plus"></i> Thêm sản phẩm
        </button>
      </div>
    </div>
    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên sản phẩm</th>
              <th>Danh mục</th>
              <th>Giá bán</th>
              <th>Giá vốn</th>
              <th>Tồn kho</th>
              <th>Đơn vị</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody id="products-table-body">
            <tr><td colspan="8" class="text-center text-muted">Đang tải...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  await loadCategoryFilter();
  await loadProducts();

  document.getElementById('product-search').addEventListener('input', debounce(loadProducts, 300));
  document.getElementById('product-category-filter').addEventListener('change', loadProducts);
}

async function loadCategoryFilter() {
  const result = await window.api.getCategories();
  if (result.success) {
    const select = document.getElementById('product-category-filter');
    if (select) {
      select.innerHTML = '<option value="">Tất cả danh mục</option>';
      result.data.forEach(cat => {
        select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
      });
    }
  }
}

async function loadProducts() {
  const search = document.getElementById('product-search')?.value || '';
  const categoryId = document.getElementById('product-category-filter')?.value || null;
  const result = await window.api.getProducts(search, categoryId ? parseInt(categoryId) : null);

  const tbody = document.getElementById('products-table-body');
  if (!result.success || result.data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-box-open"></i><h3>Chưa có sản phẩm</h3><p>Nhấn "Thêm sản phẩm" để bắt đầu</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = result.data.map(p => `
    <tr>
      <td>${p.id}</td>
      <td><strong>${p.name}</strong></td>
      <td>${p.category_name || '-'}</td>
      <td class="text-success text-bold">${formatCurrency(p.price)}</td>
      <td>${formatCurrency(p.cost_price)}</td>
      <td><span class="${p.stock <= 5 ? 'text-danger text-bold' : ''}">${p.stock}</span></td>
      <td>${p.unit}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-sm btn-secondary" onclick="showProductModal(${p.id})" title="Sửa">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')" title="Xóa">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function showProductModal(productId = null) {
  const categories = await window.api.getCategories();
  let product = null;
  let sizes = [];

  if (productId) {
    const result = await window.api.getProductById(productId);
    if (result.success) product = result.data;
    const sizeResult = await window.api.getProductSizes(productId);
    if (sizeResult.success) sizes = sizeResult.data;
  }

  const catOptions = categories.success ? categories.data.map(c =>
    `<option value="${c.id}" ${product && product.category_id === c.id ? 'selected' : ''}>${c.name}</option>`
  ).join('') : '';

  const sizesHtml = sizes.length > 0 ? sizes.map((s, i) => `
    <div class="size-row" style="display:flex;gap:6px;margin-bottom:4px;align-items:center;">
      <select class="form-control size-name" style="width:80px;">
        <option value="S" ${s.size_name === 'S' ? 'selected' : ''}>S</option>
        <option value="M" ${s.size_name === 'M' ? 'selected' : ''}>M</option>
        <option value="L" ${s.size_name === 'L' ? 'selected' : ''}>L</option>
        <option value="XL" ${s.size_name === 'XL' ? 'selected' : ''}>XL</option>
      </select>
      <input class="form-control size-price" type="number" value="${s.price}" placeholder="Giá" min="0" style="flex:1;">
      <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    </div>
  `).join('') : '';

  showModal(`
    <div class="modal-header">
      <h3>${product ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <form id="product-form">
      <div class="form-group">
        <label>Tên sản phẩm *</label>
        <input class="form-control" id="pf-name" value="${product ? product.name : ''}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Danh mục</label>
          <select class="form-control" id="pf-category">
            <option value="">Không phân loại</option>
            ${catOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Đơn vị</label>
          <input class="form-control" id="pf-unit" value="${product ? product.unit : 'cái'}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Giá bán * (giá mặc định)</label>
          <input class="form-control" type="number" id="pf-price" value="${product ? product.price : ''}" min="0" required>
        </div>
        <div class="form-group">
          <label>Giá vốn</label>
          <input class="form-control" type="number" id="pf-cost" value="${product ? product.cost_price : ''}" min="0">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Tồn kho</label>
          <input class="form-control" type="number" id="pf-stock" value="${product ? product.stock : 0}" min="0">
        </div>
        <div class="form-group">
          <label>Mã vạch</label>
          <input class="form-control" id="pf-barcode" value="${product ? product.barcode || '' : ''}">
        </div>
      </div>

      <div class="form-group" style="border-top:1px solid var(--border);padding-top:12px;margin-top:8px;">
        <label><i class="fas fa-ruler"></i> Size sản phẩm <span style="font-size:11px;color:var(--text-secondary);">(để trống nếu không có size)</span></label>
        <div id="size-rows">${sizesHtml}</div>
        <button type="button" class="btn btn-sm btn-secondary" onclick="addSizeRow()" style="margin-top:4px;">
          <i class="fas fa-plus"></i> Thêm size
        </button>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Hủy</button>
        <button type="submit" class="btn btn-primary">${product ? 'Cập nhật' : 'Thêm mới'}</button>
      </div>
    </form>
  `);

  document.getElementById('product-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('pf-name').value.trim(),
      category_id: document.getElementById('pf-category').value || null,
      unit: document.getElementById('pf-unit').value.trim() || 'cái',
      price: parseFloat(document.getElementById('pf-price').value) || 0,
      cost_price: parseFloat(document.getElementById('pf-cost').value) || 0,
      stock: parseInt(document.getElementById('pf-stock').value) || 0,
      barcode: document.getElementById('pf-barcode').value.trim()
    };

    if (!data.name || data.price < 0) {
      showToast('Vui lòng nhập đầy đủ tên và giá bán', 'error');
      return;
    }

    // Collect sizes
    const sizeRows = document.querySelectorAll('#size-rows .size-row');
    const newSizes = [];
    sizeRows.forEach(row => {
      const name = row.querySelector('.size-name').value.trim();
      const price = parseFloat(row.querySelector('.size-price').value) || 0;
      if (name && price > 0) newSizes.push({ size_name: name, price });
    });

    let result;
    if (product) {
      result = await window.api.updateProduct(product.id, data);
    } else {
      result = await window.api.createProduct(data);
    }

    if (result.success) {
      const pid = product ? product.id : result.data.id;
      // Save sizes
      if (newSizes.length > 0) {
        await window.api.setProductSizes(pid, newSizes);
      } else {
        await window.api.setProductSizes(pid, []); // Clear sizes
      }
      closeModal();
      showToast(product ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm mới', 'success');
      await window.api.logActivity(getCurrentUser().id, product ? 'update_product' : 'create_product', data.name);
      loadProducts();
    } else {
      showToast('Lỗi: ' + result.error, 'error');
    }
  };
}

function addSizeRow(name = '', price = '') {
  const container = document.getElementById('size-rows');
  const row = document.createElement('div');
  row.className = 'size-row';
  row.style.cssText = 'display:flex;gap:6px;margin-bottom:4px;align-items:center;';
  row.innerHTML = `
    <select class="form-control size-name" style="width:80px;">
      <option value="S" ${name === 'S' ? 'selected' : ''}>S</option>
      <option value="M" ${name === 'M' ? 'selected' : ''}>M</option>
      <option value="L" ${name === 'L' ? 'selected' : ''}>L</option>
      <option value="XL" ${name === 'XL' ? 'selected' : ''}>XL</option>
    </select>
    <input class="form-control size-price" type="number" value="${price}" placeholder="Giá" min="0" style="flex:1;">
    <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
  `;
  container.appendChild(row);
}

function deleteProduct(id, name) {
  showConfirm(`Bạn có chắc muốn xóa sản phẩm <strong>"${name}"</strong>?`, async () => {
    const result = await window.api.deleteProduct(id);
    if (result.success) {
      showToast('Đã xóa sản phẩm', 'success');
      await window.api.logActivity(getCurrentUser().id, 'delete_product', name);
      loadProducts();
    } else {
      showToast('Lỗi: ' + result.error, 'error');
    }
  });
}


async function openLabelSettings() {
  const result = await window.api.getProducts('', null);
  if (result.success && result.data.length > 0) {
    showPrintLabelModal(result.data);
  } else {
    showToast('Không có sản phẩm', 'warning');
  }
}

// ==================== CATEGORY MODAL ====================
function getHiddenCategoryIds() {
  try { return JSON.parse(localStorage.getItem('hidden_categories') || '[]'); } catch(e) { return []; }
}
function saveHiddenCategoryIds(ids) {
  localStorage.setItem('hidden_categories', JSON.stringify(ids));
}

async function showCategoryModal() {
  const result = await window.api.getCategories();
  const categories = result.success ? result.data : [];
  const hiddenIds = getHiddenCategoryIds();

  showModal(`
    <div class="modal-header">
      <h3>Quản lý danh mục</h3>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="form-group">
      <div style="display:flex;gap:8px;">
        <input class="form-control" id="cat-name" placeholder="Tên danh mục mới">
        <button class="btn btn-primary" onclick="addCategory()"><i class="fas fa-plus"></i></button>
      </div>
    </div>
    <div style="font-size:11px;color:var(--text-secondary);padding:0 20px 8px;">
      <i class="fas fa-info-circle" style="color:var(--primary);"></i> Tắt hiển thị → ẩn danh mục và SP khỏi trang Bán hàng
    </div>
    <div class="table-container">
      <table>
        <thead><tr><th>ID</th><th>Tên</th><th>Hiển thị</th><th>Thao tác</th></tr></thead>
        <tbody id="category-list">
          ${categories.map(c => {
            const isVisible = !hiddenIds.includes(c.id);
            return `
            <tr>
              <td>${c.id}</td>
              <td>${c.name}</td>
              <td>
                <label class="toggle-switch" style="margin:0;">
                  <input type="checkbox" ${isVisible ? 'checked' : ''} onchange="toggleCategoryVisibility(${c.id}, this.checked)">
                  <span class="toggle-slider"></span>
                </label>
              </td>
              <td>
                <button class="btn btn-sm btn-danger" onclick="deleteCategory(${c.id})">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    </div>
  `);
}

function toggleCategoryVisibility(catId, visible) {
  let hiddenIds = getHiddenCategoryIds();
  if (visible) {
    hiddenIds = hiddenIds.filter(id => id !== catId);
  } else {
    if (!hiddenIds.includes(catId)) hiddenIds.push(catId);
  }
  saveHiddenCategoryIds(hiddenIds);
}

async function addCategory() {
  const name = document.getElementById('cat-name').value.trim();
  if (!name) { showToast('Vui lòng nhập tên danh mục', 'error'); return; }

  const result = await window.api.createCategory({ name });
  if (result.success) {
    showToast('Đã thêm danh mục', 'success');
    showCategoryModal();
    loadCategoryFilter();
  } else {
    showToast('Lỗi: ' + result.error, 'error');
  }
}

async function deleteCategory(id) {
  const result = await window.api.deleteCategory(id);
  if (result.success) {
    showToast('Đã xóa danh mục', 'success');
    showCategoryModal();
    loadCategoryFilter();
    loadProducts();
  } else {
    showToast('Lỗi: ' + result.error, 'error');
  }
}
