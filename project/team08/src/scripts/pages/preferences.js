/* preferences.js
   Handles UI interactions for the user preferences page.
*/

import { onLoad, viewMode, marketStatus } from "../initPage.js";
import { AppState } from "../state/astate.js";
import { saveUserData } from "../storage/userStorage.js";
import { logout } from "../auth/auth.js";

let darkModeToggle = null;
let currencySelect = null;
let priceChangeFormat = null;
let defaultChartRange = null;
let defaultIntervalChartRange = null;
let defaultLandingPage = null;
let marketStatusToggle = null;
let searchables = null;
let signout = null;
let exportJsonBtn = null;
let importJsonBtn = null;
let importFileInput = null;

function getUser() {
    return AppState.current?.user ?? null;
}

function persistUser() {
    const state = AppState.current;

    if (!state?.user) return;

    saveUserData(
        state.user.username,
        state.getPersistedUserData()
    );
}

function bindElements() {
    darkModeToggle = document.querySelector("#dark-mode-toggle");
    currencySelect = document.querySelector("#currency-select");
    priceChangeFormat = document.querySelector("#price-change-format");
    defaultChartRange = document.querySelector("#default-chart-range");
    defaultIntervalChartRange = document.querySelector("#default-interChart-range");
    defaultLandingPage = document.querySelector("#default-landing-page");
    marketStatusToggle = document.querySelector("#market-status-toggle");
    searchables = document.querySelectorAll(".searchable-type-chip");
    signout = document.querySelector("#sign-out-btn");
    exportJsonBtn = document.querySelector("#export-data-btn-json");
    importJsonBtn = document.querySelector("#import-data-btn-json");
}

function loadSearchablePrefs(settings) {
    searchables.forEach(label => {
        const input = label.querySelector("input[type='checkbox']");
        if (!input) return;

        const type = input.dataset.name;
        input.checked = settings.searchIncludes.has(type);
    });
}

function loadUserPrefs() {
    const user = getUser();
    if (!user) return;

    const settings = user.settings;

    if (darkModeToggle) {
        darkModeToggle.checked = settings.darkMode;
    }

    if (currencySelect) {
        currencySelect.value = settings.currency;
    }

    if (priceChangeFormat) {
        priceChangeFormat.value = settings.movementFormat;
    }
    console.log("CR: ", defaultChartRange.value);
    if (defaultChartRange) {
        console.log("CRS: ", settings.chartRange);
        defaultChartRange.value = settings.chartRange;
    }
    console.log("ICR: ", defaultIntervalChartRange.value);
    if (defaultIntervalChartRange) {
        console.log(settings.intervalChartRange);
        defaultIntervalChartRange.value = settings.intervalChartRange
    }

    if (defaultLandingPage) {
        defaultLandingPage.value = settings.landingPage;
    }

    if (marketStatusToggle) {
        marketStatusToggle.checked = settings.displayMarketStatus;
    }

    if (searchables) {
        loadSearchablePrefs(settings);
    }
}

// Creates a hidden file input and wires it to the import handler.
// Done lazily — the element is only created once the user clicks the import button.
function createHiddenImportInput() {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = ".json,application/json";
    input.style.display = "none";

    input.addEventListener("change", handleImportJSON);

    document.body.appendChild(input);

    return input;
}

// Handles the file selected from the picker when importing from the preferences page.
// Unlike the login-page import, this merges into the currently logged-in account:
// the imported file's username is replaced with the active user's username so the
// portfolio and settings overwrite their data without creating a new account.
async function handleImportJSON(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
        // Read and parse the selected file
        const text = await file.text();
        const imported = JSON.parse(text);

        // Validate the file has the minimum required fields
        if (
            !imported.username ||
            !imported.settings
        ) {
            throw new Error("Invalid Tradar export file.");
        }

        const user = AppState.current?.user;

        if (!user) {
            throw new Error("No logged in user.");
        }

        // Warn the user that this will overwrite their current data
        const confirmed = window.confirm(
            "Importing data will overwrite your current account data. Continue?"
        );

        if (!confirmed) return;

        // Force the imported data onto the current user's username so it doesn't
        // create a ghost account — only portfolio/settings/watchlist are adopted
        imported.username = user.username;

        // Write directly to localStorage, overwriting the existing user record
        localStorage.setItem(
            `team08_user_${user.username}`,
            JSON.stringify(imported)
        );

        // Re-hydrate AppState so the rest of the page reflects the new data
        await AppState.hydrate();

        alert("Import successful. Reloading page...");

        window.location.reload();

    } catch (err) {
        console.error("Import failed:", err);

        alert(
            `Could not import file:\n${err.message}`
        );
    }

    // Reset so the same file can be re-selected if needed
    event.target.value = "";
}

async function bindPreferenceEvents() {
    const user = getUser();
    if (!user) return;

    if (darkModeToggle) {
        darkModeToggle.addEventListener("change", e => {
            user.updateSettings({
                darkMode: e.currentTarget.checked
            });

            viewMode();
            persistUser();
        });
    }

    if (currencySelect) {
        currencySelect.addEventListener("change", e => {
            user.updateSettings({
                currency: e.currentTarget.value
            });

            persistUser();
        });
    }

    if (priceChangeFormat) {
        priceChangeFormat.addEventListener("change", e => {
            user.updateSettings({
                movementFormat: e.currentTarget.value
            });

            persistUser();
        });
    }

    if (defaultChartRange) {
        defaultChartRange.addEventListener("change", e => {
            user.updateSettings({
                chartRange: e.currentTarget.value
            });

            persistUser();
        });
    }

    if (defaultIntervalChartRange) {
        defaultIntervalChartRange.addEventListener("change", e => {
            user.updateSettings({
                intervalChartRange: e.currentTarget.value
            });

            persistUser();
        });
    }

    if (defaultLandingPage) {
        defaultLandingPage.addEventListener("change", e => {
            user.updateSettings({
                landingPage: e.currentTarget.value
            });

            persistUser();
        });
    }

    if (marketStatusToggle) {
        marketStatusToggle.addEventListener("change", async e => {
            user.updateSettings({
                displayMarketStatus: e.currentTarget.checked
            });

            const mstatus = document.getElementById("market-status");

            if (e.currentTarget.checked) {
                mstatus.textContent = await marketStatus();
                mstatus.dataset.marketState = mstatus.textContent.toLowerCase();
            } else {
                mstatus.textContent = "";
                mstatus.removeAttribute("data-market-state");
            }

            persistUser();
        });
    }

    if (searchables) {
        searchables.forEach(label => {
            const input = label.querySelector("input[type='checkbox']");
            if (!input) return;

            input.addEventListener("change", e => {
                const type = e.currentTarget.dataset.name;
                const checked = e.currentTarget.checked;

                if (!type) return;

                if (checked) {
                    user.settings.searchIncludes.add(type);
                } else {
                    user.settings.searchIncludes.delete(type);
                }

                persistUser();
            });
        });
    }

    if (signout) {
        signout.addEventListener("click", e => {
            logout();
        })
    }

    if (exportJsonBtn) {
        exportJsonBtn.addEventListener("click", exportUserDataJSON);
    }

    if (importJsonBtn) {
        importJsonBtn.addEventListener("click", () => {
            if (!importFileInput) {
                importFileInput = createHiddenImportInput();
            }

            importFileInput.click();
        });
    }
}

// Serializes the current user's full account data to a JSON file and triggers
// a browser download. The file can later be imported on the login page or here
// in preferences to restore the account on any device.
function exportUserDataJSON() {
    const state = AppState.current;
    const user = state?.user;

    if (!user) return;

    // Build a plain object from the user's live data — Maps and Sets need to be
    // converted to arrays because JSON.stringify can't handle them natively
    const data = {
        username: user.username,
        password: user.password,
        realizedGainLoss: user.realizedGainLoss,
        portfolio: user.portfolio.toJSON(),
        watchlist: user.watchlist.toJSON(),
        settings: {
            ...user.settings,
            searchIncludes: [...user.settings.searchIncludes]
        }
    };

    // Wrap the JSON string in a Blob so it can be turned into a download URL
    const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        { type: "application/json" }
    );

    // Create a temporary object URL, attach it to a hidden link, click it to
    // start the download, then immediately revoke the URL to free memory
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `tradar-export-${user.username}.json`;
    a.click();

    URL.revokeObjectURL(url);
}

window.onload = async function () {
    await AppState.hydrate();

    if (!AppState.current) {
        window.location.replace("login.html");
        return;
    }

    bindElements();
    loadUserPrefs();
    await bindPreferenceEvents();
    onLoad();
};

window.addEventListener("beforeunload", () => {
    persistUser();
});