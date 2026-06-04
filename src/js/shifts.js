// ==================== SHIFT HISTORY PAGE ====================

async function renderShiftsPage() {
  const today = new Date().toISOString().split('T')[0];
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <h3 style="color:var(--text-secondary)"><i class="fas fa-clock"></i> Lịch sử ca làm việc</h3>
      </div>
      <div class="toolbar-right" style="display:flex;gap:8px;align-items:center;">
        <input type="date" id="shift-date-filter" class="form-control" value="${today}" style="width:170px;" onchange="filterShifts()">
        <button class="btn btn-secondary" onclick="filterShiftsAll()"><i class="fas fa-list"></i> Tất cả</button>
      </div>
    </div>
    <div class="card">
      <div id="shifts-list">
        <div class="text-center text-muted" style="padding:30px;">
          <i class="fas fa-spinner fa-spin"></i> Đang tải...
        </div>
      </div>
    </div>
  `;

  await filterShifts();
}

async function filterShifts() {
  const date = document.getElementById('shift-date-filter')?.value;
  if (!date) return;
  const result = await window.api.getShiftsByDate(date, date);
  renderShiftCards(result.success ? result.data : []);
}

async function filterShiftsAll() {
  const result = await window.api.getAllShifts(50);
  renderShiftCards(result.success ? result.data : []);
  document.getElementById('shift-date-filter').value = '';
}

async function renderShiftCards(shifts) {
  const listEl = document.getElementById('shifts-list');
  if (!shifts || shifts.length === 0) {
    listEl.innerHTML = '<div class="text-center text-muted" style="padding:30px;">Không có ca làm việc nào</div>';
    return;
  }

  const reasonLabels = {
    'expense': 'Mua nguyên liệu',
    'owner_withdraw': 'Chủ rút tiền',
    'safe_deposit': 'Rút bỏ két',
    'other_out': 'Chi phí khác',
    'other_in': 'Thu khác'
  };

  let html = '';
  for (const shift of shifts) {
    const sumResult = await window.api.getShiftSummary(shift.id);
    const s = sumResult.success ? sumResult.data : {};
    const isOpen = shift.status === 'open';
    const startStr = new Date(shift.start_time).toLocaleString('vi-VN');
    const endStr = shift.end_time ? new Date(shift.end_time).toLocaleString('vi-VN') : '';
    const cashIn = s.total_cash_in || 0;
    const cashOut = s.total_cash_out || 0;
    const expectedCash = (s.start_amount || 0) + (s.cash_total || 0) + cashIn - cashOut;

    html += `
      <div style="border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden;">
        <div onclick="toggleShiftDetail(${shift.id})" 
             style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;cursor:pointer;background:var(--surface);transition:background 0.2s;"
             onmouseover="this.style.background='var(--hover)'" onmouseout="this.style.background='var(--surface)'">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:10px;height:10px;border-radius:50%;background:${isOpen ? '#4caf50' : '#9e9e9e'};${isOpen ? 'animation:pulse 2s infinite;' : ''}"></div>
            <div>
              <div style="font-weight:600;font-size:14px;">
                ${isOpen ? '<span style="color:#4caf50;">● Đang mở — chưa chốt ca</span>' : '<span style="color:var(--text-secondary);">Đã đóng</span>'}
                <span style="margin-left:8px;color:var(--text-primary);">${shift.user_name || 'N/A'}</span>
              </div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">
                <i class="fas fa-play" style="color:#4caf50;font-size:10px;"></i> ${startStr}
                ${!isOpen ? `<span style="margin:0 6px;">→</span><i class="fas fa-stop" style="color:#f44336;font-size:10px;"></i> ${endStr}` : ''}
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:20px;">
            <div style="text-align:center;">
              <div style="font-size:11px;color:var(--text-secondary);">Đầu ca</div>
              <div style="font-size:14px;font-weight:600;color:var(--text-secondary);">${formatCurrency(s.start_amount || 0)}</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:11px;color:var(--text-secondary);">Đơn</div>
              <div style="font-size:18px;font-weight:bold;color:#4caf50;">${s.order_count || 0}</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:11px;color:var(--text-secondary);">Doanh thu</div>
              <div style="font-size:18px;font-weight:bold;color:#2196f3;">${formatCurrency(s.total_revenue || 0)}</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:11px;color:var(--text-secondary);">Két cuối</div>
              <div style="font-size:16px;font-weight:bold;color:#ff9800;">${formatCurrency(expectedCash)}</div>
            </div>
            <i class="fas fa-chevron-down" id="shift-chevron-${shift.id}" style="color:var(--text-secondary);transition:transform 0.3s;"></i>
          </div>
        </div>
        <div id="shift-detail-${shift.id}" style="display:none;padding:0 18px 14px;background:var(--bg-primary);">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px;">
            <div style="background:rgba(255,152,0,0.1);padding:10px;border-radius:8px;text-align:center;">
              <div style="font-size:11px;color:var(--text-secondary);">Tiền mặt bán</div>
              <div style="font-size:16px;font-weight:bold;color:#ff9800;">${formatCurrency(s.cash_total || 0)}</div>
            </div>
            <div style="background:rgba(156,39,176,0.1);padding:10px;border-radius:8px;text-align:center;">
              <div style="font-size:11px;color:var(--text-secondary);">Chuyển khoản</div>
              <div style="font-size:16px;font-weight:bold;color:#9c27b0;">${formatCurrency(s.transfer_total || 0)}</div>
            </div>
            <div style="background:rgba(0,150,136,0.1);padding:10px;border-radius:8px;text-align:center;">
              <div style="font-size:11px;color:var(--text-secondary);">Thu vào</div>
              <div style="font-size:16px;font-weight:bold;color:#009688;">+${formatCurrency(cashIn)}</div>
            </div>
            <div style="background:rgba(244,67,54,0.1);padding:10px;border-radius:8px;text-align:center;">
              <div style="font-size:11px;color:var(--text-secondary);">Chi/Rút ra</div>
              <div style="font-size:16px;font-weight:bold;color:#f44336;">-${formatCurrency(cashOut)}</div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:10px;padding:8px 12px;background:rgba(76,175,80,0.1);border-radius:8px;">
            <span style="color:var(--text-secondary);font-size:13px;">Tiền đầu ca: ${formatCurrency(s.start_amount || 0)}</span>
            <span style="font-weight:bold;color:#4caf50;font-size:13px;">Két cuối dự kiến: ${formatCurrency(expectedCash)}</span>
          </div>
          ${shift.note ? `<div style="margin-top:8px;padding:8px 12px;background:var(--surface);border-radius:8px;font-size:12px;color:var(--text-secondary);"><i class="fas fa-sticky-note"></i> ${shift.note}</div>` : ''}
          <div id="shift-txns-${shift.id}" style="margin-top:10px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">Thu/Chi trong ca:</div>
            <div style="font-size:12px;color:var(--text-secondary);text-align:center;padding:8px;">Đang tải...</div>
          </div>
        </div>
      </div>
    `;
  }

  listEl.innerHTML = html;
}

async function toggleShiftDetail(shiftId) {
  const detail = document.getElementById(`shift-detail-${shiftId}`);
  const chevron = document.getElementById(`shift-chevron-${shiftId}`);
  if (!detail) return;

  if (detail.style.display === 'none') {
    detail.style.display = 'block';
    chevron.style.transform = 'rotate(180deg)';
    await loadShiftTransactions(shiftId);
  } else {
    detail.style.display = 'none';
    chevron.style.transform = 'rotate(0)';
  }
}

async function loadShiftTransactions(shiftId) {
  const container = document.getElementById(`shift-txns-${shiftId}`);
  if (!container) return;

  const result = await window.api.getShiftTransactions(shiftId);
  const txns = result.success ? result.data : [];

  const reasonLabels = {
    'expense': 'Mua nguyên liệu',
    'owner_withdraw': 'Chủ rút tiền',
    'safe_deposit': 'Rút bỏ két',
    'other_out': 'Chi phí khác',
    'other_in': 'Thu khác'
  };

  if (txns.length === 0) {
    container.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">Thu/Chi trong ca:</div>
      <div style="font-size:12px;color:var(--text-secondary);text-align:center;padding:8px;border:1px dashed var(--border);border-radius:8px;">Không có giao dịch thu/chi</div>
    `;
    return;
  }

  let rows = txns.map(t => {
    const time = new Date(t.created_at).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'});
    const isOut = t.type === 'out';
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid var(--border);font-size:12px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="color:${isOut ? '#f44336' : '#4caf50'};font-weight:600;width:40px;">${isOut ? '↓ Chi' : '↑ Thu'}</span>
          <span>${reasonLabels[t.reason] || t.reason}</span>
          ${t.note ? `<span style="color:var(--text-secondary);font-size:11px;">(${t.note})</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:bold;color:${isOut ? '#f44336' : '#4caf50'};">${isOut ? '-' : '+'}${formatCurrency(t.amount)}</span>
          <span style="font-size:11px;color:var(--text-secondary);">${time}</span>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">Thu/Chi trong ca (${txns.length}):</div>
    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;max-height:200px;overflow-y:auto;">
      ${rows}
    </div>
  `;
}
