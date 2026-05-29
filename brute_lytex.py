import requests
import base64
import json

client_id = '60f088830b1ca8f058070b'
client_secret = 'CwygW1gMxWN3h0QYlHE1abCZFgAXodcIuWLKtEcUu60yq6rzxMtSdAjl9MrCgaCfmerIusMLj2Ii8Z2qYoMDCibcILNZ9i068gwzCuQ4nyEl9s08qAgVp45qzqiCA8PBBCQWz5zdyE3GDnFNwm33FSIAmfGKOxRqSE6KrDTw8jT5ZeaMHKsJzm5CUpOFoa96DaSbABoa93beCkhgwZWPI93FqKLPFqAsCKwIx49XkYxQLoq8MAeF0UwBCQU6TdiN'

auth_string = f'{client_id}:{client_secret}'
auth_base64 = base64.b64encode(auth_string.encode()).decode()

bases = [
    'https://api-pay.lytex.com.br',
    'https://public-api-pay.lytex.com.br',
]

headers_to_try = [
    {'Authorization': f'Basic {auth_base64}'},
    {'Authorization': f'Bearer {client_secret}', 'client_id': client_id},
    {'client_id': client_id, 'client_secret': client_secret},
    {'x-api-key': client_secret},
    {'Token': client_secret}
]

paths = ['/v1/pix', '/v2/pix', '/v1/charges', '/v2/charges', '/api/v1/pix']

print('Testing Lytex API combinations...')
for base in bases:
    for path in paths:
        url = base + path
        for headers in headers_to_try:
            try:
                # Try a POST request to create a charge
                r = requests.post(url, headers=headers, json={"value": 10.00}, timeout=5)
                if r.status_code not in [404, 405]:
                    print(f'[{r.status_code}] {url} | Headers: {list(headers.keys())}')
                    print(f'Response: {r.text[:200]}')
            except Exception as e:
                pass
print('Finished.')
