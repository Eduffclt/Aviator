let adminToken = localStorage.getItem('admin_token');
let currentWithdrawalStatus = 'PENDING';
let selectedWithdrawalId = null;
let selectedUserId = null;

const adminLoginScreen = document.getElementById('admin-login');
const adminPanel = document.getElementById('admin-panel');
const adminLoginError = document.getElementById('admin-login-error');

// Login
document.getElementById('btn-admin-login').addEventListener('click', async () => {
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.error) {
        adminLoginError.innerText = data.error;
        return;
    }
    if (!data.user.is_admin) {
        adminLoginError.innerText = 'Você não tem permissão de administrador.';
        return;
    }
    localStorage.setItem('admin_token', data.token);
    adminToken = data.token;
    adminLoginScreen.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    loadDashboard();
});

document.getElementById('btn-admin-logout').addEventListener('click', () => {
    localStorage.removeItem('admin_token');
    window.location.reload();
});

// Auto-login if token saved
if (adminToken) {
    fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${adminToken}` } })
        .then(r => r.json())
        .then(data => {
            if (!data.error) {
                adminLoginScreen.classList.add('hidden');
                adminPanel.classList.remove('hidden');
                loadDashboard();
            }
        });
}

// Navigation
document.querySelectorAll('.admin-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
        btn.classList.add('active');
        const section = btn.dataset.section;
        document.getElementById(`section-${section}`).classList.remove('hidden');
        if (section === 'dashboard') loadDashboard();
        if (section === 'withdrawals') loadWithdrawals(currentWithdrawalStatus);
        if (section === 'users') loadUsers();
    });
});

// Filter tabs
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentWithdrawalStatus = btn.dataset.status;
        loadWithdrawals(currentWithdrawalStatus);
    });
});

// Dashboard
async function loadDashboard() {
    const data = await apiFetch('/api/admin/stats');
    if (!data) return;
    document.getElementById('stat-users').innerText = data.total_users;
    document.getElementById('stat-balance').innerText = `R$ ${data.total_balance.toFixed(2)}`;
    document.getElementById('stat-pending').innerText = data.pending_withdrawals;
    document.getElementById('stat-deposits').innerText = `R$ ${data.total_deposits.toFixed(2)}`;

    if (data.pending_withdrawals > 0) {
        const badge = document.getElementById('pending-badge');
        badge.innerText = data.pending_withdrawals;
        badge.classList.remove('hidden');
    }
}

// Force Crash Point
document.getElementById('btn-force-crash').addEventListener('click', async () => {
    const input = document.getElementById('forced-multiplier');
    const multiplier = parseFloat(input.value);
    
    if (!multiplier || multiplier < 1.01) {
        showToast('❌ O multiplicador deve ser no mínimo 1.01', 'error');
        return;
    }

    const res = await apiFetch('/api/admin/force_crash', 'POST', { multiplier });
    if (res?.message) {
        showToast('🚀 ' + res.message, 'success');
        input.value = '';
    }
});

// Withdrawals
async function loadWithdrawals(status) {
    const list = await apiFetch(`/api/admin/withdrawals?status=${status}`);
    if (!list) return;
    const tbody = document.getElementById('withdrawals-body');
    const noMsg = document.getElementById('no-withdrawals');
    tbody.innerHTML = '';

    if (list.length === 0) {
        noMsg.classList.remove('hidden');
        return;
    }
    noMsg.classList.add('hidden');

    list.forEach(w => {
        const date = new Date(w.created_at).toLocaleString('pt-BR');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${w.id}</td>
            <td><strong>${w.username}</strong></td>
            <td><strong style="color:var(--success)">R$ ${w.amount.toFixed(2)}</strong></td>
            <td><span class="pix-copy-field" onclick="copyText('${w.pix_key}', this)" title="Clique para copiar">${w.pix_key}</span></td>
            <td>${date}</td>
            <td><span class="status-badge ${w.status}">${statusLabel(w.status)}</span></td>
            <td>
                <div class="action-btns">
                    ${w.status === 'PENDING' ? `
                        <button class="btn-sm btn-approve" onclick="approveWithdrawal(${w.id})"><i class="fa-solid fa-check"></i> Aprovar</button>
                        <button class="btn-sm btn-reject" onclick="openRejectModal(${w.id})"><i class="fa-solid fa-xmark"></i> Rejeitar</button>
                    ` : `<span style="color:var(--text-muted);font-size:0.8rem">${w.notes || '-'}</span>`}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function approveWithdrawal(id) {
    if (!confirm('Confirmar aprovação? Pague o PIX manualmente antes de aprovar!')) return;
    const res = await apiFetch(`/api/admin/withdrawals/${id}/approve`, 'POST', { notes: 'Aprovado e pago.' });
    if (res?.message) {
        showToast('✅ ' + res.message, 'success');
        loadWithdrawals(currentWithdrawalStatus);
        loadDashboard();
    }
}

function openRejectModal(id) {
    selectedWithdrawalId = id;
    document.getElementById('reject-notes').value = '';
    document.getElementById('modal-reject').classList.remove('hidden');
}

document.getElementById('btn-confirm-reject').addEventListener('click', async () => {
    const notes = document.getElementById('reject-notes').value;
    const res = await apiFetch(`/api/admin/withdrawals/${selectedWithdrawalId}/reject`, 'POST', { notes });
    if (res?.message) {
        showToast('❌ ' + res.message, 'error');
        document.getElementById('modal-reject').classList.add('hidden');
        loadWithdrawals(currentWithdrawalStatus);
        loadDashboard();
    }
});

// Users
async function loadUsers() {
    const users = await apiFetch('/api/admin/users');
    if (!users) return;
    const tbody = document.getElementById('users-body');
    tbody.innerHTML = '';

    users.forEach(u => {
        const date = new Date(u.created_at).toLocaleString('pt-BR');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${u.id}</td>
            <td>
                <strong>${u.username}</strong>
                ${u.is_admin ? '<span style="color:var(--primary);font-size:0.7rem;margin-left:5px">ADMIN</span>' : ''}
            </td>
            <td><strong style="color:var(--success)">R$ ${u.balance.toFixed(2)}</strong></td>
            <td>${u.is_admin ? '<i class="fa-solid fa-check" style="color:var(--success)"></i>' : '-'}</td>
            <td>${date}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-sm btn-edit" onclick="openBalanceModal(${u.id}, '${u.username}', ${u.balance})"><i class="fa-solid fa-pencil"></i> Saldo</button>
                    <button class="btn-sm btn-toggle" onclick="toggleAdmin(${u.id})"><i class="fa-solid fa-shield-halved"></i> Admin</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openBalanceModal(userId, username, balance) {
    selectedUserId = userId;
    document.getElementById('modal-balance-user').innerText = `Usuário: ${username}`;
    document.getElementById('new-balance-input').value = balance.toFixed(2);
    document.getElementById('modal-balance').classList.remove('hidden');
}

document.getElementById('btn-confirm-balance').addEventListener('click', async () => {
    const newBal = parseFloat(document.getElementById('new-balance-input').value);
    const res = await apiFetch(`/api/admin/users/${selectedUserId}/balance`, 'POST', { balance: newBal });
    if (res?.message) {
        showToast('💰 ' + res.message, 'success');
        document.getElementById('modal-balance').classList.add('hidden');
        loadUsers();
    }
});

async function toggleAdmin(userId) {
    const res = await apiFetch(`/api/admin/users/${userId}/toggle_admin`, 'POST', {});
    if (res) {
        showToast(`🛡️ Admin: ${res.is_admin ? 'Ativado' : 'Desativado'}`, 'success');
        loadUsers();
    }
}

// Modals close
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    });
});

// Utils
async function apiFetch(url, method = 'GET', body = null) {
    const opts = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    return res.json();
}

function statusLabel(s) {
    return { PENDING: 'Pendente', APPROVED: 'Aprovado', REJECTED: 'Rejeitado' }[s] || s;
}

function copyText(text, el) {
    navigator.clipboard.writeText(text).then(() => {
        el.style.borderColor = 'var(--success)';
        el.style.color = 'var(--success)';
        setTimeout(() => {
            el.style.borderColor = '';
            el.style.color = '';
        }, 2000);
    });
}

function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.innerText = msg;
    t.style.cssText = `
        position:fixed;bottom:30px;right:30px;z-index:9999;
        background:${type === 'success' ? '#2ecc71' : '#e50914'};
        color:${type === 'success' ? 'black' : 'white'};
        padding:12px 20px;border-radius:8px;font-weight:700;
        animation: fadeIn 0.3s ease;
    `;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}
