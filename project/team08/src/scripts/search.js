/* search.js
   Handles search bar functionality and API integration.
   Features: Search results dropdown, click-to-navigate to stock details page.
*/
import { stockSearchFMP, search } from "./api.js";
import { AppState } from "./state/astate.js";

let searchTimeout;
let currentSearchQuery = "";

export function initSearch() {
  const searchInput = document.getElementById("search");
  const searchResultsContainer = document.getElementById("search-results");

  if (!searchInput) return;

  searchInput.addEventListener("input", handleSearchInput);

  searchInput.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const first = searchResultsContainer.querySelector(".search-result-item");
    if (first) {
      first.click();
      return;
    }
    const query = searchInput.value.trim();
    if (!query) return;
    clearTimeout(searchTimeout);
    const results = await stockSearchFMP(query);
    if (results && results.length > 0) navigateToStock(results[0].symbol);
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrapper") && !e.target.closest("#search-results")) {
      searchResultsContainer.innerHTML = "";
    }
  });
}

/**
 * Handles search input with debouncing to reduce API calls.
 * Clears results if input is empty, otherwise queries API.
 */
function handleSearchInput(event) {
  const query = event.target.value.trim();
  currentSearchQuery = query;

  clearTimeout(searchTimeout);

  if (!query) {
    document.getElementById("search-results").innerHTML = "";
    return;
  }

  searchTimeout = setTimeout(() => {
    performSearch(query);
  }, 300);
}

/**
 * Performs stock search via API and displays results.
 */
function performSearch(query) {
  if (query !== currentSearchQuery) return;
  const results = AppState.current.searchAssets(query);
  // stockSearchFMP(query);
  displaySearchResults(results);
}

/**
 * Displays search results in the dropdown.
 * Shows "No results" message if empty, otherwise lists clickable stocks.
 */
function displaySearchResults(results) {
  const container = document.getElementById("search-results");
  const searchInput = document.getElementById("search");

  if (!results || results.length === 0) {
    container.innerHTML = '<div class="search-no-results">No stocks found</div>';
  } else {
    container.innerHTML = results
      .map(
        (asset) => `
      <div class="search-result-item" data-symbol="${asset.symbol}" data-exchange="${asset.type}">
        <div class="result-symbol">${asset.symbol}</div>
        <div class="result-name">${asset.name}</div>
        <div class="result-type">${asset.type}</div>
      </div>
    `
      )
      .join("");

    container.addEventListener("click", (e) => {
      const item = e.target.closest(".search-result-item");
      if (!item) return;
      navigateToStock(item.dataset.symbol, item.dataset.exchange);
    });
  }

  if (searchInput) {
    const rect = searchInput.getBoundingClientRect();
    container.style.left = rect.left + "px";
    container.style.width = rect.width + "px";
  }
}

/**
 * Navigates to the stock details page for the given symbol.
 *
 * @param {string} symbol - Stock ticker symbol
 */
function navigateToStock(symbol, type) {
  window.location.href = `stock-details.html?symbol=${encodeURIComponent(symbol)}&type=${encodeURIComponent(type)}`;
}

/**
 * Displays a temporary toast notification.
 *
 * @param {string} message - Message to display
 * @param {string} type - Type of toast ("success", "warning", "error")
 */
export function showToast(message, type = "success") {
  const toast = document.getElementById("toast") || createToastElement();

  toast.textContent = message;
  toast.className = `show ${type}`;

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

/**
 * Creates the toast element if it doesn't exist.
 * Called only once to initialize the toast container.
 */
function createToastElement() {
  const toast = document.createElement("div");
  toast.id = "toast";
  document.body.appendChild(toast);
  return toast;
}
