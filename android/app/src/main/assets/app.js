/* ==========================================================================
   Lumina Finance - Application Logic & State Engine
   ========================================================================== */

// --- Application State ---
let state = {
  userName: 'Sivakumar',
  baseBalance: 124592.80,
  transactions: [],
  monthlySavings: 1200,
  gistId: '',
  gistToken: '',
  isAdminLoggedIn: true,
  adminPin: '7871',
  currentFormType: 'expense',
  editingTxId: null
};

// --- Storage Keys ---
const STORAGE_KEY = 'smart_expense_tracker_data_v1';
const USER_PROFILE_KEY = 'lumina_user_profile_v1';
const GIST_ID_STORAGE = 'smart_expense_tracker_gist_id';
const GIST_TOKEN_STORAGE = 'smart_expense_tracker_gist_token';

let cloudSyncInterval = null;

// --- Keypad & Transaction Entry State ---
let currentKeypadAmount = "0";
let selectedKeypadCategory = "Fuel";

// --- Category Visual Mapping ---
const CATEGORY_MAP = {
  Food: { icon: 'restaurant', color: '#ffb700', bg: 'rgba(255, 183, 0, 0.18)' },
  Fuel: { icon: 'local_gas_station', color: '#00dbe9', bg: 'rgba(0, 219, 233, 0.18)' },
  Transportation: { icon: 'local_gas_station', color: '#00dbe9', bg: 'rgba(0, 219, 233, 0.18)' },
  Housing: { icon: 'home', color: '#9d4edd', bg: 'rgba(157, 78, 221, 0.18)' },
  Shop: { icon: 'shopping_bag', color: '#ecb1ff', bg: 'rgba(208, 91, 255, 0.18)' },
  Shopping: { icon: 'shopping_bag', color: '#ecb1ff', bg: 'rgba(208, 91, 255, 0.18)' },
  Entertainment: { icon: 'sports_esports', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.18)' },
  Health: { icon: 'medical_services', color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.18)' },
  Education: { icon: 'school', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.18)' },
  Income: { icon: 'payments', color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.18)' },
  Other: { icon: 'more_horiz', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.18)' }
};

// --- Chart Instances ---
let categoryChartInstance = null;
let monthlyExpenseChartInstance = null;
let weeklyExpenseChartInstance = null;
let methodChartInstance = null;
let activeReportTab = 'monthly';

// --- Initialize App ---
document.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();
  initCloudDatabaseSync();
  renderApp();
});

// --- LocalStorage Operations ---
function loadFromLocalStorage() {
  try {
    const profileRaw = localStorage.getItem(USER_PROFILE_KEY);
    if (profileRaw) {
      const parsedProfile = JSON.parse(profileRaw);
      if (parsedProfile.userName) state.userName = parsedProfile.userName;
      if (typeof parsedProfile.baseBalance === 'number') state.baseBalance = parsedProfile.baseBalance;
    }

    const savedGistId = localStorage.getItem(GIST_ID_STORAGE);
    if (savedGistId) state.gistId = savedGistId;

    const savedGistToken = localStorage.getItem(GIST_TOKEN_STORAGE);
    if (savedGistToken) state.gistToken = savedGistToken;

    const rawData = localStorage.getItem(STORAGE_KEY);
    if (rawData) {
      const parsed = JSON.parse(rawData);
      state.transactions = parsed.transactions || [];
      state.monthlySavings = typeof parsed.monthlySavings !== 'undefined' ? parsed.monthlySavings : 1200;
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
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify({
      userName: state.userName,
      baseBalance: state.baseBalance
    }));

    const payload = {
      userName: state.userName,
      baseBalance: state.baseBalance,
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
    showToast('Failed to save to local storage', 'danger');
  }
}

// --- Cloud Synchronization Engine ---
function initCloudDatabaseSync() {
  syncFromCloudDatabase();
  window.addEventListener('focus', syncFromCloudDatabase);
  if (!cloudSyncInterval) {
    cloudSyncInterval = setInterval(syncFromCloudDatabase, 30000);
  }
}

async function syncFromCloudDatabase() {
  if (!state.gistId) return;
  try {
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (state.gistToken) headers['Authorization'] = `token ${state.gistToken}`;

    const res = await fetch(`https://api.github.com/gists/${state.gistId}`, { method: 'GET', headers });
    if (res.ok) {
      const gistData = await res.json();
      const files = gistData.files;
      const fileKey = files['expenses.json'] ? 'expenses.json' : Object.keys(files)[0];
      if (fileKey && files[fileKey]) {
        const content = JSON.parse(files[fileKey].content);
        if (Array.isArray(content.transactions)) {
          state.transactions = content.transactions;
          if (content.userName) state.userName = content.userName;
          if (typeof content.baseBalance === 'number') state.baseBalance = content.baseBalance;
          saveToLocalStorage(false);
          renderApp();
        }
      }
    }
  } catch (err) {
    console.warn('Gist fetch error:', err);
  }
}

async function syncToCloudDatabase() {
  if (!state.gistId || !state.gistToken) return;
  try {
    const payload = {
      userName: state.userName,
      baseBalance: state.baseBalance,
      transactions: state.transactions,
      monthlySavings: state.monthlySavings,
      updatedAt: new Date().toISOString()
    };
    await fetch(`https://api.github.com/gists/${state.gistId}`, {
      method: 'PATCH',
      headers: { 'Accept': 'application/vnd.github.v3+json', 'Authorization': `token ${state.gistToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: { 'expenses.json': { content: JSON.stringify(payload, null, 2) } } })
    });
  } catch (err) {
    console.warn('Gist push error:', err);
  }
}

// --- Seed Initial Data ---
function seedDemoData(notify = true) {
  state.userName = 'Sivakumar';
  state.baseBalance = 124592.80;
  state.monthlySavings = 1200;
  state.transactions = [
    { id: 'tx-1', type: 'expense', amount: 150.00, date: new Date().toISOString().split('T')[0], category: 'Transportation', method: 'Debit Card', note: 'Return to Home' },
    { id: 'tx-2', type: 'expense', amount: 3450.00, date: new Date(Date.now() - 86400000).toISOString().split('T')[0], category: 'Shop', method: 'Debit Card', note: 'Bought ETH (-1.5 ETH)' },
    { id: 'tx-3', type: 'income', amount: 3210.00, date: new Date(Date.now() - 172800000).toISOString().split('T')[0], category: 'Income', method: 'Bank Transfer', note: 'Received BTC (+0.05 BTC)' },
    { id: 'tx-4', type: 'expense', amount: 85.00, date: new Date(Date.now() - 259200000).toISOString().split('T')[0], category: 'Fuel', method: 'Credit Card', note: 'Fuel Fill-Up' }
  ];
  saveToLocalStorage();
  renderApp();
  if (notify) showToast('Ledger initialized with default data', 'success');
}

// --- Core App Render ---
function renderApp() {
  updateProfileUI();
  calculateMetrics();
  renderRecentActivity();
  if (activeReportTab === 'heatmap') {
    renderHeatmapChart();
  }
  renderCharts();
}

// --- User Profile & Name UI ---
function updateProfileUI() {
  const greetingEl = document.getElementById('user-greeting-name');
  if (greetingEl) {
    greetingEl.innerHTML = `${escapeHtml(state.userName)} <span class="material-symbols-outlined text-sm text-on-surface-variant">edit</span>`;
  }
  const navUserEl = document.getElementById('nav-user-name');
  if (navUserEl) {
    navUserEl.innerText = state.userName;
  }
}

function openProfileModal() {
  const nameInput = document.getElementById('profile-name-input');
  const balInput = document.getElementById('profile-balance-input');
  if (nameInput) nameInput.value = state.userName || 'Sivakumar';
  if (balInput) balInput.value = state.baseBalance || 124592.80;
  const modal = document.getElementById('profile-modal');
  if (modal) modal.classList.add('active');
}

function closeProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (modal) modal.classList.remove('active');
}

function handleProfileSubmit(e) {
  e.preventDefault();
  const nameVal = document.getElementById('profile-name-input').value.trim();
  const balVal = parseFloat(document.getElementById('profile-balance-input').value);

  if (nameVal) {
    state.userName = nameVal;
  }
  if (!isNaN(balVal)) {
    state.baseBalance = balVal;
  }
  saveToLocalStorage();
  closeProfileModal();
  renderApp();
  showToast(`Profile updated! Hello, ${state.userName}`, 'success');
}

// --- Keypad Functions ---
function updateDisplay() {
  const display = document.getElementById('amountDisplay');
  if (!display) return;
  if (currentKeypadAmount === "0" || !currentKeypadAmount) {
    display.innerText = "0.00";
  } else {
    display.innerText = currentKeypadAmount;
  }
}

function appendNum(num) {
  if (currentKeypadAmount === "0" && num !== ".") {
    currentKeypadAmount = num;
  } else if (currentKeypadAmount.length < 8) {
    if (num === '.' && currentKeypadAmount.includes('.')) return;
    currentKeypadAmount += num;
  }
  updateDisplay();
}

function deleteNum() {
  if (currentKeypadAmount.length > 1) {
    currentKeypadAmount = currentKeypadAmount.slice(0, -1);
  } else {
    currentKeypadAmount = "0";
  }
  updateDisplay();
}

function selectCategory(catName, btnEl) {
  selectedKeypadCategory = catName;
  document.querySelectorAll('.cat-btn').forEach(b => {
    b.className = "cat-btn flex flex-col items-center p-stack-sm rounded-lg bg-surface-container border border-outline-variant/30 hover:border-primary-fixed/50 transition-all w-20 cursor-pointer";
    const textSpan = b.querySelector('span:last-child');
    if (textSpan) textSpan.classList.add('text-on-surface-variant');
  });
  if (btnEl) {
    btnEl.className = "cat-btn flex flex-col items-center p-stack-sm rounded-lg bg-primary-container/20 border border-primary-fixed text-primary-fixed transition-all w-20 shadow-[0_0_15px_rgba(0,219,233,0.15)] cursor-pointer";
    const textSpan = btnEl.querySelector('span:last-child');
    if (textSpan) textSpan.classList.remove('text-on-surface-variant');
  }
}

function triggerSuccess() {
  const amountVal = parseFloat(currentKeypadAmount) || 0;
  if (amountVal <= 0) {
    showToast('Please enter an amount on the keypad!', 'danger');
    return;
  }

  const newTx = {
    id: `tx-${Date.now()}`,
    type: 'expense',
    amount: amountVal,
    date: new Date().toISOString().split('T')[0],
    category: selectedKeypadCategory || 'Fuel',
    method: 'Debit Card',
    note: `${selectedKeypadCategory || 'Expense'} Entry`
  };

  state.transactions.unshift(newTx);
  saveToLocalStorage();

  const overlay = document.getElementById('successOverlay');
  if (overlay) {
    overlay.classList.add('active');
    setTimeout(() => {
      overlay.classList.remove('active');
      currentKeypadAmount = "0";
      updateDisplay();
      closeTransactionModal();
      renderApp();
    }, 1600);
  } else {
    currentKeypadAmount = "0";
    updateDisplay();
    closeTransactionModal();
    renderApp();
  }
}

// --- Send Modal Handlers ---
function openSendModal() {
  document.getElementById('send-recipient').value = '';
  document.getElementById('send-amount').value = '';
  document.getElementById('send-note').value = '';
  const modal = document.getElementById('send-modal');
  if (modal) modal.classList.add('active');
}

function closeSendModal() {
  const modal = document.getElementById('send-modal');
  if (modal) modal.classList.remove('active');
}

function handleSendSubmit(e) {
  e.preventDefault();
  const recipient = document.getElementById('send-recipient').value.trim();
  const amount = parseFloat(document.getElementById('send-amount').value);
  const note = document.getElementById('send-note').value.trim();

  if (!recipient || isNaN(amount) || amount <= 0) {
    showToast('Please enter recipient and valid amount!', 'danger');
    return;
  }

  state.transactions.unshift({
    id: `tx-${Date.now()}`,
    type: 'expense',
    amount: amount,
    date: new Date().toISOString().split('T')[0],
    category: 'Transportation',
    method: 'Bank Transfer',
    note: note ? `Sent to ${recipient} (${note})` : `Sent to ${recipient}`
  });

  saveToLocalStorage();
  closeSendModal();
  renderApp();
  showToast(`Sent $${amount.toFixed(2)} to ${recipient}!`, 'success');
}

// --- Receive Modal Handlers ---
function openReceiveModal() {
  document.getElementById('receive-sender').value = '';
  document.getElementById('receive-amount').value = '';
  document.getElementById('receive-note').value = '';
  const modal = document.getElementById('receive-modal');
  if (modal) modal.classList.add('active');
}

function closeReceiveModal() {
  const modal = document.getElementById('receive-modal');
  if (modal) modal.classList.remove('active');
}

function handleReceiveSubmit(e) {
  e.preventDefault();
  const sender = document.getElementById('receive-sender').value.trim();
  const amount = parseFloat(document.getElementById('receive-amount').value);
  const note = document.getElementById('receive-note').value.trim();

  if (!sender || isNaN(amount) || amount <= 0) {
    showToast('Please enter sender name and valid amount!', 'danger');
    return;
  }

  state.transactions.unshift({
    id: `tx-${Date.now()}`,
    type: 'income',
    amount: amount,
    date: new Date().toISOString().split('T')[0],
    category: 'Income',
    method: 'Bank Transfer',
    note: note ? `Received from ${sender} (${note})` : `Received from ${sender}`
  });

  saveToLocalStorage();
  closeReceiveModal();
  renderApp();
  showToast(`Received $${amount.toFixed(2)} from ${sender}!`, 'success');
}

// --- Modal Controls ---
function openTransactionModal() {
  currentKeypadAmount = "0";
  updateDisplay();
  const modal = document.getElementById('transaction-modal');
  if (modal) modal.classList.add('active');
}

function closeTransactionModal() {
  const modal = document.getElementById('transaction-modal');
  if (modal) modal.classList.remove('active');
}

function openVaultModal() {
  const gistIdInput = document.getElementById('gist-id-input');
  const gistTokenInput = document.getElementById('gist-token-input');
  if (gistIdInput) gistIdInput.value = state.gistId || '';
  if (gistTokenInput) gistTokenInput.value = state.gistToken || '';
  const modal = document.getElementById('vault-modal');
  if (modal) modal.classList.add('active');
}

function closeVaultModal() {
  const modal = document.getElementById('vault-modal');
  if (modal) modal.classList.remove('active');
}

function handleVaultFormSubmit(e) {
  e.preventDefault();
  state.gistId = document.getElementById('gist-id-input').value.trim();
  state.gistToken = document.getElementById('gist-token-input').value.trim();
  saveToLocalStorage();
  closeVaultModal();
  syncFromCloudDatabase();
  showToast('Vault credentials saved & synced', 'success');
}

function openSavingsModal() {
  openProfileModal();
}

// --- Dynamic Balance Calculation ---
function calculateMetrics() {
  let netBalance = state.baseBalance || 124592.80;
  let totalIncome = 0;
  let totalExpense = 0;

  state.transactions.forEach(tx => {
    const val = parseFloat(tx.amount) || 0;
    if (tx.type === 'income') {
      totalIncome += val;
      netBalance += val;
    } else {
      totalExpense += val;
      netBalance -= val;
    }
  });

  const balanceEl = document.getElementById('metric-balance');
  if (balanceEl) {
    balanceEl.innerText = `$${netBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

// --- Recent Activity Renderer ---
function renderRecentActivity() {
  const container = document.getElementById('recent-activity-list');
  if (!container) return;

  if (state.transactions.length === 0) {
    container.innerHTML = `
      <div class="glass-panel rounded-lg p-stack-md text-center text-on-surface-variant font-label-sm">
        No recent activity logged
      </div>
    `;
    return;
  }

  const items = state.transactions.slice(0, 5);
  container.innerHTML = items.map(tx => {
    const isIncome = tx.type === 'income';
    const icon = isIncome ? 'arrow_downward' : 'arrow_outward';
    const textColor = isIncome ? 'text-primary-fixed-dim' : 'text-on-surface';
    const sign = isIncome ? '+' : '-';
    const displayAmount = `${sign}$${parseFloat(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    return `
      <div class="glass-panel rounded-lg p-stack-md flex justify-between items-center hover:bg-surface-variant/30 cursor-pointer transition-colors">
        <div class="flex items-center gap-stack-md">
          <div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center ${textColor}">
            <span class="material-symbols-outlined">${icon}</span>
          </div>
          <div>
            <p class="font-body-md text-body-md text-on-surface">${escapeHtml(tx.note || tx.category)}</p>
            <p class="font-label-sm text-label-sm text-on-surface-variant">${tx.date}</p>
          </div>
        </div>
        <div class="text-right">
          <p class="font-label-md text-label-md ${textColor}">${displayAmount}</p>
          <p class="font-label-sm text-label-sm text-on-surface-variant">${tx.category}</p>
        </div>
      </div>
    `;
  }).join('');
}

// --- Report Tabs Router & Dynamic Chart Renderer ---
function switchReportTab(tabMode) {
  activeReportTab = tabMode;

  ['monthly', 'weekly', 'database', 'heatmap'].forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const panel = document.getElementById(`panel-report-${t}`);
    if (btn) {
      if (t === tabMode) {
        btn.className = "px-3.5 py-1.5 rounded-lg bg-primary-container/20 text-primary-fixed border border-primary-fixed/40 font-label-sm active cursor-pointer";
      } else {
        btn.className = "px-3.5 py-1.5 rounded-lg bg-surface-variant text-on-surface-variant font-label-sm cursor-pointer";
      }
    }
    if (panel) {
      panel.style.display = t === tabMode ? 'block' : 'none';
    }
  });

  requestAnimationFrame(() => {
    setTimeout(() => {
      renderCharts();
    }, 50);
  });
}

function toggleViewAllTransactions() {
  switchReportTab('heatmap');
  showToast('Viewing activity breakdown', 'info');
}

// --- Chart Renderers ---
function renderCharts() {
  if (activeReportTab === 'monthly') {
    renderMonthlyExpenseChart();
    renderCategoryChart();
  } else if (activeReportTab === 'weekly') {
    renderWeeklyExpenseChart();
  } else if (activeReportTab === 'database') {
    renderMethodChart();
  }
}

function renderMonthlyExpenseChart() {
  const canvas = document.getElementById('monthlyExpenseChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (monthlyExpenseChartInstance) monthlyExpenseChartInstance.destroy();

  // Aggregate expenses per YYYY-MM from transactions
  const monthMap = {};
  state.transactions.forEach(tx => {
    if (tx.type === 'expense' && tx.date) {
      const monthKey = tx.date.substring(0, 7);
      monthMap[monthKey] = (monthMap[monthKey] || 0) + parseFloat(tx.amount);
    }
  });

  let labels = Object.keys(monthMap).sort();
  let data = labels.map(k => monthMap[k]);

  // Fallback defaults if no transactions exist yet
  if (labels.length === 0) {
    labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
    data = [1200, 1900, 1500, 2100, 1800, 2400, 3100, 2980];
  }

  monthlyExpenseChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Expenses ($)',
        data: data,
        borderColor: '#00dbe9',
        borderWidth: 2,
        backgroundColor: 'rgba(0, 219, 233, 0.12)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#00dbe9',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#849495' }, grid: { display: false } },
        y: { ticks: { color: '#849495', callback: val => '$' + val }, grid: { color: 'rgba(132, 148, 149, 0.1)' } }
      }
    }
  });
}

function renderCategoryChart() {
  const canvas = document.getElementById('categoryChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (categoryChartInstance) categoryChartInstance.destroy();

  const catMap = {};
  state.transactions.forEach(tx => {
    if (tx.type === 'expense') {
      catMap[tx.category] = (catMap[tx.category] || 0) + parseFloat(tx.amount);
    }
  });

  let labels = Object.keys(catMap);
  let data = Object.values(catMap);

  if (labels.length === 0) {
    labels = ['Food', 'Fuel', 'Shop', 'Housing', 'Transportation'];
    data = [450, 250, 150, 800, 150];
  }

  const colors = labels.map(c => CATEGORY_MAP[c] ? CATEGORY_MAP[c].color : '#849495');

  categoryChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#e4e1e9', font: { family: 'Geist', size: 11 } } } },
      cutout: '70%'
    }
  });
}

function renderWeeklyExpenseChart() {
  const canvas = document.getElementById('weeklyExpenseChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (weeklyExpenseChartInstance) weeklyExpenseChartInstance.destroy();

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayData = [120, 240, 180, 310, 290, 450, 190];

  weeklyExpenseChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dayLabels,
      datasets: [{
        label: 'Daily Spent ($)',
        data: dayData,
        backgroundColor: '#d05bff',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#849495' }, grid: { display: false } },
        y: { ticks: { color: '#849495', callback: val => '$' + val }, grid: { color: 'rgba(132, 148, 149, 0.1)' } }
      }
    }
  });
}

function renderMethodChart() {
  const canvas = document.getElementById('methodChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (methodChartInstance) methodChartInstance.destroy();

  methodChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Debit Card', 'Credit Card', 'Bank Transfer', 'Cash'],
      datasets: [{
        data: [60, 25, 10, 5],
        backgroundColor: ['#00dbe9', '#d05bff', '#00ff9d', '#ffb700'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#e4e1e9' } } },
      cutout: '65%'
    }
  });
}

function renderHeatmapChart() {
  const container = document.getElementById('heatmap-grid-container');
  if (!container) return;

  let html = `<div class="flex gap-1 flex-wrap p-2 bg-surface-container-lowest/50 rounded-lg">`;
  for (let i = 0; i < 90; i++) {
    const level = Math.floor(Math.random() * 5);
    html += `<div class="heatmap-tile level-${level}" title="Day ${i + 1}"></div>`;
  }
  html += `</div>`;
  container.innerHTML = html;
}

// --- Utilities ---
function resetAllData() {
  if (confirm('Reset ledger data to defaults?')) {
    seedDemoData(true);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// Global Exports
window.appendNum = appendNum;
window.deleteNum = deleteNum;
window.updateDisplay = updateDisplay;
window.selectCategory = selectCategory;
window.triggerSuccess = triggerSuccess;
window.openTransactionModal = openTransactionModal;
window.closeTransactionModal = closeTransactionModal;
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.handleProfileSubmit = handleProfileSubmit;
window.openSendModal = openSendModal;
window.closeSendModal = closeSendModal;
window.handleSendSubmit = handleSendSubmit;
window.openReceiveModal = openReceiveModal;
window.closeReceiveModal = closeReceiveModal;
window.handleReceiveSubmit = handleReceiveSubmit;
window.openVaultModal = openVaultModal;
window.closeVaultModal = closeVaultModal;
window.handleVaultFormSubmit = handleVaultFormSubmit;
window.openSavingsModal = openSavingsModal;
window.switchReportTab = switchReportTab;
window.toggleViewAllTransactions = toggleViewAllTransactions;
window.resetAllData = resetAllData;
window.syncFromCloudDatabase = syncFromCloudDatabase;
