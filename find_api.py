import requests
import re

r = requests.get('https://pay.lytex.com.br', timeout=10)
html = r.text

js_files = re.findall(r'src="(main-es2015[^"]+\.js)"', html)
print('JS files:', js_files)

for js in js_files[:1]:
    url = 'https://pay.lytex.com.br/' + js
    print(f'Baixando: {url}')
    r2 = requests.get(url, timeout=30)
    content = r2.text
    
    # Buscar qualquer URL que pareca endpoint de API
    urls = re.findall(r'https://[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}(?:/[a-zA-Z0-9.\-/_]*)?', content)
    unique_urls = set(u for u in urls if 'lytex' in u or 'api' in u.lower())
    print('URLs relevantes encontradas:')
    for u in sorted(unique_urls):
        print(' ', u)
