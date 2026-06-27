// ==================== POS - POINT OF SALE ====================
let posProducts = [];
let posToppings = [];
let posTabs = [];
let activeTabId = null;
let tabCounter = 0;

// ==================== PERSIST TABS ====================
function saveTabs() {
  try {
    localStorage.setItem('pos_tabs', JSON.stringify({ posTabs, activeTabId, tabCounter }));
  } catch (e) { }
}

function loadTabs() {
  try {
    const saved = localStorage.getItem('pos_tabs');
    if (saved) {
      const data = JSON.parse(saved);
      if (data.posTabs && data.posTabs.length > 0) {
        // Only keep tabs that have items in cart
        const activeTabs = data.posTabs.filter(t => t.cart && t.cart.length > 0);
        if (activeTabs.length > 0) {
          posTabs = activeTabs;
          activeTabId = activeTabs.find(t => t.id === data.activeTabId) ? data.activeTabId : activeTabs[0].id;
          const maxId = Math.max(...activeTabs.map(t => t.id), 0);
          tabCounter = Math.max(data.tabCounter || 0, maxId);
          return true;
        }
      }
    }
  } catch (e) { }
  // Reset everything for fresh start
  tabCounter = 0;
  return false;
}

// ==================== TAB MANAGEMENT ====================
function createNewTab(name) {
  tabCounter++;
  const tab = {
    id: tabCounter,
    name: name || `Đơn ${tabCounter}`,
    cart: [],
    discount: 0,
    discountType: 'money',
    customerId: null,
    paymentMethod: 'cash'
  };
  posTabs.push(tab);
  activeTabId = tab.id;
  saveTabs();
  return tab;
}

function getActiveTab() {
  return posTabs.find(t => t.id === activeTabId);
}

function getActiveCart() {
  const tab = getActiveTab();
  return tab ? tab.cart : [];
}

function switchTab(tabId) {
  activeTabId = tabId;
  saveTabs();
  renderTabsBar();
  renderCart();
  syncTabUI();
}

function addNewTab() {
  createNewTab();
  renderTabsBar();
  renderCart();
  syncTabUI();
}

function closeTab(tabId, e) {
  if (e) e.stopPropagation();
  const tab = posTabs.find(t => t.id === tabId);
  if (tab && tab.cart.length > 0) {
    showConfirm(`Đơn "${tab.name}" còn ${tab.cart.length} sản phẩm. Xóa đơn này?`, () => {
      removeTab(tabId);
    });
  } else {
    removeTab(tabId);
  }
}

function removeTab(tabId) {
  posTabs = posTabs.filter(t => t.id !== tabId);
  if (posTabs.length === 0) {
    createNewTab();
  } else if (activeTabId === tabId) {
    activeTabId = posTabs[posTabs.length - 1].id;
  }
  saveTabs();
  renderTabsBar();
  renderCart();
  syncTabUI();
}

function renameActiveTab() {
  const tab = getActiveTab();
  if (!tab) return;
  showModal(`
    <div class="modal-header">
      <h3>Đổi tên đơn</h3>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="form-group">
      <label>Tên đơn hàng</label>
      <input class="form-control" id="tab-rename-input" value="${tab.name}" autofocus>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="doRenameTab()"><i class="fas fa-check"></i> Lưu</button>
    </div>
  `);
  // Select all text
  setTimeout(() => {
    const inp = document.getElementById('tab-rename-input');
    if (inp) { inp.select(); inp.focus(); }
  }, 100);
}

function doRenameTab() {
  const name = document.getElementById('tab-rename-input').value.trim();
  if (!name) { showToast('Vui lòng nhập tên', 'error'); return; }
  const tab = getActiveTab();
  if (tab) tab.name = name;
  closeModal();
  renderTabsBar();
  document.getElementById('cart-tab-title').textContent = name;
}

function renderTabsBar() {
  const container = document.getElementById('cart-tabs');
  if (!container) return;
  container.innerHTML = posTabs.map(tab => {
    const isActive = tab.id === activeTabId;
    const itemCount = tab.cart.reduce((s, i) => s + i.quantity, 0);
    return `
      <div class="cart-tab ${isActive ? 'active' : ''}" onclick="switchTab(${tab.id})">
        <span class="cart-tab-name">${tab.name}</span>
        ${itemCount > 0 ? `<span class="cart-tab-badge">${itemCount}</span>` : ''}
        ${posTabs.length > 1 ? `<span class="cart-tab-close" onclick="closeTab(${tab.id}, event)"><i class="fas fa-times"></i></span>` : ''}
      </div>
    `;
  }).join('');
}

function scrollTabs(direction) {
  const container = document.getElementById('cart-tabs');
  if (container) container.scrollLeft += direction * 120;
}

function syncTabUI() {
  const tab = getActiveTab();
  if (!tab) return;
  // Update title
  const titleEl = document.getElementById('cart-tab-title');
  if (titleEl) titleEl.textContent = tab.name;
  // Sync customer select
  if (typeof updateCustomerDisplay === 'function') {
    updateCustomerDisplay(tab.customerId !== undefined ? tab.customerId : null);
  }
  // Sync discount
  const discInput = document.getElementById('cart-discount');
  if (discInput) discInput.value = tab.discount || 0;
  // Sync discount type buttons
  document.querySelectorAll('.cart-footer .discount-type').forEach(b => {
    b.classList.toggle('active', b.dataset.type === (tab.discountType || 'money'));
  });
  // Sync payment method
  document.querySelectorAll('.payment-method').forEach(m => {
    m.classList.toggle('active', m.dataset.method === (tab.paymentMethod || 'cash'));
  });
  // Sync loyalty points display
  if (typeof onCustomerChange === 'function') {
    onCustomerChange();
  }
}

// ==================== RENDER POS PAGE ====================
async function renderPosPage() {
  // Load saved tabs or create first tab
  if (posTabs.length === 0) {
    if (!loadTabs()) {
      createNewTab();
    }
  }

  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="pos-layout">
      <div class="pos-products">
        <div class="pos-search">
          <div class="search-box" style="flex:1">
            <i class="fas fa-search"></i>
            <input type="text" id="pos-search-input" placeholder="Tìm sản phẩm (tên hoặc mã vạch)..." autofocus>
          </div>
        </div>
        <div id="shift-bar" class="shift-bar"></div>
        <div class="pos-categories" id="pos-categories"></div>
        <div class="pos-product-grid" id="pos-product-grid">
          <div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Đang tải...</p></div>
        </div>
      </div>
      <div class="pos-cart">
        <div class="cart-tabs-bar">
          <button class="cart-tabs-scroll-btn" onclick="scrollTabs(-1)" title="Cuộn trái">
            <i class="fas fa-chevron-left"></i>
          </button>
          <div class="cart-tabs" id="cart-tabs"></div>
          <button class="cart-tabs-scroll-btn" onclick="scrollTabs(1)" title="Cuộn phải">
            <i class="fas fa-chevron-right"></i>
          </button>
          <button class="cart-tab-add" onclick="addNewTab()" title="Thêm đơn mới">
            <i class="fas fa-plus"></i>
          </button>
        </div>
        <div class="cart-header">
          <h3><i class="fas fa-shopping-cart"></i> <span id="cart-tab-title">Giỏ hàng</span> <span class="cart-count" id="cart-count">0</span></h3>
          <div class="btn-group">
            <button class="btn btn-sm btn-secondary" onclick="renameActiveTab()" title="Đổi tên">
              <i class="fas fa-pen"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="clearCart()" title="Xóa giỏ">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="cart-items" id="cart-items">
          <div class="cart-empty">
            <i class="fas fa-shopping-basket"></i>
            <p>Giỏ hàng trống</p>
          </div>
        </div>
        <div class="cart-footer">
          <div class="customer-combobox" id="customer-combobox">
            <div class="customer-combobox-display" onclick="toggleCustomerDropdown()">
              <span id="customer-combobox-text">Khách lẻ</span>
              <i class="fas fa-chevron-down"></i>
            </div>
            <div class="customer-combobox-dropdown" id="customer-dropdown" style="display:none;">
              <div class="customer-search-box">
                <input type="text" id="customer-search-input" placeholder="Tìm tên, SĐT, địa chỉ..." oninput="filterCustomers()">
              </div>
              <div class="customer-list" id="customer-list">
                <!-- items -->
              </div>
            </div>
          </div>
          <div id="loyalty-points-bar" style="display:none;padding:6px 10px;background:rgba(255,193,7,0.1);border:1px solid rgba(255,193,7,0.3);border-radius:8px;margin-bottom:8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:12px;"><i class="fas fa-star" style="color:#FFC107;"></i> Điểm: <strong id="loyalty-points-value">0</strong></span>
              <button class="btn btn-sm" id="use-points-btn" onclick="showUsePointsModal()" style="font-size:11px;padding:2px 8px;background:rgba(255,193,7,0.2);border:1px solid #FFC107;color:#FFC107;border-radius:6px;cursor:pointer;">
                <i class="fas fa-gift"></i> Dùng điểm
              </button>
            </div>
            <div id="points-applied-info" style="display:none;font-size:11px;color:var(--success);margin-top:4px;"></div>
          </div>
          <div class="cart-totals">
            <div class="cart-row">
              <span>Tạm tính:</span>
              <span id="cart-subtotal">0 ₫</span>
            </div>
            <div class="cart-row">
              <span>Giảm giá:</span>
              <div class="discount-group">
                <input class="cart-discount-input" type="number" id="cart-discount" value="0" min="0" oninput="onDiscountChange()">
                <div class="discount-type-toggle">
                  <button class="discount-type active" data-type="money" onclick="switchDiscountType(this)">₫</button>
                  <button class="discount-type" data-type="percent" onclick="switchDiscountType(this)">%</button>
                </div>
              </div>
            </div>
            <div class="cart-row total">
              <span>Tổng cộng:</span>
              <span id="cart-total">0 ₫</span>
            </div>
          </div>
          <div class="payment-methods">
            <div class="payment-method active" data-method="cash" onclick="selectPayment(this)">
              <i class="fas fa-money-bill-wave"></i> Tiền mặt
            </div>
            <div class="payment-method" data-method="transfer" onclick="selectPayment(this)">
              <i class="fas fa-university"></i> CK
              <i class="fas fa-cog" onclick="event.stopPropagation();showBankSettings()" title="Cài đặt ngân hàng" style="font-size:10px;opacity:0.6;margin-left:4px;"></i>
            </div>
          </div>
          <div id="qr-preview" class="qr-preview" style="display:none;"></div>
          <div class="print-toggle">
            <label class="toggle-label" for="pos-print-toggle">
              <i class="fas fa-print"></i> In hóa đơn
            </label>
            <label class="toggle-switch">
              <input type="checkbox" id="pos-print-toggle" checked>
              <span class="toggle-slider"></span>
            </label>
            <i class="fas fa-cog" onclick="showPrinterSettingsModal()" title="Cài đặt máy in" style="cursor:pointer;font-size:12px;opacity:0.6;margin-left:6px;"></i>
          </div>

          <div class="cart-actions">
            <button class="btn btn-success" onclick="checkout()">
              <i class="fas fa-check-circle"></i> Thanh toán
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  renderTabsBar();
  syncTabUI();
  await loadPosCategories();
  await loadPosProducts();
  await loadPosCustomers();
  await updateShiftBar();
  renderCart();

  document.getElementById('pos-search-input').addEventListener('input', debounce(loadPosProducts, 200));
}

async function onCustomerChange() {
  const tab = getActiveTab();
  // customerId and pointsUsed are set in selectCustomer()
  saveTabs();

  // Load and show loyalty points
  const bar = document.getElementById('loyalty-points-bar');
  const pointsVal = document.getElementById('loyalty-points-value');
  const pointsInfo = document.getElementById('points-applied-info');

  if (tab && tab.customerId) {
    const result = await window.api.getCustomerById(tab.customerId);
    if (result.success && result.data) {
      const pts = result.data.loyalty_points || 0;
      bar.style.display = 'block';
      pointsVal.textContent = pts;
      pointsInfo.style.display = 'none';
      document.getElementById('use-points-btn').style.display = pts > 0 ? 'inline-block' : 'none';
    } else {
      bar.style.display = 'none';
    }
  } else {
    bar.style.display = 'none';
  }
  updateCartTotals();
}

function showUsePointsModal() {
  const tab = getActiveTab();
  if (!tab || !tab.customerId) return;
  const currentPoints = parseInt(document.getElementById('loyalty-points-value')?.textContent || '0');
  if (currentPoints <= 0) { showToast('Không có điểm để dùng', 'warning'); return; }

  const MAX_POINTS_PER_ORDER = 250; // 250 points = 50,000đ max
  const usablePoints = Math.min(currentPoints, MAX_POINTS_PER_ORDER);
  const maxDiscount = Math.floor(usablePoints / 5) * 1000; // 5 points = 1,000đ

  showModal(`
    <div class="modal-header">
      <h3><i class="fas fa-star" style="color:#FFC107;"></i> Dùng điểm tích lũy</h3>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div style="padding:15px;">
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:32px;font-weight:bold;color:#FFC107;">${currentPoints}</div>
        <div style="color:var(--text-secondary);font-size:13px;">điểm hiện có</div>
      </div>
      <div style="background:rgba(255,193,7,0.1);border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px;color:var(--text-secondary);">
        <i class="fas fa-info-circle" style="color:#FFC107;"></i> 5 điểm = 1.000₫ giảm giá. Tối đa: <strong>${formatCurrency(maxDiscount)}</strong>
      </div>
      <div class="form-group">
        <label>Số điểm muốn dùng</label>
        <input class="form-control" type="number" id="use-points-input" value="${usablePoints}" min="1" max="${usablePoints}" style="font-size:18px;font-weight:bold;text-align:center;">
        <div style="text-align:center;margin-top:4px;font-size:13px;color:var(--success);">
          = Giảm <span id="points-discount-preview">${formatCurrency(maxDiscount)}</span>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="applyPointsDiscount()" style="background:#FFC107;border-color:#FFC107;">
        <i class="fas fa-check"></i> Áp dụng
      </button>
    </div>
  `, false);

  document.getElementById('use-points-input').addEventListener('input', function() {
    const pts = Math.min(Math.max(parseInt(this.value) || 0, 0), usablePoints);
    document.getElementById('points-discount-preview').textContent = formatCurrency(Math.floor(pts / 5) * 1000);
  });
}

function applyPointsDiscount() {
  const tab = getActiveTab();
  if (!tab) return;
  const pts = parseInt(document.getElementById('use-points-input')?.value || 0);
  if (pts <= 0) { showToast('Nhập số điểm hợp lệ', 'error'); return; }

  tab.pointsUsed = pts;
  closeModal();

  // Update UI
  const info = document.getElementById('points-applied-info');
  if (info) {
    info.style.display = 'block';
    info.innerHTML = `<i class="fas fa-check-circle"></i> Dùng ${pts} điểm = Giảm ${formatCurrency(Math.floor(pts / 5) * 1000)}`;
  }

  saveTabs();
  updateCartTotals();
  showToast(`Đã áp dụng ${pts} điểm`, 'success');
}

function clearPointsDiscount() {
  const tab = getActiveTab();
  if (tab) tab.pointsUsed = 0;
  const info = document.getElementById('points-applied-info');
  if (info) info.style.display = 'none';
  saveTabs();
  updateCartTotals();
}

function onDiscountChange() {
  const tab = getActiveTab();
  if (tab) tab.discount = parseFloat(document.getElementById('cart-discount')?.value || 0);
  saveTabs();
  updateCartTotals();
}

// ==================== CATEGORIES & PRODUCTS ====================
let posSelectedCategory = null;

async function loadPosCategories() {
  const result = await window.api.getCategories();
  if (!result.success) return;

  const hiddenIds = getHiddenCategoryIds();
  const container = document.getElementById('pos-categories');
  container.innerHTML = `<div class="category-chip active" onclick="filterPosCategory(this, null)">Tất cả</div>`;
  result.data.forEach(cat => {
    if (hiddenIds.includes(cat.id)) return; // Ẩn danh mục bị tắt
    container.innerHTML += `<div class="category-chip" onclick="filterPosCategory(this, ${cat.id})">${cat.name}</div>`;
  });
}

function filterPosCategory(el, catId) {
  posSelectedCategory = catId;
  document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  loadPosProducts();
}

async function loadPosProducts() {
  const search = document.getElementById('pos-search-input')?.value || '';
  const result = await window.api.getProducts(search, posSelectedCategory);
  const grid = document.getElementById('pos-product-grid');

  if (!result.success || result.data.length === 0) {
    grid.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>Không tìm thấy sản phẩm</p></div>';
    return;
  }

  // Lọc bỏ SP thuộc danh mục bị ẩn
  const hiddenCatIds = getHiddenCategoryIds();
  posProducts = result.data.filter(p => !hiddenCatIds.includes(p.category_id));

  // Load toppings riêng (lấy tất cả SP, không phụ thuộc category filter)
  if (!posSelectedCategory || posToppings.length === 0) {
    const allResult = posSelectedCategory
      ? await window.api.getProducts('', null)
      : { success: true, data: posProducts };
    if (allResult.success) {
      const allProducts = allResult.data.filter(p => !hiddenCatIds.includes(p.category_id));
      posToppings = allProducts.filter(p => (p.category_name || '').toLowerCase().includes('topping'));
    }
  }

  const displayProducts = posProducts.filter(p => !(p.category_name || '').toLowerCase().includes('topping'));

  // Preload sizes for display products
  for (const p of displayProducts) {
    const sizeResult = await window.api.getProductSizes(p.id);
    p.sizes = sizeResult.success ? sizeResult.data : [];
  }

  grid.innerHTML = displayProducts.map(p => `
    <div class="pos-product-card" onclick="addToCart(${p.id})" ${p.stock <= 0 ? 'style="opacity:0.5;pointer-events:none;"' : ''}>
      <div class="product-icon"><i class="fas fa-cube"></i></div>
      <h4>${p.name}</h4>
      ${p.sizes && p.sizes.length > 0
      ? `<div class="price" style="font-size:11px;">${formatCurrency(p.sizes[0].price)} ~ ${formatCurrency(p.sizes[p.sizes.length - 1].price)}</div>
           <div style="font-size:10px;color:var(--primary);margin-top:2px;"><i class="fas fa-ruler"></i> ${p.sizes.map(s => s.size_name).join('/')}</div>`
      : `<div class="price">${formatCurrency(p.price)}</div>`
    }
      <div class="stock ${p.stock <= 5 ? 'low' : ''}">Kho: ${p.stock}</div>
    </div>
  `).join('');

  // Load and show active combos at top
  const comboResult = await window.api.getCombos(true);
  if (comboResult.success && comboResult.data.length > 0) {
    let combos = comboResult.data;
    if (search) {
      const s = removeVietnameseTones(search.toLowerCase());
      combos = combos.filter(c => {
        const name = removeVietnameseTones((c.name || '').toLowerCase());
        return name.includes(s);
      });
    }

    if (combos.length > 0) {
      const comboHtml = combos.map(c => {
        const itemNames = c.items.map(it => `${it.product_name}×${it.quantity}`).join(', ');
        return `
          <div class="pos-product-card" onclick="addComboToCart(${c.id})" style="border:1px solid var(--primary);background:rgba(108,92,231,0.05);">
            <div class="product-icon" style="background:rgba(108,92,231,0.2);"><i class="fas fa-gift" style="color:var(--primary);"></i></div>
            <h4>${c.name}</h4>
            <div style="font-size:10px;color:var(--text-secondary);margin-bottom:2px;">${itemNames}</div>
            <div class="price">${formatCurrency(c.price)}</div>
          </div>`;
      }).join('');
      grid.innerHTML = comboHtml + grid.innerHTML;
    }
  }
}

window.posAllCustomers = [];

async function loadPosCustomers() {
  const result = await window.api.getCustomers();
  if (!result.success) return;
  window.posAllCustomers = result.data || [];
  
  renderCustomerList(window.posAllCustomers);
  
  const tab = getActiveTab();
  if (tab) {
     updateCustomerDisplay(tab.customerId);
  }
}

function renderCustomerList(customers) {
  const list = document.getElementById('customer-list');
  if (!list) return;
  
  let html = `<div class="customer-list-item" onclick="selectCustomer('')">
    <div class="cust-name">Khách lẻ</div>
  </div>`;
  
  customers.forEach(c => {
    html += `<div class="customer-list-item" onclick="selectCustomer('${c.id}')">
      <div class="cust-name">${c.name}</div>
      <div class="cust-info">${c.phone ? c.phone : ''} ${c.address ? '- ' + c.address : ''}</div>
    </div>`;
  });
  list.innerHTML = html;
}

function filterCustomers() {
  const query = document.getElementById('customer-search-input')?.value || '';
  const searchStr = removeVietnameseTones(query.toLowerCase().trim());
  
  if (!searchStr) {
    renderCustomerList(window.posAllCustomers);
    return;
  }
  
  const filtered = window.posAllCustomers.filter(c => {
    const name = removeVietnameseTones((c.name || '').toLowerCase());
    const phone = (c.phone || '').toLowerCase();
    const address = removeVietnameseTones((c.address || '').toLowerCase());
    const email = (c.email || '').toLowerCase();
    
    return name.includes(searchStr) || 
           phone.includes(searchStr) || 
           address.includes(searchStr) || 
           email.includes(searchStr);
  });
  renderCustomerList(filtered);
}

function toggleCustomerDropdown() {
  const dropdown = document.getElementById('customer-dropdown');
  const display = document.querySelector('.customer-combobox-display');
  if (dropdown.style.display === 'none') {
    dropdown.style.display = 'flex';
    
    const rect = display.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 260 && rect.top > 260) {
        dropdown.style.top = 'auto';
        dropdown.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    } else {
        dropdown.style.bottom = 'auto';
        dropdown.style.top = (rect.bottom + 4) + 'px';
    }
    dropdown.style.left = rect.left + 'px';
    dropdown.style.width = rect.width + 'px';

    document.getElementById('customer-search-input')?.focus();
    filterCustomers(); // reset list
  } else {
    dropdown.style.display = 'none';
  }
}

function selectCustomer(id) {
  document.getElementById('customer-dropdown').style.display = 'none';
  const tab = getActiveTab();
  if (tab) {
    tab.customerId = id;
    tab.pointsUsed = 0;
  }
  updateCustomerDisplay(id);
  onCustomerChange();
}

function updateCustomerDisplay(id) {
  const textEl = document.getElementById('customer-combobox-text');
  const displayEl = document.querySelector('.customer-combobox-display');
  if (displayEl) displayEl.classList.remove('error'); // clear error state

  if (!textEl) return;
  if (id === null || id === undefined) {
    textEl.innerHTML = '<span style="color:var(--danger)"><i class="fas fa-exclamation-circle"></i> Vui lòng chọn khách hàng</span>';
    return;
  }
  if (id === '') {
    textEl.textContent = 'Khách lẻ';
    return;
  }
  const c = window.posAllCustomers.find(x => String(x.id) === String(id));
  if (c) {
    textEl.textContent = `${c.name} ${c.phone ? '- ' + c.phone : ''}`;
  } else {
    textEl.textContent = 'Khách lẻ';
  }
}

document.addEventListener('click', (e) => {
  const combo = document.getElementById('customer-combobox');
  if (combo && !combo.contains(e.target)) {
    const dropdown = document.getElementById('customer-dropdown');
    if (dropdown) dropdown.style.display = 'none';
  }
});

// ==================== CART OPERATIONS ====================
async function addComboToCart(comboId) {
  const tab = getActiveTab();
  if (!tab) return;
  const cart = tab.cart;

  const result = await window.api.getComboById(comboId);
  if (!result.success || !result.data) {
    showToast('Không tìm thấy combo', 'error');
    return;
  }

  const combo = result.data;
  const itemNames = combo.items.map(it => `${it.product_name}×${it.quantity}`).join(', ');

  // Add combo as single line item
  cart.push({
    product_id: `combo_${combo.id}`,
    product_name: `🎁 ${combo.name}`,
    price: combo.price,
    quantity: 1,
    subtotal: combo.price,
    max_stock: 9999,
    item_discount: 0,
    item_discount_type: 'money',
    is_combo: true,
    combo_detail: itemNames,
    size_name: ''
  });

  renderCart();
  renderTabsBar();
  saveTabs();
  showToast(`Đã thêm ${combo.name}`, 'success');
}

function addToCart(productId, sizeName = null, sizePrice = null) {
  const tab = getActiveTab();
  if (!tab) return;
  const cart = tab.cart;
  const product = posProducts.find(p => p.id === productId);
  if (!product) return;

  // If product has sizes and no size selected yet, show picker
  if (product.sizes && product.sizes.length > 0 && !sizeName) {
    showSizePicker(product);
    return;
  }

  const price = sizePrice || product.price;
  const displayName = sizeName ? `${product.name} (${sizeName})` : product.name;

  const existing = cart.find(item => item.product_id === productId && !item.note && item.size_name === (sizeName || '') && (!item.toppings || item.toppings.length === 0));
  if (existing) {
    if (existing.quantity >= product.stock) {
      showToast('Đã hết hàng trong kho', 'warning');
      return;
    }
    existing.quantity++;
    existing.subtotal = calcItemSubtotal(existing);
  } else {
    if (product.stock <= 0) {
      showToast('Sản phẩm đã hết hàng', 'warning');
      return;
    }
    cart.push({
      product_id: product.id,
      product_name: displayName,
      price: price,
      quantity: 1,
      subtotal: price,
      max_stock: product.stock,
      item_discount: 0,
      item_discount_type: 'money',
      size_name: sizeName || '',
      toppings: []
    });
  }

  renderCart();
  renderTabsBar();
  saveTabs();
}

function showSizePicker(product) {
  const sizeBtns = product.sizes.map(s => `
    <button type="button" class="btn btn-secondary" style="flex:1;min-width:80px;padding:12px 8px;text-align:center;"
            onclick="closeModal(); addToCart(${product.id}, '${s.size_name}', ${s.price})">
      <div style="font-weight:bold;font-size:16px;">${s.size_name}</div>
      <div style="font-size:13px;color:var(--primary);margin-top:4px;">${formatCurrency(s.price)}</div>
    </button>
  `).join('');

  showModal(`
    <div class="modal-header">
      <h3><i class="fas fa-ruler"></i> Chọn size: ${product.name}</h3>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div style="display:flex;gap:8px;padding:15px;flex-wrap:wrap;">
      ${sizeBtns}
    </div>
  `, false);
}

function updateCartQty(index, delta) {
  const cart = getActiveCart();
  const item = cart[index];
  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    cart.splice(index, 1);
  } else if (newQty > item.max_stock) {
    showToast('Vượt quá tồn kho', 'warning');
    return;
  } else {
    item.quantity = newQty;
    item.subtotal = calcItemSubtotal(item);
  }
  renderCart();
  renderTabsBar();
  saveTabs();
}

function removeFromCart(index) {
  const cart = getActiveCart();
  cart.splice(index, 1);
  renderCart();
  renderTabsBar();
  saveTabs();
}

function clearCart() {
  const tab = getActiveTab();
  if (tab) tab.cart = [];
  renderCart();
  renderTabsBar();
  saveTabs();
}

// ==================== PER-ITEM DISCOUNT ====================
function calcItemSubtotal(item) {
  const toppingTotal = (item.toppings || []).reduce((s, t) => s + (t.price || 0), 0);
  const unitPrice = item.price + toppingTotal;
  const raw = unitPrice * item.quantity;
  if (!item.item_discount || item.item_discount <= 0) return raw;
  if (item.item_discount_type === 'percent') {
    return Math.max(0, raw - (raw * item.item_discount / 100));
  }
  return Math.max(0, raw - item.item_discount);
}

function setItemDiscount(index) {
  const cart = getActiveCart();
  const item = cart[index];
  showModal(`
    <div class="modal-header">
      <h3>Giảm giá: ${item.product_name}</h3>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <p class="text-muted mb-4">Giá gốc: ${formatCurrency(item.price)} × ${item.quantity} = ${formatCurrency(item.price * item.quantity)}</p>
    <div class="form-group">
      <label>Loại giảm giá</label>
      <div class="discount-type-toggle" style="width:fit-content;">
        <button class="discount-type ${item.item_discount_type === 'money' ? 'active' : ''}" data-type="money">₫ Tiền</button>
        <button class="discount-type ${item.item_discount_type === 'percent' ? 'active' : ''}" data-type="percent">% Phần trăm</button>
      </div>
    </div>
    <div class="form-group">
      <label>Giá trị giảm</label>
      <input class="form-control" type="number" id="item-disc-value" value="${item.item_discount || 0}" min="0" autofocus>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-danger" onclick="applyItemDiscount(${index}, 0, 'money')"><i class="fas fa-times"></i> Xóa giảm giá</button>
      <button class="btn btn-primary" onclick="applyItemDiscountFromModal(${index})"><i class="fas fa-check"></i> Áp dụng</button>
    </div>
  `);
  const toggleBtns = document.querySelectorAll('.modal-content .discount-type');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      toggleBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
    });
  });
}

function applyItemDiscountFromModal(index) {
  const value = parseFloat(document.getElementById('item-disc-value').value) || 0;
  const activeBtn = document.querySelector('.modal-content .discount-type.active');
  const type = activeBtn ? activeBtn.dataset.type : 'money';
  applyItemDiscount(index, value, type);
}

function applyItemDiscount(index, value, type) {
  const cart = getActiveCart();
  cart[index].item_discount = value;
  cart[index].item_discount_type = type;
  cart[index].subtotal = calcItemSubtotal(cart[index]);
  closeModal();
  renderCart();
  saveTabs();
  showToast(value > 0 ? 'Đã áp dụng giảm giá' : 'Đã xóa giảm giá', 'success');
}

// ==================== RENDER CART ====================
function renderCart() {
  const cart = getActiveCart();
  const itemsContainer = document.getElementById('cart-items');
  const countEl = document.getElementById('cart-count');

  countEl.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (cart.length === 0) {
    itemsContainer.innerHTML = '<div class="cart-empty"><i class="fas fa-shopping-basket"></i><p>Giỏ hàng trống</p></div>';
  } else {
    itemsContainer.innerHTML = cart.map((item, i) => {
      const hasDiscount = item.item_discount && item.item_discount > 0;
      const toppingTotal = (item.toppings || []).reduce((s, t) => s + (t.price || 0), 0);
      const unitPrice = item.price + toppingTotal;
      const rawTotal = unitPrice * item.quantity;
      const discountLabel = hasDiscount
        ? (item.item_discount_type === 'percent' ? `-${item.item_discount}%` : `-${formatCurrency(item.item_discount)}`)
        : '';
      const noteTags = (item.note || '').split(', ').filter(n => n);
      const hasToppings = item.toppings && item.toppings.length > 0;
      const toppingNames = hasToppings ? item.toppings.map(t => t.name).join(', ') : '';
      return `
      <div class="cart-item ${hasDiscount ? 'has-discount' : ''}">
        <div class="cart-item-info">
          <div class="cart-item-name">
            <span class="cart-item-name-text">${item.product_name}</span>
            <span class="cart-item-actions">
              <span class="item-discount-tag" onclick="setItemDiscount(${i})" title="Giảm giá sản phẩm">
                <i class="fas fa-tag"></i>${hasDiscount ? ' ' + discountLabel : ''}
              </span>
              ${posToppings.length > 0 ? `<span onclick="toggleToppingPicker(${i})" title="Topping" class="cart-action-btn" style="color:${hasToppings ? '#4caf50' : 'var(--text-secondary)'};">
                <i class="fas fa-plus-circle"></i>
              </span>` : ''}
              <span onclick="toggleItemNote(${i})" title="Ghi chú" class="cart-action-btn" style="color:${item.note ? '#ff9800' : 'var(--text-secondary)'};">
                <i class="fas fa-sticky-note"></i>
              </span>
            </span>
          </div>
          ${hasToppings ? `<div style="font-size:11px;color:#4caf50;margin-top:2px;"><i class="fas fa-plus-circle" style="font-size:9px;"></i> ${toppingNames} (+${formatCurrency(toppingTotal)})</div>` : ''}
          ${item.note ? `<div style="font-size:11px;color:#ff9800;margin-top:2px;"><i class="fas fa-sticky-note" style="font-size:9px;"></i> ${item.note}</div>` : ''}
          <div class="cart-item-price">
            ${formatCurrency(unitPrice)} × ${item.quantity}
            ${hasDiscount ? `<span class="item-original-price">${formatCurrency(rawTotal)}</span> → ` : ' = '}
            <strong>${formatCurrency(item.subtotal)}</strong>
          </div>
          <div id="item-topping-picker-${i}" style="display:none;margin-top:6px;">
            <div style="display:flex;flex-wrap:wrap;gap:4px;">
              ${posToppings.map(t => {
                const active = (item.toppings || []).some(tp => tp.id === t.id);
                return `<span onclick="toggleTopping(${i},${t.id})" style="padding:2px 8px;border-radius:12px;font-size:10px;cursor:pointer;border:1px solid ${active ? '#4caf50' : 'var(--border)'};background:${active ? 'rgba(76,175,80,0.2)' : 'var(--surface)'};color:${active ? '#4caf50' : 'var(--text-secondary)'};">${t.name} +${formatCurrency(t.price)}</span>`;
              }).join('')}
            </div>
          </div>
          <div id="item-note-input-${i}" style="display:none;margin-top:6px;">
            <div style="display:flex;flex-wrap:wrap;gap:4px;">
              ${['0% đường', '30% đường', '50% đường', '70% đường', 'không đá', '30% đá', '50% đá', '70% đá', 'nóng'].map(tag => {
        const active = noteTags.includes(tag);
        return `<span onclick="toggleNoteTag(${i},'${tag}')" style="padding:2px 8px;border-radius:12px;font-size:10px;cursor:pointer;border:1px solid ${active ? '#ff9800' : 'var(--border)'};background:${active ? 'rgba(255,152,0,0.2)' : 'var(--surface)'};color:${active ? '#ff9800' : 'var(--text-secondary)'};">${tag}</span>`;
      }).join('')}
            </div>
            <input class="form-control" style="font-size:11px;padding:4px 8px;margin-top:4px;" placeholder="Ghi chú khác..." id="custom-note-${i}" onkeydown="if(event.key==='Enter'){addCustomNote(${i},this.value);this.value=''}">
          </div>
        </div>
        <div class="cart-item-qty">
          <button onclick="updateCartQty(${i}, -1)">−</button>
          <span>${item.quantity}</span>
          <button onclick="updateCartQty(${i}, 1)">+</button>
        </div>
        <div class="cart-item-remove" onclick="removeFromCart(${i})">
          <i class="fas fa-times"></i>
        </div>
      </div>
    `}).join('');
  }

  updateCartTotals();
}

function toggleItemNote(index) {
  const el = document.getElementById(`item-note-input-${index}`);
  if (el) {
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }
}

function toggleToppingPicker(index) {
  const el = document.getElementById(`item-topping-picker-${index}`);
  if (el) {
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }
}

function toggleTopping(index, toppingId) {
  const cart = getActiveCart();
  if (!cart[index]) return;
  const item = cart[index];
  if (!item.toppings) item.toppings = [];

  const topping = posToppings.find(t => t.id === toppingId);
  if (!topping) return;

  const existIdx = item.toppings.findIndex(t => t.id === toppingId);
  if (existIdx >= 0) {
    item.toppings.splice(existIdx, 1);
  } else {
    item.toppings.push({ id: topping.id, name: topping.name, price: topping.price });
  }

  item.subtotal = calcItemSubtotal(item);
  saveTabs();
  renderCart();
  // Re-open the topping picker
  setTimeout(() => {
    const el = document.getElementById(`item-topping-picker-${index}`);
    if (el) el.style.display = 'block';
  }, 50);
}

function toggleNoteTag(index, tag) {
  const cart = getActiveCart();
  if (!cart[index]) return;
  let notes = (cart[index].note || '').split(', ').filter(n => n);
  const idx = notes.indexOf(tag);
  if (idx >= 0) notes.splice(idx, 1);
  else notes.push(tag);
  cart[index].note = notes.join(', ');
  renderCart();
  // Re-open the note panel
  setTimeout(() => {
    const el = document.getElementById(`item-note-input-${index}`);
    if (el) el.style.display = 'block';
  }, 50);
}

function addCustomNote(index, text) {
  if (!text.trim()) return;
  const cart = getActiveCart();
  if (!cart[index]) return;
  let notes = (cart[index].note || '').split(', ').filter(n => n);
  if (!notes.includes(text.trim())) notes.push(text.trim());
  cart[index].note = notes.join(', ');
  renderCart();
  setTimeout(() => {
    const el = document.getElementById(`item-note-input-${index}`);
    if (el) el.style.display = 'block';
  }, 50);
}

function saveItemNote(index, note) {
  const cart = getActiveCart();
  if (cart[index]) {
    cart[index].note = note.trim();
    renderCart();
  }
}

// ==================== TOTALS & PAYMENT ====================
function switchDiscountType(el) {
  document.querySelectorAll('.cart-footer .discount-type').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  const tab = getActiveTab();
  if (tab) tab.discountType = el.dataset.type;
  updateCartTotals();
}

function calcDiscount(subtotal) {
  const tab = getActiveTab();
  if (!tab) return 0;
  const discountVal = tab.discount || 0;
  if (tab.discountType === 'percent') {
    return Math.min(subtotal, subtotal * discountVal / 100);
  }
  return Math.min(subtotal, discountVal);
}

function updateCartTotals() {
  const tab = getActiveTab();
  const cart = getActiveCart();
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = calcDiscount(subtotal);
  const pointsDiscount = (tab && tab.pointsUsed) ? Math.floor(tab.pointsUsed / 5) * 1000 : 0;
  const total = Math.max(0, subtotal - discount - pointsDiscount);

  document.getElementById('cart-subtotal').textContent = formatCurrency(subtotal);
  document.getElementById('cart-total').textContent = formatCurrency(total);
  updateQRPreview();
}

function selectPayment(el) {
  document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('active'));
  el.classList.add('active');
  const tab = getActiveTab();
  if (tab) tab.paymentMethod = el.dataset.method;
  saveTabs();
  updateQRPreview();
}

async function updateQRPreview() {
  const tab = getActiveTab();
  const container = document.getElementById('qr-preview');
  if (!container) return;

  if (!tab || tab.paymentMethod !== 'transfer' || tab.cart.length === 0) {
    container.style.display = 'none';
    return;
  }

  const bankInfo = getBankSettings();
  if (!bankInfo) {
    container.innerHTML = `<div class="qr-preview-msg" onclick="showBankSettings()">
      <i class="fas fa-cog"></i> Bấm để cài đặt tài khoản nhận tiền
    </div>`;
    container.style.display = '';
    return;
  }

  const cart = tab.cart;
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = calcDiscount(subtotal);
  const total = Math.max(0, subtotal - discount);
  const amountInt = Math.round(total);
  if (amountInt <= 0) { container.style.display = 'none'; return; }

  const bank = BANK_LIST.find(b => b.code === bankInfo.bankCode);
  if (!bank) { container.style.display = 'none'; return; }

  let qrImgHtml;
  const tabName = tab.name || '';

  if (bank.isMomo) {
    const phone = bankInfo.momoPhone || bankInfo.accountNo;
    const note = encodeURIComponent(tabName.replace(/[^a-zA-Z0-9 ]/g, ''));
    const qrUrl = `https://img.vietqr.io/image/${bank.bin}-${phone}-compact2.png?amount=${amountInt}&addInfo=${note}`;
    const momoPayload = `2|99|${phone}|||0|0|${amountInt}|${tabName}|transfer_myqr`;
    const qrFallback = await window.api.generateQR(momoPayload);
    qrImgHtml = `<img src="${qrUrl}" class="qr-preview-img" onerror="this.src='${qrFallback.success ? qrFallback.data : ''}'">`;
    container.innerHTML = `
      <div class="qr-preview-inner">
        ${qrImgHtml}
        <div class="qr-preview-info">
          <div class="qr-preview-amount">${formatCurrency(total)}</div>
          <div class="qr-preview-label"><i class="fas fa-wallet" style="color:#ae2070"></i> MoMo · ${phone}</div>
        </div>
      </div>`;
  } else {
    const note = encodeURIComponent(tabName.replace(/[^a-zA-Z0-9 ]/g, ''));
    const accountName = encodeURIComponent(bankInfo.accountName);
    const qrUrl = `https://img.vietqr.io/image/${bank.bin}-${bankInfo.accountNo}-compact2.png?amount=${amountInt}&addInfo=${note}&accountName=${accountName}`;
    container.innerHTML = `
      <div class="qr-preview-inner">
        <img src="${qrUrl}" class="qr-preview-img" onerror="this.alt='Lỗi mạng'">
        <div class="qr-preview-info">
          <div class="qr-preview-amount">${formatCurrency(total)}</div>
          <div class="qr-preview-label"><i class="fas fa-university" style="color:#1a73e8"></i> ${bank.name} · ${bankInfo.accountNo}</div>
          <div class="qr-preview-name">${bankInfo.accountName}</div>
        </div>
      </div>`;
  }
  container.style.display = '';
}

// ==================== BANK QR (VIETQR) + MOMO SETTINGS ====================
const BANK_LIST = [
  { code: 'MOMO', bin: '971025', name: 'MoMo', isMomo: true },
  { code: 'MB', bin: '970422', name: 'MBBank' },
  { code: 'VCB', bin: '970436', name: 'Vietcombank' },
  { code: 'TCB', bin: '970407', name: 'Techcombank' },
  { code: 'ACB', bin: '970416', name: 'ACB' },
  { code: 'VPB', bin: '970432', name: 'VPBank' },
  { code: 'BIDV', bin: '970418', name: 'BIDV' },
  { code: 'CTG', bin: '970415', name: 'VietinBank' },
  { code: 'TPB', bin: '970423', name: 'TPBank' },
  { code: 'STB', bin: '970403', name: 'Sacombank' },
  { code: 'HDB', bin: '970437', name: 'HDBank' },
  { code: 'VIB', bin: '970441', name: 'VIB' },
  { code: 'SHB', bin: '970443', name: 'SHB' },
  { code: 'MSB', bin: '970426', name: 'MSB' },
  { code: 'OCB', bin: '970448', name: 'OCB' },
  { code: 'AGRI', bin: '970405', name: 'Agribank' },
  { code: 'SCB', bin: '970429', name: 'SCB' },
  { code: 'EIB', bin: '970431', name: 'Eximbank' },
  { code: 'LPB', bin: '970449', name: 'LienVietPostBank' },
];

function getBankSettings() {
  try {
    const saved = localStorage.getItem('bank_settings');
    return saved ? JSON.parse(saved) : null;
  } catch (e) { return null; }
}

function saveBankSettingsData(settings) {
  localStorage.setItem('bank_settings', JSON.stringify(settings));
}

function showBankSettings() {
  const current = getBankSettings() || {};
  const bankOptions = BANK_LIST.map(b =>
    `<option value="${b.code}" ${current.bankCode === b.code ? 'selected' : ''}>${b.name}</option>`
  ).join('');

  const isMomo = current.bankCode === 'MOMO';

  showModal(`
    <div class="modal-header">
      <h3><i class="fas fa-university" style="color:#1a73e8;"></i> Cài đặt chuyển khoản</h3>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="form-group">
      <label>Ngân hàng / Ví điện tử</label>
      <select class="form-control" id="bank-code-input" onchange="toggleBankFields()">
        <option value="">-- Chọn --</option>
        ${bankOptions}
      </select>
    </div>
    <div id="bank-fields" style="${isMomo ? 'display:none' : ''}">
      <div class="form-group">
        <label>Số tài khoản</label>
        <input class="form-control" id="bank-account-input" value="${current.accountNo || ''}" placeholder="VD: 0123456789">
      </div>
      <div class="form-group">
        <label>Tên chủ tài khoản</label>
        <input class="form-control" id="bank-name-input" value="${current.accountName || ''}" placeholder="VD: NGUYEN VAN A">
      </div>
    </div>
    <div id="momo-fields" style="${isMomo ? '' : 'display:none'}">
      <div class="form-group">
        <label>Số điện thoại MoMo</label>
        <input class="form-control" id="momo-phone-input" value="${current.momoPhone || ''}" placeholder="VD: 0987654321">
      </div>
    </div>
    <p class="text-muted" style="font-size:12px;">Chọn MoMo hoặc ngân hàng — QR sẽ tự động tạo theo chuẩn tương ứng.</p>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="doSaveBankSettings()"><i class="fas fa-save"></i> Lưu</button>
    </div>
  `);
}

function toggleBankFields() {
  const code = document.getElementById('bank-code-input').value;
  document.getElementById('bank-fields').style.display = code === 'MOMO' ? 'none' : '';
  document.getElementById('momo-fields').style.display = code === 'MOMO' ? '' : 'none';
}

function doSaveBankSettings() {
  const bankCode = document.getElementById('bank-code-input').value;
  if (!bankCode) { showToast('Vui lòng chọn ngân hàng/ví', 'error'); return; }

  if (bankCode === 'MOMO') {
    const momoPhone = document.getElementById('momo-phone-input').value.trim();
    if (!momoPhone || momoPhone.length < 10) { showToast('Số MoMo không hợp lệ', 'error'); return; }
    saveBankSettingsData({ bankCode, momoPhone });
  } else {
    const accountNo = document.getElementById('bank-account-input').value.trim();
    const accountName = document.getElementById('bank-name-input').value.trim();
    if (!accountNo) { showToast('Vui lòng nhập số tài khoản', 'error'); return; }
    if (!accountName) { showToast('Vui lòng nhập tên chủ TK', 'error'); return; }
    saveBankSettingsData({ bankCode, accountNo, accountName });
  }

  closeModal();
  showToast('Đã lưu cài đặt', 'success');
}

// ==================== CHECKOUT ====================
async function checkout() {
  const tab = getActiveTab();
  if (!tab || tab.cart.length === 0) {
    showToast('Giỏ hàng trống', 'warning');
    return;
  }

  // Require customer selection
  if (tab.customerId === null) {
    const displayEl = document.querySelector('.customer-combobox-display');
    if (displayEl) displayEl.classList.add('error');
    showToast('Vui lòng chọn khách hàng trước khi thanh toán!', 'error');
    return;
  }

  // Require open shift for non-admin
  if (!isAdmin() && !currentShift) {
    showToast('Phải mở ca trước khi thanh toán!', 'error');
    showOpenShiftModal();
    return;
  }

  const cart = tab.cart;
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = calcDiscount(subtotal);
  const pointsDiscount = Math.floor((tab.pointsUsed || 0) / 5) * 1000;
  const total = Math.max(0, subtotal - discount - pointsDiscount);

  // If payment is transfer, check bank settings
  if ((tab.paymentMethod || 'cash') === 'transfer') {
    const bankInfo = getBankSettings();
    if (!bankInfo) {
      showToast('Chưa cài đặt tài khoản nhận tiền!', 'warning');
      showBankSettings();
      return;
    }
  }

  const method = (tab.paymentMethod || 'cash') === 'cash' ? 'Tiền mặt' : 'Chuyển khoản';
  showConfirm(`Xác nhận thanh toán <strong>${formatCurrency(total)}</strong> (${method})?`, async () => {
    await processOrder(tab, subtotal, discount + pointsDiscount, total);
  });
}

async function showBankQR(amount, tabName) {
  const bankInfo = getBankSettings();
  const bank = BANK_LIST.find(b => b.code === bankInfo.bankCode);
  if (!bank) { showToast('Cài đặt không hợp lệ', 'error'); return; }

  const amountInt = Math.round(amount);
  let qrImgHtml, brandColor, brandIcon, brandName, infoLine1, infoLine2, helpText;

  if (bank.isMomo) {
    // MoMo via VietQR (scannable by all banks) with fallback to native MoMo QR
    const phone = bankInfo.momoPhone || bankInfo.accountNo;
    const note = encodeURIComponent(tabName.replace(/[^a-zA-Z0-9 ]/g, ''));
    const qrUrl = `https://img.vietqr.io/image/${bank.bin}-${phone}-compact2.png?amount=${amountInt}&addInfo=${note}`;

    // Also generate native MoMo QR as fallback
    const momoPayload = `2|99|${phone}|||0|0|${amountInt}|${tabName}|transfer_myqr`;
    const qrFallback = await window.api.generateQR(momoPayload);

    qrImgHtml = `
      <img src="${qrUrl}" alt="MoMo VietQR" class="momo-qr-img" id="momo-vietqr-img"
        onerror="document.getElementById('momo-vietqr-img').src='${qrFallback.success ? qrFallback.data : ''}';document.getElementById('momo-qr-help').innerHTML='⚠️ VietQR lỗi, dùng QR MoMo (chỉ quét bằng MoMo)';">
    `;
    brandColor = '#ae2070';
    brandIcon = 'fas fa-wallet';
    brandName = 'MoMo';
    infoLine1 = phone;
    infoLine2 = '';
    helpText = 'Quét bằng app ngân hàng bất kỳ hoặc MoMo';
  } else {
    // VietQR — load from API
    const note = encodeURIComponent(tabName.replace(/[^a-zA-Z0-9 ]/g, ''));
    const accountName = encodeURIComponent(bankInfo.accountName);
    const qrUrl = `https://img.vietqr.io/image/${bank.bin}-${bankInfo.accountNo}-compact2.png?amount=${amountInt}&addInfo=${note}&accountName=${accountName}`;
    qrImgHtml = `<img src="${qrUrl}" alt="VietQR" class="momo-qr-img" onerror="this.alt='Lỗi tải QR - kiểm tra mạng'; this.style.border='2px dashed #ccc';">`;
    brandColor = '#1a73e8';
    brandIcon = 'fas fa-university';
    brandName = bank.name;
    infoLine1 = bankInfo.accountNo;
    infoLine2 = bankInfo.accountName;
    helpText = 'Quét bằng app ngân hàng bất kỳ, MoMo, ZaloPay...';
  }

  showModal(`
    <div class="modal-header">
      <h3><i class="fas fa-qrcode" style="color:${brandColor};"></i> Thanh toán chuyển khoản</h3>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="momo-qr-container">
      <div class="momo-qr-card">
        <div class="momo-logo" style="color:${brandColor};">
          <i class="${brandIcon}"></i> ${brandName}
        </div>
        ${qrImgHtml}
        <div class="momo-amount" style="color:${brandColor};">${formatCurrency(amount)}</div>
        <div class="momo-phone">${infoLine1}</div>
        ${infoLine2 ? `<div class="momo-note" style="font-weight:600;color:#333;">${infoLine2}</div>` : ''}
        <div class="momo-note">${tabName}</div>
      </div>
      <p class="text-muted" id="momo-qr-help" style="text-align:center;font-size:12px;margin-top:12px;">
        ${helpText}
      </p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-success" onclick="confirmBankPayment()">
        <i class="fas fa-check-circle"></i> Đã nhận tiền - Xác nhận
      </button>
    </div>
  `, true);
}

async function confirmBankPayment() {
  closeModal();
  const tab = getActiveTab();
  if (!tab) return;
  const cart = tab.cart;
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = calcDiscount(subtotal);
  const total = Math.max(0, subtotal - discount);
  await processOrder(tab, subtotal, discount, total);
}

async function processOrder(tab, subtotal, discount, total) {
  const cart = tab.cart;
  const customerId = tab.customerId || null;

  const orderData = {
    customer_id: customerId ? parseInt(customerId) : null,
    user_id: getCurrentUser().id,
    total: subtotal,
    discount: discount,
    final_total: total,
    payment_method: tab.paymentMethod || 'cash',
    status: 'completed',
    pointsUsed: tab.pointsUsed || 0,
    items: cart.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal,
      note: item.note || '',
      toppings: (item.toppings && item.toppings.length > 0) ? JSON.stringify(item.toppings) : ''
    }))
  };

  try {
    const result = await window.api.createOrder(orderData);
    if (result.success) {
      showToast(`Thanh toán "${tab.name}" thành công!`, 'success');
      await window.api.logActivity(getCurrentUser().id, 'create_order', `Đơn #${result.data.id} - ${tab.name} - ${formatCurrency(total)}`);

      // Deduct loyalty points if used
      if (tab.pointsUsed > 0 && tab.customerId) {
        await window.api.useCustomerPoints(parseInt(tab.customerId), tab.pointsUsed);
      }
      // Auto-print bill if toggle is ON
      const printEnabled = document.getElementById('pos-print-toggle')?.checked;
      if (printEnabled) {
        await printOrderBill(result.data.id);
      }

      // Auto-print order labels (tem) - sẽ tự lọc SP bị tắt
      await printOrderLabels(result.data.id, cart);

      // Clear current tab or remove it
      tab.cart = [];
      tab.discount = 0;
      tab.customerId = null;

      // If there are other tabs, remove this one and switch
      if (posTabs.length > 1) {
        removeTab(tab.id);
      } else {
        syncTabUI();
        renderCart();
        renderTabsBar();
        saveTabs();
      }

      loadPosProducts();
    } else {
      showToast('Lỗi: ' + result.error, 'error');
    }
  } catch (err) {
    showToast('Lỗi hệ thống: ' + err.message, 'error');
  }
}

// ==================== SHIFT MANAGEMENT ====================
let currentShift = null;

async function updateShiftBar() {
  const bar = document.getElementById('shift-bar');
  if (!bar) return;
  const user = getCurrentUser();
  if (!user) return;

  const result = await window.api.getCurrentShift(user.id);
  currentShift = result.success ? result.data : null;

  if (currentShift) {
    const startTime = new Date(currentShift.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    bar.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:rgba(76,175,80,0.15);border-radius:8px;border:1px solid rgba(76,175,80,0.3);">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="width:8px;height:8px;background:#4caf50;border-radius:50%;animation:pulse 2s infinite;"></span>
          <span style="color:#4caf50;font-weight:600;font-size:13px;">Ca đang mở</span>
          <span style="color:var(--text-secondary);font-size:12px;">từ ${startTime}</span>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm btn-secondary" onclick="showShiftCashModal()" style="font-size:11px;"><i class="fas fa-exchange-alt"></i> Thu/Chi</button>
          <button class="btn btn-sm btn-secondary" onclick="showShiftHistory()" style="font-size:11px;"><i class="fas fa-history"></i> Lịch sử</button>
          <button class="btn btn-sm btn-danger" onclick="showCloseShiftModal()" style="font-size:11px;"><i class="fas fa-stop-circle"></i> Đóng ca</button>
        </div>
      </div>
    `;
  } else {
    bar.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:rgba(255,152,0,0.15);border-radius:8px;border:1px solid rgba(255,152,0,0.3);">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="width:8px;height:8px;background:#ff9800;border-radius:50;"></span>
          <span style="color:#ff9800;font-weight:600;font-size:13px;">Chưa mở ca</span>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm btn-secondary" onclick="showShiftHistory()" style="font-size:11px;"><i class="fas fa-history"></i> Lịch sử</button>
          <button class="btn btn-sm btn-primary" onclick="showOpenShiftModal()" style="font-size:11px;"><i class="fas fa-play-circle"></i> Mở ca</button>
        </div>
      </div>
    `;
  }
}

async function showOpenShiftModal() {
  // Auto-fill from last closed shift
  let suggestedAmount = 0;
  const lastResult = await window.api.getLastClosedShiftCash();
  if (lastResult.success) suggestedAmount = lastResult.data || 0;

  showModal(`
    <div class="modal-header">
      <h3><i class="fas fa-play-circle" style="color:#4caf50;"></i> Mở ca làm việc</h3>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <form id="open-shift-form">
      <div class="form-group">
        <label>Tiền đầu ca (tiền mặt trong két)</label>
        <input class="form-control" type="number" id="shift-start-amount" value="${suggestedAmount}" min="0" style="font-size:18px;font-weight:bold;">
        ${suggestedAmount > 0 ? `<small style="color:var(--text-secondary);display:block;margin-top:4px;"><i class="fas fa-info-circle"></i> Tự động lấy từ két cuối ca trước: ${formatCurrency(suggestedAmount)}</small>` : ''}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Hủy</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-play-circle"></i> Mở ca</button>
      </div>
    </form>
  `);

  document.getElementById('open-shift-form').onsubmit = async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    const startAmount = parseFloat(document.getElementById('shift-start-amount').value) || 0;
    const result = await window.api.openShift(user.id, startAmount);
    if (result.success) {
      closeModal();
      showToast('Đã mở ca!', 'success');
      updateShiftBar();
    } else {
      showToast('Lỗi: ' + result.error, 'error');
    }
  };
}

async function showCloseShiftModal() {
  if (!currentShift) return;
  const result = await window.api.getShiftSummary(currentShift.id);
  if (!result.success || !result.data) {
    showToast('Không tìm thấy dữ liệu ca', 'error');
    return;
  }
  const s = result.data;
  const startTime = new Date(s.start_time).toLocaleString('vi-VN');
  const cashIn = s.total_cash_in || 0;
  const cashOut = s.total_cash_out || 0;
  const expectedCash = (s.start_amount || 0) + (s.cash_total || 0) + cashIn - cashOut;

  showModal(`
    <div class="modal-header">
      <h3><i class="fas fa-stop-circle" style="color:#f44336;"></i> Đóng ca làm việc</h3>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div style="padding:0 20px;">
      <div style="background:var(--surface);border-radius:10px;padding:15px;margin-bottom:15px;">
        <div style="text-align:center;color:var(--text-secondary);margin-bottom:10px;">Bắt đầu: ${startTime}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="background:rgba(76,175,80,0.1);padding:12px;border-radius:8px;text-align:center;">
            <div style="font-size:11px;color:var(--text-secondary);">Số đơn</div>
            <div style="font-size:24px;font-weight:bold;color:#4caf50;">${s.order_count || 0}</div>
          </div>
          <div style="background:rgba(33,150,243,0.1);padding:12px;border-radius:8px;text-align:center;">
            <div style="font-size:11px;color:var(--text-secondary);">Tổng doanh thu</div>
            <div style="font-size:24px;font-weight:bold;color:#2196f3;">${formatCurrency(s.total_revenue || 0)}</div>
          </div>
          <div style="background:rgba(255,152,0,0.1);padding:12px;border-radius:8px;text-align:center;">
            <div style="font-size:11px;color:var(--text-secondary);">Tiền mặt bán</div>
            <div style="font-size:18px;font-weight:bold;color:#ff9800;">${formatCurrency(s.cash_total || 0)}</div>
          </div>
          <div style="background:rgba(156,39,176,0.1);padding:12px;border-radius:8px;text-align:center;">
            <div style="font-size:11px;color:var(--text-secondary);">Chuyển khoản</div>
            <div style="font-size:18px;font-weight:bold;color:#9c27b0;">${formatCurrency(s.transfer_total || 0)}</div>
          </div>
        </div>
        ${(cashIn > 0 || cashOut > 0) ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
          <div style="background:rgba(0,150,136,0.1);padding:10px;border-radius:8px;text-align:center;">
            <div style="font-size:11px;color:var(--text-secondary);">Thu vào két</div>
            <div style="font-size:16px;font-weight:bold;color:#009688;">+${formatCurrency(cashIn)}</div>
          </div>
          <div style="background:rgba(244,67,54,0.1);padding:10px;border-radius:8px;text-align:center;">
            <div style="font-size:11px;color:var(--text-secondary);">Chi/Rút ra</div>
            <div style="font-size:16px;font-weight:bold;color:#f44336;">-${formatCurrency(cashOut)}</div>
          </div>
        </div>
        ` : ''}
        <div style="margin-top:12px;padding:10px;background:rgba(76,175,80,0.1);border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:var(--text-secondary);">Tiền đầu ca: ${formatCurrency(s.start_amount || 0)}</div>
          <div style="font-size:16px;font-weight:bold;color:#4caf50;">Tiền mặt trong két dự kiến: ${formatCurrency(expectedCash)}</div>
        </div>
      </div>
    </div>
    <form id="close-shift-form">
      <div class="form-group" style="padding:0 20px;">
        <label>Ghi chú cuối ca</label>
        <textarea class="form-control" id="shift-close-note" rows="2" placeholder="VD: Đã kiểm tiền, đủ..."></textarea>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Hủy</button>
        <button type="submit" class="btn btn-danger"><i class="fas fa-stop-circle"></i> Xác nhận đóng ca</button>
      </div>
    </form>
  `);

  document.getElementById('close-shift-form').onsubmit = async (e) => {
    e.preventDefault();
    const note = document.getElementById('shift-close-note').value.trim();
    const result = await window.api.closeShift(currentShift.id, note);
    if (result.success) {
      closeModal();
      showToast('Đã đóng ca!', 'success');
      currentShift = null;
      updateShiftBar();
    } else {
      showToast('Lỗi: ' + result.error, 'error');
    }
  };
}

async function showShiftCashModal() {
  if (!currentShift) {
    showToast('Chưa mở ca', 'error');
    return;
  }

  const txnResult = await window.api.getShiftTransactions(currentShift.id);
  const txns = txnResult.success ? txnResult.data : [];

  const reasonLabels = {
    'expense': 'Mua nguyên liệu',
    'owner_withdraw': 'Chủ rút tiền',
    'safe_deposit': 'Rút bỏ két',
    'other_out': 'Chi phí khác',
    'other_in': 'Thu khác'
  };

  let txnRows = txns.map(t => {
    const time = new Date(t.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const isOut = t.type === 'out';
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px;border-bottom:1px solid var(--border);font-size:13px;">
        <div>
          <span style="color:${isOut ? '#f44336' : '#4caf50'};font-weight:600;">${isOut ? '↓ Chi' : '↑ Thu'}</span>
          <span style="margin-left:6px;">${reasonLabels[t.reason] || t.reason}</span>
          ${t.note ? `<span style="color:var(--text-secondary);font-size:11px;margin-left:4px;">(${t.note})</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:bold;color:${isOut ? '#f44336' : '#4caf50'};">${isOut ? '-' : '+'}${formatCurrency(t.amount)}</span>
          <span style="font-size:11px;color:var(--text-secondary);">${time}</span>
          <button class="btn btn-sm" onclick="deleteShiftTxn(${t.id})" style="padding:2px 6px;font-size:10px;color:#f44336;"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
  }).join('');

  showModal(`
    <div class="modal-header">
      <h3><i class="fas fa-exchange-alt"></i> Thu/Chi trong ca</h3>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <form id="cash-txn-form">
      <div style="padding:0 20px;">
        <div class="form-row">
          <div class="form-group">
            <label>Loại</label>
            <select class="form-control" id="txn-type" onchange="document.getElementById('txn-reason').innerHTML = this.value === 'out' ? '<option value=\\'expense\\'>Mua nguyên liệu</option><option value=\\'owner_withdraw\\'>Chủ rút tiền</option><option value=\\'safe_deposit\\'>Rút bỏ két</option><option value=\\'other_out\\'>Chi phí khác</option>' : '<option value=\\'other_in\\'>Thu khác</option>'">
              <option value="out" selected>Chi ra</option>
              <option value="in">Thu vào</option>
            </select>
          </div>
          <div class="form-group">
            <label>Lý do</label>
            <select class="form-control" id="txn-reason">
              <option value="expense">Mua nguyên liệu</option>
              <option value="owner_withdraw">Chủ rút tiền</option>
              <option value="safe_deposit">Rút bỏ két</option>
              <option value="other_out">Chi phí khác</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Số tiền</label>
            <input class="form-control" type="number" id="txn-amount" min="1000" step="1000" required placeholder="0" style="font-size:16px;font-weight:bold;">
          </div>
          <div class="form-group">
            <label>Ghi chú</label>
            <input class="form-control" id="txn-note" placeholder="VD: Mua đá, sữa...">
          </div>
        </div>
      </div>
      <div style="padding:0 20px 10px;">
        <button type="submit" class="btn btn-primary" style="width:100%;"><i class="fas fa-plus"></i> Thêm</button>
      </div>
    </form>
    <div style="padding:0 20px 15px;">
      <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">Lịch sử thu/chi ca này:</div>
      <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;">
        ${txnRows || '<div style="padding:15px;text-align:center;color:var(--text-secondary);font-size:13px;">Chưa có giao dịch</div>'}
      </div>
    </div>
  `);

  document.getElementById('cash-txn-form').onsubmit = async (e) => {
    e.preventDefault();
    const type = document.getElementById('txn-type').value;
    const reason = document.getElementById('txn-reason').value;
    const amount = parseFloat(document.getElementById('txn-amount').value);
    const note = document.getElementById('txn-note').value.trim();

    if (!amount || amount <= 0) {
      showToast('Nhập số tiền hợp lệ', 'error');
      return;
    }

    const result = await window.api.addShiftTransaction(currentShift.id, type, amount, reason, note);
    if (result.success) {
      showToast('Đã thêm!', 'success');
      showShiftCashModal(); // Reload modal
    } else {
      showToast('Lỗi: ' + result.error, 'error');
    }
  };
}

async function deleteShiftTxn(id) {
  const result = await window.api.deleteShiftTransaction(id);
  if (result.success) {
    showToast('Đã xóa', 'success');
    showShiftCashModal(); // Reload modal
  }
}

function showShiftHistory() {
  navigateTo('shifts');
}
