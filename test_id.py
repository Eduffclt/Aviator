import requests, json, base64

client_id = '69f0168830b1ca8f080170b'
client_secret = 'CwygW1gMxWN3h0QYlHE1abCZFgAXodcIuWLKtEcUu60yq6rzxMtSdAjl9MrCgaCfmerIusMLj2Ii8Z2qYoMDCibcILNZ9i068gwzCuQ4nyEl9s08qAgVp45qzqiCA8PBBCQWz5zdyE3GDnFNwm33FSIAmfGKOxRqSE6KrDTw8jT5ZeaMHKsJzm5CUpOFoa96DaSbABoa93beCkhgwZWPI93FqKLPFqAsCKwIx49XkYxQLoq8MAeF0UwBCQU6TdiN'

url = 'https://api-pay.lytex.com.br/v2/invoices'

payload = {
    'client': {
      'type': 'pf',
      'name': 'João Silva',
      'cpfCnpj': '08608853051',
      'email': 'joaosilva@lytex.com.br',
      'cellphone':  '31999999999'
    },
    'items':[{
      'name': 'Depósito Aviator',
      'quantity' : 1,
      'value':  1000
    }],
    'dueDate': '2025-12-31',
    'paymentMethods': {
      'pix':  {'enable': True},
      'boleto': {'enable': False},
      'creditCard': {'enable': False}
    }
}

headers_list = [
    {'Client-Id': client_id, 'Client-Secret': client_secret},
    {'client_id': client_id, 'client_secret': client_secret},
    {'Authorization': f'Basic {base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()}'}
]

for h in headers_list:
    try:
        r = requests.post(url, headers=h, json=payload, timeout=5)
        print(f'{list(h.keys())} -> {r.status_code} {r.text[:100]}')
    except Exception as e:
        print(e)
