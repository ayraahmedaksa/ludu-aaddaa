const API_URL = 'https://ludu-aaddaa-1.onrender.com/api';
const SOCKET_URL = 'http://localhost:5000';
let token = localStorage.getItem('userToken');
let currentUser = null;
let socket = null;
let currentRoom = null;
let selectedBet = 100;

if (token) {
    loadUser();
}

// Auth
function openAuth() {
    document.getElementById('authModal').style.display = 'block';
    showLogin();
}

function closeAuth() {
    document.getElementById('authModal').style.display = 'none';
}

function showLogin() {
    document.getElementById('authTitle').textContent = 'লগইন';
    document.getElementById('loginFormDiv').style.display = 'block';
    document.getElementById('registerFormDiv').style.display = 'none';
}

function showRegister() {
    document.getElementById('authTitle').textContent = 'রেজিস্ট্রেশন';
    document.getElementById('loginFormDiv').style.display = 'none';
    document.getElementById('registerFormDiv').style.display = 'block';
}

async function login() {
    const phone = document.getElementById('loginPhone').value;
    const password = document.getElementById('loginPass').value;
    
    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password })
        });
        const data = await res.json();
        
        if (data.success) {
            token = data.token;
            localStorage.setItem('userToken', token);
            currentUser = data.user;
            closeAuth();
            loadUser();
            alert('লগইন সফল হয়েছে');
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('লগইন ব্যর্থ');
    }
}

async function register() {
    const phone = document.getElementById('regPhone').value;
    const password = document.getElementById('regPass').value;
    const full_name = document.getElementById('regName').value;
    const referral_code = document.getElementById('refCode').value;
    
    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password, full_name, referral_code })
        });
        const data = await res.json();
        
        if (data.success) {
            token = data.token;
            localStorage.setItem('userToken', token);
            currentUser = data.user;
            closeAuth();
            loadUser();
            alert('রেজিস্ট্রেশন সফল হয়েছে');
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('রেজিস্ট্রেশন ব্যর্থ');
    }
}

async function loadUser() {
    try {
        const res = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success) {
            currentUser = data.user;
            document.getElementById('userInfo').style.display = 'flex';
            document.getElementById('loginBtn').style.display = 'none';
            document.getElementById('userPhone').textContent = currentUser.phone;
            document.getElementById('userBalance').textContent = currentUser.balance;
            document.getElementById('walletBalance').textContent = currentUser.balance;
            document.getElementById('holdBalance').textContent = currentUser.hold_balance || 0;
            initSocket();
        } else {
            logout();
        }
    } catch (error) {
        logout();
    }
}

function logout() {
    localStorage.removeItem('userToken');
    token = null;
    currentUser = null;
    if (socket) socket.disconnect();
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('loginBtn').style.display = 'block';
    location.reload();
}

// Navigation
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(`page-${page}`).style.display = 'block';
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-link[data-page="${page}"]`)?.classList.add('active');
    
    if (page === 'lobby') loadRooms();
    if (page === 'wallet') loadUser();
}

// Lobby
async function loadRooms() {
    try {
        const res = await fetch(`${API_URL}/rooms`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        const list = document.getElementById('roomsList');
        list.innerHTML = '';
        
        if (data.success && data.rooms.length > 0) {
            data.rooms.forEach(room => {
                const players = JSON.parse(room.players || '[]');
                const div = document.createElement('div');
                div.className = 'room-item';
                div.innerHTML = `
                    <div>${room.bet_amount} ৳</div>
                    <div>${room.table_fee} ৳</div>
                    <div>${room.bet_amount * 2 - room.table_fee * 2} ৳</div>
                    <div>${players.length}/${room.max_players}</div>
                    <div><button class="btn-join" onclick="joinRoom('${room.room_code}')">জয়েন করুন</button></div>
                `;
                list.appendChild(div);
            });
        } else {
            list.innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">কোনো রুম নেই। প্রথমে রুম তৈরি করুন।</p>';
        }
    } catch (error) {
        console.error(error);
    }
}

// Create Room
function openCreateRoom() {
    if (!token) return openAuth();
    document.getElementById('createRoomModal').style.display = 'block';
    selectBet(100);
}

function closeCreateRoom() {
    document.getElementById('createRoomModal').style.display = 'none';
}

function selectBet(amount) {
    selectedBet = Number(amount);
    document.querySelectorAll('.bet-btn').forEach(b => b.classList.remove('active'));
    event?.target?.classList.add('active');
    document.getElementById('showBet').textContent = selectedBet;
    document.getElementById('showTotal').textContent = selectedBet + 10;
    document.getElementById('showWin').textContent = (selectedBet * 2) - 20;
}

async function createRoom() {
    try {
        const res = await fetch(`${API_URL}/rooms/create`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ bet_amount: selectedBet })
        });
        const data = await res.json();
        
        if (data.success) {
            alert(data.message);
            closeCreateRoom();
            enterRoom(data.roomCode);
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('রুম তৈরি ব্যর্থ');
    }
}

async function joinRoom(roomCode) {
    if (!token) return openAuth();
    try {
        const res = await fetch(`${API_URL}/rooms/join/${roomCode}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success) {
            alert(data.message);
            if (data.status === 'playing') {
                window.location.href = `game.html?room=${roomCode}`;
            } else {
                enterRoom(roomCode);
            }
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('জয়েন ব্যর্থ');
    }
}

async function enterRoom(roomCode) {
    currentRoom = roomCode;
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById('page-room').style.display = 'block';
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    
    document.getElementById('currentRoomCode').textContent = roomCode;
    
    if (socket) {
        socket.emit('join-room', roomCode);
    }
    
    loadRoomDetails(roomCode);
    // Check every 2 seconds if game started
    const checkInterval = setInterval(async () => {
        const res = await fetch(`${API_URL}/rooms/${roomCode}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.room.status === 'playing') {
            clearInterval(checkInterval);
            window.location.href = `game.html?room=${roomCode}`;
        }
    }, 2000);
}

async function loadRoomDetails(roomCode) {
    try {
        const res = await fetch(`${API_URL}/rooms/${roomCode}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success) {
            const room = data.room;
            document.getElementById('roomBet').textContent = room.bet_amount;
            document.getElementById('roomFee').textContent = room.table_fee;
            document.getElementById('roomStatus').textContent = room.status === 'waiting' ? 'অপেক্ষা করছে...' : 'গেম শুরু হয়েছে';
            
            if (room.status === 'playing') {
                document.getElementById('gameArea').style.display = 'block';
            }
        }
    } catch (error) {
        console.error(error);
    }
}

async function leaveCurrentRoom() {
    if (!currentRoom) return;
    try {
        const res = await fetch(`${API_URL}/rooms/leave/${currentRoom}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        alert(data.message);
        currentRoom = null;
        showPage('lobby');
        loadUser();
    } catch (error) {
        alert('ত্রুটি হয়েছে');
    }
}

// Socket
function initSocket() {
    if (socket) return;
    socket = io(SOCKET_URL);
    
    socket.on('receive-message', (data) => {
        const div = document.getElementById('roomChatMessages');
        const msg = document.createElement('div');
        msg.className = 'chat-msg';
        msg.innerHTML = `<span class="chat-user">${data.phone || 'User'}</span>: ${data.message}`;
        div.appendChild(msg);
        div.scrollTop = div.scrollHeight;
    });
}

function sendChat() {
    if (!currentRoom) return;
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;
    
    socket.emit('send-message', {
        roomCode: currentRoom,
        userId: currentUser.id,
        phone: currentUser.phone,
        message: message
    });
    
    input.value = '';
}

// Wallet
function showDeposit() {
    if (!token) return openAuth();
    document.getElementById('depositModal').style.display = 'block';
}

function closeDeposit() {
    document.getElementById('depositModal').style.display = 'none';
}

async function submitDeposit() {
    const amount = document.getElementById('depositAmount').value;
    const method = document.getElementById('depositMethod').value;
    const sender_number = document.getElementById('senderNumber').value;
    const trx_id = document.getElementById('trxId').value;
    
    try {
        const res = await fetch(`${API_URL}/payment/deposit`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, method, sender_number, trx_id })
        });
        const data = await res.json();
        alert(data.message);
        if (data.success) {
            closeDeposit();
            loadMyDeposits();
        }
    } catch (error) {
        alert('রিকোয়েস্ট ব্যর্থ');
    }
}

function showWithdraw() {
    if (!token) return openAuth();
    document.getElementById('withdrawModal').style.display = 'block';
}

function closeWithdraw() {
    document.getElementById('withdrawModal').style.display = 'none';
}

async function submitWithdraw() {
    const amount = document.getElementById('withdrawAmount').value;
    const method = document.getElementById('withdrawMethod').value;
    const account_number = document.getElementById('accountNumber').value;
    
    try {
        const res = await fetch(`${API_URL}/payment/withdraw`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, method, account_number })
        });
        const data = await res.json();
        alert(data.message);
        if (data.success) {
            closeWithdraw();
            loadUser();
            loadMyWithdraws();
        }
    } catch (error) {
        alert('রিকোয়েস্ট ব্যর্থ');
    }
}

async function loadMyDeposits() {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event?.target?.classList.add('active');
    document.getElementById('depositHistory').style.display = 'block';
    document.getElementById('withdrawHistory').style.display = 'none';
    
    try {
        const res = await fetch(`${API_URL}/payment/deposit`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        const div = document.getElementById('depositHistory');
        div.innerHTML = '';
        
        if (data.success && data.deposits.length > 0) {
            data.deposits.forEach(dep => {
                const item = document.createElement('div');
                item.className = 'history-item';
                item.innerHTML = `
                    <div>
                        <strong>${dep.amount} ৳</strong> - ${dep.method.toUpperCase()}<br>
                        <small>TrxID: ${dep.trx_id}</small>
                    </div>
                    <div style="text-align: right;">
                        <span style="color: ${dep.status === 'approved' ? 'green' : dep.status === 'pending' ? 'orange' : 'red'};">
                            ${dep.status === 'approved' ? 'অনুমোদিত' : dep.status === 'pending' ? 'পেন্ডিং' : 'প্রত্যাখ্যাত'}
                        </span><br>
                        <small>${new Date(dep.created_at).toLocaleDateString('bn-BD')}</small>
                    </div>
                `;
                div.appendChild(item);
            });
        } else {
            div.innerHTML = '<p class="text-muted">কোনো রিকোয়েস্ট নেই</p>';
        }
    } catch (error) {
        console.error(error);
    }
}

async function loadMyWithdraws() {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event?.target?.classList.add('active');
    document.getElementById('depositHistory').style.display = 'none';
    document.getElementById('withdrawHistory').style.display = 'block';
    
    try {
        const res = await fetch(`${API_URL}/payment/withdraw`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        const div = document.getElementById('withdrawHistory');
        div.innerHTML = '';
        
        if (data.success && data.withdraws.length > 0) {
            data.withdraws.forEach(wd => {
                const item = document.createElement('div');
                item.className = 'history-item';
                item.innerHTML = `
                    <div>
                        <strong>${wd.amount} ৳</strong> - ${wd.method.toUpperCase()}<br>
                        <small>${wd.account_number}</small>
                    </div>
                    <div style="text-align: right;">
                        <span style="color: ${wd.status === 'paid' ? 'green' : wd.status === 'pending' ? 'orange' : 'red'};">
                            ${wd.status === 'paid' ? 'প্রদান করা হয়েছে' : wd.status === 'pending' ? 'পেন্ডিং' : 'প্রত্যাখ্যাত'}
                        </span><br>
                        <small>${new Date(wd.created_at).toLocaleDateString('bn-BD')}</small>
                    </div>
                `;
                div.appendChild(item);
            });
        } else {
            div.innerHTML = '<p class="text-muted">কোনো রিকোয়�েন্ট নেই</p>';
        }
    } catch (error) {
        console.error(error);
    }
}

// Close modals
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}
