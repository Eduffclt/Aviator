from flask_sqlalchemy import SQLAlchemy
import datetime

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    balance = db.Column(db.Float, default=0.0)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    bets = db.relationship('Bet', backref='user', lazy=True)
    transactions = db.relationship('Transaction', backref='user', lazy=True)
    withdrawals = db.relationship('WithdrawalRequest', backref='user', lazy=True)

class Bet(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    cashed_out = db.Column(db.Boolean, default=False)
    cashout_multiplier = db.Column(db.Float, nullable=True)
    win_amount = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    type = db.Column(db.String(20), nullable=False) # 'DEPOSIT', 'WITHDRAW', 'BET', 'WIN'
    gateway_id = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(20), default='PENDING')
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class WithdrawalRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    pix_key = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(20), default='PENDING') # PENDING, APPROVED, REJECTED
    notes = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
