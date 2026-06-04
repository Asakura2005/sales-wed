// ==================== STATISTICS ====================
let revenueChart = null;
let topProductsChart = null;

async function renderStatsPage() {
  const container = document.getElementById('page-container');
  const currentYear = new Date().getFullYear();

  container.innerHTML = `
    <div class="toolbar" style="display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;gap:4px;align-items:center;">
        <div style="display:inline-flex;border-radius:8px;overflow:hidden;border:1px solid var(--border);">
          <button class="stats-period-btn active" id="stats-btn-today" onclick="setStatsPeriod('today')">Hôm nay</button>
          <button class="stats-period-btn" id="stats-btn-week" onclick="setStatsPeriod('week')">7 ngày</button>
          <button class="stats-period-btn" id="stats-btn-month" onclick="setStatsPeriod('month')">Tháng này</button>
        </div>
        <span style="color:var(--border);margin:0 6px;">|</span>
        <input type="date" id="stats-date-from" class="form-control" value="${getToday()}" style="width:140px;font-size:12px;">
        <span style="color:var(--text-secondary);font-size:12px;">→</span>
        <input type="date" id="stats-date-to" class="form-control" value="${getToday()}" style="width:140px;font-size:12px;">
        <button class="btn btn-sm btn-secondary" onclick="setStatsPeriod('custom')"><i class="fas fa-filter"></i></button>
      </div>
    </div>

    <div class="stat-cards" id="stats-summary"></div>

    <div class="charts-grid">
      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <h3 class="card-title"><i class="fas fa-chart-bar"></i> Doanh thu</h3>
          <span id="stats-chart-label" style="font-size:12px;color:var(--text-secondary);"></span>
        </div>
        <div class="chart-container">
          <canvas id="revenue-chart"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-trophy"></i> Top sản phẩm</h3>
        </div>
        <div class="chart-container">
          <canvas id="top-products-chart"></canvas>
        </div>
      </div>
    </div>

    <div class="card mt-4">
      <div class="card-header">
        <h3 class="card-title"><i class="fas fa-table"></i> Chi tiết theo ngày</h3>
      </div>
      <div class="table-container">
        <table>
          <thead><tr><th>Ngày</th><th>Số đơn</th><th>Doanh thu</th></tr></thead>
          <tbody id="stats-daily-table"></tbody>
        </table>
      </div>
    </div>
  `;

  // Add inline styles for period buttons
  addStatsPeriodStyles();
  setStatsPeriod('today');
}

function addStatsPeriodStyles() {
  if (document.getElementById('stats-period-styles')) return;
  const style = document.createElement('style');
  style.id = 'stats-period-styles';
  style.textContent = `
    .stats-period-btn {
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      transition: all 0.2s;
      border-right: 1px solid var(--border);
    }
    .stats-period-btn:last-child { border-right: none; }
    .stats-period-btn:hover { background: var(--hover); color: var(--text-primary); }
    .stats-period-btn.active {
      background: var(--primary);
      color: white;
    }
  `;
  document.head.appendChild(style);
}

function setStatsPeriod(period) {
  const today = new Date();
  let from, to;

  if (period === 'today') {
    from = to = getToday();
  } else if (period === 'week') {
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);
    from = weekAgo.toISOString().split('T')[0];
    to = getToday();
  } else if (period === 'month') {
    from = getFirstDayOfMonth();
    to = getToday();
  } else {
    from = document.getElementById('stats-date-from').value;
    to = document.getElementById('stats-date-to').value;
  }

  document.getElementById('stats-date-from').value = from;
  document.getElementById('stats-date-to').value = to;

  // Update active button
  document.querySelectorAll('.stats-period-btn').forEach(btn => btn.classList.remove('active'));
  if (period !== 'custom') {
    const btn = document.getElementById(`stats-btn-${period}`);
    if (btn) btn.classList.add('active');
  }

  loadStats();
}

async function loadStats() {
  const dateFrom = document.getElementById('stats-date-from').value;
  const dateTo = document.getElementById('stats-date-to').value;

  const revenueResult = await window.api.getRevenue(dateFrom, dateTo);
  const topResult = await window.api.getTopProducts(dateFrom, dateTo, 10);

  if (revenueResult.success) {
    const data = revenueResult.data;
    const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
    const totalOrders = data.reduce((sum, d) => sum + d.orders, 0);
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    document.getElementById('stats-summary').innerHTML = `
      <div class="stat-card revenue">
        <div class="stat-icon"><i class="fas fa-money-bill-trend-up"></i></div>
        <div class="stat-info">
          <h3>${formatCurrency(totalRevenue)}</h3>
          <p>Tổng doanh thu</p>
        </div>
      </div>
      <div class="stat-card orders">
        <div class="stat-icon"><i class="fas fa-receipt"></i></div>
        <div class="stat-info">
          <h3>${totalOrders}</h3>
          <p>Tổng đơn hàng</p>
        </div>
      </div>
      <div class="stat-card products">
        <div class="stat-icon"><i class="fas fa-calculator"></i></div>
        <div class="stat-info">
          <h3>${formatCurrency(avgOrder)}</h3>
          <p>Trung bình/đơn</p>
        </div>
      </div>
    `;

    // Revenue chart - daily bars
    renderRevenueChart(data, dateFrom, dateTo);

    // Daily table
    const tbody = document.getElementById('stats-daily-table');
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Không có dữ liệu</td></tr>';
    } else {
      tbody.innerHTML = data.map(d => `
        <tr>
          <td>${formatDate(d.date)}</td>
          <td>${d.orders}</td>
          <td class="text-success text-bold">${formatCurrency(d.revenue)}</td>
        </tr>
      `).join('');
    }
  }

  if (topResult.success && topResult.data.length > 0) {
    renderTopProductsChart(topResult.data);
  }
}

function renderRevenueChart(data, dateFrom, dateTo) {
  const ctx = document.getElementById('revenue-chart');
  if (!ctx) return;

  if (revenueChart) revenueChart.destroy();

  const label = document.getElementById('stats-chart-label');
  if (label) label.textContent = `${formatDate(dateFrom)} → ${formatDate(dateTo)}`;

  // Fill all dates in range, even days with no orders
  const dataMap = {};
  data.forEach(d => { dataMap[d.date] = d; });

  const allDays = [];
  const start = new Date(dateFrom);
  const end = new Date(dateTo);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split('T')[0];
    allDays.push({
      date: key,
      revenue: dataMap[key] ? dataMap[key].revenue : 0,
      orders: dataMap[key] ? dataMap[key].orders : 0
    });
  }

  const labels = allDays.map(d => {
    const date = new Date(d.date);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  });
  const values = allDays.map(d => d.revenue);

  revenueChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Doanh thu',
        data: values,
        backgroundColor: values.map(v => v > 0 ? 'rgba(108, 92, 231, 0.7)' : 'rgba(108, 92, 231, 0.1)'),
        borderColor: 'rgba(108, 92, 231, 1)',
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const d = allDays[items[0].dataIndex];
              return formatDate(d.date);
            },
            label: (ctx) => `Doanh thu: ${formatCurrency(ctx.raw)}`,
            afterLabel: (ctx) => {
              const d = allDays[ctx.dataIndex];
              return `Số đơn: ${d.orders}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (val) => formatCurrency(val),
            color: '#A0A0B8',
            font: { size: 11 }
          },
          grid: { color: 'rgba(45,45,68,0.5)' }
        },
        x: {
          ticks: { color: '#A0A0B8', font: { size: 11 } },
          grid: { display: false }
        }
      }
    }
  });
}

function renderTopProductsChart(data) {
  const ctx = document.getElementById('top-products-chart');
  if (!ctx) return;

  if (topProductsChart) topProductsChart.destroy();

  const colors = [
    '#6C5CE7', '#00CEC9', '#FD79A8', '#FDCB6E', '#74B9FF',
    '#A29BFE', '#55EFC4', '#E17055', '#00B894', '#D63031'
  ];

  topProductsChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.product_name),
      datasets: [{
        data: data.map(d => d.total_revenue),
        backgroundColor: colors.slice(0, data.length),
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#A0A0B8',
            padding: 12,
            usePointStyle: true,
            font: { size: 11 }
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}`
          }
        }
      }
    }
  });
}
