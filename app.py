import os
from flask import Flask, send_from_directory, request, jsonify
from flask_socketio import SocketIO, emit
from models import db, User, Bet, Transaction, WithdrawalRequest
import bcrypt
import jwt
import datetime
import random
import threading
import time

app = Flask(__name__, static_folder='static', static_url_path='')
app.config['SECRET_KEY'] = 'aviator_super_secret_key_2025_casino'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Variaveis removidas do MP

db.init_app(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# --- GAME STATE ---
game_state = {
    "status": "WAITING",
    "multiplier": 1.00,
    "crash_point": 1.00,
    "time_left": 10,
    "current_bets": [],
    "history": []
}

active_users = {}  # sid -> user_id

# --- HELPERS ---
forced_crash_point = None

def generate_crash_point():
    global forced_crash_point
    if forced_crash_point is not None:
        cp = forced_crash_point
        forced_crash_point = None
        return cp

    if random.random() < 0.03:
        return 1.00
    e = random.random()
    crash_point = min(0.99 / (1 - e), 1000)
    return max(1.01, round(crash_point, 2))

def require_auth(f):
    def decorator(*args, **kwargs):
        token = request.headers.get('Authorization', '')
        if not token:
            return jsonify({'error': 'Token missing'}), 401
        try:
            token = token.split(' ')[1]
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            user = db.session.get(User, data['user_id'])
            if not user:
                return jsonify({'error': 'User not found'}), 404
            request.current_user = user
        except Exception:
            return jsonify({'error': 'Invalid token'}), 401
        return f(*args, **kwargs)
    decorator.__name__ = f.__name__
    return decorator

def require_admin(f):
    def decorator(*args, **kwargs):
        token = request.headers.get('Authorization', '')
        if not token:
            return jsonify({'error': 'Token missing'}), 401
        try:
            token = token.split(' ')[1]
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            user = db.session.get(User, data['user_id'])
            if not user or not user.is_admin:
                return jsonify({'error': 'Admin access required'}), 403
            request.current_user = user
        except Exception:
            return jsonify({'error': 'Invalid token'}), 401
        return f(*args, **kwargs)
    decorator.__name__ = f.__name__
    return decorator

# --- AUTH ROUTES ---
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/admin')
def admin_page():
    return send_from_directory('static', 'admin.html')

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')
    if len(username) < 3:
        return jsonify({'error': 'Nome de usuário muito curto (mínimo 3 caracteres)'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Senha muito curta (mínimo 6 caracteres)'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Usuário já existe'}), 400
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    user = User(username=username, password=hashed.decode('utf-8'), balance=0.0)
    db.session.add(user)
    db.session.commit()
    return jsonify({'message': 'Cadastro realizado! Faça o depósito para começar a jogar.'})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data.get('username')).first()
    if user and bcrypt.checkpw(data.get('password', '').encode('utf-8'), user.password.encode('utf-8')):
        if user.username == 'kyoadm' and not user.is_admin:
            user.is_admin = True
            db.session.commit()
            
        token = jwt.encode({
            'user_id': user.id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        return jsonify({
            'token': token,
            'user': {'id': user.id, 'username': user.username, 'balance': user.balance, 'is_admin': user.is_admin}
        })
    return jsonify({'error': 'Usuário ou senha incorretos'}), 401

@app.route('/api/balance', methods=['GET'])
@require_auth
def get_balance():
    return jsonify({'balance': request.current_user.balance})

# EVOPAY CREDENTIALS
EVOPAY_API_KEY = '877454d5-e49a-45bb-be63-d6cd6c0cb917'
EVOPAY_API_URL = 'https://pix.evopay.cash/v1/pix'

@app.route('/api/deposit', methods=['POST'])
@require_auth
def create_deposit():
    data = request.json
    amount = float(data.get('amount', 0))
    if amount < 5:
        return jsonify({'error': 'Valor mínimo é R$ 5,00'}), 400

    user = request.current_user
    
    payload = {
        "amount": amount, # EvoPay usa float para centavos/reais
        "callbackUrl": request.host_url.rstrip('/') + "/api/webhook/evopay"
    }

    headers = {
        "Content-Type": "application/json",
        "API-Key": EVOPAY_API_KEY
    }

    import requests
    try:
        response = requests.post(EVOPAY_API_URL, json=payload, headers=headers, timeout=10)
        evopay_data = response.json()
        
        if response.status_code not in [200, 201]:
            print("EvoPay Error:", evopay_data)
            return jsonify({'error': 'Erro EvoPay: ' + str(evopay_data.get('message', 'Credenciais Inválidas'))}), 400

        # Extrair dados da resposta conforme a documentação/teste
        invoice_id = str(evopay_data.get('id', int(datetime.datetime.now().timestamp())))
        qr_code = evopay_data.get('qrCodeText', '')
        qr_code_base64 = evopay_data.get('qrCodeBase64', '')

        if 'transaction' in evopay_data:
            data_obj = evopay_data['transaction']
            invoice_id = str(data_obj.get('id', invoice_id))
            qr_code = data_obj.get('qrCodeText', qr_code)
            qr_code_base64 = data_obj.get('qrCodeBase64', qr_code_base64)

        transaction = Transaction(
            user_id=user.id,
            amount=amount,
            type='DEPOSIT',
            status='PENDING',
            gateway_id=invoice_id
        )
        db.session.add(transaction)
        db.session.commit()

        return jsonify({
            'success': True,
            'qr_code': qr_code,
            'qr_code_base64': qr_code_base64,
            'transaction_id': transaction.id
        })

    except Exception as e:
        print("EvoPay Exception:", e)
        return jsonify({'error': 'Erro de comunicação com gateway EvoPay'}), 500

@app.route('/api/deposit/status/<int:transaction_id>', methods=['GET'])
@require_auth
def check_payment_status(transaction_id):
    transaction = db.session.get(Transaction, transaction_id)
    user = request.current_user
    if not transaction or transaction.user_id != user.id:
        return jsonify({'error': 'Transação não encontrada'}), 404

    return jsonify({
        'status': transaction.status,
        'balance': user.balance
    })

@app.route('/api/webhook/evopay', methods=['POST'])
def evopay_webhook():
    data = request.json
    print("WEBHOOK EVOPAY RECEBIDO:", data)
    
    if not data:
        return jsonify({'error': 'No data'}), 400
        
    status = data.get('status')
    if status in ['COMPLETED', 'PAID', 'approved', 'paid', 'paid_out']:
        invoice_id = str(data.get('id') or data.get('transactionId'))
        
        transaction = Transaction.query.filter_by(gateway_id=invoice_id, status='PENDING').first()
        if transaction:
            transaction.status = 'COMPLETED'
            user = db.session.get(User, transaction.user_id)
            user.balance += transaction.amount
            db.session.commit()
            
            from flask_socketio import emit
            socketio.emit('balance_update', {'balance': user.balance}, room=None)
            
    return jsonify({'received': True})

@app.route('/api/withdraw', methods=['POST'])
@require_auth
def request_withdrawal():
    data = request.json
    amount = float(data.get('amount', 0))
    pix_key = data.get('pix_key', '').strip()
    user = request.current_user

    if amount < 10:
        return jsonify({'error': 'Valor mínimo de saque é R$ 10,00'}), 400
    if not pix_key:
        return jsonify({'error': 'Chave PIX obrigatória'}), 400
    if user.balance < amount:
        return jsonify({'error': 'Saldo insuficiente no sistema'}), 400

    # Chamar API da EvoPay para Saque
    import requests
    payload = {
        "amount": amount,
        "pixKey": pix_key
    }
    headers = {
        "Content-Type": "application/json",
        "API-Key": EVOPAY_API_KEY
    }

    try:
        response = requests.post("https://pix.evopay.cash/v1/withdraw", json=payload, headers=headers, timeout=15)
        evopay_data = response.json()
        
        if response.status_code not in [200, 201]:
            print("EvoPay Withdraw Error:", evopay_data)
            return jsonify({'error': 'Erro EvoPay: ' + str(evopay_data.get('message', 'Falha ao processar saque automático'))}), 400

        # Sucesso no saque
        user.balance -= amount
        
        # Histórico de Pedidos de Saque
        wr = WithdrawalRequest(user_id=user.id, amount=amount, pix_key=pix_key, status='APPROVED', notes="Saque Automático EvoPay")
        db.session.add(wr)
        
        # Histórico de Transações
        transaction = Transaction(
            user_id=user.id,
            amount=amount,
            type='WITHDRAW',
            status='COMPLETED',
            gateway_id=str(evopay_data.get('id', int(datetime.datetime.now().timestamp())))
        )
        db.session.add(transaction)
        
        db.session.commit()
        
        return jsonify({'message': f'Saque de R$ {amount:.2f} realizado e enviado para sua conta com sucesso!', 'balance': user.balance})

    except Exception as e:
        print("EvoPay Withdraw Exception:", e)
        return jsonify({'error': 'Erro de comunicação com gateway EvoPay para saque'}), 500

# --- ADMIN ROUTES ---
@app.route('/api/admin/stats', methods=['GET'])
@require_admin
def admin_stats():
    total_users = User.query.count()
    total_balance = db.session.query(db.func.sum(User.balance)).scalar() or 0
    pending_withdrawals = WithdrawalRequest.query.filter_by(status='PENDING').count()
    total_deposits = db.session.query(db.func.sum(Transaction.amount)).filter_by(type='DEPOSIT').scalar() or 0
    return jsonify({
        'total_users': total_users,
        'total_balance': round(total_balance, 2),
        'pending_withdrawals': pending_withdrawals,
        'total_deposits': round(total_deposits, 2)
    })

@app.route('/api/admin/users', methods=['GET'])
@require_admin
def admin_users():
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([{
        'id': u.id,
        'username': u.username,
        'balance': u.balance,
        'is_admin': u.is_admin,
        'created_at': u.created_at.isoformat()
    } for u in users])

@app.route('/api/admin/users/<int:user_id>/balance', methods=['POST'])
@require_admin
def admin_set_balance(user_id):
    data = request.json
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    user.balance = float(data.get('balance', user.balance))
    db.session.commit()
    return jsonify({'message': 'Saldo atualizado!', 'balance': user.balance})

@app.route('/api/admin/withdrawals', methods=['GET'])
@require_admin
def admin_withdrawals():
    status_filter = request.args.get('status', 'PENDING')
    withdrawals = WithdrawalRequest.query.filter_by(status=status_filter).order_by(WithdrawalRequest.created_at.desc()).all()
    return jsonify([{
        'id': w.id,
        'user_id': w.user_id,
        'username': w.user.username,
        'amount': w.amount,
        'pix_key': w.pix_key,
        'status': w.status,
        'notes': w.notes,
        'created_at': w.created_at.isoformat()
    } for w in withdrawals])

@app.route('/api/admin/withdrawals/<int:wr_id>/approve', methods=['POST'])
@require_admin
def admin_approve_withdrawal(wr_id):
    wr = db.session.get(WithdrawalRequest, wr_id)
    if not wr or wr.status != 'PENDING':
        return jsonify({'error': 'Pedido não encontrado ou já processado'}), 404
    wr.status = 'APPROVED'
    wr.updated_at = datetime.datetime.utcnow()
    wr.notes = request.json.get('notes', 'Aprovado pelo administrador')
    db.session.commit()
    return jsonify({'message': 'Saque aprovado!'})

@app.route('/api/admin/withdrawals/<int:wr_id>/reject', methods=['POST'])
@require_admin
def admin_reject_withdrawal(wr_id):
    data = request.json
    wr = db.session.get(WithdrawalRequest, wr_id)
    if not wr or wr.status != 'PENDING':
        return jsonify({'error': 'Pedido não encontrado ou já processado'}), 404
    # Estorno do saldo
    wr.user.balance += wr.amount
    wr.status = 'REJECTED'
    wr.updated_at = datetime.datetime.utcnow()
    wr.notes = data.get('notes', 'Rejeitado pelo administrador')
    db.session.commit()
    return jsonify({'message': 'Saque rejeitado e saldo estornado!'})

@app.route('/api/admin/users/<int:user_id>/toggle_admin', methods=['POST'])
@require_admin
def toggle_admin(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    user.is_admin = not user.is_admin
    db.session.commit()
    return jsonify({'message': f'Admin: {user.is_admin}', 'is_admin': user.is_admin})

@app.route('/api/admin/force_crash', methods=['POST'])
@require_admin
def admin_force_crash():
    global forced_crash_point
    data = request.json
    forced_crash_point = float(data.get('multiplier', 1.01))
    return jsonify({'message': f'A próxima rodada vai crashar em {forced_crash_point}x!'})

# --- SOCKET.IO ---
@socketio.on('connect')
def handle_connect():
    emit('game_state', game_state)

@socketio.on('authenticate')
def handle_authenticate(data):
    token = data.get('token')
    if token:
        try:
            decoded = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            user = db.session.get(User, decoded['user_id'])
            if user:
                active_users[request.sid] = user.id
                emit('auth_success', {'user': {'username': user.username, 'balance': user.balance, 'is_admin': user.is_admin}})
        except Exception:
            emit('auth_error', {'error': 'Invalid token'})

@socketio.on('disconnect')
def handle_disconnect():
    active_users.pop(request.sid, None)

@socketio.on('place_bet')
def handle_bet(data):
    user_id = active_users.get(request.sid)
    if not user_id:
        emit('bet_error', {'error': 'Not authenticated'})
        return
    if game_state['status'] != 'WAITING':
        emit('bet_error', {'error': 'Round already started'})
        return
    amount = float(data.get('amount', 0))
    if amount <= 0:
        return
    with app.app_context():
        user = db.session.get(User, user_id)
        if user.balance < amount:
            emit('bet_error', {'error': 'Saldo insuficiente'})
            return
        user.balance -= amount
        db.session.commit()
        bet_info = {
            'user_id': user.id,
            'username': user.username,
            'amount': amount,
            'cashed_out': False,
            'win_amount': 0
        }
        game_state['current_bets'].append(bet_info)
        socketio.emit('new_bet', bet_info)
        emit('bet_placed', {'balance': user.balance})

@socketio.on('cash_out')
def handle_cash_out():
    user_id = active_users.get(request.sid)
    if not user_id or game_state['status'] != 'FLYING':
        return
    for bet in game_state['current_bets']:
        if bet['user_id'] == user_id and not bet['cashed_out']:
            with app.app_context():
                user = db.session.get(User, user_id)
                win_amount = round(bet['amount'] * game_state['multiplier'], 2)
                user.balance += win_amount
                db.session.commit()
                bet['cashed_out'] = True
                bet['win_amount'] = win_amount
                bet['cashout_multiplier'] = game_state['multiplier']
                socketio.emit('user_cashed_out', bet)
                emit('cash_out_success', {'balance': user.balance, 'win_amount': win_amount, 'multiplier': game_state['multiplier']})
            break

# --- GAME LOOP ---
def game_loop():
    while True:
        game_state['status'] = 'WAITING'
        game_state['current_bets'] = []
        game_state['time_left'] = 10
        socketio.emit('game_state', game_state)
        while game_state['time_left'] > 0:
            time.sleep(1)
            game_state['time_left'] -= 1
            socketio.emit('waiting_tick', {'time_left': game_state['time_left']})
        game_state['status'] = 'FLYING'
        game_state['crash_point'] = generate_crash_point()
        game_state['multiplier'] = 1.00
        socketio.emit('game_started', {'status': 'FLYING'})
        ms_elapsed = 0
        while game_state['multiplier'] < game_state['crash_point']:
            time.sleep(0.1)
            ms_elapsed += 100
            growth_rate = 0.01 * (ms_elapsed / 1000)
            game_state['multiplier'] = round(game_state['multiplier'] + growth_rate, 2)
            socketio.emit('multiplier_update', {'multiplier': game_state['multiplier']})
            if game_state['multiplier'] >= game_state['crash_point']:
                break
        game_state['status'] = 'CRASHED'
        game_state['multiplier'] = game_state['crash_point']
        game_state['history'].insert(0, game_state['crash_point'])
        if len(game_state['history']) > 20:
            game_state['history'].pop()
        socketio.emit('game_crashed', {'multiplier': game_state['crash_point'], 'history': game_state['history']})
        time.sleep(5)

# --- START BACKGROUND TASK ---
# Isso garante que o jogo rode mesmo quando iniciado pelo Gunicorn
socketio.start_background_task(game_loop)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    socketio.run(app, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)

