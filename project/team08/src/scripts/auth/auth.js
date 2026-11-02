import {
    loadUserData,
    saveUserData,
    userExists,
} from "../storage/userStorage.js";

import { AppState } from "../state/astate.js";
import { User } from "../models/userClass.js";

export function login(username) {
    const cleanUsername = username?.trim();

    if (!cleanUsername) {
        return {
            success: false,
            message: "Username is required.",
        };
    }

    if (!userExists(cleanUsername)) {
        const newUser = new User({ username: cleanUsername });
        saveUserData(cleanUsername, newUser.toJSON());
    }

    localStorage.setItem(
        "team08_currentUser",
        cleanUsername
    );

    return {
        success: true,
        message: "Login successful.",
    };
}

export function persistCurrentUser() {
    const state = AppState.current;

    if (!state?.user) return;

    saveUserData(
        state.user.username,
        state.getPersistedUserData()
    );
}

export function logout() {
    persistCurrentUser();

    AppState.current = null;

    localStorage.removeItem("team08_currentUser");
    window.location.replace("login.html");

    return {
        success: true,
        message: "Logout successful.",
    };
}