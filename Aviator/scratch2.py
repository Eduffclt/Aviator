import requests

def test_goupay():
    url = 'https://www.goupay.com.br/api/v1/pix'
    headers = {
        'Content-Type': 'application/json',
        'x-api-key': 'gou_live_39223e98941f432481bdab2b5fffc0d8'
    }
    payload = {
        "amount": 1000, # R$ 10,00
        "description": "Venda Loja X",
        "customer": {
            "name": "Cliente Teste",
            "email": "cliente@email.com",
            "cpf": "12345678900"
        }
    }
    response = requests.post(url, json=payload, headers=headers)
    print("Status:", response.status_code)
    try:
        print("Response:", response.json())
    except:
        print("Text:", response.text)

if __name__ == "__main__":
    test_goupay()
