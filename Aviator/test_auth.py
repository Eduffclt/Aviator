import requests
import json

client_id = '60f088830b1ca8f058070b'
client_secret = 'CwygW1gMxWN3h0QYlHE1abCZFgAXodcIuWLKtEcUu60yq6rzxMtSdAjl9MrCgaCfmerIusMLj2Ii8Z2qYoMDCibcILNZ9i068gwzCuQ4nyEl9s08qAgVp45qzqiCA8PBBCQWz5zdyE3GDnFNwm33FSIAmfGKOxRqSE6KrDTw8jT5ZeaMHKsJzm5CUpOFoa96DaSbABoa93beCkhgwZWPI93FqKLPFqAsCKwIx49XkYxQLoq8MAeF0UwBCQU6TdiN'

auth_base = 'https://auth-pay.lytex.com.br'
api_base  = 'https://api-pay.lytex.com.br'

# Testar endpoints de autenticacao
auth_paths = ['/oauth/token', '/token', '/v1/oauth/token', '/auth/token', '/api/token']

print('=== TESTANDO AUTH ===')
for path in auth_paths:
    url = auth_base + path
    try:
        # JSON
        r = requests.post(url, json={
            'grant_type': 'client_credentials',
            'client_id': client_id,
            'client_secret': client_secret
        }, timeout=8)
        print(f'[JSON][{r.status_code}] {url}')
        if r.status_code not in [404, 405]:
            print('  ', r.text[:400])
    except Exception as e:
        print(f'[ERR] {url}: {str(e)[:60]}')
    
    try:
        # Form data
        r2 = requests.post(url, data={
            'grant_type': 'client_credentials',
            'client_id': client_id,
            'client_secret': client_secret
        }, timeout=8)
        print(f'[FORM][{r2.status_code}] {url}')
        if r2.status_code not in [404, 405]:
            print('  ', r2.text[:400])
    except Exception as e:
        print(f'[ERR] {url}: {str(e)[:60]}')
