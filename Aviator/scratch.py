import requests

headers = {"API-Key": "877454d5-e49a-45bb-be63-d6cd6c0cb917"}
url = "https://pix.evopay.cash/v1/withdraw"

print("POST /v1/withdraw with pixKey")
payload = {
    "amount": 30.0,
    "pixKey": "test@test.com",
    "pixType": "EMAIL"
}
res = requests.post(url, headers=headers, json=payload)
print("Status:", res.status_code)
print("Body:", res.text)
