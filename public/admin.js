const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const API_URL = '/api/admin';
const initData = tg.initData;

let currentTab = 'stats';

// Utility functions
function formatNumber(num) {
    return new Intl.NumberFormat('ru-RU').format(Math.round(num || 0));
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleString('ru-RU');
}

function formatCurrency(amount) {
    return formatNumber(amount) + ' ₽';
}

// API calls
async function apiRequest(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'x-telegram-init-data': initData || 'test-admin-data'
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);

        if (response.status === 401 || response.status === 403) {
            showUnauthorized();
            return null;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        return null;
    }
}

// UI Management
function showUnauthorized() {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('unauthorized').style.display = 'flex';
}

function showAdminPanel() {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('unauthorized').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
}

function showTab(tabName) {
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    currentTab = tabName;
    loadTabData(tabName);
}

// Data loading functions
async function loadTabData(tabName) {
    switch (tabName) {
        case 'stats':
            await loadStats();
            break;
        case 'users':
            await loadUsers();
            break;
        case 'goals':
            await loadGoals();
            break;
        case 'transactions':
            await loadTransactions();
            break;
        case 'activity':
            await loadActivity();
            break;
    }
}

async function loadStats() {
    const stats = await apiRequest('/stats');
    if (!stats) return;

    document.getElementById('total-users').textContent = formatNumber(stats.total_users);
    document.getElementById('active-goals').textContent = formatNumber(stats.active_goals);
    document.getElementById('completed-goals').textContent = formatNumber(stats.completed_goals);
    document.getElementById('total-saved').textContent = formatCurrency(stats.total_saved);
    document.getElementById('total-target').textContent = formatCurrency(stats.total_target);
    document.getElementById('transactions-today').textContent = formatNumber(stats.transactions_today);
}

async function loadUsers() {
    const users = await apiRequest('/users');
    if (!users) return;

    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.telegram_id}</td>
            <td>${user.first_name || 'Не указано'}</td>
            <td>@${user.username || 'нет'}</td>
            <td class="text-center">${user.goals_count}</td>
            <td class="text-success font-weight-bold">${formatCurrency(user.total_saved)}</td>
            <td class="small">${formatDate(user.created_at)}</td>
        </tr>
    `).join('');
}

async function loadGoals() {
    const goals = await apiRequest('/goals');
    if (!goals) return;

    const tbody = document.querySelector('#goals-table tbody');
    tbody.innerHTML = goals.map(goal => {
        const progress = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
        const status = goal.is_active ? 'Активная' : 'Завершена';
        const statusClass = goal.is_active ? 'status-active' : 'status-completed';

        return `
            <tr>
                <td>${goal.id}</td>
                <td class="font-weight-bold">${goal.name}</td>
                <td>${goal.first_name} (@${goal.username || 'нет'})</td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <small>${progress.toFixed(1)}%</small>
                </td>
                <td class="text-success font-weight-bold">${formatCurrency(goal.current_amount)}</td>
                <td class="text-warning font-weight-bold">${formatCurrency(goal.target_amount)}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td class="small">${formatDate(goal.created_at)}</td>
            </tr>
        `;
    }).join('');
}

async function loadTransactions() {
    const transactions = await apiRequest('/transactions');
    if (!transactions) return;

    const tbody = document.querySelector('#transactions-table tbody');
    tbody.innerHTML = transactions.map(transaction => {
        const typeClass = transaction.type === 'deposit' ? 'transaction-deposit' : 'transaction-withdrawal';
        const typeText = transaction.type === 'deposit' ? '📥 Пополнение' : '📤 Снятие';

        return `
            <tr>
                <td>${transaction.id}</td>
                <td class="${typeClass}">${typeText}</td>
                <td class="font-weight-bold">${formatCurrency(transaction.amount)}</td>
                <td>${transaction.goal_name}</td>
                <td>${transaction.first_name} (@${transaction.username || 'нет'})</td>
                <td class="text-success">${formatCurrency(transaction.balance_after)}</td>
                <td class="small">${formatDate(transaction.created_at)}</td>
            </tr>
        `;
    }).join('');
}

async function loadActivity() {
    const activity = await apiRequest('/activity');
    if (!activity) return;

    const tbody = document.querySelector('#activity-table tbody');
    tbody.innerHTML = activity.map(log => {
        const actionMap = {
            'goal_created': '🎯 Цель создана',
            'goal_deleted': '🗑️ Цель удалена',
            'transaction_deposit': '📥 Пополнение',
            'transaction_withdrawal': '📤 Снятие'
        };

        const actionText = actionMap[log.action] || log.action;
        const details = log.details ? JSON.stringify(JSON.parse(log.details), null, 2) : '';

        return `
            <tr>
                <td>${log.id}</td>
                <td>${actionText}</td>
                <td>${log.first_name} (@${log.username || 'нет'})</td>
                <td class="small" style="max-width: 200px; word-break: break-word;">${details}</td>
                <td class="small">${formatDate(log.created_at)}</td>
            </tr>
        `;
    }).join('');
}

// Initialization
async function initializeAdmin() {
    try {
        // Check admin access
        const adminInfo = await apiRequest('/me');
        if (!adminInfo) {
            showUnauthorized();
            return;
        }

        // Show admin panel
        showAdminPanel();

        // Set admin info
        document.getElementById('admin-name').textContent = adminInfo.first_name || 'Администратор';
        document.getElementById('admin-id').textContent = `ID: ${adminInfo.id}`;

        // Load initial data
        await loadStats();

        // Auto-refresh every 30 seconds
        setInterval(() => {
            loadTabData(currentTab);
        }, 30000);

    } catch (error) {
        console.error('Failed to initialize admin panel:', error);
        showUnauthorized();
    }
}

// Theme adaptation
if (tg.themeParams) {
    const root = document.documentElement;
    Object.entries(tg.themeParams).forEach(([key, value]) => {
        root.style.setProperty(`--tg-theme-${key.replace(/_/g, '-')}`, value);
    });
}

// Start the application
initializeAdmin();