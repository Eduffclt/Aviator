from app import app, db, User
import jwt
import datetime
import json

def run_test():
    with app.app_context():
        # Create a test user if not exists
        user = User.query.filter_by(username='test_user').first()
        if not user:
            user = User(username='test_user', password='123', balance=0.0)
            db.session.add(user)
            db.session.commit()
        
        token = jwt.encode({
            'user_id': user.id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        
        with app.test_client() as client:
            res = client.post('/api/deposit', 
                headers={'Authorization': f'Bearer {token}'},
                json={'amount': 15.0}
            )
            print("Status:", res.status_code)
            print("Data:", res.get_data(as_text=True))

if __name__ == '__main__':
    run_test()
