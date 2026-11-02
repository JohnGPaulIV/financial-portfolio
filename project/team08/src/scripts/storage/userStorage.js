export function getUserKey(username) {
    return `team08_user_${username}`;
}

export function loadUserData(username) {
    const raw = localStorage.getItem(getUserKey(username));

    if (!raw) {
        return null;
    }

    return JSON.parse(raw);
}

export function saveUserData(username, userData) {
    localStorage.setItem(
        getUserKey(username),
        JSON.stringify(userData)
    );
}

export function userExists(username) {
    return localStorage.getItem(getUserKey(username)) !== null;
}