const socket = io();

// UI Elements
const authScreen = document.getElementById('auth-screen');
const gameScreen = document.getElementById('game-screen');
const loadingOverlay = document.getElementById('loading-overlay');
const waitingOverlay = document.getElementById('waiting-overlay');
const crashedOverlay = document.getElementById('crashed-overlay');
const waitingProgress = document.getElementById('waiting-progress');

const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const authError = document.getElementById('auth-error');

const userDisplay = document.getElementById('username-display');
const balanceDisplay = document.getElementById('balance');
const btnLogout = document.getElementById('btn-logout');

const multiplierDisplay = document.getElementById('multiplier');
const historyBar = document.getElementById('history-bar');
const playersList = document.getElementById('players-list');

const betAmountInput = document.getElementById('bet-amount');
const btnMinus = document.getElementById('btn-minus');
const btnPlus = document.getElementById('btn-plus');
const btnQuick = document.querySelectorAll('.btn-quick');
const btnBet = document.getElementById('btn-bet');
const btnCashout = document.getElementById('btn-cashout');

// Canvas Elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const planeIcon = document.getElementById('plane');
const gameArea = document.querySelector('.game-area');

// Game State
let currentToken = localStorage.getItem('aviator_token');
let currentUser = null;
let gameState = 'WAITING'; // WAITING, FLYING, CRASHED
let currentMultiplier = 1.00;
let myBetAmount = 0;
let hasBetted = false;
let hasCashedOut = false;

// Configs for drawing
let animationId;
let curveData = [];
let maxCurveX = 100;
let maxCurveY = 100;

// Resize canvas
function resizeCanvas() {
    canvas.width = gameArea.clientWidth;
    canvas.height = gameArea.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// INITIAL CONNECTION
socket.on('connect', () => {
    if (currentToken) {
        socket.emit('authenticate', { token: currentToken });
    }
});

// AUTHENTICATION
btnLogin.addEventListener('click', () => {
    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput.value, password: passwordInput.value })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) authError.innerText = data.error;
        else {
            localStorage.setItem('aviator_token', data.token);
            currentToken = data.token;
            socket.emit('authenticate', { token: currentToken });
        }
    });
});

btnRegister.addEventListener('click', () => {
    fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput.value, password: passwordInput.value })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) authError.innerText = data.error;
        else {
            authError.style.color = '#2ecc71';
            authError.innerText = "Cadastro realizado! Faça o login.";
            setTimeout(() => { authError.style.color = 'var(--primary)'; authError.innerText = ''; }, 3000);
        }
    });
});

btnLogout.addEventListener('click', () => {
    localStorage.removeItem('aviator_token');
    window.location.reload();
});

socket.on('auth_success', (data) => {
    currentUser = data.user;
    userDisplay.innerText = currentUser.username;
    balanceDisplay.innerText = currentUser.balance.toFixed(2);
    
    authScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    loadingOverlay.classList.add('hidden');
    
    // Show admin link if admin
    if (currentUser.is_admin) {
        document.getElementById('admin-link').classList.remove('hidden');
    }
    
    // Resize canvas now that it is visible
    resizeCanvas();
});

// DEPOSIT MODAL
const modalDeposit = document.getElementById('modal-deposit');
document.getElementById('btn-deposit').addEventListener('click', () => {
    document.getElementById('deposit-amount').value = '';
    document.getElementById('deposit-pix-info').classList.add('hidden');
    document.getElementById('deposit-step1').classList.remove('hidden');
    document.getElementById('deposit-status-msg').innerText = 'Aguardando confirmação do pagamento...';
    document.getElementById('deposit-status-msg').className = 'status-waiting';
    document.getElementById('deposit-qr').style.display = 'none';
    document.getElementById('qr-placeholder').style.display = 'flex';
    // Update current balance in modal
    document.getElementById('modal-current-balance').innerText = `R$ ${currentUser.balance.toFixed(2)}`;
    // Reset active pill
    document.querySelectorAll('.amount-pill-btn').forEach(b => b.classList.remove('active'));
    modalDeposit.classList.remove('hidden');
});

// Quick deposit amounts
document.querySelectorAll('[data-val]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById('deposit-amount').value = btn.dataset.val;
        document.querySelectorAll('[data-val]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// Quick withdraw amounts
document.querySelectorAll('[data-val-wd]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById('withdraw-amount').value = btn.dataset.valWd;
        document.querySelectorAll('[data-val-wd]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

let pollInterval = null;

document.getElementById('btn-generate-pix').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('deposit-amount').value);
    if (!amount || amount < 5) {
        alert('Valor mínimo é R$ 5,00');
        return;
    }
    
    const btn = document.getElementById('btn-generate-pix');
    btn.innerText = 'Gerando...';
    btn.disabled = true;
    
    try {
        const res = await fetch('/api/deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
            body: JSON.stringify({ amount })
        });
        const data = await res.json();
        
        if (data.error) {
            alert(data.error);
            btn.innerText = 'Gerar PIX';
            btn.disabled = false;
            return;
        }
        
        // Show PIX info
        document.getElementById('deposit-step1').classList.add('hidden');
        document.getElementById('deposit-pix-info').classList.remove('hidden');
        document.getElementById('deposit-pix-code').innerText = data.qr_code;
        document.getElementById('deposit-amount-label').innerText = `Aguardando pagamento de R$ ${amount.toFixed(2)}`;
        
        if (data.qr_code_base64) {
            const qrImg = document.getElementById('deposit-qr');
            qrImg.src = `data:image/png;base64,${data.qr_code_base64}`;
            qrImg.style.display = 'block';
            document.getElementById('qr-placeholder').style.display = 'none';
        }
        
        // Start polling
        const paymentId = data.transaction_id;
        pollInterval = setInterval(async () => {
            const statusRes = await fetch(`/api/deposit/status/${paymentId}`, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            const statusData = await statusRes.json();
            
            if (statusData.status === 'COMPLETED') {
                clearInterval(pollInterval);
                currentUser.balance = statusData.balance;
                balanceDisplay.innerText = statusData.balance.toFixed(2);
                const statusEl = document.getElementById('deposit-status-msg');
                statusEl.className = '';
                statusEl.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--success)"></i> <strong style="color:var(--success)">Depósito de R$ ${amount.toFixed(2)} confirmado!</strong>`;
                setTimeout(() => modalDeposit.classList.add('hidden'), 3000);
            }
        }, 5000);
        
    } catch (e) {
        alert('Erro ao gerar PIX: ' + e.message);
        btn.innerText = 'Gerar PIX';
        btn.disabled = false;
    }
});

window.copyPixCode = function() {
    const code = document.getElementById('deposit-pix-code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        document.getElementById('btn-copy-pix').innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
        setTimeout(() => {
            document.getElementById('btn-copy-pix').innerHTML = '<i class="fa-solid fa-copy"></i> Copiar Código PIX';
        }, 2000);
    });
};

// WITHDRAW MODAL
const modalWithdraw = document.getElementById('modal-withdraw');
document.getElementById('btn-withdraw').addEventListener('click', () => {
    document.getElementById('withdraw-amount').value = '';
    document.getElementById('withdraw-pix-key').value = '';
    document.getElementById('withdraw-error').innerText = '';
    document.getElementById('withdraw-balance-display').innerText = `R$ ${currentUser.balance.toFixed(2)}`;
    document.querySelectorAll('[data-val-wd]').forEach(b => b.classList.remove('active'));
    modalWithdraw.classList.remove('hidden');
});

document.getElementById('btn-confirm-withdraw').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    const pixKey = document.getElementById('withdraw-pix-key').value.trim();
    const errEl = document.getElementById('withdraw-error');
    
    if (!amount || amount < 10) { errEl.innerText = 'Valor mínimo é R$ 10,00'; return; }
    if (!pixKey) { errEl.innerText = 'Informe sua chave PIX'; return; }
    if (amount > currentUser.balance) { errEl.innerText = 'Saldo insuficiente'; return; }
    
    const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
        body: JSON.stringify({ amount, pix_key: pixKey })
    });
    const data = await res.json();
    
    if (data.error) { errEl.innerText = data.error; return; }
    
    currentUser.balance = data.balance;
    balanceDisplay.innerText = data.balance.toFixed(2);
    modalWithdraw.classList.add('hidden');
    alert('✅ ' + data.message);
});

// Close modals
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
        if (pollInterval) clearInterval(pollInterval);
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    });
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            if (pollInterval) clearInterval(pollInterval);
            overlay.classList.add('hidden');
        }
    });
});

socket.on('auth_error', () => {
    localStorage.removeItem('aviator_token');
    currentToken = null;
    authScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
});

// BET CONTROLS
btnMinus.addEventListener('click', () => {
    let val = parseFloat(betAmountInput.value);
    if (val > 1) betAmountInput.value = (val - 1).toFixed(2);
});

btnPlus.addEventListener('click', () => {
    let val = parseFloat(betAmountInput.value);
    betAmountInput.value = (val + 1).toFixed(2);
});

btnQuick.forEach(btn => {
    btn.addEventListener('click', () => {
        let val = parseFloat(betAmountInput.value) || 0;
        betAmountInput.value = (val + parseFloat(btn.dataset.amount)).toFixed(2);
    });
});

btnBet.addEventListener('click', () => {
    if (gameState !== 'WAITING') return;
    const amount = parseFloat(betAmountInput.value);
    if (amount <= 0 || amount > currentUser.balance) {
        alert("Saldo insuficiente ou valor inválido.");
        return;
    }
    
    socket.emit('place_bet', { amount: amount });
    btnBet.disabled = true;
    btnBet.innerText = "AGUARDANDO...";
});

btnCashout.addEventListener('click', () => {
    if (gameState === 'FLYING' && hasBetted && !hasCashedOut) {
        socket.emit('cash_out');
    }
});

// GAME EVENTS
socket.on('game_state', (state) => {
    gameState = state.status;
    currentMultiplier = state.multiplier;
    loadingOverlay.classList.add('hidden');
    
    updateHistory(state.history);
    renderPlayers(state.current_bets);
    
    if (gameState === 'WAITING') {
        waitingOverlay.classList.remove('hidden');
        crashedOverlay.classList.add('hidden');
        multiplierDisplay.innerText = "1.00x";
        resetCanvas();
        resetBetUI();
    } else if (gameState === 'FLYING') {
        waitingOverlay.classList.add('hidden');
        crashedOverlay.classList.add('hidden');
        multiplierDisplay.innerText = currentMultiplier.toFixed(2) + "x";
        planeIcon.classList.add('plane-flying');
        startCanvasAnimation();
    } else {
        showCrash(state.crash_point);
    }
});

socket.on('waiting_tick', (data) => {
    waitingProgress.style.width = (data.time_left * 10) + "%";
});

socket.on('bet_placed', (data) => {
    currentUser.balance = data.balance;
    balanceDisplay.innerText = data.balance.toFixed(2);
    hasBetted = true;
    myBetAmount = parseFloat(betAmountInput.value);
    btnBet.innerText = "APOSTA REGISTRADA";
});

socket.on('new_bet', (bet) => {
    addPlayerToDOM(bet);
});

socket.on('game_started', (data) => {
    gameState = data.status;
    waitingOverlay.classList.add('hidden');
    
    if (hasBetted) {
        btnBet.classList.add('hidden');
        btnCashout.classList.remove('hidden');
        updateCashoutButton();
    } else {
        btnBet.disabled = true;
    }
    
    startCanvasAnimation();
});

socket.on('multiplier_update', (data) => {
    currentMultiplier = data.multiplier;
    multiplierDisplay.innerText = currentMultiplier.toFixed(2) + "x";
    
    if (hasBetted && !hasCashedOut) {
        updateCashoutButton();
    }
    
    // Add point to curve data
    curveData.push({
        x: curveData.length,
        y: currentMultiplier
    });
});

socket.on('cash_out_success', (data) => {
    hasCashedOut = true;
    currentUser.balance = data.balance;
    balanceDisplay.innerText = data.balance.toFixed(2);
    
    btnCashout.classList.add('hidden');
    btnBet.classList.remove('hidden');
    btnBet.innerText = "LUCRO: R$" + data.win_amount.toFixed(2);
});

socket.on('user_cashed_out', (bet) => {
    updatePlayerInDOM(bet);
});

socket.on('game_crashed', (data) => {
    gameState = 'CRASHED';
    showCrash(data.multiplier);
    updateHistory(data.history);
    
    if (hasBetted && !hasCashedOut) {
        btnBet.innerText = "PERDEU A APOSTA";
        setTimeout(() => {
            resetBetUI();
        }, 2000);
    }
});

// UI UPDATES
function updateCashoutButton() {
    const winAmount = (myBetAmount * currentMultiplier).toFixed(2);
    btnCashout.innerText = `CASH OUT\nR$${winAmount}`;
}

function resetBetUI() {
    hasBetted = false;
    hasCashedOut = false;
    btnBet.disabled = false;
    btnBet.innerText = "APOSTAR";
    btnBet.classList.remove('hidden');
    btnCashout.classList.add('hidden');
    playersList.innerHTML = '';
}

function showCrash(multiplier) {
    crashedOverlay.classList.remove('hidden');
    multiplierDisplay.classList.add('text-red');
    planeIcon.classList.remove('plane-flying');
    stopCanvasAnimation();
    
    // Animate plane crashing out of view
    planeIcon.style.transition = 'bottom 1s, left 1s';
    planeIcon.style.bottom = '-100px';
    planeIcon.style.left = '120%';
}

function updateHistory(history) {
    historyBar.innerHTML = '';
    history.forEach(mult => {
        const div = document.createElement('div');
        div.classList.add('history-item');
        div.innerText = mult.toFixed(2) + "x";
        
        if (mult < 1.2) div.classList.add('blue');
        else if (mult < 2) div.classList.add('purple');
        else if (mult < 10) div.classList.add('pink');
        else div.classList.add('orange');
        
        historyBar.appendChild(div);
    });
}

function renderPlayers(bets) {
    playersList.innerHTML = '';
    bets.forEach(addPlayerToDOM);
}

function addPlayerToDOM(bet) {
    const div = document.createElement('div');
    div.classList.add('player-row');
    div.id = 'player-' + bet.user_id;
    
    let isCashed = bet.cashed_out ? 'won' : '';
    let winAmountStr = bet.cashed_out ? `R$${bet.win_amount.toFixed(2)}` : '-';
    
    if (bet.cashed_out) div.classList.add('won');
    
    div.innerHTML = `
        <span>${bet.username}</span>
        <span>R$${bet.amount.toFixed(2)}</span>
        <span>${winAmountStr}</span>
    `;
    playersList.appendChild(div);
}

function updatePlayerInDOM(bet) {
    const el = document.getElementById('player-' + bet.user_id);
    if (el) {
        el.classList.add('won');
        el.innerHTML = `
            <span>${bet.username}</span>
            <span>R$${bet.amount.toFixed(2)}</span>
            <span>R$${bet.win_amount.toFixed(2)}</span>
        `;
    }
}

// CANVAS DRAWING (The Curve)
function resetCanvas() {
    curveData = [];
    maxCurveX = 100;
    multiplierDisplay.classList.remove('text-red');
    planeIcon.classList.remove('plane-flying');
    
    planeIcon.style.transition = 'none';
    planeIcon.style.bottom = '20px';
    planeIcon.style.left = '20px';
    planeIcon.style.transform = 'translate(-50%, -50%) rotate(0deg)';
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function startCanvasAnimation() {
    if (animationId) cancelAnimationFrame(animationId);
    drawCurve();
}

function stopCanvasAnimation() {
    if (animationId) cancelAnimationFrame(animationId);
}

function drawCurve() {
    if (gameState !== 'FLYING') return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (curveData.length > 0) {
        // Draw grid
        drawGrid();
        
        ctx.beginPath();
        
        // Starting point (bottom left)
        let paddingX = 20;
        let paddingY = canvas.height - 20;
        
        ctx.moveTo(paddingX, paddingY);
        
        let targetMaxX = Math.max(100, curveData.length);
        maxCurveX += (targetMaxX - maxCurveX) * 0.1;
        
        let lastScreenX = paddingX;
        let lastScreenY = paddingY;
        
        // The higher the multiplier, the higher the plane flies
        // We use log or power to curve it
        for (let i = 0; i < curveData.length; i++) {
            let point = curveData[i];
            
            // X goes from left to right as time passes
            let screenX = paddingX + ((canvas.width - paddingX * 2) * (i / maxCurveX));
            
            // Y goes up as multiplier grows
            let multRatio = Math.min(1, Math.log10(point.y) / 2); // Max log10(100) = 2
            let screenY = paddingY - ((canvas.height - paddingX * 2) * multRatio);
            
            ctx.lineTo(screenX, screenY);
            lastScreenX = screenX;
            lastScreenY = screenY;
        }
        
        // Style the curve
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#e50914';
        ctx.stroke();
        
        // Fill under curve
        ctx.lineTo(lastScreenX, paddingY);
        ctx.lineTo(paddingX, paddingY);
        
        let gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(229, 9, 20, 0.4)');
        gradient.addColorStop(1, 'rgba(229, 9, 20, 0)');
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Move Plane
        planeIcon.style.left = lastScreenX + 'px';
        planeIcon.style.bottom = (canvas.height - lastScreenY) + 'px';
        
        // Rotate plane slightly upwards based on curve
        let slope = 0;
        if (curveData.length > 2) {
            let p1 = curveData[curveData.length - 2];
            let p2 = curveData[curveData.length - 1];
            slope = (p2.y - p1.y); // Simplified rotation
        }
        let rot = Math.min(45, 15 + slope * 50);
        // The SVG points RIGHT natively.
        planeIcon.style.transform = `translate(-50%, -50%) rotate(${-rot}deg)`;
    }
    
    animationId = requestAnimationFrame(drawCurve);
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    
    // Horizontal
    for(let i = 0; i < 5; i++) {
        let y = (canvas.height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    
    // Vertical
    for(let i = 0; i < 10; i++) {
        let x = (canvas.width / 10) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
}
