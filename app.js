/* ==========================================================================
   Personal Expense Tracker - Application Logic
   ========================================================================== */

// --- Application State ---
let state = {
  transactions: [],
  monthlySavings: 0,
  gistId: '',
  gistToken: '',
  isAdminLoggedIn: false,
  adminPin: '7871',
  currentFormType: 'expense',
  editingTxId: null
};

// --- Storage Keys ---
const STORAGE_KEY = 'smart_expense_tracker_data_v1';
const GIST_ID_STORAGE = 'smart_expense_tracker_gist_id';
const GIST_TOKEN_STORAGE = 'smart_expense_tracker_gist_token';
const ADMIN_SESSION_STORAGE = 'smart_expense_tracker_admin_session';

let cloudSyncInterval = null;

// --- Category Configuration & Visual Mapping (Lumina Neon Palette) ---
const CATEGORY_MAP = {
  Food: { icon: 'fa-utensils', color: '#ffb700', bg: 'rgba(255, 183, 0, 0.18)' },
  Transportation: { icon: 'fa-car', color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.18)' },
  Housing: { icon: 'fa-house-chimney', color: '#9d4edd', bg: 'rgba(157, 78, 221, 0.18)' },
  Shopping: { icon: 'fa-bag-shopping', color: '#ff007f', bg: 'rgba(255, 0, 127, 0.18)' },
  Entertainment: { icon: 'fa-gamepad', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.18)' },
  Health: { icon: 'fa-heart-pulse', color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.18)' },
  Education: { icon: 'fa-graduation-cap', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.18)' },
  Income: { icon: 'fa-money-bill-trend-up', color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.18)' },
  Other: { icon: 'fa-ellipsis', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.18)' }
};

// --- Chart Instances ---
let categoryChartInstance = null;
let trendChartInstance = null;
let monthlyExpenseChartInstance = null;
let weeklyExpenseChartInstance = null;
let weeklyCategoryChartInstance = null;
let methodChartInstance = null;
let balanceTrendChartInstance = null;
let activeReportTab = 'monthly';
let deferredPWAPrompt = null;

// --- Initialize App & Service Worker ---
document.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();
  initCloudDatabaseSync();

  // Set default date input to today
  document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];

  initEventListeners();
  updateAdminUiState();
  renderApp();
});

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      console.log('Coin Flow PWA ServiceWorker active:', reg.scope);
    }).catch((err) => {
      console.warn('ServiceWorker registration error:', err);
    });
  });
}

// --- PWA Mobile Install Banner Handlers ---
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPWAPrompt = e;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'block';
});

function installPWAApp() {
  if (!deferredPWAPrompt) return;
  deferredPWAPrompt.prompt();
  deferredPWAPrompt.userChoice.then((choice) => {
    if (choice.outcome === 'accepted') {
      showToast('Coin Flow Mobile App installed to homescreen!', 'success');
    }
    deferredPWAPrompt = null;
    dismissPWABanner();
  });
}

function dismissPWABanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'none';
}

// --- LocalStorage Operations ---
function loadFromLocalStorage() {
  try {
    const savedGistId = localStorage.getItem(GIST_ID_STORAGE);
    const savedGistToken = localStorage.getItem(GIST_TOKEN_STORAGE);

    if (savedGistToken) state.gistToken = savedGistToken;

    // Clean legacy default template Gist ID if token is missing
    if (savedGistId && savedGistId !== '4e9d3322f1da9f4a2ed6d79374937944') {
      state.gistId = savedGistId;
    } else if (savedGistId === '4e9d3322f1da9f4a2ed6d79374937944') {
      if (savedGistToken) {
        state.gistId = savedGistId;
      } else {
        localStorage.removeItem(GIST_ID_STORAGE);
        state.gistId = '';
      }
    }

    const savedAdminSession = sessionStorage.getItem(ADMIN_SESSION_STORAGE);
    if (savedAdminSession === 'true') state.isAdminLoggedIn = true;

    const rawData = localStorage.getItem(STORAGE_KEY);
    let localTxs = [];
    if (rawData) {
      const parsed = JSON.parse(rawData);
      localTxs = parsed.transactions || [];
      state.monthlySavings = typeof parsed.monthlySavings !== 'undefined' ? parsed.monthlySavings : 0;
    }

    const txMap = new Map();

    // Only load transactions from local saved storage (or cloud Gist)
    localTxs.forEach(tx => {
      if (tx && tx.id) txMap.set(tx.id, tx);
    });

    state.transactions = Array.from(txMap.values());
    state.transactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    fetchDbJsonFallback();
  } catch (err) {
    console.error('Failed to parse LocalStorage data:', err);
    state.transactions = [];
    state.monthlySavings = 0;
    saveToLocalStorage(false);
  }
}

async function fetchDbJsonFallback() {
  try {
    const res = await fetch('db.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.transactions)) {
        if (data.transactions.length > 0) {
          const txMap = new Map();
          (state.transactions || []).forEach(tx => {
            if (tx && tx.id) txMap.set(tx.id, tx);
          });
          data.transactions.forEach(tx => {
            if (tx && tx.id && !txMap.has(tx.id)) {
              txMap.set(tx.id, tx);
            }
          });
          state.transactions = Array.from(txMap.values());
          state.transactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        }
        if (typeof data.monthlySavings !== 'undefined') {
          state.monthlySavings = data.monthlySavings;
        }
        saveToLocalStorage(false);
        renderApp();
      }
    }
  } catch (e) {
    // Ignore static fetch errors
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

// --- Database & Cloud Synchronization Engine ---
function initCloudDatabaseSync() {
  if (state.gistId && state.gistToken) {
    syncFromCloudDatabase();
  } else {
    updateSyncPillStatus('unconfigured');
  }

  window.addEventListener('focus', () => {
    if (state.gistId && state.gistToken) syncFromCloudDatabase();
  });
  if (!cloudSyncInterval) {
    cloudSyncInterval = setInterval(() => {
      if (state.gistId && state.gistToken) syncFromCloudDatabase();
    }, 30000);
  }
}

async function connectAndSyncGist(manual = true) {
  const gistIdInput = document.getElementById('gist-id-input');
  const gistTokenInput = document.getElementById('gist-token-input');

  const gistIdVal = gistIdInput ? gistIdInput.value.trim() : state.gistId;
  const gistTokenVal = gistTokenInput ? gistTokenInput.value.trim() : state.gistToken;

  state.gistId = gistIdVal || '';
  state.gistToken = gistTokenVal || '';

  if (state.gistId) localStorage.setItem(GIST_ID_STORAGE, state.gistId);
  else localStorage.removeItem(GIST_ID_STORAGE);

  if (state.gistToken) localStorage.setItem(GIST_TOKEN_STORAGE, state.gistToken);
  else localStorage.removeItem(GIST_TOKEN_STORAGE);

  if (!state.gistId && !state.gistToken) {
    updateSyncPillStatus('unconfigured');
    if (manual) showToast('Please enter a Gist ID or Access Token (PAT).', 'warning');
    return false;
  }

  updateSyncPillStatus('syncing');

  // Push current dataset directly to GitHub Gist (overwriting remote data.json & expenses.json)
  const syncSuccess = await syncToGitHubGist(false);

  if (syncSuccess) {
    if (manual) showToast('Connected & Synced with GitHub Gist successfully!', 'success');
    closeVaultModal();
    renderApp();
    return true;
  } else {
    if (manual) showToast('Failed to sync with GitHub Gist. Please check Gist ID & Token.', 'error');
    return false;
  }
}

async function clearAndResetGistData() {
  const gistIdInput = document.getElementById('gist-id-input');
  const gistTokenInput = document.getElementById('gist-token-input');

  const gistIdVal = gistIdInput ? gistIdInput.value.trim() : state.gistId;
  const gistTokenVal = gistTokenInput ? gistTokenInput.value.trim() : state.gistToken;

  if (gistIdVal) state.gistId = gistIdVal;
  if (gistTokenVal) state.gistToken = gistTokenVal;

  if (!state.gistId || !state.gistToken) {
    showToast('Please enter both Gist ID and Access Token (PAT) to clear cloud Gist data.', 'warning');
    return;
  }

  if (!confirm('Are you sure you want to permanently delete all transaction data from your GitHub Gist cloud storage (data.json & expenses.json)?')) {
    return;
  }

  state.transactions = [];
  state.monthlySavings = 0;
  saveToLocalStorage(false);

  const payload = {
    transactions: [],
    monthlySavings: 0,
    updatedAt: new Date().toISOString()
  };

  const filesContent = {
    'data.json': { content: JSON.stringify(payload, null, 2) },
    'expenses.json': { content: JSON.stringify(payload, null, 2) }
  };

  updateSyncPillStatus('syncing');

  let url = `https://api.github.com/gists/${state.gistId}`;
  let headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };

  const tokenStr = state.gistToken.trim();
  if (tokenStr.startsWith('Bearer ') || tokenStr.startsWith('token ')) {
    headers['Authorization'] = tokenStr;
  } else if (tokenStr.startsWith('github_pat_')) {
    headers['Authorization'] = `Bearer ${tokenStr}`;
  } else {
    headers['Authorization'] = `token ${tokenStr}`;
  }

  try {
    let res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ files: filesContent })
    });

    if (!res || (!res.ok && res.status !== 401 && res.status !== 404)) {
      const proxyHeaders = { 'Content-Type': 'application/json', 'x-github-token': state.gistToken };
      res = await fetch(`/api/gist-proxy?gistId=${state.gistId}`, {
        method: 'PATCH',
        headers: proxyHeaders,
        body: JSON.stringify({ files: filesContent })
      });
    }

    if (res && res.ok) {
      showToast('Successfully wiped all transactions from GitHub Gist (data.json & expenses.json)!', 'success');
      updateSyncPillStatus('synced');
      closeVaultModal();
      renderApp();
    } else {
      showToast('Failed to clear Gist data. Check Gist ID & PAT token permissions.', 'error');
      updateSyncPillStatus('failed');
    }
  } catch (err) {
    showToast('Network error while resetting Gist data.', 'error');
    updateSyncPillStatus('failed');
  }
}


async function syncToGitHubGist(manual = false) {
  if (!state.gistId && !state.gistToken) {
    updateSyncPillStatus('unconfigured');
    if (manual) showToast('Please enter a GitHub Access Token (PAT) or Gist ID.', 'warning');
    return false;
  }

  try {
    updateSyncPillStatus('syncing');
    
    const payload = {
      transactions: state.transactions || [],
      monthlySavings: state.monthlySavings || 0,
      updatedAt: new Date().toISOString()
    };

    const filesContent = {
      'data.json': { content: JSON.stringify(payload, null, 2) },
      'expenses.json': { content: JSON.stringify(payload, null, 2) }
    };

    let url = state.gistId 
      ? `https://api.github.com/gists/${state.gistId}`
      : `https://api.github.com/gists`;
    let method = state.gistId ? 'PATCH' : 'POST';

    let headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };

    if (state.gistToken) {
      const tokenStr = state.gistToken.trim();
      if (tokenStr.startsWith('Bearer ') || tokenStr.startsWith('token ')) {
        headers['Authorization'] = tokenStr;
      } else if (tokenStr.startsWith('github_pat_')) {
        headers['Authorization'] = `Bearer ${tokenStr}`;
      } else {
        headers['Authorization'] = `token ${tokenStr}`;
      }
    }

    const bodyData = method === 'POST' 
      ? JSON.stringify({ description: 'Coin Flow Expense Data Backup', public: false, files: filesContent })
      : JSON.stringify({ files: filesContent });

    let res;
    try {
      res = await fetch(url, { method, headers, body: bodyData });
    } catch (e) {
      console.warn('Direct GitHub fetch error, attempting server proxy...', e);
    }

    // Proxy fallback only if direct fetch failed
    if (!res || (!res.ok && res.status !== 401 && res.status !== 404)) {
      const proxyUrl = state.gistId ? `/api/gist-proxy?gistId=${state.gistId}` : `/api/gist-proxy`;
      const proxyHeaders = { 'Content-Type': 'application/json' };
      if (state.gistToken) proxyHeaders['x-github-token'] = state.gistToken;
      try {
        const proxyRes = await fetch(proxyUrl, { method, headers: proxyHeaders, body: bodyData });
        if (proxyRes.ok) res = proxyRes;
      } catch (proxyErr) {
        console.warn('Gist proxy fetch error:', proxyErr);
      }
    }

    if (res && res.ok) {
      const data = await res.json();
      if (data.id) {
        state.gistId = data.id;
        localStorage.setItem(GIST_ID_STORAGE, state.gistId);
        const inputElem = document.getElementById('gist-id-input');
        if (inputElem) inputElem.value = state.gistId;
      }
      updateSyncPillStatus('synced');
      if (manual) showToast('Synced data to GitHub Gist successfully!', 'success');
      return true;
    } else {
      updateSyncPillStatus('failed');
      const errStatus = res ? res.status : 0;
      if (manual) {
        if (errStatus === 404) showToast('Gist ID not found on GitHub. Check your Gist ID.', 'error');
        else if (errStatus === 401) showToast('GitHub Access Token (PAT) invalid or missing permissions.', 'error');
        else showToast('Failed to sync with GitHub Gist. Check Gist ID & Token.', 'error');
      }
      return false;
    }
  } catch (err) {
    console.warn('Gist Sync error:', err);
    updateSyncPillStatus('failed');
    if (manual) showToast('Network/Sync error. Local data remains safe.', 'error');
    return false;
  }
}

async function restoreFromGist(manual = false) {
  if (!state.gistId) {
    updateSyncPillStatus('unconfigured');
    if (manual) showToast('Please enter a Gist ID or sync first.', 'warning');
    return false;
  }

  try {
    updateSyncPillStatus('syncing');

    let headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (state.gistToken) {
      const tokenStr = state.gistToken.trim();
      if (tokenStr.startsWith('Bearer ') || tokenStr.startsWith('token ')) {
        headers['Authorization'] = tokenStr;
      } else if (tokenStr.startsWith('github_pat_')) {
        headers['Authorization'] = `Bearer ${tokenStr}`;
      } else {
        headers['Authorization'] = `token ${tokenStr}`;
      }
    }

    let res;
    try {
      res = await fetch(`https://api.github.com/gists/${state.gistId}`, { method: 'GET', headers });
    } catch (e) {
      console.warn('Direct fetch failed, trying proxy...', e);
    }
    
    if (!res || (!res.ok && res.status !== 404 && res.status !== 401)) {
      const proxyHeaders = {};
      if (state.gistToken) proxyHeaders['x-github-token'] = state.gistToken;
      try {
        const proxyRes = await fetch(`/api/gist-proxy?gistId=${state.gistId}`, { method: 'GET', headers: proxyHeaders });
        if (proxyRes.ok) res = proxyRes;
      } catch (proxyErr) {
        console.warn('Proxy restore fetch error:', proxyErr);
      }
    }

    if (res && res.ok) {
      const gistData = await res.json();
      const files = gistData.files || {};
      const targetFile = files['data.json'] || files['expenses.json'] || files[Object.keys(files)[0]];

      if (targetFile && targetFile.content) {
        const remoteContent = JSON.parse(targetFile.content);

        const txMap = new Map();
        
        // Remote cloud transactions (Single source of truth from GitHub Gist)
        if (Array.isArray(remoteContent.transactions)) {
          remoteContent.transactions.forEach(tx => {
            if (tx && tx.id) txMap.set(tx.id, tx);
          });
        }

        state.transactions = Array.from(txMap.values());
        state.transactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        if (typeof remoteContent.monthlySavings !== 'undefined' && remoteContent.monthlySavings > 0) {
          state.monthlySavings = remoteContent.monthlySavings;
        }

        saveToLocalStorage(false);
        renderApp();
        updateSyncPillStatus('synced');
        if (manual) showToast('Successfully restored and merged Gist data!', 'success');
        return true;
      }
    }

    updateSyncPillStatus('failed');
    if (manual) {
      if (res && res.status === 404) showToast('Gist ID not found on GitHub.', 'error');
      else if (res && res.status === 401) showToast('GitHub Access Token invalid/unauthorized.', 'error');
      else showToast('Could not fetch valid Gist backup file.', 'error');
    }
    return false;
  } catch (err) {
    console.warn('Gist Restore error:', err);
    updateSyncPillStatus('failed');
    if (manual) showToast('Restore failed. Local data remains intact.', 'error');
    return false;
  }
}

async function syncFromCloudDatabase() {
  return await restoreFromGist(false);
}

async function syncToCloudDatabase() {
  return await syncToGitHubGist(false);
}

function updateSyncPillStatus(status) {
  const pill = document.getElementById('sync-status-pill');
  if (!pill) return;
  
  if (status === 'synced' || status === 'online') {
    pill.style.color = '#10b981';
    pill.innerHTML = `<i class="fa-solid fa-circle-check"></i> Synced`;
  } else if (status === 'syncing') {
    pill.style.color = '#3b82f6';
    pill.innerHTML = `<i class="fa-solid fa-arrows-rotate fa-spin"></i> Syncing...`;
  } else if (status === 'local') {
    pill.style.color = '#10b981';
    pill.innerHTML = `<i class="fa-solid fa-hard-drive"></i> Local DB`;
  } else if (status === 'unconfigured') {
    pill.style.color = '#f59e0b';
    pill.innerHTML = `<i class="fa-brands fa-github"></i> Setup Gist`;
  } else {
    if (state.gistId && state.gistToken) {
      pill.style.color = '#ef4444';
      pill.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Sync Failed`;
    } else {
      pill.style.color = '#f59e0b';
      pill.innerHTML = `<i class="fa-brands fa-github"></i> Setup Gist`;
    }
  }
}

// --- Local Date Helper (Prevents Timezone Shifts) ---
function getLocalDateString(d) {
  if (!d) return '';
  const dateObj = typeof d === 'string' ? new Date(d.length === 10 ? d + 'T00:00:00' : d) : d;
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDefaultTransactions() {
  return [];
}

// --- Seed Sample Data ---
function seedDemoData(notify = true) {
  state.monthlySavings = 0;
  state.transactions = [];
  saveToLocalStorage(false);
  renderApp();
  if (notify) showToast('Local transaction data cleared!', 'success');
}

// --- Render Core App ---
function renderApp() {
  calculateMetrics();
  updateReportMetrics();
  renderTransactionsTable();
  if (activeReportTab === 'heatmap') {
    renderHeatmapChart();
  }
  renderCharts();
}

// --- Transactions Table Rendering ---
function renderTransactionsTable() {
  const tbody = document.getElementById('transactions-tbody');
  const emptyState = document.getElementById('empty-state');
  if (!tbody) return;

  const searchInput = document.getElementById('search-input');
  const filterTypeEl = document.getElementById('filter-type');
  const filterCatEl = document.getElementById('filter-category');
  const filterSortEl = document.getElementById('filter-sort');

  const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const filterType = filterTypeEl ? filterTypeEl.value : 'all';
  const filterCat = filterCatEl ? filterCatEl.value : 'all';
  const filterSort = filterSortEl ? filterSortEl.value : 'date-desc';

  // Filtering
  let filtered = state.transactions.filter(tx => {
    const note = (tx.note || '').toLowerCase();
    const category = (tx.category || '').toLowerCase();
    const method = (tx.method || '').toLowerCase();

    const matchesSearch = note.includes(searchQuery) ||
                          category.includes(searchQuery) ||
                          method.includes(searchQuery);
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
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

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

// --- Report Tab Switcher ---
function switchReportTab(tabMode) {
  activeReportTab = tabMode;

  const btnMonthly = document.getElementById('tab-btn-monthly');
  const btnWeekly = document.getElementById('tab-btn-weekly');
  const btnDatabase = document.getElementById('tab-btn-database');
  const btnHeatmap = document.getElementById('tab-btn-heatmap');

  const mnavMonthly = document.getElementById('mnav-monthly');
  const mnavWeekly = document.getElementById('mnav-weekly');
  const mnavDatabase = document.getElementById('mnav-database');
  const mnavHeatmap = document.getElementById('mnav-heatmap');

  const panelMonthly = document.getElementById('panel-report-monthly');
  const panelWeekly = document.getElementById('panel-report-weekly');
  const panelDatabase = document.getElementById('panel-report-database');
  const panelHeatmap = document.getElementById('panel-report-heatmap');

  [btnMonthly, btnWeekly, btnDatabase, btnHeatmap].forEach(b => { if (b) b.classList.remove('active'); });
  [mnavMonthly, mnavWeekly, mnavDatabase, mnavHeatmap].forEach(b => { if (b) b.classList.remove('active'); });
  [panelMonthly, panelWeekly, panelDatabase, panelHeatmap].forEach(p => { if (p) p.style.display = 'none'; });

  if (tabMode === 'monthly') {
    if (btnMonthly) btnMonthly.classList.add('active');
    if (mnavMonthly) mnavMonthly.classList.add('active');
    if (panelMonthly) panelMonthly.style.display = 'block';
  } else if (tabMode === 'weekly') {
    if (btnWeekly) btnWeekly.classList.add('active');
    if (mnavWeekly) mnavWeekly.classList.add('active');
    if (panelWeekly) panelWeekly.style.display = 'block';
  } else if (tabMode === 'database') {
    if (btnDatabase) btnDatabase.classList.add('active');
    if (mnavDatabase) mnavDatabase.classList.add('active');
    if (panelDatabase) panelDatabase.style.display = 'block';
  } else if (tabMode === 'heatmap') {
    if (btnHeatmap) btnHeatmap.classList.add('active');
    if (mnavHeatmap) mnavHeatmap.classList.add('active');
    if (panelHeatmap) panelHeatmap.style.display = 'block';
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      renderApp();
    });
  });
}

// --- Metric Calculations ---
function calculateMetrics() {
  const now = new Date();
  const currentMonthKey = getLocalDateString(now).substring(0, 7); // YYYY-MM
  const currentMonthName = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  // Update month badge UI (e.g. July 2026)
  const monthBadgeEl = document.getElementById('current-month-badge');
  if (monthBadgeEl) monthBadgeEl.innerText = currentMonthName;

  let allTimeIncome = 0;
  let allTimeExpense = 0;
  let currentMonthIncome = 0;
  let currentMonthExpense = 0;
  let currentMonthExpenseCount = 0;

  state.transactions.forEach(tx => {
    const val = parseFloat(tx.amount) || 0;
    const isCurrentMonth = tx.date && tx.date.startsWith(currentMonthKey);

    if (tx.type === 'income') {
      allTimeIncome += val;
      if (isCurrentMonth) {
        currentMonthIncome += val;
      }
    } else {
      allTimeExpense += val;
      if (isCurrentMonth) {
        currentMonthExpense += val;
        currentMonthExpenseCount++;
      }
    }
  });

  // Net Balance STAYS ALL-TIME (Cumulative)
  const netBalance = allTimeIncome - allTimeExpense;

  // Check month filter dropdown
  const filterMonthEl = document.getElementById('filter-month');
  const filterVal = filterMonthEl ? filterMonthEl.value : 'current';

  const displayIncome = filterVal === 'all' ? allTimeIncome : currentMonthIncome;
  const displayExpense = filterVal === 'all' ? allTimeExpense : currentMonthExpense;
  const displayCount = filterVal === 'all' 
    ? state.transactions.filter(t => t.type === 'expense').length 
    : currentMonthExpenseCount;

  // DOM Elements
  // 1. Net Balance: Always All-Time Cumulative
  document.getElementById('metric-balance').innerText = formatCurrency(netBalance);
  
  // 2. Monthly Income: Restarts on 1st of every month
  document.getElementById('metric-income').innerText = formatCurrency(displayIncome);
  
  // 3. Monthly Spent: Restarts on 1st of every month
  document.getElementById('metric-expense').innerText = formatCurrency(displayExpense);
  
  const metricSavingsEl = document.getElementById('metric-savings');
  if (metricSavingsEl) {
    metricSavingsEl.innerText = formatCurrency(state.monthlySavings || 0);
  }

  const savingsSubtextEl = document.getElementById('savings-subtext-info');
  if (savingsSubtextEl) {
    savingsSubtextEl.innerText = `Manually set monthly target`;
  }

  const countEl = document.getElementById('metric-count');
  if (countEl) {
    countEl.innerText = filterVal === 'all'
      ? `${displayCount} items logged (All Time)`
      : `${displayCount} items logged (${currentMonthName})`;
  }
}

// --- Detailed Weekly & Monthly Report Metrics ---
function updateReportMetrics() {
  // 1. Monthly Report Highlights
  const currentMonthKey = new Date().toISOString().substring(0, 7);
  const now = new Date();
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = prevMonthDate.toISOString().substring(0, 7);

  let thisMonthTotal = 0;
  let prevMonthTotal = 0;
  const monthCatMap = {};

  state.transactions.forEach(tx => {
    if (tx.type === 'expense' && tx.date) {
      const val = parseFloat(tx.amount) || 0;
      if (tx.date.startsWith(currentMonthKey)) {
        thisMonthTotal += val;
        monthCatMap[tx.category] = (monthCatMap[tx.category] || 0) + val;
      } else if (tx.date.startsWith(prevMonthKey)) {
        prevMonthTotal += val;
      }
    }
  });

  const weeklyAvg = thisMonthTotal / 4;
  let momTrendStr = '0%';
  if (prevMonthTotal > 0) {
    const diff = ((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100;
    momTrendStr = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
  } else if (thisMonthTotal > 0) {
    momTrendStr = '+100%';
  }

  let topMonthCat = 'None';
  let maxMonthCatVal = 0;
  Object.keys(monthCatMap).forEach(cat => {
    if (monthCatMap[cat] > maxMonthCatVal) {
      maxMonthCatVal = monthCatMap[cat];
      topMonthCat = cat;
    }
  });

  const elMonthTotal = document.getElementById('monthly-report-total');
  const elMonthWeeklyAvg = document.getElementById('monthly-report-weekly-avg');
  const elMonthMom = document.getElementById('monthly-report-mom-trend');
  const elMonthTopCat = document.getElementById('monthly-report-top-cat');

  if (elMonthTotal) elMonthTotal.innerText = formatCurrency(thisMonthTotal);
  if (elMonthWeeklyAvg) elMonthWeeklyAvg.innerText = formatCurrency(weeklyAvg);
  if (elMonthMom) {
    elMonthMom.innerText = momTrendStr;
    elMonthMom.style.color = momTrendStr.startsWith('-') ? 'var(--success)' : 'var(--danger)';
  }
  if (elMonthTopCat) elMonthTopCat.innerText = topMonthCat;

  // 2. Weekly Report Highlights
  const today = new Date();
  const day = today.getDay();
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const monDate = new Date(today);
  monDate.setDate(today.getDate() + diffToMon);

  const sunDate = new Date(monDate);
  sunDate.setDate(monDate.getDate() + 6);

  const monStr = monDate.toISOString().substring(0, 10);
  const sunStr = sunDate.toISOString().substring(0, 10);

  let thisWeekTotal = 0;
  const daySpendMap = { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 };
  const weekCatMap = {};
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  state.transactions.forEach(tx => {
    if (tx.type === 'expense' && tx.date) {
      if (tx.date >= monStr && tx.date <= sunStr) {
        const val = parseFloat(tx.amount) || 0;
        thisWeekTotal += val;

        const dObj = new Date(tx.date + 'T00:00:00');
        const dayName = dayNames[dObj.getDay()];
        if (daySpendMap[dayName] !== undefined) {
          daySpendMap[dayName] += val;
        }

        weekCatMap[tx.category] = (weekCatMap[tx.category] || 0) + val;
      }
    }
  });

  const dailyAvg = thisWeekTotal / 7;

  let peakDayName = 'None';
  let peakDayVal = 0;
  Object.keys(daySpendMap).forEach(d => {
    if (daySpendMap[d] > peakDayVal) {
      peakDayVal = daySpendMap[d];
      peakDayName = d;
    }
  });

  let topWeekCat = 'None';
  let maxWeekCatVal = 0;
  Object.keys(weekCatMap).forEach(cat => {
    if (weekCatMap[cat] > maxWeekCatVal) {
      maxWeekCatVal = weekCatMap[cat];
      topWeekCat = cat;
    }
  });

  const elWeekTotal = document.getElementById('weekly-report-total');
  const elWeekDailyAvg = document.getElementById('weekly-report-daily-avg');
  const elWeekPeakDay = document.getElementById('weekly-report-peak-day');
  const elWeekTopCat = document.getElementById('weekly-report-top-cat');

  if (elWeekTotal) elWeekTotal.innerText = formatCurrency(thisWeekTotal);
  if (elWeekDailyAvg) elWeekDailyAvg.innerText = formatCurrency(dailyAvg);
  if (elWeekPeakDay) elWeekPeakDay.innerText = peakDayVal > 0 ? `${peakDayName} (${formatCurrency(peakDayVal)})` : 'None';
  if (elWeekTopCat) elWeekTopCat.innerText = topWeekCat;

  // 3. AI Database Analysis Highlights
  let dbIncome = 0;
  let dbExpense = 0;
  let maxExpenseTx = null;
  const methodCountMap = {};

  state.transactions.forEach(tx => {
    const val = parseFloat(tx.amount) || 0;
    if (tx.type === 'income') {
      dbIncome += val;
    } else {
      dbExpense += val;
      if (!maxExpenseTx || val > maxExpenseTx.amount) {
        maxExpenseTx = tx;
      }
      methodCountMap[tx.method] = (methodCountMap[tx.method] || 0) + 1;
    }
  });

  const netSavings = dbIncome - dbExpense;
  const savingsRatio = dbIncome > 0 ? Math.max(0, (netSavings / dbIncome) * 100) : 0;
  
  // Health Score Calculation (0 to 100)
  let healthScore = 70;
  if (dbIncome > 0) {
    if (savingsRatio >= 30) healthScore = 92;
    else if (savingsRatio >= 20) healthScore = 85;
    else if (savingsRatio >= 10) healthScore = 75;
    else if (savingsRatio > 0) healthScore = 65;
    else healthScore = 45;
  }
  if (dbExpense > dbIncome && dbIncome > 0) healthScore = 35;

  let topMethodName = 'None';
  let maxMethodCount = 0;
  Object.keys(methodCountMap).forEach(m => {
    if (methodCountMap[m] > maxMethodCount) {
      maxMethodCount = methodCountMap[m];
      topMethodName = m;
    }
  });

  const daysSpan = Math.max(1, Math.ceil(state.transactions.length / 2) * 5);
  const velocity = dbExpense / daysSpan;

  const elHealthScore = document.getElementById('analysis-health-score');
  const elSavingsRate = document.getElementById('db-analysis-savings-rate');
  const elLargestTx = document.getElementById('db-analysis-largest-tx');
  const elLargestNote = document.getElementById('db-analysis-largest-note');
  const elTopMethod = document.getElementById('db-analysis-top-method');
  const elVelocity = document.getElementById('db-analysis-velocity');
  const elInsightsList = document.getElementById('db-analysis-insights-list');

  if (elHealthScore) elHealthScore.innerText = `${healthScore}/100`;
  if (elSavingsRate) elSavingsRate.innerText = `${savingsRatio.toFixed(1)}%`;
  if (elLargestTx) elLargestTx.innerText = maxExpenseTx ? formatCurrency(maxExpenseTx.amount) : '₹0.00';
  if (elLargestNote) elLargestNote.innerText = maxExpenseTx ? maxExpenseTx.note : 'None';
  if (elTopMethod) elTopMethod.innerText = topMethodName;
  if (elVelocity) elVelocity.innerText = `${formatCurrency(velocity)}/day`;

  if (elInsightsList) {
    let insights = [];
    if (netSavings > 0) {
      insights.push(`<strong>Healthy Cashflow:</strong> You are saving ${savingsRatio.toFixed(1)}% of your total gross income.`);
    } else {
      insights.push(`<strong>Deficit Alert:</strong> Total expenses exceed recorded income. Consider reviewing non-essential spending.`);
    }

    if (maxExpenseTx) {
      insights.push(`<strong>Largest Single Expenditure:</strong> "${escapeHtml(maxExpenseTx.note)}" at ${formatCurrency(maxExpenseTx.amount)} (${maxExpenseTx.category}).`);
    }

    if (topMethodName !== 'None') {
      insights.push(`<strong>Preferred Payment Channel:</strong> ${topMethodName} accounts for ${maxMethodCount} transaction${maxMethodCount > 1 ? 's' : ''}.`);
    }

    elInsightsList.innerHTML = insights.map(item => `<li>${item}</li>`).join('');
  }
}

// --- Month Filter & Restart Actions ---
function handleMonthFilterChange(e) {
  renderApp();
}

function restartMonthlySpent() {
  if (!state.isAdminLoggedIn) {
    openAdminModal();
    return;
  }

  const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  if (confirm(`Restart monthly spent for ${currentMonthName}?\n\nThis will clear/archive current month's expenses so your spent counter restarts fresh from ₹0.00 for ${currentMonthName}.`)) {
    const currentMonthKey = new Date().toISOString().substring(0, 7);
    // Remove expense transactions for current month to reset monthly counter
    state.transactions = state.transactions.filter(tx => {
      return !(tx.type === 'expense' && tx.date.startsWith(currentMonthKey));
    });

    saveToLocalStorage();
    renderApp();
    showToast(`Monthly spent restarted to ₹0.00 for ${currentMonthName}!`, 'success');
  }
}

// --- Chart Visualizations Router ---
function renderCharts() {
  if (typeof Chart === 'undefined') return;
  try {
    if (activeReportTab === 'monthly') {
      try { renderMonthlyExpenseChart(); } catch (e) { console.warn('Monthly chart error:', e); }
      try { renderCategoryChart(); } catch (e) { console.warn('Category chart error:', e); }
    } else if (activeReportTab === 'weekly') {
      try { renderWeeklyExpenseChart(); } catch (e) { console.warn('Weekly chart error:', e); }
      try { renderWeeklyCategoryChart(); } catch (e) { console.warn('Weekly category chart error:', e); }
    } else if (activeReportTab === 'database') {
      try { renderMethodChart(); } catch (e) { console.warn('Method chart error:', e); }
      try { renderBalanceTrendChart(); } catch (e) { console.warn('Balance chart error:', e); }
    } else if (activeReportTab === 'heatmap') {
      try { renderTrendChart(); } catch (e) { console.warn('Trend chart error:', e); }
    }
  } catch (err) {
    console.warn('Error rendering charts:', err);
  }
}

// --- GitHub-Style Daily Expense Activity Heatmap ---
function renderHeatmapChart() {
  const container = document.getElementById('heatmap-grid-container');
  if (!container) return;

  const today = new Date();
  const endDate = new Date(today);
  // Align to end of current week (Saturday)
  const dayOfWeek = endDate.getDay();
  endDate.setDate(endDate.getDate() + (6 - dayOfWeek));

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (52 * 7 - 1)); // 364 days (52 weeks)

  // Map expenses per YYYY-MM-DD
  const expenseByDate = {};
  let totalYearExpense = 0;
  let activeDaysCount = 0;

  state.transactions.forEach(tx => {
    if (tx.type === 'expense' && tx.date) {
      const dateStr = tx.date;
      const val = parseFloat(tx.amount) || 0;
      if (!expenseByDate[dateStr]) {
        expenseByDate[dateStr] = { total: 0, count: 0 };
      }
      expenseByDate[dateStr].total += val;
      expenseByDate[dateStr].count += 1;
    }
  });

  // Calculate day cells data
  let maxDailyExpense = 0;
  const daysArray = [];
  const curr = new Date(startDate);

  while (curr <= endDate) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, '0');
    const dd = String(curr.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const data = expenseByDate[dateStr] || { total: 0, count: 0 };
    if (data.total > 0) {
      activeDaysCount++;
      totalYearExpense += data.total;
      if (data.total > maxDailyExpense) maxDailyExpense = data.total;
    }

    daysArray.push({
      dateStr: dateStr,
      dateObj: new Date(curr),
      total: data.total,
      count: data.count
    });

    curr.setDate(curr.getDate() + 1);
  }

  // Update header stats
  const activeDaysEl = document.getElementById('heatmap-active-days');
  const totalYearEl = document.getElementById('heatmap-total-year');
  if (activeDaysEl) activeDaysEl.innerText = activeDaysCount;
  if (totalYearEl) totalYearEl.innerText = formatCurrency(totalYearExpense);

  // Group into weeks (52 columns of 7 days)
  const weeks = [];
  for (let i = 0; i < daysArray.length; i += 7) {
    weeks.push(daysArray.slice(i, i + 7));
  }

  // Month label positions
  const monthLabels = [];
  let currentMonthName = '';
  weeks.forEach((week, weekIdx) => {
    const firstDayOfWeek = week[0];
    if (firstDayOfWeek) {
      const mName = firstDayOfWeek.dateObj.toLocaleString('default', { month: 'short' });
      if (mName !== currentMonthName) {
        currentMonthName = mName;
        monthLabels.push({ name: mName, weekIndex: weekIdx });
      }
    }
  });

  // Build Grid HTML
  let html = '';

  // Month labels row
  html += `<div class="heatmap-months-header">`;
  monthLabels.forEach(m => {
    const leftPx = m.weekIndex * 14; // 11px tile width + 3px gap
    html += `<span class="heatmap-month-label" style="left: ${leftPx}px">${m.name}</span>`;
  });
  html += `</div>`;

  // Main grid layout
  html += `<div class="heatmap-main-grid">`;
  
  // Weekday column
  html += `<div class="heatmap-weekdays-col">`;
  html += `<span></span>`; // Sun
  html += `<span>Mon</span>`;
  html += `<span></span>`; // Tue
  html += `<span>Wed</span>`;
  html += `<span></span>`; // Thu
  html += `<span>Fri</span>`;
  html += `<span></span>`; // Sat
  html += `</div>`;

  // Weeks grid
  html += `<div class="heatmap-weeks-wrapper">`;
  weeks.forEach(week => {
    html += `<div class="heatmap-week-col">`;
    week.forEach(day => {
      let level = 0;
      if (day.total > 0) {
        if (maxDailyExpense > 0) {
          const ratio = day.total / maxDailyExpense;
          if (ratio <= 0.25) level = 1;
          else if (ratio <= 0.5) level = 2;
          else if (ratio <= 0.75) level = 3;
          else level = 4;
        } else {
          level = 1;
        }
      }

      const formattedDateStr = day.dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const tooltipText = day.total > 0 
        ? `${formatCurrency(day.total)} spent on ${formattedDateStr} (${day.count} transaction${day.count > 1 ? 's' : ''})`
        : `No expenses logged on ${formattedDateStr}`;

      html += `<div class="heatmap-tile level-${level}" title="${tooltipText}"></div>`;
    });
    html += `</div>`;
  });
  html += `</div>`; // end weeks-wrapper

  html += `</div>`; // end main-grid

  container.innerHTML = html;
}

// --- Dedicated Monthly Expenses Graph ---
function renderMonthlyExpenseChart() {
  const canvas = document.getElementById('monthlyExpenseChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Aggregate expenses per YYYY-MM
  const monthlyExpenses = {};
  state.transactions.forEach(tx => {
    if (tx.type === 'expense' && tx.date) {
      const monthKey = tx.date.substring(0, 7);
      monthlyExpenses[monthKey] = (monthlyExpenses[monthKey] || 0) + parseFloat(tx.amount);
    }
  });

  let sortedMonths = Object.keys(monthlyExpenses).sort();
  const currentMonthKey = new Date().toISOString().substring(0, 7);
  if (!sortedMonths.includes(currentMonthKey)) {
    sortedMonths.push(currentMonthKey);
    sortedMonths.sort();
  }

  const dataValues = sortedMonths.map(m => monthlyExpenses[m] || 0);
  const monthLabels = sortedMonths.map(m => {
    const [year, month] = m.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleString('default', { month: 'short', year: '2-digit' });
  });

  if (monthlyExpenseChartInstance) {
    monthlyExpenseChartInstance.destroy();
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(244, 63, 94, 0.35)');
  gradient.addColorStop(1, 'rgba(244, 63, 94, 0.0)');

  monthlyExpenseChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthLabels,
      datasets: [{
        label: 'Monthly Spent',
        data: dataValues,
        borderColor: '#f43f5e',
        borderWidth: 3,
        backgroundColor: gradient,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#f43f5e',
        pointBorderColor: '#ffffff',
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` Total Spent: ₹${context.raw.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { display: false } },
        y: {
          ticks: { color: '#64748b', callback: value => '₹' + value },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    }
  });
}

// --- Dedicated Weekly Expenses Graph ---
function renderWeeklyExpenseChart() {
  const canvas = document.getElementById('weeklyExpenseChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Compute Monday date of current week
  const today = new Date();
  const day = today.getDay();
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const monDate = new Date(today);
  monDate.setDate(today.getDate() + diffToMon);

  const daysList = [];
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayValues = [0, 0, 0, 0, 0, 0, 0];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monDate);
    d.setDate(monDate.getDate() + i);
    daysList.push(getLocalDateString(d));
  }

  state.transactions.forEach(tx => {
    if (tx.type === 'expense' && tx.date) {
      const idx = daysList.indexOf(tx.date);
      if (idx !== -1) {
        dayValues[idx] += parseFloat(tx.amount) || 0;
      }
    }
  });

  if (weeklyExpenseChartInstance) {
    weeklyExpenseChartInstance.destroy();
  }

  weeklyExpenseChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dayLabels,
      datasets: [{
        label: 'Daily Expense (₹)',
        data: dayValues,
        backgroundColor: '#10b981',
        hoverBackgroundColor: '#34d399',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` Spent: ₹${context.raw.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { display: false } },
        y: {
          ticks: { color: '#64748b', callback: val => '₹' + val },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    }
  });
}

function renderWeeklyCategoryChart() {
  const canvas = document.getElementById('weeklyCategoryChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const today = new Date();
  const day = today.getDay();
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const monDate = new Date(today);
  monDate.setDate(today.getDate() + diffToMon);

  const sunDate = new Date(monDate);
  sunDate.setDate(monDate.getDate() + 6);

  const monStr = getLocalDateString(monDate);
  const sunStr = getLocalDateString(sunDate);

  const weekCategoryMap = {};
  state.transactions.forEach(tx => {
    if (tx.type === 'expense' && tx.date && tx.date >= monStr && tx.date <= sunStr) {
      weekCategoryMap[tx.category] = (weekCategoryMap[tx.category] || 0) + parseFloat(tx.amount);
    }
  });

  const labels = Object.keys(weekCategoryMap);
  const dataValues = Object.values(weekCategoryMap);
  const backgroundColors = labels.map(cat => (CATEGORY_MAP[cat] ? CATEGORY_MAP[cat].color : '#64748b'));

  if (weeklyCategoryChartInstance) {
    weeklyCategoryChartInstance.destroy();
  }

  if (labels.length === 0) {
    weeklyCategoryChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['No Weekly Expenses'],
        datasets: [{ data: [1], backgroundColor: ['rgba(255,255,255,0.05)'] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    return;
  }

  weeklyCategoryChartInstance = new Chart(ctx, {
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
        }
      },
      cutout: '70%'
    }
  });
}

// --- Payment Method Breakdown Graph ---
function renderMethodChart() {
  const canvas = document.getElementById('methodChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const methodMap = {};
  state.transactions.forEach(tx => {
    if (tx.type === 'expense') {
      const m = tx.method || 'Other';
      methodMap[m] = (methodMap[m] || 0) + parseFloat(tx.amount);
    }
  });

  const labels = Object.keys(methodMap);
  const dataValues = Object.values(methodMap);
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  if (methodChartInstance) {
    methodChartInstance.destroy();
  }

  methodChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length ? labels : ['No Data'],
      datasets: [{
        data: dataValues.length ? dataValues : [1],
        backgroundColor: colors.slice(0, labels.length || 1),
        borderWidth: 2,
        borderColor: '#111726'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ₹${ctx.raw.toFixed(2)}` } }
      },
      cutout: '65%'
    }
  });
}

// --- Cumulative Net Balance Trajectory Graph ---
function renderBalanceTrendChart() {
  const canvas = document.getElementById('balanceTrendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const sortedTx = [...state.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  let cumulativeBalance = 0;
  const dateMap = {};

  sortedTx.forEach(tx => {
    const val = parseFloat(tx.amount) || 0;
    if (tx.type === 'income') cumulativeBalance += val;
    else cumulativeBalance -= val;
    dateMap[tx.date] = cumulativeBalance;
  });

  const sortedDates = Object.keys(dateMap).sort();
  const balanceValues = sortedDates.map(d => dateMap[d]);
  const dateLabels = sortedDates.map(d => formatDate(d));

  if (balanceTrendChartInstance) {
    balanceTrendChartInstance.destroy();
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
  gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

  balanceTrendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dateLabels.length ? dateLabels : ['No Data'],
      datasets: [{
        label: 'Net Balance',
        data: balanceValues.length ? balanceValues : [0],
        borderColor: '#10b981',
        borderWidth: 3,
        backgroundColor: gradient,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#10b981',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` Net Balance: ₹${ctx.raw.toFixed(2)}` } }
      },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { display: false } },
        y: { ticks: { color: '#64748b', callback: val => '₹' + val }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
      }
    }
  });
}

function renderCategoryChart() {
  const canvas = document.getElementById('categoryChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
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
              return ` ${context.label}: ₹${context.raw.toFixed(2)}`;
            }
          }
        }
      },
      cutout: '70%'
    }
  });
}

function renderTrendChart() {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

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

  // Desktop Sidebar Nav Handlers
  safeAddListener('nav-btn-dashboard', 'click', () => { switchReportTab('monthly'); window.scrollTo({top:0, behavior:'smooth'}); });
  safeAddListener('nav-btn-cloud-sync', 'click', openVaultModal);
  safeAddListener('nav-btn-transactions', 'click', () => document.getElementById('transactions-section')?.scrollIntoView({behavior:'smooth'}));
  safeAddListener('nav-btn-savings', 'click', openSavingsModal);
  safeAddListener('nav-btn-admin', 'click', toggleAdminMode);
  safeAddListener('nav-btn-vault', 'click', openVaultModal);
  safeAddListener('nav-btn-reset', 'click', resetAllData);

  // Mobile Bottom Nav Handlers
  safeAddListener('mnav-monthly', 'click', () => switchReportTab('monthly'));
  safeAddListener('mnav-weekly', 'click', () => switchReportTab('weekly'));
  safeAddListener('mnav-database', 'click', () => switchReportTab('database'));
  safeAddListener('mnav-heatmap', 'click', () => switchReportTab('heatmap'));

  // Header Handlers
  safeAddListener('btn-admin-login', 'click', toggleAdminMode);
  safeAddListener('btn-sync-now', 'click', syncFromCloudDatabase);

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

  if (modal) {
    modal.classList.add('active');
  }
}

function closeTransactionModal() {
  const modal = document.getElementById('transaction-modal');
  if (modal) {
    modal.classList.remove('active');
  }
  state.editingTxId = null;
  isSubmittingTx = false;
}

function openSavingsModal() {
  const savingsInput = document.getElementById('monthly-savings-input');
  if (savingsInput) savingsInput.value = state.monthlySavings || 0;

  const modal = document.getElementById('savings-modal');
  if (modal) {
    modal.classList.add('active');
  }

  setTimeout(() => {
    if (savingsInput) {
      savingsInput.focus();
      savingsInput.select();
    }
  }, 100);
}

function closeSavingsModal() {
  const modal = document.getElementById('savings-modal');
  if (modal) {
    modal.classList.remove('active');
  }
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

  if (gistIdInput) gistIdInput.value = state.gistId || '';
  if (gistTokenInput) gistTokenInput.value = state.gistToken || '';

  const modal = document.getElementById('vault-modal');
  if (modal) {
    modal.classList.add('active');
  }

  setTimeout(() => {
    if (gistIdInput) {
      gistIdInput.focus();
    }
  }, 100);
}

function closeVaultModal() {
  const modal = document.getElementById('vault-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function handleVaultFormSubmit(e) {
  e.preventDefault();
  connectAndSyncGist(true);
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
  if (modal) {
    modal.classList.add('active');
  }

  setTimeout(() => {
    if (input) input.focus();
  }, 100);
}

function closeAdminModal() {
  const modal = document.getElementById('admin-modal');
  if (modal) {
    modal.classList.remove('active');
  }
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
window.restartMonthlySpent = restartMonthlySpent;
window.handleMonthFilterChange = handleMonthFilterChange;
window.switchReportTab = switchReportTab;
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
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(message, type = 'info') {
  if (window.AndroidNative) {
    try {
      if (typeof window.AndroidNative.showToast === 'function') {
        window.AndroidNative.showToast(message);
      }
      if (typeof window.AndroidNative.vibrate === 'function') {
        window.AndroidNative.vibrate(35);
      }
    } catch (e) {}
  }

  const container = document.getElementById('toast-container');
  if (!container) return;
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

// Global Window Exports for Gist Sync & Restore
window.connectAndSyncGist = connectAndSyncGist;
window.syncToGitHubGist = syncToGitHubGist;
window.restoreFromGist = restoreFromGist;
window.syncFromCloudDatabase = syncFromCloudDatabase;
window.syncToCloudDatabase = syncToCloudDatabase;
window.openVaultModal = openVaultModal;
window.closeVaultModal = closeVaultModal;
window.handleVaultFormSubmit = handleVaultFormSubmit;
