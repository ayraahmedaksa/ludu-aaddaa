const API_URL = 'http://localhost:5000/api';
let token = localStorage.getItem('adminToken');

// Check if logged in
if (token) {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('dashboardPage').style.display = 'flex';
    loadDashboard();
} else {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('dashboardPage').style.display = 'none';
}

// Login Form
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const res = await fetch(`${API_URL}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (data.success) {
            token = data.token;
            localStorage.setItem('adminToken', token);
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('dashboardPage').style.display = 'flex';
            document.getElementById('agentName').textContent = data.agent.full_name || data.agent.username;
            loadDashboard();
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('লগইন ব্যর্থ হয়েছে');
    }
});

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        const page = item.getAttribute('data-page');
        document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
        document.getElementById(`page-${page}`).style.display = 'block';
        document.getElementById('pageTitle').textContent = item.textContent.trim();
        
        if (page === 'deposits') loadDeposits();
        if (page === 'withdraws') loadWithdraws();
        if (page === 'users') loadUsers();
        if (page === 'rooms') loadRooms();
        if (page === 'settings') loadSettings();
    });
});

async function loadDashboard() {
    try {
        const res = await fetch(`${API_URL}/admin/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success) {
            document.getElementById('totalUsers').textContent = data.stats.totalUsers;
            document.getElementById('todayUsers').textContent = data.stats.todayUsers;
            document.getElementById('pendingDeposits').textContent = data.stats.pendingDeposits.count;
            document.getElementById('pendingWithdraws').textContent = data.stats.pendingWithdraws.count;
            document.getElementById('depositBadge').textContent = data.stats.pendingDeposits.count;
            document.getElementById('withdrawBadge').textContent = data.stats.pendingWithdraws.count;
        }
    } catch (error) {
        console.error(error);
    }
    updateTime();
    setInterval(updateTime, 1000);
}

function updateTime() {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleString('bn-BD');
}

async function loadDeposits() {
    const status = document.getElementById('depositFilter').value;
    try {
        const res = await fetch(`${API_URL}/admin/deposits?status=${status}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        const tbody = document.getElementById('depositsTable');
        tbody.innerHTML = '';
        
        if (data.success && data.deposits.length > 0) {
            data.deposits.forEach(dep => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${dep.id}</td>
                    <td>${dep.phone}<br><small>${dep.full_name || '-'}</small></td>
                    <td><strong>${dep.amount} ৳</strong></td>
                    <td>${dep.method.toUpperCase()}</td>
                    <td>${dep.sender_number}</td>
                    <td><code>${dep.trx_id}</code></td>
                    <td>${new Date(dep.created_at).toLocaleString('bn-BD')}</td>
                    <td>
                        ${status === 'pending' ? `
                            <button class="btn-success" onclick="approveDeposit(${dep.id})">অনুমোদন</button>
                            <button class="btn-danger" onclick="rejectDeposit(${dep.id})">প্রত্যাখ্যান</button>
                        ` : status === 'approved' ? `<span style="color: green;">অনুমোদিত</span>` : `<span style="color: red;">প্রত্যাখ্যাত</span><br><small>${dep.reject_reason || ''}</small>`}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">কোনো রিকোয়েস্ট নেই</td></tr>';
        }
    } catch (error) {
        console.error(error);
    }
}

async function approveDeposit(id) {
    if (!confirm('আপনি কি এই ডিপোজিট অনুমোদন করতে চান?')) return;
    try {
        const res = await fetch(`${API_URL}/admin/deposits/${id}/approve`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        alert(data.message);
        loadDeposits();
        loadDashboard();
    } catch (error) {
        alert('ত্রুটি হয়েছে');
    }
}

async function rejectDeposit(id) {
    const reason = prompt('প্রত্যাখ্যানের কারণ লিখুন:');
    if (!reason) return;
    try {
        const res = await fetch(`${API_URL}/admin/deposits/${id}/reject`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        const data = await res.json();
        alert(data.message);
        loadDeposits();
        loadDashboard();
    } catch (error) {
        alert('ত্রুটি হয়েছে');
    }
}

async function loadWithdraws() {
    const status = document.getElementById('withdrawFilter').value;
    try {
        const res = await fetch(`${API_URL}/admin/withdraws?status=${status}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        const tbody = document.getElementById('withdrawsTable');
        tbody.innerHTML = '';
        
        if (data.success && data.withdraws.length > 0) {
            data.withdraws.forEach(wd => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${wd.id}</td>
                    <td>${wd.phone}<br><small>${wd.full_name || '-'}</small></td>
                    <td><strong>${wd.amount} ৳</strong></td>
                    <td>${wd.method.toUpperCase()}</td>
                    <td>${wd.account_number}</td>
                    <td>${wd.balance} ৳</td>
                    <td>${new Date(wd.created_at).toLocaleString('bn-BD')}</td>
                    <td>
                        ${status === 'pending' ? `
                            <button class="btn-success" onclick="markPaid(${wd.id})">Paid মার্ক করুন</button>
                            <button class="btn-danger" onclick="rejectWithdraw(${wd.id})">প্রত্যাখ্যান</button>
                        ` : status === 'paid' ? `<span style="color: green;">প্রদান করা হয়েছে</span>` : `<span style="color: red;">প্রত্যাখ্যাত</span><br><small>${wd.reject_reason || ''}</small>`}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">কোনো রিকোয়েস্ট নেই</td></tr>';
        }
    } catch (error) {
        console.error(error);
    }
}

async function markPaid(id) {
    if (!confirm('টাকা পাঠানো হয়েছে নিশ্চিত করছেন?')) return;
    try {
        const res = await fetch(`${API_URL}/admin/withdraws/${id}/paid`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        alert(data.message);
        loadWithdraws();
        loadDashboard();
    } catch (error) {
        alert('ত্রুটি হয়েছে');
    }
}

async function rejectWithdraw(id) {
    const reason = prompt('প্রত্যাখ্যানের কারণ লিখুন:');
    if (!reason) return;
    try {
        const res = await fetch(`${API_URL}/admin/withdraws/${id}/reject`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        const data = await res.json();
        alert(data.message);
        loadWithdraws();
        loadDashboard();
    } catch (error) {
        alert('ত্রুটি হয়েছে');
    }
}

async function loadUsers() {
    const search = document.getElementById('userSearch').value;
    try {
        const res = await fetch(`${API_URL}/admin/users?search=${search}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        const tbody = document.getElementById('usersTable');
        tbody.innerHTML = '';
        
        if (data.success && data.users.length > 0) {
            data.users.forEach(user => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${user.id}</td>
                    <td>${user.phone}</td>
                    <td>${user.full_name || '-'}</td>
                    <td><strong>${user.balance} ৳</strong></td>
                    <td>${user.hold_balance} ৳</td>
                    <td><span style="color: ${user.status === 'active' ? 'green' : 'red'};">${user.status === 'active' ? 'সক্রিয়' : 'ব্যান'}</span></td>
                    <td>${new Date(user.created_at).toLocaleDateString('bn-BD')}</td>
                    <td>
                        <button class="btn-info" onclick="openBalanceModal(${user.id})">ব্যালেন্স</button>
                        <button class="btn-${user.status === 'active' ? 'danger' : 'success'}" onclick="toggleBan(${user.id})">${user.status === 'active' ? 'ব্যান' : 'আনব্যান'}</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">কোনো ইউজার নেই</td></tr>';
        }
    } catch (error) {
        console.error(error);
    }
}

function openBalanceModal(userId) {
    document.getElementById('balanceUserId').value = userId;
    document.getElementById('balanceModal').style.display = 'block';
}

function closeBalanceModal() {
    document.getElementById('balanceModal').style.display = 'none';
}

async function updateBalance() {
    const userId = document.getElementById('balanceUserId').value;
    const amount = document.getElementById('balanceAmount').value;
    const type = document.getElementById('balanceType').value;
    const description = document.getElementById('balanceDesc').value;
    
    if (!amount) return alert('পরিমাণ লিখুন');
    
    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/balance`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, type, description })
        });
        const data = await res.json();
        alert(data.message);
        closeBalanceModal();
        loadUsers();
    } catch (error) {
        alert('ত্রুটি হয়েছে');
    }
}

async function toggleBan(userId) {
    if (!confirm('আপনি কি নিশ্চিত?')) return;
    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/ban`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        alert(data.message);
        loadUsers();
    } catch (error) {
        alert('ত্রুটি হয়েছে');
    }
}

async function loadRooms() {
    try {
        const res = await fetch(`${API_URL}/admin/rooms`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        const tbody = document.getElementById('roomsTable');
        tbody.innerHTML = '';
        
        if (data.success && data.rooms.length > 0) {
            data.rooms.forEach(room => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${room.room_code}</strong></td>
                    <td>${room.bet_amount} ৳</td>
                    <td>${room.table_fee} ৳</td>
                    <td>${room.current_players}/${room.max_players}</td>
                    <td><span style="color: ${room.status === 'playing' ? 'green' : room.status === 'waiting' ? 'orange' : 'gray'};">${room.status}</span></td>
                    <td>${new Date(room.created_at).toLocaleString('bn-BD')}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">কোনো রুম নেই</td></tr>';
        }
    } catch (error) {
        console.error(error);
    }
}

async function loadChats() {
    const roomId = document.getElementById('chatRoomId').value;
    if (!roomId) return;
    
    try {
        const res = await fetch(`${API_URL}/admin/chats/${roomId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        const div = document.getElementById('chatLogs');
        div.innerHTML = '';
        
        if (data.success && data.chats.length > 0) {
            data.chats.forEach(chat => {
                const item = document.createElement('div');
                item.className = 'chat-item';
                item.innerHTML = `
                    <span class="chat-user">${chat.full_name || chat.phone}</span>
                    <span class="chat-time">${new Date(chat.created_at).toLocaleString('bn-BD')}</span>
                    <div style="margin-top: 5px;">${chat.message}</div>
                `;
                div.appendChild(item);
            });
        } else {
            div.innerHTML = '<p class="text-muted">কোনো চ্যাট নেই</p>';
        }
    } catch (error) {
        console.error(error);
    }
}

async function loadSettings() {
    try {
        const res = await fetch(`${API_URL}/admin/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success) {
            data.settings.forEach(s => {
                if (document.getElementById(s.key)) {
                    document.getElementById(s.key).value = s.value;
                }
            });
        }
    } catch (error) {
        console.error(error);
    }
}

async function saveSettings() {
    const settings = ['min_deposit', 'min_withdraw', 'min_bet', 'max_bet', 'table_fee_per_player'];
    try {
        for (let key of settings) {
            const value = document.getElementById(key).value;
            await fetch(`${API_URL}/admin/settings`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });
        }
        alert('সেটিংস সংরক্ষণ করা হয়েছে');
    } catch (error) {
        alert('ত্রুটি হয়েছে');
    }
}

function logout() {
    localStorage.removeItem('adminToken');
    location.reload();
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('balanceModal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}
