// ==================== PRINTER - THERMAL BILL ====================

function getPrinterConfig() {
  try {
    const saved = localStorage.getItem('printer_config');
    return saved ? JSON.parse(saved) : { billPrinter: '', labelPrinter: '' };
  } catch (e) { return { billPrinter: '', labelPrinter: '' }; }
}

function savePrinterConfig(config) {
  localStorage.setItem('printer_config', JSON.stringify(config));
}

async function ensurePrinterConfig() {
  const config = getPrinterConfig();
  // Nếu chưa cài gì cả → mở modal cài đặt
  if (!config.billPrinter && !config.labelPrinter) {
    showToast('⚠️ Chưa cài máy in! Đang mở cài đặt...', 'warning');
    await showPrinterSettingsModal();
    return getPrinterConfig();
  }
  return config;
}

function generateBillHtml(order, qrDataUrl, bankLabel) {
  // Tính tổng giảm giá từ item-level (chênh lệch giữa giá gốc và subtotal)
  const itemOriginalTotal = order.items.reduce((s, it) => s + (it.price * it.quantity), 0);
  const itemActualTotal = order.items.reduce((s, it) => s + it.subtotal, 0);
  const itemDiscountTotal = itemOriginalTotal - itemActualTotal;
  // Tổng giảm giá = order-level + item-level
  const totalDiscount = (order.discount || 0) + itemDiscountTotal;

  const itemsHtml = order.items.map(item => {
    const toppings = item.toppings ? (typeof item.toppings === 'string' ? (function(){ try { return JSON.parse(item.toppings); } catch(e) { return []; } })() : item.toppings) : [];
    const toppingLine = toppings.length > 0 ? `<tr><td colspan="4" class="sub-row">+ ${toppings.map(t => t.name).join(', ')}</td></tr>` : '';
    const noteLine = item.note ? `<tr><td colspan="4" class="sub-row">${item.note}</td></tr>` : '';
    return `
    <tr>
      <td class="col-sp">${item.product_name}</td>
      <td class="col-sl">${item.quantity}</td>
      <td class="col-gia">${fmtK(item.price)}</td>
      <td class="col-tt">${fmtK(item.subtotal)}</td>
    </tr>
    ${toppingLine}
    ${noteLine}
  `;
  }).join('');

  const qrSection = qrDataUrl ? `
    <div class="line"></div>
    <div class="center" style="margin:3px 0;">
      <div style="font-size:11px;font-weight:bold;margin-bottom:3px;">QUÉT MÃ CHUYỂN KHOẢN</div>
      <img src="${qrDataUrl}" style="width:30mm;height:30mm;" />
      <div style="font-size:13px;font-weight:bold;margin-top:3px;">${formatCurrencyShort(order.final_total)}</div>
      ${bankLabel || ''}
      <div style="font-size:10px;margin-top:3px;font-weight:bold;">Lưu ý: CK đúng mã bill, không đổi nội dung</div>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 0; size: 72mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, sans-serif;
    font-size: 11px;
    width: 72mm;
    color: #000;
    -webkit-print-color-adjust: exact;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: 3px 0; }
  .shop-name { font-size: 13px; font-weight: bold; margin-bottom: 1px; }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .items-tbl { margin: 2px 0; }
  .items-tbl th {
    border-bottom: 1px solid #000;
    padding: 1px 0;
    font-size: 10px;
    font-weight: 700;
    overflow: hidden;
  }
  .items-tbl td {
    padding: 1px 0;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .col-sp { text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .col-sl { text-align: center; width: 8%; }
  .col-gia { text-align: right; width: 25%; white-space: nowrap; }
  .col-tt { text-align: right; width: 25%; white-space: nowrap; font-weight: 600; }
  .sub-row { padding: 0 0 1px 4px !important; font-size: 9px !important; font-style: italic; white-space: normal !important; }
  .sum-tbl { margin-top: 2px; }
  .sum-tbl td { padding: 1px 0; font-size: 11px; }
  .total-row td { font-size: 14px; font-weight: bold; padding-top: 2px; }
  .footer { margin-top: 4px; font-size: 10px; }
</style>
</head>
<body>
  <div class="center">
    <div class="shop-name">LÀ NHÀ - GÓP NHẶT VỊ NHÀ</div>
    <div style="font-size:10px;">Toà 2A VINACONEX 7, 136 Hồ Tùng Mậu</div>
    <div style="font-size:10px;">ĐT: 0862790096</div>
  </div>

  <div class="line"></div>

  <div class="center bold" style="font-size:12px;">HÓA ĐƠN BÁN HÀNG</div>
  <div style="font-size:10px;">Mã: #${order.id} | ${formatDateTime(order.created_at)}</div>
  <div style="font-size:10px;">NV: ${order.user_name} | KH: ${order.customer_name || 'Khách lẻ'}${order.customer_phone ? ' - ' + order.customer_phone : ''}${order.customer_address ? ' - ' + order.customer_address : ''}</div>

  <div class="line"></div>

  <table class="items-tbl">
    <thead>
      <tr>
        <th class="col-sp">SP</th>
        <th class="col-sl">SL</th>
        <th class="col-gia">Giá</th>
        <th class="col-tt">T.Tiền</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="line"></div>

  <table class="sum-tbl">
    <tr>
      <td>Tạm tính:</td>
      <td style="text-align:right;">${formatCurrencyShort(itemOriginalTotal)}</td>
    </tr>
    ${totalDiscount > 0 ? `
      <tr>
        <td>Giảm giá:</td>
        <td style="text-align:right;">-${formatCurrencyShort(totalDiscount)}</td>
      </tr>
    ` : ''}
    <tr class="total-row">
      <td>TỔNG:</td>
      <td style="text-align:right;">${formatCurrencyShort(order.final_total)}</td>
    </tr>
  </table>

  <div class="line"></div>

  <div style="font-size:10px;">TT: ${getPaymentBadge(order.payment_method)}</div>

  ${qrSection}

  <div class="line"></div>

  <div class="center footer">Cảm ơn quý khách, hẹn gặp lại!</div>
</body>
</html>`;
}

// Format giá ngắn gọn cho bill (bỏ "đ", dùng dấu chấm ngàn)
function fmtK(amount) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount || 0));
}

function formatCurrencyShort(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount || 0) + 'đ';
}

// Build VietQR EMVCo payload string (NAPAS standard)
function buildVietQRPayload(bankBin, accountNo, amount, addInfo) {
  // Helper: TLV (Tag-Length-Value) encoding
  function tlv(tag, value) {
    const len = value.length.toString().padStart(2, '0');
    return tag + len + value;
  }

  // Merchant Account Information (ID 38) - VietQR via NAPAS
  const guid = tlv('00', 'A000000727');          // NAPAS
  const beneficiaryOrg = tlv('01', tlv('00', bankBin) + tlv('01', accountNo));
  const serviceCode = tlv('02', 'QRIBFTTA');     // Interbank fund transfer
  const merchantAcct = tlv('38', guid + beneficiaryOrg + serviceCode);

  // Build payload without CRC
  let payload = '';
  payload += tlv('00', '01');                     // Payload Format Indicator
  payload += tlv('01', '12');                     // Point of Initiation: Dynamic QR
  payload += merchantAcct;
  payload += tlv('52', '5812');                   // Merchant Category Code (Restaurants)
  payload += tlv('53', '704');                    // Transaction Currency: VND
  if (amount > 0) {
    payload += tlv('54', amount.toString());      // Transaction Amount
  }
  payload += tlv('58', 'VN');                     // Country Code
  if (addInfo) {
    payload += tlv('62', tlv('08', addInfo));     // Additional Data - Purpose of Transaction
  }
  // CRC placeholder
  payload += '6304';

  // Calculate CRC-16/CCITT-FALSE
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xFFFF;
    }
  }
  return payload + crc.toString(16).toUpperCase().padStart(4, '0');
}

async function generateBillQR(order) {
  if (order.payment_method !== 'transfer') return null;

  const bankInfo = getBankSettings();
  if (!bankInfo) return null;
  const bank = BANK_LIST.find(b => b.code === bankInfo.bankCode);
  if (!bank) return null;

  const amountInt = Math.round(order.final_total);
  const addInfo = `DH${order.id}`;

  if (bank.isMomo) {
    const phone = bankInfo.momoPhone || bankInfo.accountNo;
    // Generate VietQR EMVCo payload for MoMo (scannable by all banking apps)
    const vietqrPayload = buildVietQRPayload(bank.bin, phone, amountInt, addInfo);
    const result = await window.api.generateQR(vietqrPayload);
    return {
      qrUrl: result.success ? result.data : null,
      label: `
        <div style="font-size:12px;font-weight:bold;margin-top:3px;">MoMo</div>
        <div style="font-size:12px;">STK: ${phone}</div>
      `
    };
  } else {
    // Generate VietQR EMVCo payload for bank (embedded base64, no network needed)
    const vietqrPayload = buildVietQRPayload(bank.bin, bankInfo.accountNo, amountInt, addInfo);
    const result = await window.api.generateQR(vietqrPayload);
    return {
      qrUrl: result.success ? result.data : null,
      label: `
        <div style="font-size:12px;font-weight:bold;margin-top:3px;">${bank.name}</div>
        <div style="font-size:12px;">STK: ${bankInfo.accountNo}</div>
        <div style="font-size:12px;">${bankInfo.accountName}</div>
      `
    };
  }
}

async function printOrderBill(orderId) {
  try {
    const result = await window.api.getOrderById(orderId);
    if (!result.success) {
      showToast('Không tìm thấy đơn hàng', 'error');
      return;
    }

    const config = await ensurePrinterConfig();
    if (!config.billPrinter) {
      showToast('⚠️ Chưa cài máy in Bill! Bấm ⚙️', 'warning');
      return;
    }
    const qrInfo = await generateBillQR(result.data);
    const html = generateBillHtml(result.data, qrInfo?.qrUrl, qrInfo?.label);
    const printResult = await window.api.printBill(html, config.billPrinter);

    if (printResult.success) {
      showToast('Đã in bill → ' + config.billPrinter, 'success');
    } else {
      showToast('Lỗi in bill: ' + (printResult.error || ''), 'error');
    }
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'error');
  }
}

// ==================== LABEL PRINTING - THERMAL STICKER ====================

const LABEL_PRESETS = [
  { name: '30×20mm', w: 30, h: 20 },
  { name: '40×30mm', w: 40, h: 30 },
  { name: '50×30mm', w: 50, h: 30 },
  { name: '50×40mm', w: 50, h: 40 },
  { name: '58×40mm', w: 58, h: 40 },
  { name: '80×50mm', w: 80, h: 50 },
];

function getLabelSettings() {
  try {
    const saved = localStorage.getItem('label_settings');
    return saved ? JSON.parse(saved) : { paperWidth: 40, paperHeight: 30, quantity: 1, showPrice: true, printerName: '' };
  } catch (e) { return { paperWidth: 40, paperHeight: 30, quantity: 1, showPrice: true, printerName: '' }; }
}

function saveLabelSettings(settings) {
  localStorage.setItem('label_settings', JSON.stringify(settings));
}

function getExcludedLabelProductIds() {
  try {
    const saved = localStorage.getItem('label_excluded_products');
    return saved ? JSON.parse(saved) : [];
  } catch (e) { return []; }
}

function saveExcludedLabelProductIds(ids) {
  localStorage.setItem('label_excluded_products', JSON.stringify(ids));
}

function generateLabelHtml(products, config) {
  const { quantity, showPrice } = config;
  const now = new Date();
  const dateStr = now.toLocaleDateString('vi-VN');

  let labelsHtml = '';
  for (const product of products) {
    for (let i = 0; i < quantity; i++) {
      labelsHtml += `
        <div class="label">
          <div class="label-border">
            <div class="shop-name">LÀ NHÀ - GÓP NHẶT VỊ NHÀ</div>
            <div class="separator"></div>
            <div class="product-name">${product.name}</div>
            ${product.size_name ? `<div class="size-info">Size: ${product.size_name}</div>` : ''}
            ${showPrice ? `<div class="price">${formatCurrencyShort(product.price)}</div>` : ''}
            <div class="separator"></div>
            <div class="bottom-row">
              <span class="code">${product.barcode || ('SP' + product.id)}</span>
              <span class="date">${dateStr}</span>
            </div>
          </div>
        </div>
        <div class="cut-line">✂ - - - - - - - - - - - - - - - - - - -</div>
      `;
    }
  }

  const pw = config.paperWidth || 40;
  const ph = config.paperHeight || 30;
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  @page { margin: 0; size: ${pw}mm ${ph}mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: 'Arial', sans-serif;
    width: ${pw}mm;
    color: #000;
    -webkit-print-color-adjust: exact;
  }
  .label {
    width: ${pw}mm;
    height: ${ph}mm;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2mm;
    page-break-after: always;
  }
  .label-border {
    width: 100%;
    height: 100%;
    border: 1px solid #000;
    border-radius: 3px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2mm;
    text-align: center;
    overflow: hidden;
  }
  .shop-name {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.3px;
    white-space: nowrap;
  }
  .separator {
    width: 85%;
    border-top: 1px solid #000;
    margin: 1.5px 0;
  }
  .product-name {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.15;
    margin: 1.5px 0;
    word-break: break-word;
    overflow: hidden;
  }
  .size-info {
    font-size: 9px;
    margin-top: 1px;
  }
  .price {
    font-size: 15px;
    font-weight: 600;
    margin: 1.5px 0;
  }
  .bottom-row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    font-size: 8px;
    color: #333;
  }
  .code { font-weight: 500; }
  .cut-line { display: none; }
</style>
</head><body>${labelsHtml}</body></html>`;
}

async function showPrintLabelModal(products) {
  if (!products || products.length === 0) {
    showToast('Không có sản phẩm', 'warning');
    return;
  }

  const settings = getLabelSettings();
  const excludedIds = getExcludedLabelProductIds();
  let printers = [];
  try {
    const res = await window.api.getPrinters();
    if (res.success) printers = res.data;
  } catch (e) {}

  const presetOptions = LABEL_PRESETS.map(p =>
    `<option value="${p.w}x${p.h}" ${settings.paperWidth === p.w && settings.paperHeight === p.h ? 'selected' : ''}>${p.name}</option>`
  ).join('');

  const printerOptions = printers.map(p =>
    `<option value="${p.name}" ${settings.printerName === p.name ? 'selected' : ''}>${p.displayName || p.name}${p.isDefault ? ' ★' : ''}</option>`
  ).join('');

  const productList = products.map(p => {
    const isEnabled = !excludedIds.includes(p.id);
    return `<div class="label-cfg-item" data-product-id="${p.id}" data-name="${p.name.toLowerCase()}" style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);transition:background 0.15s;">
      <label class="toggle-switch" style="flex-shrink:0;">
        <input type="checkbox" class="label-product-toggle" data-product-id="${p.id}" ${isEnabled ? 'checked' : ''}
          onchange="onLabelToggleChange()">
        <span class="toggle-slider"></span>
      </label>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
      </div>
      <div style="font-size:12px;font-weight:600;color:var(--primary);white-space:nowrap;">${formatCurrencyShort(p.price)}</div>
    </div>`;
  }).join('');

  const enabledCount = products.filter(p => !excludedIds.includes(p.id)).length;

  showModal(`
    <div class="modal-header">
      <h3><i class="fas fa-cog" style="color:var(--primary);"></i> Cài đặt in tem</h3>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div style="padding:0 20px 16px;">
      <div style="background:rgba(108,92,231,0.08);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--text-secondary);line-height:1.5;">
        <i class="fas fa-info-circle" style="color:var(--primary);"></i>
        Sản phẩm được <strong>bật</strong> sẽ tự động in tem khi thanh toán. Sản phẩm bị <strong>tắt</strong> sẽ không in tem.
      </div>

      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="position:relative;flex:1;">
          <i class="fas fa-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-secondary);font-size:12px;"></i>
          <input type="text" id="label-cfg-search" placeholder="Tìm sản phẩm..."
            oninput="filterLabelCfgProducts()"
            style="width:100%;padding:7px 10px 7px 30px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;outline:none;">
        </div>
        <button onclick="toggleAllLabelCfg()" id="label-cfg-toggle-btn"
          style="font-size:11px;padding:6px 12px;border-radius:6px;border:1px solid var(--primary);background:transparent;color:var(--primary);cursor:pointer;white-space:nowrap;font-weight:600;">
          ${enabledCount === products.length ? 'Tắt tất cả' : 'Bật tất cả'}
        </button>
      </div>

      <div style="font-size:11px;color:var(--text-secondary);font-weight:600;margin-bottom:4px;">
        <i class="fas fa-tag"></i> <span id="label-cfg-count">${enabledCount}</span>/${products.length} sản phẩm sẽ in tem
      </div>

      <div id="label-cfg-list" style="max-height:250px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-bottom:16px;">
        ${productList}
      </div>

      <div style="border-top:1px solid var(--border);padding-top:14px;">
        <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:10px;">
          <i class="fas fa-sliders-h" style="color:var(--primary);"></i> Cài đặt tem
        </div>
        <div class="form-row" style="gap:10px;">
          <div class="form-group" style="flex:1;">
            <label><i class="fas fa-ruler-combined"></i> Khổ giấy</label>
            <select class="form-control" id="label-paper-size" onchange="saveLabelSettingsFromModal()">
              ${presetOptions}
            </select>
          </div>
          <div class="form-group" style="flex:0.6;">
            <label><i class="fas fa-copy"></i> Số lượng/SP</label>
            <input class="form-control" type="number" id="label-quantity" value="${settings.quantity}" min="1" max="100" onchange="saveLabelSettingsFromModal()">
          </div>
        </div>
        <div class="form-row" style="gap:10px;">
          <div class="form-group" style="flex:1;">
            <label><i class="fas fa-print"></i> Máy in</label>
            <select class="form-control" id="label-printer" onchange="saveLabelSettingsFromModal()">
              <option value="">Mặc định (chọn khi in)</option>
              ${printerOptions}
            </select>
          </div>
          <div class="form-group" style="flex:0.6;display:flex;align-items:flex-end;padding-bottom:4px;">
            <label class="toggle-label" style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
              <input type="checkbox" id="label-show-price" ${settings.showPrice ? 'checked' : ''} onchange="saveLabelSettingsFromModal()" style="width:16px;height:16px;">
              Hiện giá
            </label>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" onclick="closeModal()">
        <i class="fas fa-check"></i> Xong
      </button>
    </div>
  `, true);

  window._labelCfgProducts = products;
}

function filterLabelCfgProducts() {
  const query = (document.getElementById('label-cfg-search')?.value || '').toLowerCase().trim();
  document.querySelectorAll('.label-cfg-item').forEach(item => {
    const name = item.dataset.name || '';
    item.style.display = (!query || name.includes(query)) ? 'flex' : 'none';
  });
}

function onLabelToggleChange() {
  const products = window._labelCfgProducts || [];
  const excludedIds = [];
  document.querySelectorAll('.label-product-toggle').forEach(cb => {
    if (!cb.checked) {
      excludedIds.push(parseInt(cb.dataset.productId));
    }
  });
  saveExcludedLabelProductIds(excludedIds);

  const enabledCount = products.length - excludedIds.length;
  const countEl = document.getElementById('label-cfg-count');
  const toggleBtn = document.getElementById('label-cfg-toggle-btn');
  if (countEl) countEl.textContent = enabledCount;
  if (toggleBtn) toggleBtn.textContent = enabledCount === products.length ? 'Tắt tất cả' : 'Bật tất cả';
}

function toggleAllLabelCfg() {
  const products = window._labelCfgProducts || [];
  const excludedIds = getExcludedLabelProductIds();
  const enabledCount = products.length - excludedIds.length;
  const shouldEnableAll = enabledCount < products.length;
  document.querySelectorAll('.label-product-toggle').forEach(cb => cb.checked = shouldEnableAll);
  onLabelToggleChange();
}

function saveLabelSettingsFromModal() {
  const sizeVal = document.getElementById('label-paper-size')?.value || '40x30';
  const [pw, ph] = sizeVal.split('x').map(Number);
  const quantity = parseInt(document.getElementById('label-quantity')?.value) || 1;
  const showPrice = document.getElementById('label-show-price')?.checked ?? true;
  const printerName = document.getElementById('label-printer')?.value || '';
  saveLabelSettings({ paperWidth: pw, paperHeight: ph, quantity, showPrice, printerName });
}

// ==================== ORDER LABEL (TEM ĐƠN HÀNG) ====================
function generateOrderLabelHtml(orderId, items) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  let labelsHtml = '';
  for (const item of items) {
    // Giá đã giảm (subtotal / quantity = giá cuối 1 đơn vị, bao gồm topping + giảm giá)
    const subtotal = item.subtotal != null ? item.subtotal : (item.price * item.quantity);
    const unitFinalPrice = Math.round(subtotal / item.quantity);
    const priceStr = new Intl.NumberFormat('vi-VN').format(unitFinalPrice) + 'đ';
    const toppings = item.toppings ? (typeof item.toppings === 'string' ? (function(){ try { return JSON.parse(item.toppings); } catch(e) { return []; } })() : item.toppings) : [];

    for (let i = 0; i < item.quantity; i++) {
      const sizeStr = item.size_name ? `(${item.size_name})` : '';
      const qtyStr = item.quantity > 1 ? `${i + 1}/${item.quantity}` : '';
      // Topping hiện tên + giá
      const toppingParts = toppings.map(t => {
        const tp = t.price ? `${t.name} +${new Intl.NumberFormat('vi-VN').format(t.price)}` : t.name;
        return tp;
      });
      const toppingStr = toppingParts.length > 0 ? toppingParts.join(', ') : '';
      const noteStr = item.note || '';
      // Combo: hiện các món bên trong
      const comboStr = item.combo_detail || '';

      labelsHtml += `
        <div class="label">
          <div class="label-header">
            <span class="shop">Là Nhà</span>
            <span class="order-id">#${orderId}</span>
          </div>
          <div class="label-line"></div>
          <div class="label-body">
            <div class="product-name">${item.product_name} ${sizeStr}</div>
            ${qtyStr ? `<div class="qty-tag">${qtyStr}</div>` : ''}
            ${comboStr ? `<div class="combo-detail">${comboStr}</div>` : ''}
            ${toppingStr ? `<div class="topping-info">+ ${toppingStr}</div>` : ''}
            ${noteStr ? `<div class="note-info">★ ${noteStr}</div>` : ''}
          </div>
          <div class="label-line"></div>
          <div class="label-footer">
            <span class="price-tag">${priceStr}</span>
            <span class="time-stamp">${timeStr}</span>
          </div>
        </div>
      `;
    }
  }

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  @page { margin: 0; size: 40mm 30mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: Arial, sans-serif;
    width: 40mm;
    color: #000;
    -webkit-print-color-adjust: exact;
  }
  .label {
    width: 40mm;
    height: 30mm;
    display: flex;
    flex-direction: column;
    padding: 1.5mm 2mm;
    page-break-after: always;
    overflow: hidden;
  }
  .label-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  .shop {
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .order-id {
    font-size: 9pt;
    font-weight: 700;
  }
  .label-line {
    border-top: 1px dashed #000;
    margin: 0.8mm 0;
    flex-shrink: 0;
  }
  .label-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    overflow: hidden;
    min-height: 0;
  }
  .product-name {
    font-size: 12pt;
    font-weight: 700;
    line-height: 1.1;
    word-break: break-word;
    max-height: 10mm;
    overflow: hidden;
  }
  .qty-tag {
    font-size: 7pt;
    font-weight: 600;
    border: 1px solid #000;
    border-radius: 2px;
    padding: 0 1.5mm;
    margin-top: 0.3mm;
  }
  .combo-detail {
    font-size: 6pt;
    font-weight: 500;
    margin-top: 0.5mm;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.2;
    color: #333;
  }
  .topping-info {
    font-size: 6.5pt;
    font-weight: 500;
    margin-top: 0.5mm;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.2;
  }
  .note-info {
    font-size: 6.5pt;
    font-weight: 600;
    margin-top: 0.3mm;
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .label-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  .price-tag {
    font-size: 9pt;
    font-weight: 700;
  }
  .time-stamp {
    font-size: 7pt;
    font-weight: 500;
  }
</style>
</head><body>${labelsHtml}</body></html>`;
}

async function printOrderLabels(orderId, cartItems) {
  if (!cartItems || cartItems.length === 0) return;

  // Lọc bỏ sản phẩm đã bị tắt in tem (combo luôn in)
  const excludedIds = getExcludedLabelProductIds();
  const filteredItems = cartItems.filter(item => item.is_combo || !excludedIds.includes(item.product_id));
  if (filteredItems.length === 0) return; // Tất cả SP đều bị tắt

  // Nếu chưa cài máy in tem → bỏ qua im lặng (user chủ ý tắt)
  const config = getPrinterConfig();
  if (!config.labelPrinter) return;

  const items = filteredItems.map(item => ({
    product_name: item.product_name,
    quantity: item.quantity,
    price: item.price || 0,
    subtotal: item.subtotal != null ? item.subtotal : (item.price * item.quantity),
    size_name: item.size_name || '',
    note: item.note || '',
    toppings: Array.isArray(item.toppings) ? JSON.stringify(item.toppings) : (item.toppings || ''),
    is_combo: item.is_combo || false,
    combo_detail: item.combo_detail || ''
  }));

  const labelSettings = getLabelSettings();
  const html = generateOrderLabelHtml(orderId, items);
  try {
    const printResult = await window.api.printLabel(html, {
      printerName: config.labelPrinter,
      paperWidth: labelSettings.paperWidth || 40,
      paperHeight: labelSettings.paperHeight || 30
    });
    if (printResult.success) {
      showToast('Đã in tem → ' + config.labelPrinter, 'success');
    } else {
      showToast('Lỗi in tem: ' + (printResult.error || ''), 'error');
    }
  } catch (e) {
    showToast('Lỗi in tem: ' + e.message, 'error');
  }
}

// ==================== PRINTER SETTINGS MODAL ====================
async function showPrinterSettingsModal() {
  const config = getPrinterConfig();
  let printers = [];
  try {
    const res = await window.api.getPrinters();
    if (res.success) printers = res.data;
  } catch (e) {}

  const printerList = printers.map(p =>
    `<div style="font-size:11px;color:var(--text-secondary);padding:2px 0;">• ${p.name} ${p.isDefault ? '(mặc định)' : ''}</div>`
  ).join('');

  const billOptions = printers.map(p =>
    `<option value="${p.name}" ${config.billPrinter === p.name ? 'selected' : ''}>${p.displayName || p.name}${p.isDefault ? ' ★' : ''}</option>`
  ).join('');

  const labelOptions = printers.map(p =>
    `<option value="${p.name}" ${config.labelPrinter === p.name ? 'selected' : ''}>${p.displayName || p.name}${p.isDefault ? ' ★' : ''}</option>`
  ).join('');

  showModal(`
    <div class="modal-header">
      <h3><i class="fas fa-print" style="color:var(--primary);"></i> Cài đặt máy in</h3>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div style="padding:15px;">
      <div style="background:rgba(108,92,231,0.1);padding:10px;border-radius:8px;margin-bottom:14px;font-size:12px;color:var(--text-secondary);">
        <i class="fas fa-info-circle" style="color:var(--primary);"></i>
        <strong>Máy in phát hiện:</strong><br>
        ${printerList || '<span style="color:var(--danger);">Không tìm thấy máy in nào!</span>'}
      </div>
      <div class="form-group">
        <label><i class="fas fa-receipt"></i> Máy in Bill (hóa đơn)</label>
        <div style="display:flex;gap:6px;">
          <select class="form-control" id="cfg-bill-printer" style="flex:1;">
            <option value="">-- Tắt in bill --</option>
            ${billOptions}
          </select>
          <button class="btn btn-sm btn-secondary" onclick="testPrint('bill')" title="In thử" style="white-space:nowrap;">
            <i class="fas fa-vial"></i> Thử
          </button>
        </div>
      </div>
      <div class="form-group">
        <label><i class="fas fa-tag"></i> Máy in Tem (nhãn sản phẩm)</label>
        <div style="display:flex;gap:6px;">
          <select class="form-control" id="cfg-label-printer" style="flex:1;">
            <option value="">-- Tắt in tem --</option>
            ${labelOptions}
          </select>
          <button class="btn btn-sm btn-secondary" onclick="testPrint('label')" title="In thử" style="white-space:nowrap;">
            <i class="fas fa-vial"></i> Thử
          </button>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="savePrinterSettingsModal()">
        <i class="fas fa-save"></i> Lưu
      </button>
    </div>
  `);
}

async function testPrint(type) {
  const printerName = type === 'bill'
    ? document.getElementById('cfg-bill-printer')?.value
    : document.getElementById('cfg-label-printer')?.value;

  if (!printerName) {
    showToast('Chọn máy in trước khi thử!', 'warning');
    return;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>@page{margin:0;size:80mm auto;}body{font-family:Arial;width:80mm;padding:5mm;text-align:center;}</style>
    </head><body>
      <h2>TEST ${type === 'bill' ? 'BILL' : 'TEM'}</h2>
      <p>Máy in: ${printerName}</p>
      <p>${new Date().toLocaleString('vi-VN')}</p>
      <p>✅ Nếu thấy tờ này = máy in OK!</p>
    </body></html>`;

  showToast(`Đang in thử → ${printerName}...`, 'info');
  try {
    const result = await window.api.printSilent(html, printerName);
    if (result.success) {
      showToast(`✅ In thử thành công → ${printerName}`, 'success');
    } else {
      showToast(`❌ Lỗi in: ${result.error || 'Không xác định'}`, 'error');
    }
  } catch (e) {
    showToast(`❌ Lỗi: ${e.message}`, 'error');
  }
}

function savePrinterSettingsModal() {
  const config = {
    billPrinter: document.getElementById('cfg-bill-printer')?.value || '',
    labelPrinter: document.getElementById('cfg-label-printer')?.value || ''
  };
  savePrinterConfig(config);
  closeModal();

  const parts = [];
  if (config.billPrinter) parts.push(`Bill→${config.billPrinter}`);
  if (config.labelPrinter) parts.push(`Tem→${config.labelPrinter}`);
  showToast('Đã lưu: ' + (parts.join(', ') || 'Tắt hết'), 'success');
}
