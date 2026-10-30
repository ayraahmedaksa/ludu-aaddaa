const API_URL = 'https://ludu-aaddaa-1.onrender.com/api';
const SOCKET_URL = 'http://localhost:5000';
let token = localStorage.getItem('userToken');
let currentUser = null;
let socket = null;
let roomCode = new URLSearchParams(window.location.search).get('room');
let gameState = null;
let myId = null;

if (!token || !roomCode) {
    alert('অবৈধ 접근');
    window.location.href = 'index.html';
}

loadUser();
initGame();

// Load user
async function loadUser() {
    try {
        const res = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            myId = data.user.id;
            document.getElementById('roomCode').textContent = roomCode;
            loadRoomInfo();
        } else {
            window.location.href = 'index.html';
        }
    } catch (error) {
        window.location.href = 'index.html';
    }
}

async function loadRoomInfo() {
    try {
        const res = await fetch(`${API_URL}/rooms/${roomCode}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('betAmount').textContent = data.room.bet_amount;
        }
    } catch (error) {
        console.error(error);
    }
}

// Init game
function initGame() {
    socket = io(SOCKET_URL);
    
    socket.on('connect', () => {
        socket.emit('game:join', { roomCode, userId: myId });
    });
    
    socket.on('game:started', (data) => {
        gameState = data.gameState;
        setupBoard();
        updateGameUI();
        document.getElementById('turnIndicator').textContent = 'গেম শুরু হয়েছে!';
        document.getElementById('turnIndicator').style.background = '#28a745';
    });
    
    socket.on('game:state', (data) => {
        gameState = data.gameState;
        setupBoard();
        updateGameUI();
    });
    
    socket.on('game:diceRolled', (data) => {
        const dice = document.getElementById('dice');
        dice.classList.add('rolling');
        setTimeout(() => {
            dice.querySelector('.dice-face').textContent = data.diceValue;
            dice.classList.remove('rolling');
            document.getElementById('diceText').textContent = data.userId === myId ? 'গুটি নির্বাচন করুন' : 'অপোনেন্ট চাল নিচ্ছে...';
            
            if (data.userId === myId) {
                showPawnSelector(data.diceValue);
            }
        }, 500);
    });
    
    socket.on('game:pawnMoved', (data) => {
        gameState = data.gameState;
        setupBoard();
        updateGameUI();
        document.getElementById('pawnsSelector').style.display = 'none';
        document.getElementById('diceText').textContent = 'ডাইস রোল করুন';
        
        if (data.nextTurn === myId) {
            document.getElementById('turnIndicator').textContent = 'আপনার পালা';
            document.getElementById('turnIndicator').style.background = '#28a745';
        } else {
            document.getElementById('turnIndicator').textContent = 'অপোনেন্টের পালা';
            document.getElementById('turnIndicator').style.background = '#dc3545';
        }
    });
    
    socket.on('game:turnChange', (data) => {
        gameState.currentTurn = data.currentTurn;
        updateGameUI();
        document.getElementById('diceText').textContent = 'ডাইস রোল করুন';
        if (data.currentTurn === myId) {
            document.getElementById('turnIndicator').textContent = 'আপনার পালা';
            document.getElementById('turnIndicator').style.background = '#28a745';
        } else {
            document.getElementById('turnIndicator').textContent = 'অপোনেন্টের পালা';
            document.getElementById('turnIndicator').style.background = '#dc3545';
        }
    });
    
    socket.on('game:over', (data) => {
        const modal = document.getElementById('gameOverModal');
        const title = document.getElementById('gameOverTitle');
        const msg = document.getElementById('gameOverMessage');
        
        if (data.winner == myId) {
            title.textContent = '🎉 অভিনন্দন! আপনি জয়ী হয়েছেন!';
            title.style.color = '#28a745';
            msg.textContent = 'আপনার অ্যাকাউন্টে টাকা যোগ করা হয়েছে।';
        } else {
            title.textContent = '😔 দুর্ভাগ্য!';
            title.style.color = '#dc3545';
            msg.textContent = 'অপোনেন্ট জয়ী হয়েছে। পরের বার চেষ্টা করুন।';
        }
        modal.style.display = 'flex';
    });
    
    socket.on('game:error', (data) => {
        alert(data.message);
    });
    
    // Chat
    socket.on('receive-message', (data) => {
        const div = document.getElementById('gameChatMessages');
        const msg = document.createElement('div');
        msg.className = 'chat-msg';
        msg.innerHTML = `<strong>${data.phone}:</strong> ${data.message}`;
        div.appendChild(msg);
        div.scrollTop = div.scrollHeight;
    });
}

// Setup board
function setupBoard() {
    const board = document.getElementById('ludoBoard');
    board.innerHTML = '';
    
    // Create 15x15 grid
    for (let i = 0; i < 225; i++) {
        const cell = document.createElement('div');
        cell.className = 'board-cell';
        const row = Math.floor(i / 15) + 1;
        const col = (i % 15) + 1;
        
        // Home areas
        if (row <= 6 && col <= 6) cell.classList.add('home-blue');
        if (row <= 6 && col >= 10) cell.classList.add('home-green');
        // if (row >= 10 && col <= 6) cell.classList.add('home-red');
        // if (row >= 10 && col >= 10) cell.classList.add('home-yellow');
        
        board.appendChild(cell);
    }
}

// Update UI
function updateGameUI() {
    if (!gameState) return;
    
    // Update player cards
    const players = Object.keys(gameState.players);
    players.forEach(pid => {
        const player = gameState.players[pid];
        if (player.color === 'blue') {
            document.getElementById('blueName').textContent = pid == myId ? 'আপনি (নীল)' : 'অপোনেন্ট (নীল)';
            const finished = player.pawns.filter(p => p.position === 'finished').length;
            document.getElementById('bluePawns').textContent = finished + '/4';
        } else if (player.color === 'green') {
            document.getElementById('greenName').textContent = pid == myId ? 'আপনি (সবুজ)' : 'অপোনেন্ট (সবুজ)';
            const finished = player.pawns.filter(p => p.position === 'finished').length;
            document.getElementById('greenPawns').textContent = finished + '/4';
        }
    });
    
    // Update turn
    if (gameState.currentTurn === myId) {
        document.getElementById('turnIndicator').textContent = 'আপনার পালা';
        document.getElementById('turnIndicator').style.background = '#28a745';
        document.getElementById('dice').style.cursor = gameState.hasRolled ? 'not-allowed' : 'pointer';
    } else {
        document.getElementById('turnIndicator').textContent = 'অপোনেন্টের পালা';
        document.getElementById('turnIndicator').style.background = '#dc3545';
        document.getElementById('dice').style.cursor = 'not-allowed';
    }
}

// Roll dice
function rollDice() {
    if (!gameState) return;
    if (gameState.currentTurn !== myId) {
        alert('আপনার পালা নয়!');
        return;
    }
    if (gameState.hasRolled) {
        alert('আপনি ইতিমধ্যে ডাইস রোল করেছেন!');
        return;
    }
    
    socket.emit('game:rollDice', { roomCode, userId: myId });
}

// Show pawn selector
function showPawnSelector(diceValue) {
    const selector = document.getElementById('pawnsSelector');
    const options = document.getElementById('pawnOptions');
    options.innerHTML = '';
    
    const player = gameState.players[myId];
    player.pawns.forEach((pawn, idx) => {
        if ((pawn.position === 'home' && diceValue === 6) || pawn.position === 'board') {
            if (diceValue !== 6 && pawn.position === 'board') {
                if (pawn.step + diceValue <= 56) {
                    const btn = document.createElement('div');
                    btn.className = `pawn-option ${player.color}`;
                    btn.onclick = () => movePawn(idx);
                    options.appendChild(btn);
                }
            } else if (diceValue === 6) {
                const btn = document.createElement('div');
                btn.className = `pawn-option ${player.color}`;
                btn.onclick = () => movePawn(idx);
                options.appendChild(btn);
            }
        }
    });
    
    if (options.children.length === 0) {
        alert('কোনো বৈধ চাল নেই');
        // Turn will change from server
    } else {
        selector.style.display = 'block';
    }
}

// Move pawn
function movePawn(pawnIndex) {
    document.getElementById('pawnsSelector').style.display = 'none';
    socket.emit('game:movePawn', { roomCode, userId: myId, pawnIndex });
}

// Chat
function sendGameChat() {
    const input = document.getElementById('gameChatInput');
    const message = input.value.trim();
    if (!message) return;
    
    socket.emit('send-message', {
        roomCode,
        userId: myId,
        phone: currentUser.phone,
        message
    });
    
    input.value = '';
}

// Leave game
function leaveGame() {
    if (confirm('আপনি কি সত্যিই খেলা ছাড়তে চান?')) {
        window.location.href = 'index.html';
    }
}

// Back to lobby
function backToLobby() {
    window.location.href = 'index.html';
}

// Enter key for chat
document.getElementById('gameChatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendGameChat();
});
