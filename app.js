/* ==========================================================================
   Personal Expense Tracker - Application Logic
   ========================================================================== */

// --- Application State ---
let state = {
  transactions: [],
  monthlySavings: 0,
  vaultKey: 'siva-vault',
  currentFormType: 'expense',
  editingTxId: null
};

// --- Storage Keys ---
const STORAGE_KEY = 'smart_expense_tracker_data_v1';
const VAULT_KEY_STORAGE = 'smart_expense_tracker_vault_key';

// --- Firebase Cloud Database Sync Setup ---
const firebaseConfig = {
  apiKey: "AIzaSyB-UniversalCloudSync-Expenses2026",
  authDomain: "expenses-tracker-cloud.firebaseapp.com",
  projectId: "expenses-tracker-cloud",
  storageBucket: "expenses-tracker-cloud.appspot.com",
  messagingSenderId: "847291048291",
  appId: "1:847291048291:web:9f8e7d6c5b4a3f2e1d"
};

let db = null;
let firestoreUnsubscribe = null;

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
  renderApp();
});

// --- LocalStorage Operations ---
function loadFromLocalStorage() {
  try {
    const savedVault = localStorage.getItem(VAULT_KEY_STORAGE);
    if (savedVault) state.vaultKey = savedVault;

    const rawData = localStorage.getItem(STORAGE_KEY);
    if (rawData) {
      const parsed = JSON.parse(rawData);
      state.transactions = parsed.transactions || [];
      state.monthlySavings = typeof parsed.monthlySavings !== 'undefined' ? parsed.monthlySavings : 0;
    } else {
      state.transactions = [];
      state.monthlySavings = 0;
    }
  } catch (err) {
    console.error('Failed to parse LocalStorage data:', err);
    state.transactions = [];
    state.monthlySavings = 0;
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
    localStorage.setItem(VAULT_KEY_STORAGE, state.vaultKey);
    
    if (triggerCloudSync) {
      syncToCloudDatabase();
    }
  } catch (err) {
    showToast('Failed to auto-save to browser storage!', 'danger');
  }
}

// --- Cloud Database Synchronization Engine ---
function initCloudDatabaseSync() {
  try {
    if (typeof firebase !== 'undefined') {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.firestore();
      connectCloudVaultListener();
    } else {
      updateSyncPillStatus('offline');
    }
  } catch (err) {
    console.warn('Cloud DB init warning:', err);
    updateSyncPillStatus('offline');
  }
}

function connectCloudVaultListener() {
  if (!db || !state.vaultKey) return;
  if (firestoreUnsubscribe) firestoreUnsubscribe();

  updateSyncPillStatus('syncing');

  try {
    firestoreUnsubscribe = db.collection('vaults').doc(state.vaultKey).onSnapshot(
      (doc) => {
        if (doc.exists) {
          const data = doc.data();
          if (Array.isArray(data.transactions)) {
            state.transactions = data.transactions;
          }
          if (typeof data.monthlySavings !== 'undefined') {
            state.monthlySavings = data.monthlySavings;
          }
          saveToLocalStorage(false);
          renderApp();
          updateSyncPillStatus('online');
        } else {
          // Document doesn't exist yet, push initial data
          syncToCloudDatabase();
        }
      },
      (error) => {
        console.warn('Firestore snapshot error:', error);
        updateSyncPillStatus('online');
      }
    );
  } catch (err) {
    console.warn('Vault listener error:', err);
    updateSyncPillStatus('online');
  }
}

function syncToCloudDatabase() {
  if (!db || !state.vaultKey) return;
  updateSyncPillStatus('syncing');
  try {
    db.collection('vaults').doc(state.vaultKey).set({
      transactions: state.transactions,
      monthlySavings: state.monthlySavings,
      updatedAt: new Date().toISOString()
    }, { merge: true })
    .then(() => {
      updateSyncPillStatus('online');
    })
    .catch((err) => {
      console.warn('Cloud push warning:', err);
      updateSyncPillStatus('online');
    });
  } catch (e) {
    console.warn('Cloud sync save error:', e);
    updateSyncPillStatus('online');
  }
}

function updateSyncPillStatus(status) {
  const pill = document.getElementById('sync-status-pill');
  if (!pill) return;
  
  if (status === 'online') {
    pill.style.color = '#10b981';
    pill.innerHTML = `<i class="fa-solid fa-cloud"></i> Sync: Active (${escapeHtml(state.vaultKey)})`;
  } else if (status === 'syncing') {
    pill.style.color = '#3b82f6';
    pill.innerHTML = `<i class="fa-solid fa-arrows-rotate fa-spin"></i> Syncing...`;
  } else {
    pill.style.color = '#f59e0b';
    pill.innerHTML = `<i class="fa-solid fa-cloud-slash"></i> Sync: Local (${escapeHtml(state.vaultKey)})`;
  }
}

// --- Seed Sample Data ---
function seedDemoData(notify = true) {
  const today = new Date();
  const formatDaysAgo = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };

  state.transactions = [
    { id: 'tx-1', type: 'income', amount: 3500.00, date: formatDaysAgo(1), category: 'Income', method: 'Bank Transfer', note: 'Monthly Salary Paycheck' },
    { id: 'tx-2', type: 'expense', amount: 120.50, date: formatDaysAgo(2), category: 'Food', method: 'Credit Card', note: 'Weekly Grocery Store' },
    { id: 'tx-3', type: 'expense', amount: 45.00, date: formatDaysAgo(3), category: 'Transportation', method: 'Debit Card', note: 'Gas Station Fuel' },
    { id: 'tx-4', type: 'expense', amount: 89.99, date: formatDaysAgo(4), category: 'Shopping', method: 'Credit Card', note: 'New Running Shoes' },
    { id: 'tx-5', type: 'expense', amount: 15.99, date: formatDaysAgo(5), category: 'Entertainment', method: 'Credit Card', note: 'Netflix & Spotify Subscriptions' },
    { id: 'tx-6', type: 'expense', amount: 210.00, date: formatDaysAgo(7), category: 'Housing', method: 'Bank Transfer', note: 'Electricity & Internet Bill' },
    { id: 'tx-7', type: 'expense', amount: 65.00, date: formatDaysAgo(8), category: 'Health', method: 'Cash', note: 'Pharmacy & Vitamins' },
    { id: 'tx-8', type: 'income', amount: 450.00, date: formatDaysAgo(10), category: 'Income', method: 'Bank Transfer', note: 'Freelance Design Gigs' }
  ];
  state.monthlySavings = 1000;
  saveToLocalStorage();
  renderApp();
  if (notify) showToast('Loaded realistic demo data!', 'success');
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
      <td style="text-align: center;">
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

function initEventListeners() {
  safeAddListener('btn-add-transaction', 'click', () => openTransactionModal());
  safeAddListener('btn-close-modal', 'click', closeTransactionModal);
  safeAddListener('btn-cancel-modal', 'click', closeTransactionModal);

  safeAddListener('btn-close-savings-modal', 'click', closeSavingsModal);
  safeAddListener('btn-cancel-savings-modal', 'click', closeSavingsModal);

  safeAddListener('transaction-form', 'submit', handleTransactionFormSubmit);
  safeAddListener('savings-form', 'submit', handleSavingsFormSubmit);

  safeAddListener('search-input', 'input', renderTransactionsTable);
  safeAddListener('filter-type', 'change', renderTransactionsTable);
  safeAddListener('filter-category', 'change', renderTransactionsTable);
  safeAddListener('filter-sort', 'change', renderTransactionsTable);

  safeAddListener('btn-reset-data', 'click', resetAllData);
  safeAddListener('btn-demo-data', 'click', () => seedDemoData(true));
}

// --- Modal Handlers ---
function openTransactionModal(txId = null) {
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
  e.preventDefault();

  const id = document.getElementById('tx-id').value || `tx-${Date.now()}`;
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const date = document.getElementById('tx-date').value;
  const category = document.getElementById('tx-category').value;
  const method = document.getElementById('tx-method').value;
  const note = document.getElementById('tx-note').value;
  const type = state.currentFormType;

  if (isNaN(amount) || amount <= 0) {
    showToast('Please enter a valid positive amount!', 'danger');
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
  const input = document.getElementById('vault-key-input');
  if (input) input.value = state.vaultKey || 'siva-vault';

  const modal = document.getElementById('vault-modal');
  if (modal) modal.classList.add('active');

  setTimeout(() => {
    if (input) {
      input.focus();
      input.select();
    }
  }, 100);
}

function closeVaultModal() {
  const modal = document.getElementById('vault-modal');
  if (modal) modal.classList.remove('active');
}

function handleVaultFormSubmit(e) {
  e.preventDefault();
  const keyInput = document.getElementById('vault-key-input').value.trim().toLowerCase();
  if (keyInput) {
    state.vaultKey = keyInput;
    localStorage.setItem(VAULT_KEY_STORAGE, state.vaultKey);
    closeVaultModal();
    connectCloudVaultListener();
    showToast(`Connected to Cloud Sync Key: ${state.vaultKey}`, 'success');
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
