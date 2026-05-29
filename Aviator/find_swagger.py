import requests

bases = [
    'https://api-pay.lytex.com.br',
    'https://api.lytex.com.br',
    'https://pay.lytex.com.br',
    'https://public-api-pay.lytex.com.br'
]

paths = [
    '/docs', '/swagger', '/swagger/v1/swagger.json', '/api/docs', '/swagger-ui.html',
    '/v1/api-docs', '/v2/api-docs', '/openapi.json', '/api/swagger.json'
]

print("Buscando swagger...")
for base in bases:
    for path in paths:
        url = base + path
        try:
            r = requests.get(url, timeout=3)
            if r.status_code == 200:
                print(f"[ACHOU] {url}")
        except:
            pass
print("Fim busca swagger")
