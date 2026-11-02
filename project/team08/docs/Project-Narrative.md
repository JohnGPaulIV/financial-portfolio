# Tradar 

## Purpose

<!-- Clearly state the main idea and intended purpose of your application.
Explain a problem your application aims to solve and why it is important. -->
Tradar is a stock portfolio and market tracking web application that allows users to manage a personal stock portfolio, view real time market data, and monitor stocks through a watchlist. Keeping track of investments across multiple websites is overwhelming and can be difficult for the average person, especially with the rise in popularity of stock trading. Tradar solves this by giving users a centralized dashboard where they can log their holdings, track live price changes, and analyze stock performance through interactive charts.

## Users

<!-- Identify the primary users of your application, including their background or needs.
Justify how your application will benefit these users and improve their experience. -->
Tradar is designed for the casual investor who wants a simple way to manage and track a personal portfolio. Many popular tools overwhelm beginners right off the bat, which tends to cause people to quit before even getting started. Users should have a basic understanding of the stock market but don't need access to professional grade tools. Our application will reduce the friction that comes with monitoring investments across multiple sources and give casual users the experience of an intuitive and personalized dashboard. For example, a user's watchlist will save them time by continuously checking the price of stocks they are interested in, always keeping them up to date.

## Features

<!-- Outline the core functionalities of your application and explain how they will work.
Provide a concrete example demonstrating how the application fulfills its purpose. -->
Tradar's core features are built around four main areas, portfolio management, stock search. watchlist tracking, and data visualization. In the portfolio section, users can add stocks by entering details such as the company name, ticker symbol, purchasing price, and number of shares, and then can later sell or remove them. The stock search feature will use Finnhub API to let users look up any publicly traded company with smart autocomplete suggestions and real-time data. The watchlist allows users to save favorite stocks and quickly monitor their current price and daily change. The dashboard gives users a quick view of everything they currently hold, while interactive charts let them view price history across time ranges like 1D, 1W, 1M, and 1Y, aswell as compare stocks against each other. For example, a user who had just recently purchased NVIDIA stock on a trading site, could search up and add NVIDIA to their existing portfolio, and be tracked with other stocks that have previously been purchased.

<!-- Describe the types of data that users will create, read, update, and delete (CRUD).
Include an example of this data using either real or representative sample values. -->

## Data
Our application will handle data across four main CRUD operations tied to the user's portfolio, watchlist,
and settings. Users will create data when adding a stock to their portfolio or watchlist, 
read data when viewing live stock prices and chart history fetched from the Finnhub API, 
update data when editing an existing holding such as adding more shares, and delete data when selling or 
removing a stock entirely from their portfolio or watchlist. Settings like dark 
mode and chart preferences are also created and updated by the user and persisted 
through local storage. It is important to note that market data such as live 
prices, daily percentage changes, and chart history are not stored locally but 
instead fetched in real time from the Finnhub API on demand. If a user enters 
an invalid ticker symbol, no data will be stored and an error screen will be 
displayed instead.

A representative example of a portfolio entry a user might create looks like this:
```json
{
  "symbol": "AAPL",
  "companyName": "Apple Inc.",
  "sharesPurchased": 10,
  "purchasePrice": 172.30,
  "dateAdded": "2025-03-15"
}
```

## References
- [Finnhub Stock API](https://finnhub.io)

