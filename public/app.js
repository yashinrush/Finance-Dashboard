/* ═══════════════════════════════════════════════════════════════
   FINANCE OS — Application Logic
   ═══════════════════════════════════════════════════════════════ */

const API = '';   // same-origin, backend serves this file

/* ── State ───────────────────────────────────────────────────── */
const S = {
  token: null,
  user:  null,
  page:  'dashboard',
  records: { data: [], total: 0, page: 1, limit: 12 },
  filters: { type: '', category: '', from: '', to: '', q: '' },
  charts: {},
  editingRecord: null,
};

/* ── Helpers ─────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n ?? 0);
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) : '—';
const fmtShort = d => d ? new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '—';
const initials = name => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) : '?';
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (S.token) headers['Authorization'] = 'Bearer ' + S.token;
  const res = await fetch(API + path, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || 'Request failed'), { status: res.status, data: json });
  return json;
}

/* ── Toast ───────────────────────────────────────────────────── */
function toast(msg, type = 'info') {
  const icons = {
    success: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
  };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${msg}</span>`;
  $('toast-container').prepend(t);
  setTimeout(() => t.remove(), 4000);
}

/* ── Auth ────────────────────────────────────────────────────── */
async function login(email, password) {
  const btn = $('login-btn');
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner"></div> Signing in…`;
  $('login-error').textContent = '';
  try {
    const data = await api('POST', '/auth/login', { email, password });
    S.token = data.token;
    S.user  = data.user;
    localStorage.setItem('fo_token', data.token);
    localStorage.setItem('fo_user',  JSON.stringify(data.user));
    showApp();
  } catch (err) {
    $('login-error').textContent = err.status === 401
      ? '⚠ Invalid email or password.'
      : '⚠ ' + (err.message || 'Login failed');
    btn.disabled = false;
    btn.innerHTML = 'Sign In';
  }
}

function logout() {
  S.token = null; S.user = null;
  localStorage.removeItem('fo_token');
  localStorage.removeItem('fo_user');
  // Destroy charts
  Object.values(S.charts).forEach(c => { try { c.destroy(); } catch(_){} });
  S.charts = {};
  $('app-shell').classList.add('hidden');
  $('login-screen').classList.remove('hidden');
  $('login-form').reset();
}

/* ── App Shell Bootstrap ─────────────────────────────────────── */
function showApp() {
  $('login-screen').classList.add('hidden');
  $('app-shell').classList.remove('hidden');
  buildSidebar();
  buildHeader();
  startClock();
  navigate('dashboard');
}

function buildSidebar() {
  const u = S.user;
  $('sb-avatar').textContent = initials(u.name || u.email);
  $('sb-name').textContent   = u.name || u.email;
  $('sb-role').textContent   = u.role.charAt(0).toUpperCase() + u.role.slice(1);

  // Show/hide admin-only items
  if (u.role === 'admin') {
    $('nav-users').classList.remove('hidden');
  } else {
    $('nav-users').classList.add('hidden');
  }
  // Show/hide analytics item (analyst + admin)
  if (u.role === 'viewer') {
    $('nav-analytics').classList.add('hidden');
  }
}

function buildHeader() {
  const u = S.user;
  const chip = $('header-role-chip');
  chip.textContent = u.role;
  chip.className = `role-chip ${u.role}`;
}

let clockTimer;
function startClock() {
  function tick() {
    const el = $('header-clock');
    if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  }
  tick();
  clockTimer = setInterval(tick, 1000);
}

/* ── Navigation ──────────────────────────────────────────────── */
function navigate(page) {
  S.page = page;
  // Hide all sections
  document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));
  // Show target
  const el = $('page-' + page);
  if (el) { el.classList.remove('hidden'); }

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });

  // Update header
  const titles = { dashboard:'Dashboard', records:'Records', analytics:'Analytics', users:'User Management' };
  $('header-page-title').textContent = titles[page] || page;

  // Load data for section
  const loaders = { dashboard: loadDashboard, records: loadRecords, analytics: loadAnalytics, users: loadUsers };
  if (loaders[page]) loaders[page]();
}

/* ══════════════════════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════════════════════ */
async function loadDashboard() {
  try {
    const [overview, categories, trends, recent] = await Promise.all([
      api('GET', '/dashboard/overview'),
      api('GET', '/dashboard/categories'),
      api('GET', '/dashboard/trends/monthly?months=7'),
      api('GET', '/dashboard/recent?limit=8'),
    ]);
    renderStatCards(overview);
    renderTrendChart(trends);
    renderDonutChart(categories);
    renderRecentActivity(recent);
  } catch(err) {
    toast('Failed to load dashboard data', 'error');
  }
}

function renderStatCards(d) {
  $('stat-income').textContent  = fmt(d.totalIncome);
  $('stat-expense').textContent = fmt(d.totalExpenses);
  $('stat-balance').textContent = fmt(d.netBalance);
  $('stat-records').textContent = d.recordCount ?? '—';

  // Simple change indicator (balance positive/negative)
  const balChg = $('stat-balance-chg');
  if (d.netBalance >= 0) {
    balChg.className = 'stat-change up';
    balChg.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M12 4l8 8H4z"/></svg> Positive`;
  } else {
    balChg.className = 'stat-change down';
    balChg.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M12 20l8-8H4z"/></svg> Negative`;
  }
}

function renderTrendChart(data) {
  const ctx = $('trend-chart').getContext('2d');
  if (S.charts.trend) S.charts.trend.destroy();

  const labels   = data.map(d => d.month);
  const incomes  = data.map(d => d.income  ?? 0);
  const expenses = data.map(d => d.expense ?? 0);

  const makeGrad = (ctx, color1, color2) => {
    const g = ctx.createLinearGradient(0, 0, 0, 280);
    g.addColorStop(0, color1); g.addColorStop(1, color2);
    return g;
  };

  S.charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomes,
          borderColor: '#10b981',
          backgroundColor: makeGrad(ctx, 'rgba(16,185,129,0.18)', 'rgba(16,185,129,0)'),
          fill: true, tension: 0.4,
          pointBackgroundColor: '#10b981',
          pointRadius: 4, pointHoverRadius: 7,
          borderWidth: 2.5,
        },
        {
          label: 'Expenses',
          data: expenses,
          borderColor: '#f43f5e',
          backgroundColor: makeGrad(ctx, 'rgba(244,63,94,0.15)', 'rgba(244,63,94,0)'),
          fill: true, tension: 0.4,
          pointBackgroundColor: '#f43f5e',
          pointRadius: 4, pointHoverRadius: 7,
          borderWidth: 2.5,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, boxWidth: 12, boxHeight: 12, borderRadius: 4, usePointStyle: true, pointStyleWidth: 10 }
        },
        tooltip: {
          backgroundColor: 'rgba(7,13,28,0.95)',
          borderColor: 'rgba(99,102,241,0.3)', borderWidth: 1,
          titleColor: '#f1f5f9', bodyColor: '#94a3b8',
          titleFont: { family: 'Inter', weight: '700' },
          bodyFont: { family: 'Inter' },
          padding: 14, cornerRadius: 12,
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}` }
        },
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#475569', font: { family: 'Inter', size: 11 } } },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#475569', font: { family: 'Inter', size: 11 }, callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(1)+'k' : v) }
        },
      },
    },
  });
}

function renderDonutChart(categories) {
  const ctx = $('donut-chart').getContext('2d');
  if (S.charts.donut) S.charts.donut.destroy();

  const top = categories.slice(0, 8).map(c => ({ ...c, total: (c.income||0) + (c.expense||0) }));
  const colors = ['#6366f1','#06b6d4','#10b981','#f59e0b','#f43f5e','#a78bfa','#38bdf8','#34d399'];

  S.charts.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: top.map(c => c.category),
      datasets: [{
        data: top.map(c => c.total),
        backgroundColor: colors,
        borderColor: 'rgba(7,13,28,0.8)',
        borderWidth: 3, hoverOffset: 8,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, boxWidth: 10, boxHeight: 10, borderRadius: 3, padding: 10, usePointStyle: true }
        },
        tooltip: {
          backgroundColor: 'rgba(7,13,28,0.95)',
          borderColor: 'rgba(99,102,241,0.3)', borderWidth: 1,
          titleColor: '#f1f5f9', bodyColor: '#94a3b8',
          titleFont: { family: 'Inter', weight: '700' },
          padding: 12, cornerRadius: 12,
          callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)}` }
        },
      },
    },
  });
}

function renderRecentActivity(items) {
  const list = $('recent-list');
  if (!items.length) { list.innerHTML = emptyState('No recent activity'); return; }
  list.innerHTML = items.map(r => `
    <div class="activity-item">
      <div class="activity-icon ${r.type}">
        ${r.type === 'income'
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>`
        }
      </div>
      <div class="activity-info">
        <div class="activity-cat">${r.category}</div>
        <div class="activity-date">${fmtDate(r.date)}${r.notes ? ' · ' + r.notes.slice(0,30) : ''}</div>
      </div>
      <div class="activity-amount ${r.type}">${r.type === 'income' ? '+' : '-'}${fmt(r.amount)}</div>
    </div>
  `).join('');
}

/* ══════════════════════════════════════════════════════════════════
   RECORDS
   ══════════════════════════════════════════════════════════════════ */
async function loadRecords() {
  const f = S.filters;
  const p = S.records;
  const skip = (p.page - 1) * p.limit;
  let url = `/records?limit=${p.limit}&skip=${skip}`;
  if (f.type)     url += `&type=${f.type}`;
  if (f.category) url += `&category=${encodeURIComponent(f.category)}`;
  if (f.from)     url += `&from=${f.from}`;
  if (f.to)       url += `&to=${f.to}`;

  $('records-tbody').innerHTML = skeletonRows(12, 7);
  try {
    const data = await api('GET', url);
    p.data  = data.records;
    p.total = data.total;
    renderRecordsTable(data.records);
    renderPagination(data.total);
    $('records-count-badge').textContent = data.total;
  } catch(err) {
    toast('Failed to load records', 'error');
    $('records-tbody').innerHTML = `<tr><td colspan="7">${emptyState('Could not load records')}</td></tr>`;
  }
}

function renderRecordsTable(rows) {
  const canEdit = ['admin'].includes(S.user?.role);
  if (!rows.length) {
    $('records-tbody').innerHTML = `<tr><td colspan="7"><div class="empty-state">${svgEmpty()}<p>No records found matching your filters.</p></div></td></tr>`;
    return;
  }
  $('records-tbody').innerHTML = rows.map(r => `
    <tr>
      <td class="truncate" style="max-width:140px;color:var(--text-2);font-size:0.75rem;font-family:monospace">${r._id.slice(0,8)}…</td>
      <td><span class="badge badge-${r.type}">${r.type === 'income'
        ? `<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`
        : `<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><path d="M12 5v14M5 12l7 7 7-7"/></svg>`
      } ${r.type}</span></td>
      <td style="text-transform:capitalize;font-weight:600">${r.category}</td>
      <td class="font-bold ${r.type === 'income' ? 'text-success' : 'text-danger'}">${r.type === 'income' ? '+' : '-'}${fmt(r.amount)}</td>
      <td style="color:var(--text-2)">${fmtDate(r.date)}</td>
      <td style="color:var(--text-2);max-width:180px" class="truncate">${r.notes || '—'}</td>
      <td>
        <div style="display:flex;gap:6px">
          ${canEdit ? `
            <button class="btn btn-ghost btn-icon btn-sm" onclick="openEditRecord('${r._id}')" title="Edit">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
            </button>
            <button class="btn btn-danger btn-icon btn-sm" onclick="deleteRecord('${r._id}')" title="Delete">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          ` : '<span class="text-xs text-muted">Read-only</span>'}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderPagination(total) {
  const p = S.records;
  const totalPages = Math.ceil(total / p.limit) || 1;
  $('pagination-info').textContent = `Showing ${Math.min((p.page-1)*p.limit+1, total)}–${Math.min(p.page*p.limit, total)} of ${total}`;

  const btns = $('pagination-btns');
  const pages = [];
  // prev
  pages.push(`<button class="page-btn" onclick="goPage(${p.page-1})" ${p.page<=1?'disabled':''}>‹</button>`);
  // page numbers
  let start = Math.max(1, p.page-2), end = Math.min(totalPages, start+4);
  start = Math.max(1, end-4);
  for (let i = start; i <= end; i++) {
    pages.push(`<button class="page-btn ${i===p.page?'active':''}" onclick="goPage(${i})">${i}</button>`);
  }
  // next
  pages.push(`<button class="page-btn" onclick="goPage(${p.page+1})" ${p.page>=totalPages?'disabled':''}>›</button>`);
  btns.innerHTML = pages.join('');
}

function goPage(n) {
  const totalPages = Math.ceil(S.records.total / S.records.limit) || 1;
  S.records.page = clamp(n, 1, totalPages);
  loadRecords();
}

function applyFilters() {
  S.filters.type     = $('filter-type').value;
  S.filters.category = $('filter-category').value;
  S.filters.from     = $('filter-from').value;
  S.filters.to       = $('filter-to').value;
  S.records.page     = 1;
  loadRecords();
}

function clearFilters() {
  $('filter-type').value     = '';
  $('filter-category').value = '';
  $('filter-from').value     = '';
  $('filter-to').value       = '';
  S.filters = { type:'', category:'', from:'', to:'', q:'' };
  S.records.page = 1;
  loadRecords();
}

/* ── Record CRUD ── */
function openAddRecord() {
  S.editingRecord = null;
  $('rec-modal-title').textContent = 'Add New Record';
  $('rec-modal-icon').innerHTML = svgPlus();
  $('rec-form').reset();
  $('rec-id').value = '';
  $('rec-date').value = new Date().toISOString().split('T')[0];
  showModal('record-modal');
}

async function openEditRecord(id) {
  const r = S.records.data.find(x => x._id === id);
  if (!r) return;
  S.editingRecord = r;
  $('rec-modal-title').textContent = 'Edit Record';
  $('rec-modal-icon').innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>`;
  $('rec-id').value       = r._id;
  $('rec-amount').value   = r.amount;
  $('rec-type').value     = r.type;
  $('rec-category').value = r.category;
  $('rec-date').value     = r.date ? r.date.split('T')[0] : '';
  $('rec-notes').value    = r.notes || '';
  showModal('record-modal');
}

async function saveRecord() {
  const btn = $('rec-save-btn');
  const id  = $('rec-id').value;
  const body = {
    amount:   parseFloat($('rec-amount').value),
    type:     $('rec-type').value,
    category: $('rec-category').value.trim().toLowerCase(),
    date:     $('rec-date').value,
    notes:    $('rec-notes').value.trim(),
  };

  if (!body.amount || !body.type || !body.category || !body.date) {
    toast('Please fill all required fields', 'error'); return;
  }

  btn.disabled = true;
  btn.innerHTML = `<div class="spinner"></div> Saving…`;

  try {
    if (id) {
      await api('PATCH', `/records/${id}`, body);
      toast('Record updated successfully!', 'success');
    } else {
      await api('POST', '/records', body);
      toast('Record created successfully!', 'success');
    }
    hideModal('record-modal');
    loadRecords();
    // Refresh dashboard stat if on dashboard
  } catch(err) {
    const msg = err.data?.details
      ? Object.values(err.data.details)[0]
      : (err.message || 'Save failed');
    toast(msg, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Save Record';
  }
}

async function deleteRecord(id) {
  const confirmed = await confirmDialog(
    'Delete Record',
    'This record will be permanently removed. This action cannot be undone.'
  );
  if (!confirmed) return;
  try {
    await api('DELETE', `/records/${id}`);
    toast('Record deleted', 'success');
    loadRecords();
  } catch(err) {
    toast(err.message || 'Delete failed', 'error');
  }
}

/* ══════════════════════════════════════════════════════════════════
   ANALYTICS
   ══════════════════════════════════════════════════════════════════ */
async function loadAnalytics() {
  try {
    const [categories, trends12, insights] = await Promise.all([
      api('GET', '/dashboard/categories'),
      api('GET', '/dashboard/trends/monthly?months=12'),
      api('GET', '/dashboard/insights').catch(() => null),
    ]);
    renderCategoryChart(categories);
    renderTrends12Chart(trends12);
    if (insights) renderInsights(insights);
    else $('insights-grid').innerHTML = `<div class="insight-card" style="grid-column:1/-1;text-align:center;color:var(--text-3)">Analyst or Admin role required for insights.</div>`;
    renderCategoryBars(categories);
  } catch(err) {
    toast('Failed to load analytics', 'error');
  }
}

function renderCategoryChart(cats) {
  const ctx = $('cat-chart').getContext('2d');
  if (S.charts.cat) S.charts.cat.destroy();
  const top = cats.slice(0,10).map(c => ({ ...c, total: (c.income||0) + (c.expense||0) }));
  const colors = ['#6366f1','#06b6d4','#10b981','#f59e0b','#f43f5e','#a78bfa','#38bdf8','#34d399','#fb7185','#fcd34d'];
  S.charts.cat = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(c => c.category),
      datasets: [{
        label: 'Total',
        data: top.map(c => c.total),
        backgroundColor: colors,
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: true, indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(7,13,28,0.95)',
          borderColor: 'rgba(99,102,241,0.3)', borderWidth: 1,
          titleColor: '#f1f5f9', bodyColor: '#94a3b8',
          padding: 12, cornerRadius: 12,
          callbacks: { label: ctx => ` ${fmt(ctx.raw)}` }
        },
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#475569', font: { family:'Inter',size:11 }, callback: v => '$'+(v>=1000?(v/1000).toFixed(1)+'k':v) } },
        y: { grid: { display: false }, ticks: { color: '#94a3b8', font: { family:'Inter',size:12 } } },
      },
    },
  });
}

function renderTrends12Chart(data) {
  const ctx = $('trends12-chart').getContext('2d');
  if (S.charts.trends12) S.charts.trends12.destroy();

  S.charts.trends12 = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.month),
      datasets: [
        { label:'Income',   data: data.map(d=>d.income  ??0), borderColor:'#10b981', fill:false, tension:0.4, pointRadius:3, borderWidth:2.5 },
        { label:'Expenses', data: data.map(d=>d.expense ??0), borderColor:'#f43f5e', fill:false, tension:0.4, pointRadius:3, borderWidth:2.5 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      interaction: { mode:'index', intersect:false },
      plugins: {
        legend: { labels: { color:'#94a3b8', font:{family:'Inter',size:12}, boxWidth:12, usePointStyle:true, pointStyleWidth:10 } },
        tooltip: {
          backgroundColor:'rgba(7,13,28,0.95)', borderColor:'rgba(99,102,241,0.3)', borderWidth:1,
          titleColor:'#f1f5f9', bodyColor:'#94a3b8', padding:12, cornerRadius:12,
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}` }
        },
      },
      scales: {
        x: { grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#475569',font:{family:'Inter',size:11}} },
        y: { grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#475569',font:{family:'Inter',size:11}, callback: v=>'$'+(v>=1000?(v/1000).toFixed(1)+'k':v)} },
      },
    },
  });
}

function renderInsights(d) {
  $('ins-ratio').textContent   = d.expenseToIncomeRatio ?? '—';
  // Calculate avg from last3MonthsTrend if available
  const trend = d.last3MonthsTrend || [];
  const activeMonths = trend.filter(m => m.income > 0 || m.expense > 0).length || 1;
  const avgInc = trend.reduce((s,m)=>s+(m.income||0), 0) / activeMonths;
  const avgExp = trend.reduce((s,m)=>s+(m.expense||0), 0) / activeMonths;
  $('ins-avg-inc').textContent = fmt(avgInc);
  $('ins-avg-exp').textContent = fmt(avgExp);
  $('ins-top-cat').textContent = d.topExpenseCategories?.[0]?.category ?? '—';
  $('ins-top-inc').textContent = d.topIncomeCategories?.[0]?.category  ?? '—';
  $('ins-months').textContent  = trend.length || '—';
}

function renderCategoryBars(cats) {
  const withTotals = cats.slice(0,12).map(c => ({ ...c, total: (c.income||0) + (c.expense||0) }));
  const max = Math.max(...withTotals.map(c => c.total), 1);
  const container = $('cat-bars');
  container.innerHTML = withTotals.map(c => `
    <div class="cat-bar-row">
      <div class="cat-bar-info">
        <span class="cat-bar-name">${c.category}</span>
        <span class="cat-bar-val">${fmt(c.total)}</span>
      </div>
      <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${(c.total/max*100).toFixed(1)}%"></div></div>
    </div>
  `).join('');
}

/* ══════════════════════════════════════════════════════════════════
   USERS
   ══════════════════════════════════════════════════════════════════ */
async function loadUsers() {
  $('users-tbody').innerHTML = skeletonRows(5, 5);
  try {
    const data = await api('GET', '/users');
    renderUsersTable(data.users);
    $('users-count-badge').textContent = data.users.length;
  } catch(err) {
    toast('Failed to load users', 'error');
    $('users-tbody').innerHTML = `<tr><td colspan="5">${emptyState('Access denied or failed')}</td></tr>`;
  }
}

function renderUsersTable(users) {
  if (!users.length) { $('users-tbody').innerHTML = `<tr><td colspan="5"><div class="empty-state">${svgEmpty()}<p>No users found.</p></div></td></tr>`; return; }
  $('users-tbody').innerHTML = users.map(u => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="user-avatar" style="width:34px;height:34px;font-size:0.8rem;border-radius:10px">${initials(u.name||u.email)}</div>
          <div>
            <div style="font-weight:600;font-size:0.875rem">${u.name || '—'}</div>
            <div style="color:var(--text-2);font-size:0.75rem">${u.email}</div>
          </div>
        </div>
      </td>
      <td><span class="badge badge-${u.role}">${u.role}</span></td>
      <td><span class="badge badge-${u.status}">${u.status}</span></td>
      <td style="color:var(--text-2);font-size:0.8rem">${fmtDate(u.createdAt)}</td>
      <td>
        <div style="display:flex;gap:8px;align-items:center">
          <select class="filter-input" style="padding:6px 10px;font-size:0.78rem" onchange="updateUserRole('${u._id}',this.value)" ${u._id === S.user?.id ? 'disabled' : ''}>
            <option value="admin"   ${u.role==='admin'   ?'selected':''}>Admin</option>
            <option value="analyst" ${u.role==='analyst' ?'selected':''}>Analyst</option>
            <option value="viewer"  ${u.role==='viewer'  ?'selected':''}>Viewer</option>
          </select>
          ${u._id !== S.user?.id && u.status === 'active' ? `
            <button class="btn btn-danger btn-sm" onclick="deactivateUser('${u._id}','${u.name||u.email}')">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Deactivate
            </button>
          ` : u.status === 'inactive' ? `<span class="badge badge-inactive">Inactive</span>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

async function updateUserRole(id, role) {
  try {
    await api('PATCH', `/users/${id}`, { role });
    toast(`Role updated to ${role}`, 'success');
    loadUsers();
  } catch(err) {
    toast(err.message || 'Update failed', 'error');
    loadUsers(); // re-render to reset select
  }
}

async function deactivateUser(id, name) {
  const ok = await confirmDialog('Deactivate User', `Deactivate <strong>${name}</strong>? They will no longer be able to log in.`);
  if (!ok) return;
  try {
    await api('DELETE', `/users/${id}`);
    toast(`User deactivated`, 'success');
    loadUsers();
  } catch(err) {
    toast(err.message || 'Failed', 'error');
  }
}

/* ══════════════════════════════════════════════════════════════════
   MODALS
   ══════════════════════════════════════════════════════════════════ */
function showModal(id) {
  $('modal-overlay').classList.remove('hidden');
  document.querySelectorAll('.modal-pane').forEach(m => m.classList.add('hidden'));
  $(id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function hideModal(id) {
  $('modal-overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

let resolveConfirm;
function confirmDialog(title, text) {
  return new Promise(resolve => {
    resolveConfirm = resolve;
    $('confirm-title').textContent = title;
    $('confirm-text').innerHTML = text;
    showModal('confirm-modal');
  });
}
function confirmYes() { hideModal('confirm-modal'); resolveConfirm?.(true); }
function confirmNo()  { hideModal('confirm-modal'); resolveConfirm?.(false); }

/* ── Misc helpers ── */
function emptyState(msg) {
  return `<div class="empty-state">${svgEmpty()}<p>${msg}</p></div>`;
}
function svgEmpty() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 15s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>`;
}
function svgPlus() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>`;
}
function skeletonRows(rows, cols) {
  return Array.from({length: rows}, () =>
    `<tr>${Array.from({length:cols},(_,i)=>`<td><div class="skeleton" style="height:16px;width:${[90,70,80,65,75,60,50][i]||70}%"></div></td>`).join('')}</tr>`
  ).join('');
}

/* ══════════════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  // Try restoring session
  const token = localStorage.getItem('fo_token');
  const user  = JSON.parse(localStorage.getItem('fo_user') || 'null');
  if (token && user) {
    S.token = token; S.user = user;
    // Verify token is still valid
    api('GET', '/auth/me').then(data => {
      S.user = data.user;
      localStorage.setItem('fo_user', JSON.stringify(data.user));
      showApp();
    }).catch(() => {
      localStorage.removeItem('fo_token'); localStorage.removeItem('fo_user');
    });
  }

  // Login form
  $('login-form').addEventListener('submit', e => {
    e.preventDefault();
    login($('login-email').value.trim(), $('login-password').value);
  });

  // Keyboard shortcut: Escape closes modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideModal();
  });

  // Click outside modal
  $('modal-overlay').addEventListener('click', e => {
    if (e.target === $('modal-overlay')) hideModal();
  });

  // Demo credentials quick-fill
  window.fillDemo = (email, pass) => {
    $('login-email').value    = email;
    $('login-password').value = pass;
  };
});

// Expose to HTML inline handlers
window.navigate       = navigate;
window.logout         = logout;
window.openAddRecord  = openAddRecord;
window.openEditRecord = openEditRecord;
window.saveRecord     = saveRecord;
window.deleteRecord   = deleteRecord;
window.applyFilters   = applyFilters;
window.clearFilters   = clearFilters;
window.goPage         = goPage;
window.updateUserRole = updateUserRole;
window.deactivateUser = deactivateUser;
window.confirmYes     = confirmYes;
window.confirmNo      = confirmNo;
window.showModal      = showModal;
window.hideModal      = hideModal;
