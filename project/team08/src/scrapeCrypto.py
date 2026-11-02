import requests
import json
from time import sleep
import random

CURRENCIES = ["usd"]


def main():
    coins = []

    for currency in CURRENCIES:
        curr_page = 1

        while True:
            url = (
                "https://api.coingecko.com/api/v3/coins/markets"
                f"?vs_currency={currency}"
                "&order=market_cap_desc"
                "&per_page=250"
                f"&page={curr_page}"
                f"&symbols=eth"
            )

            res = requests.get(url)

            if res.status_code == 429:
                print("Rate limited, waiting 60s...")
                sleep(60)
                continue

            if res.status_code != 200:
                print(f"Request failed: {res.status_code}")
                sleep(random.randrange(3, 5))
                continue

            data = res.json()

            if not data:
                break

            coins.extend(data)
            curr_page += 1
            print("ADDED.\n")
            sleep(5)

    with open("crypto_data.json", "w") as file:
        json.dump(coins, file, indent=4)


if __name__ == "__main__":
    main()
