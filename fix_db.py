import sqlite3

def fix_db():
    conn = sqlite3.connect('instance/database.db')
    c = conn.cursor()
    
    try:
        c.execute("ALTER TABLE `transaction` RENAME COLUMN mp_payment_id TO gateway_id")
        print("Renamed mp_payment_id to gateway_id")
    except Exception as e:
        print("Rename failed:", e)

    try:
        c.execute("ALTER TABLE `transaction` ADD COLUMN status VARCHAR(20) DEFAULT 'PENDING'")
        print("Added status column")
    except Exception as e:
        print("Add status column failed:", e)

    conn.commit()
    conn.close()

if __name__ == '__main__':
    fix_db()
