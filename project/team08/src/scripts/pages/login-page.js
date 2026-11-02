import { login } from "../auth/auth.js";
import { AppState } from "../state/astate.js";
import { saveUserData } from "../storage/userStorage.js";

async function goToLandingPage() {
    await AppState.hydrate();

    const landingPage =
        AppState.current?.user?.settings?.landingPage ??
        "index";

    window.location.replace(
        `${landingPage}.html`
    );
}

const loginForm =
    document.querySelector("#login-form");

const importBtn =
    document.querySelector("#import-account-btn");

let importInput = null;

// Creates a hidden file input and wires it to the import handler.
// Done lazily so the element only exists once the user actually clicks Import.
function createImportInput() {
    const input =
        document.createElement("input");

    input.type = "file";
    input.accept = ".json,application/json";
    input.style.display = "none";

    input.addEventListener(
        "change",
        handleImportAccount
    );

    document.body.appendChild(input);

    return input;
}

// Handles the file the user selected from the file picker.
// Reads the JSON, validates it has a username, writes it straight into
// localStorage, sets it as the active user, then navigates to the app.
// If anything goes wrong the error is shown in an alert and the input is cleared.
async function handleImportAccount(event) {
    const file =
        event.target.files?.[0];

    if (!file) return;

    try {
        // Read the file contents and parse as JSON
        const text = await file.text();
        const imported = JSON.parse(text);

        // Minimum validity check — the file must at least have a username field
        if (!imported.username) {
            throw new Error(
                "Invalid account export."
            );
        }

        // Write the imported data into localStorage under the standard user key,
        // overwriting any existing account with the same username
        saveUserData(
            imported.username,
            imported
        );

        // Mark this username as the currently active session
        localStorage.setItem(
            "team08_currentUser",
            imported.username
        );

        alert(
            "Account imported successfully."
        );

        // Hydrate AppState with the newly written data and redirect
        await goToLandingPage();

    } catch (err) {
        console.error(
            "Import failed:",
            err
        );

        alert(
            `Could not import account:\n${err.message}`
        );
    }

    // Reset the input so the same file can be re-selected if needed
    event.target.value = "";
}

if (loginForm) {
    loginForm.addEventListener(
        "submit",
        async e => {
            e.preventDefault();

            const username =
                document.querySelector("#username")
                    ?.value
                    ?.trim();

            const authMessage =
                document.querySelector(
                    "#auth-message"
                );

            const msg =
                login(username);

            if (!msg.success) {
                if (authMessage) {
                    authMessage.textContent =
                        msg.message;
                }

                return;
            }

            await goToLandingPage();
        }
    );
}

// Clicking Import Account creates the hidden file input on first use,
// then programmatically opens the OS file picker
if (importBtn) {
    importBtn.addEventListener(
        "click",
        () => {
            if (!importInput) {
                importInput =
                    createImportInput();
            }

            importInput.click();
        }
    );
}