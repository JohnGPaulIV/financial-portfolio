import requests

url = "https://api.coingecko.com/api/v3/simple/supported_vs_currencies"

res = requests.get(url)

print(res.json())