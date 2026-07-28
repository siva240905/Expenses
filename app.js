/* ==========================================================================
   Personal Expense Tracker - Application Logic
   ========================================================================== */

// --- Application State ---
let state = {
  transactions: [],
  monthlySavings: 0,
  gistId: '4e9d3322f1da9f4a2ed6d79374937944',
  gistToken: '',
  isAdminLoggedIn: false,
  adminPin: '1234',
  currentFormType: 'expense',
  editingTxId: null
};

// --- Storage Keys ---
const STORAGE_KEY = 'smart_expense_tracker_data_v1';
const GIST_ID_STORAGE = 'smart_expense_tracker_gist_id';
const GIST_TOKEN_STORAGE = 'smart_expense_tracker_gist_token';
const ADMIN_SESSION_STORAGE = 'smart_expense_tracker_admin_session';

let cloudSyncInterval = null;

// --- Category Configuration & Visual Mapping ---
const CATEGORY_MAP = {
  Food: { icon: 'fa-utensils', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  Transportation: { icon: 'fa-car', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  Housing: { icon: 'fa-house-chimney', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
  Shopping: { icon: 'fa-bag-shopping', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
  Entertainment: { icon: 'fa-gamepad', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
  Health: { icon: 'fa-heart-pulse', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  Education: { icon: 'fa-graduation-cap', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)' },
  Income: { icon: 'fa-money-bill-trend-up', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
  Other: { icon: 'fa-ellipsis', color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' }
};

// --- Chart Instances ---
let categoryChartInstance = null;
let trendChartInstance = null;

// --- Initialize App on DOM Content Loaded ---
document.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();
  initCloudDatabaseSync();

  // Set default date input to today
  document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];

  initEventListeners();
  updateAdminUiState();
  renderApp();
});

// --- LocalStorage Operations ---
function loadFromLocalStorage() {
  try {
    const savedGistId = localStorage.getItem(GIST_ID_STORAGE);
    state.gistId = savedGistId || '4e9d3322f1da9f4a2ed6d79374937944';

    const savedGistToken = localStorage.getItem(GIST_TOKEN_STORAGE);
    if (savedGistToken) state.gistToken = savedGistToken;

    const savedAdminSession = sessionStorage.getItem(ADMIN_SESSION_STORAGE);
    if (savedAdminSession === 'true') state.isAdminLoggedIn = true;

    const rawData = localStorage.getItem(STORAGE_KEY);
    if (rawData) {
      const parsed = JSON.parse(rawData);
      state.transactions = parsed.transactions || [];
      state.monthlySavings = typeof parsed.monthlySavings !== 'undefined' ? parsed.monthlySavings : 0;
    } else {
      seedDemoData(false);
    }
  } catch (err) {
    console.error('Failed to parse LocalStorage data:', err);
    seedDemoData(false);
  }
}

function saveToLocalStorage(triggerCloudSync = true) {
  try {
    const payload = {
      transactions: state.transactions,
      monthlySavings: state.monthlySavings,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    if (state.gistId) localStorage.setItem(GIST_ID_STORAGE, state.gistId);
    if (state.gistToken) localStorage.setItem(GIST_TOKEN_STORAGE, state.gistToken);
    
    if (triggerCloudSync && state.gistId && state.gistToken) {
      syncToCloudDatabase();
    }
  } catch (err) {
    showToast('Failed to auto-save to browser storage!', 'danger');
  }
}

// --- GitHub Gist Database Synchronization Engine ---
function initCloudDatabaseSync() {
  syncFromCloudDatabase();

  window.addEventListener('focus', syncFromCloudDatabase);
  if (!cloudSyncInterval) {
    cloudSyncInterval = setInterval(syncFromCloudDatabase, 30000);
  }
}

async function syncFromCloudDatabase() {
  if (!state.gistId) {
    updateSyncPillStatus('unconfigured');
    return;
  }
  try {
    updateSyncPillStatus('syncing');
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (state.gistToken) {
      headers['Authorization'] = `token ${state.gistToken}`;
    }

    const res = await fetch(`https://api.github.com/gists/${state.gistId}`, {
      method: 'GET',
      headers: headers
    });

    if (res.ok) {
      const gistData = await res.json();
      const files = gistData.files;
      const fileKey = files['expenses.json'] ? 'expenses.json' : Object.keys(files)[0];

      if (fileKey && files[fileKey]) {
        const content = JSON.parse(files[fileKey].content);
        let changed = false;
        if (Array.isArray(content.transactions)) {
          state.transactions = content.transactions;
          changed = true;
        }
        if (typeof content.monthlySavings !== 'undefined') {
          state.monthlySavings = content.monthlySavings;
          changed = true;
        }
        if (changed) {
          saveToLocalStorage(false);
          renderApp();
        }
        updateSyncPillStatus('online');
      }
    } else {
      updateSyncPillStatus('offline');
    }
  } catch (err) {
    console.warn('GitHub Gist fetch error:', err);
    updateSyncPillStatus('offline');
  }
}

async function syncToCloudDatabase() {
  if (!state.gistId || !state.gistToken) {
    updateSyncPillStatus('unconfigured');
    return;
  }
  try {
    updateSyncPillStatus('syncing');
    const payload = {
      transactions: state.transactions,
      monthlySavings: state.monthlySavings,
      updatedAt: new Date().toISOString()
    };

    const res = await fetch(`https://api.github.com/gists/${state.gistId}`, {
      method: 'PATCH',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${state.gistToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: {
          'expenses.json': {
            content: JSON.stringify(payload, null, 2)
          }
        }
      })
    });

    if (res.ok) {
      updateSyncPillStatus('online');
    } else {
      updateSyncPillStatus('offline');
    }
  } catch (err) {
    console.warn('GitHub Gist push error:', err);
    updateSyncPillStatus('offline');
  }
}

function updateSyncPillStatus(status) {
  const pill = document.getElementById('sync-status-pill');
  if (!pill) return;
  
  if (status === 'online') {
    pill.style.color = '#10b981';
    pill.innerHTML = `<i class="fa-brands fa-github"></i> Gist: Active`;
  } else if (status === 'syncing') {
    pill.style.color = '#3b82f6';
    pill.innerHTML = `<i class="fa-solid fa-arrows-rotate fa-spin"></i> Syncing...`;
  } else if (status === 'unconfigured') {
    pill.style.color = '#f59e0b';
    pill.innerHTML = `<i class="fa-brands fa-github"></i> Sync: Setup Gist`;
  } else {
    pill.style.color = '#ef4444';
    pill.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Gist: Offline`;
  }
}

// --- Seed Sample Data ---
function seedDemoData(notify = true) {
  state.transactions = [
    { id: 'tx-1', date: '2026-07-24', category: 'Transportation', note: 'return home', method: 'Bank Transfer', amount: 50, type: 'expense' },
    { id: 'tx-2', date: '2026-07-23', category: 'Transportation', note: 'Petrol', method: 'Bank Transfer', amount: 200, type: 'expense' },
    { id: 'tx-3', date: '2026-07-23', category: 'Food', note: 'Snack', method: 'Bank Transfer', amount: 15, type: 'expense' },
    { id: 'tx-4', date: '2026-07-23', category: 'Food', note: 'Grocery', method: 'Bank Transfer', amount: 68, type: 'expense' },
    { id: 'tx-5', date: '2026-07-23', category: 'Food', note: 'Breakfast', method: 'Bank Transfer', amount: 18, type: 'expense' },
    { id: 'tx-6', date: '2026-07-23', category: 'Food', note: 'Dinner', method: 'Bank Transfer', amount: 55, type: 'expense' },
    { id: 'tx-7', date: '2026-07-22', category: 'Housing', note: 'rice and oil', method: 'Bank Transfer', amount: 352, type: 'expense' },
    { id: 'tx-8', date: '2026-07-22', category: 'Food', note: 'Breakfast', method: 'Bank Transfer', amount: 65, type: 'expense' },
    { id: 'tx-9', date: '2026-07-21', category: 'Food', note: 'dinner', method: 'Bank Transfer', amount: 97, type: 'expense' },
    { id: 'tx-10', date: '2026-07-21', category: 'Shopping', note: 'Brush', method: 'Bank Transfer', amount: 75, type: 'expense' },
    { id: 'tx-11', date: '2026-07-20', category: 'Food', note: 'Dinner', method: 'Bank Transfer', amount: 35, type: 'expense' },
    { id: 'tx-12', date: '2026-07-20', category: 'Housing', note: 'RENT', method: 'Bank Transfer', amount: 5000, type: 'expense' },
    { id: 'tx-13', date: '2026-07-19', category: 'Income', note: 'house', method: 'Bank Transfer', amount: 9000, type: 'income' }
  ];
  state.monthlySavings = 0;
  saveToLocalStorage();
  renderApp();
  if (notify) showToast('Loaded your 13 saved transaction records!', 'success');
}

// --- Render Core App ---
function renderApp() {
  calculateMetrics();
  renderTransactionsTable();
  renderCharts();
}

// --- Metric Calculations ---
function calculateMetrics() {
  let totalIncome = 0;
  let totalExpense = 0;

  state.transactions.forEach(tx => {
    const val = parseFloat(tx.amount) || 0;
    if (tx.type === 'income') {
      totalIncome += val;
    } else {
      totalExpense += val;
    }
  });

  const netBalance = totalIncome - totalExpense;

  // DOM Elements
  document.getElementById('metric-balance').innerText = formatCurrency(netBalance);
  document.getElementById('metric-income').innerText = formatCurrency(totalIncome);
  document.getElementById('metric-expense').innerText = formatCurrency(totalExpense);
  
  const metricSavingsEl = document.getElementById('metric-savings');
  if (metricSavingsEl) {
    metricSavingsEl.innerText = formatCurrency(state.monthlySavings || 0);
  }

  const savingsSubtextEl = document.getElementById('savings-subtext-info');
  if (savingsSubtextEl) {
    savingsSubtextEl.innerText = `Manually set by you`;
  }

  document.getElementById('metric-count').innerText = `${state.transactions.length} items logged`;
}

// --- Transactions Table Rendering ---
function renderTransactionsTable() {
  const tbody = document.getElementById('transactions-tbody');
  const emptyState = document.getElementById('empty-state');

  const searchQuery = document.getElementById('search-input').value.toLowerCase().trim();
  const filterType = document.getElementById('filter-type').value;
  const filterCat = document.getElementById('filter-category').value;
  const filterSort = document.getElementById('filter-sort').value;

  // Filtering
  let filtered = state.transactions.filter(tx => {
    const matchesSearch = tx.note.toLowerCase().includes(searchQuery) ||
                          tx.category.toLowerCase().includes(searchQuery) ||
                          tx.method.toLowerCase().includes(searchQuery);
    const matchesType = filterType === 'all' || tx.type === filterType;
    const matchesCat = filterCat === 'all' || tx.category === filterCat;

    return matchesSearch && matchesType && matchesCat;
  });

  // Sorting
  filtered.sort((a, b) => {
    if (filterSort === 'date-desc') return new Date(b.date) - new Date(a.date);
    if (filterSort === 'date-asc') return new Date(a.date) - new Date(b.date);
    if (filterSort === 'amount-desc') return b.amount - a.amount;
    if (filterSort === 'amount-asc') return a.amount - b.amount;
    return 0;
  });

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  filtered.forEach(tx => {
    const catConfig = CATEGORY_MAP[tx.category] || CATEGORY_MAP.Other;
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${formatDate(tx.date)}</td>
      <td>
        <span class="category-badge" style="color: ${catConfig.color}; background: ${catConfig.bg};">
          <i class="fa-solid ${catConfig.icon}"></i> ${tx.category}
        </span>
      </td>
      <td><strong>${escapeHtml(tx.note)}</strong></td>
      <td><span style="color: var(--text-muted); font-size: 0.85rem;"><i class="fa-regular fa-credit-card"></i> ${tx.method}</span></td>
      <td style="text-align: right;">
        <span class="amount-display ${tx.type}">
          ${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount)}
        </span>
      </td>
      <td class="admin-only" style="text-align: center;">
        <button class="btn btn-secondary btn-icon-only" onclick="editTransaction('${tx.id}')" title="Edit Item">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button class="btn btn-outline-danger btn-icon-only" onclick="deleteTransaction('${tx.id}')" title="Delete Item">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Chart Visualizations ---
function renderCharts() {
  renderCategoryChart();
  renderTrendChart();
}

function renderCategoryChart() {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  
  // Aggregate expenses by category
  const expenseByCategory = {};
  state.transactions
    .filter(tx => tx.type === 'expense')
    .forEach(tx => {
      expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + parseFloat(tx.amount);
    });

  const labels = Object.keys(expenseByCategory);
  const dataValues = Object.values(expenseByCategory);
  const backgroundColors = labels.map(cat => (CATEGORY_MAP[cat] ? CATEGORY_MAP[cat].color : '#64748b'));

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
  }

  if (labels.length === 0) {
    categoryChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['No Expense Data'],
        datasets: [{ data: [1], backgroundColor: ['rgba(255,255,255,0.05)'] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    return;
  }

  categoryChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: dataValues,
        backgroundColor: backgroundColors,
        borderWidth: 2,
        borderColor: '#111726'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.label}: $${context.raw.toFixed(2)}`;
            }
          }
        }
      },
      cutout: '70%'
    }
  });
}

function renderTrendChart() {
  const ctx = document.getElementById('trendChart').getContext('2d');

  // Group transactions by date/month
  const monthlyData = {};
  state.transactions.forEach(tx => {
    const monthKey = tx.date.substring(0, 7); // YYYY-MM
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, expense: 0 };
    }
    if (tx.type === 'income') {
      monthlyData[monthKey].income += parseFloat(tx.amount);
    } else {
      monthlyData[monthKey].expense += parseFloat(tx.amount);
    }
  });

  const sortedMonths = Object.keys(monthlyData).sort();
  const incomeSeries = sortedMonths.map(m => monthlyData[m].income);
  const expenseSeries = sortedMonths.map(m => monthlyData[m].expense);
  const monthLabels = sortedMonths.map(m => {
    const [year, month] = m.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleString('default', { month: 'short', year: '2-digit' });
  });

  if (trendChartInstance) {
    trendChartInstance.destroy();
  }

  trendChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: monthLabels.length ? monthLabels : ['No Data'],
      datasets: [
        {
          label: 'Income',
          data: incomeSeries.length ? incomeSeries : [0],
          backgroundColor: '#10b981',
          borderRadius: 6
        },
        {
          label: 'Expenses',
          data: expenseSeries.length ? expenseSeries : [0],
          backgroundColor: '#f43f5e',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } }
        }
      },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { display: false } },
        y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
      }
    }
  });
}

// --- Event Listeners Setup ---
// --- Event Listeners Setup ---
function safeAddListener(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}

let isSubmittingTx = false;

function initEventListeners() {
  safeAddListener('btn-add-transaction', 'click', () => openTransactionModal());
  safeAddListener('btn-close-modal', 'click', closeTransactionModal);
  safeAddListener('btn-cancel-modal', 'click', closeTransactionModal);

  safeAddListener('btn-close-savings-modal', 'click', closeSavingsModal);
  safeAddListener('btn-cancel-savings-modal', 'click', closeSavingsModal);

  safeAddListener('search-input', 'input', renderTransactionsTable);
  safeAddListener('filter-type', 'change', renderTransactionsTable);
  safeAddListener('filter-category', 'change', renderTransactionsTable);
  safeAddListener('filter-sort', 'change', renderTransactionsTable);

  safeAddListener('btn-reset-data', 'click', resetAllData);
  safeAddListener('btn-demo-data', 'click', () => seedDemoData(true));
}

// --- Modal Handlers ---
function openTransactionModal(txId = null) {
  isSubmittingTx = false;
  const modal = document.getElementById('transaction-modal');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('transaction-form');

  form.reset();
  state.editingTxId = txId;

  if (txId) {
    const tx = state.transactions.find(t => t.id === txId);
    if (tx) {
      title.innerText = 'Edit Transaction';
      document.getElementById('tx-id').value = tx.id;
      document.getElementById('tx-amount').value = tx.amount;
      document.getElementById('tx-date').value = tx.date;
      document.getElementById('tx-category').value = tx.category;
      document.getElementById('tx-method').value = tx.method;
      document.getElementById('tx-note').value = tx.note;
      setFormType(tx.type);
    }
  } else {
    title.innerText = 'Add Transaction';
    document.getElementById('tx-id').value = '';
    document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
    setFormType('expense');
  }

  modal.classList.add('active');
}

function closeTransactionModal() {
  document.getElementById('transaction-modal').classList.remove('active');
  state.editingTxId = null;
  isSubmittingTx = false;
}

function openSavingsModal() {
  const savingsInput = document.getElementById('monthly-savings-input');
  if (savingsInput) savingsInput.value = state.monthlySavings || 0;

  const modal = document.getElementById('savings-modal');
  if (modal) modal.classList.add('active');

  setTimeout(() => {
    if (savingsInput) {
      savingsInput.focus();
      savingsInput.select();
    }
  }, 100);
}

function closeSavingsModal() {
  const modal = document.getElementById('savings-modal');
  if (modal) modal.classList.remove('active');
}

function setFormType(type) {
  state.currentFormType = type;
  const btnExpense = document.getElementById('type-btn-expense');
  const btnIncome = document.getElementById('type-btn-income');
  const catSelect = document.getElementById('tx-category');

  if (type === 'expense') {
    btnExpense.classList.add('active');
    btnIncome.classList.remove('active');
    if (catSelect.value === 'Income') catSelect.value = 'Food';
  } else {
    btnIncome.classList.add('active');
    btnExpense.classList.remove('active');
    catSelect.value = 'Income';
  }
}

// --- Transaction Form Actions ---
function handleTransactionFormSubmit(e) {
  if (e) e.preventDefault();
  if (isSubmittingTx) return;
  isSubmittingTx = true;

  const id = document.getElementById('tx-id').value || `tx-${Date.now()}`;
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const date = document.getElementById('tx-date').value;
  const category = document.getElementById('tx-category').value;
  const method = document.getElementById('tx-method').value;
  const note = document.getElementById('tx-note').value;
  const type = state.currentFormType;

  if (isNaN(amount) || amount <= 0) {
    showToast('Please enter a valid positive amount!', 'danger');
    isSubmittingTx = false;
    return;
  }

  const newTx = { id, type, amount, date, category, method, note };

  if (state.editingTxId) {
    const idx = state.transactions.findIndex(t => t.id === state.editingTxId);
    if (idx !== -1) state.transactions[idx] = newTx;
    showToast('Transaction updated successfully!', 'success');
  } else {
    state.transactions.unshift(newTx);
    showToast('Transaction saved!', 'success');
  }

  saveToLocalStorage();
  closeTransactionModal();
  renderApp();
}

function handleSavingsFormSubmit(e) {
  e.preventDefault();
  const val = parseFloat(document.getElementById('monthly-savings-input').value);

  if (!isNaN(val) && val >= 0) {
    state.monthlySavings = val;
    saveToLocalStorage();
    closeSavingsModal();
    renderApp();
    showToast(`Updated monthly savings to ${formatCurrency(state.monthlySavings)}!`, 'success');
  }
}

function openVaultModal() {
  const gistIdInput = document.getElementById('gist-id-input');
  const gistTokenInput = document.getElementById('gist-token-input');

  if (gistIdInput) gistIdInput.value = state.gistId || '4e9d3322f1da9f4a2ed6d79374937944';
  if (gistTokenInput) gistTokenInput.value = state.gistToken || '';

  const modal = document.getElementById('vault-modal');
  if (modal) modal.classList.add('active');

  setTimeout(() => {
    if (gistIdInput) {
      gistIdInput.focus();
      gistIdInput.select();
    }
  }, 100);
}

function closeVaultModal() {
  const modal = document.getElementById('vault-modal');
  if (modal) modal.classList.remove('active');
}

function handleVaultFormSubmit(e) {
  e.preventDefault();
  const gistIdVal = document.getElementById('gist-id-input').value.trim();
  const gistTokenVal = document.getElementById('gist-token-input').value.trim();

  if (gistIdVal) {
    state.gistId = gistIdVal;
    state.gistToken = gistTokenVal;
    localStorage.setItem(GIST_ID_STORAGE, state.gistId);
    if (state.gistToken) localStorage.setItem(GIST_TOKEN_STORAGE, state.gistToken);

    closeVaultModal();
    syncFromCloudDatabase();
    showToast('Connected to GitHub Gist Cloud Database!', 'success');
  }
}

// --- Admin Mode Handlers ---
function toggleAdminMode() {
  if (state.isAdminLoggedIn) {
    adminLogout();
  } else {
    openAdminModal();
  }
}

function openAdminModal() {
  const input = document.getElementById('admin-pin-input');
  if (input) input.value = '';

  const modal = document.getElementById('admin-modal');
  if (modal) modal.classList.add('active');

  setTimeout(() => {
    if (input) input.focus();
  }, 100);
}

function closeAdminModal() {
  const modal = document.getElementById('admin-modal');
  if (modal) modal.classList.remove('active');
}

function handleAdminFormSubmit(e) {
  e.preventDefault();
  const inputPin = document.getElementById('admin-pin-input').value.trim();
  if (inputPin === state.adminPin) {
    state.isAdminLoggedIn = true;
    sessionStorage.setItem(ADMIN_SESSION_STORAGE, 'true');
    closeAdminModal();
    updateAdminUiState();
    renderApp();
    showToast('Admin Mode Unlocked! You can now edit transactions & savings.', 'success');
  } else {
    showToast('Invalid Admin PIN! Access denied.', 'danger');
  }
}

function adminLogout() {
  state.isAdminLoggedIn = false;
  sessionStorage.removeItem(ADMIN_SESSION_STORAGE);
  updateAdminUiState();
  renderApp();
  showToast('Locked back to Public Report Mode.', 'warning');
}

function updateAdminUiState() {
  document.body.classList.toggle('admin-mode', state.isAdminLoggedIn);
  
  const textEl = document.getElementById('admin-btn-text');
  const iconEl = document.getElementById('admin-icon');

  if (textEl && iconEl) {
    if (state.isAdminLoggedIn) {
      textEl.innerText = 'Lock Admin';
      iconEl.className = 'fa-solid fa-lock-open';
    } else {
      textEl.innerText = 'Admin Login';
      iconEl.className = 'fa-solid fa-lock';
    }
  }
}

function handleSavingsCardClick() {
  if (state.isAdminLoggedIn) {
    openSavingsModal();
  } else {
    showToast('Public Report View: Login as Admin to edit Monthly Savings.', 'warning');
  }
}

// --- Quick Add Bar Actions ---
function handleQuickAddSubmit(e) {
  if (e) e.preventDefault();
  if (!state.isAdminLoggedIn) {
    showToast('Public Report View: Login as Admin to add transactions.', 'warning');
    return;
  }

  const amount = parseFloat(document.getElementById('quick-amount').value);
  const type = document.getElementById('quick-type').value;
  const category = document.getElementById('quick-category').value;
  const note = document.getElementById('quick-note').value;
  const date = new Date().toISOString().split('T')[0];

  if (isNaN(amount) || amount <= 0) {
    showToast('Please enter a valid positive amount!', 'danger');
    return;
  }

  const newTx = {
    id: `tx-${Date.now()}`,
    type: type,
    amount: amount,
    date: date,
    category: category,
    method: type === 'income' ? 'Bank Transfer' : 'Debit Card',
    note: note
  };

  state.transactions.unshift(newTx);
  document.getElementById('quick-add-form').reset();
  saveToLocalStorage();
  renderApp();
  showToast(`Added ${type === 'income' ? '+' : '-'}${formatCurrency(amount)} (${category})!`, 'success');
}

function quickAddPreset(category, defaultNote, type) {
  if (!state.isAdminLoggedIn) {
    openAdminModal();
    return;
  }

  const catSelect = document.getElementById('quick-category');
  const typeSelect = document.getElementById('quick-type');
  const noteInput = document.getElementById('quick-note');
  const amountInput = document.getElementById('quick-amount');

  if (catSelect) catSelect.value = category;
  if (typeSelect) typeSelect.value = type;
  if (noteInput) noteInput.value = defaultNote;

  if (amountInput) {
    amountInput.focus();
  }
}

window.openTransactionModal = openTransactionModal;
window.closeTransactionModal = closeTransactionModal;
window.handleTransactionFormSubmit = handleTransactionFormSubmit;
window.setFormType = setFormType;
window.openSavingsModal = openSavingsModal;
window.closeSavingsModal = closeSavingsModal;
window.handleSavingsFormSubmit = handleSavingsFormSubmit;
window.openVaultModal = openVaultModal;
window.closeVaultModal = closeVaultModal;
window.handleVaultFormSubmit = handleVaultFormSubmit;
window.toggleAdminMode = toggleAdminMode;
window.openAdminModal = openAdminModal;
window.closeAdminModal = closeAdminModal;
window.handleAdminFormSubmit = handleAdminFormSubmit;
window.adminLogout = adminLogout;
window.handleSavingsCardClick = handleSavingsCardClick;
window.handleQuickAddSubmit = handleQuickAddSubmit;
window.quickAddPreset = quickAddPreset;
window.syncFromCloudDatabase = syncFromCloudDatabase;
window.syncToCloudDatabase = syncToCloudDatabase;
window.openBudgetModal = openSavingsModal;
window.resetAllData = resetAllData;

window.editTransaction = function(id) {
  openTransactionModal(id);
};

window.deleteTransaction = function(id) {
  if (confirm('Are you sure you want to delete this transaction item?')) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveToLocalStorage();
    renderApp();
    showToast('Transaction deleted.', 'warning');
  }
};

// --- Export & Import Utilities ---
function exportJSONBackup() {
  const payload = {
    transactions: state.transactions,
    monthlyBudget: state.monthlyBudget,
    exportDate: new Date().toISOString()
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `expense_tracker_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  showToast('JSON Backup downloaded!', 'success');
}

function exportCSV() {
  if (state.transactions.length === 0) {
    showToast('No transaction data to export.', 'warning');
    return;
  }

  let csvContent = 'data:text/csv;charset=utf-8,ID,Date,Type,Category,Note,Method,Amount\n';

  state.transactions.forEach(tx => {
    const row = [
      tx.id,
      tx.date,
      tx.type,
      `"${tx.category}"`,
      `"${tx.note.replace(/"/g, '""')}"`,
      `"${tx.method}"`,
      tx.amount
    ].join(',');
    csvContent += row + '\n';
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `expenses_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();

  showToast('CSV Spreadsheet downloaded!', 'success');
}

function handleImportJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (Array.isArray(data.transactions)) {
        state.transactions = data.transactions;
        if (data.monthlyBudget) state.monthlyBudget = data.monthlyBudget;
        saveToLocalStorage();
        renderApp();
        showToast('Successfully imported transactions backup!', 'success');
      } else {
        showToast('Invalid backup file format.', 'danger');
      }
    } catch (err) {
      showToast('Error reading file. Ensure it is valid JSON.', 'danger');
    }
  };
  reader.readAsText(file);
}

function resetAllData() {
  if (confirm('Are you sure you want to delete all saved transactions and reset data?')) {
    state.transactions = [];
    state.monthlySavings = 0;
    saveToLocalStorage();
    renderApp();
    showToast('All local expense data cleared.', 'warning');
  }
}

// --- Helper Utilities ---
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast`;

  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'danger') icon = 'fa-circle-exclamation';
  if (type === 'warning') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
