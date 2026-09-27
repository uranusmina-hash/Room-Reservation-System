const USERS_KEY = "users";
const SESSION_KEY = "session";
const RESET_REQUESTS_KEY = "passwordResetRequests";
const REMEMBER_KEY = "rememberedLogin";

// Simple line-style eye icons used by the password show/hide toggle.
const ICON_EYE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>';
const ICON_EYE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.71-1.06a3 3 0 1 1-4.24-4.24"/><path d="M6.61 6.61A18.42 18.42 0 0 0 1 12s4 8 11 8a9.26 9.26 0 0 0 5.39-1.61"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

// Roles the admin is allowed to create accounts for.
const CREATABLE_ROLES = ["teacher", "staff", "student"];

// Every account email must be a @gmail.com address. Used at login,
// on the forgot-password request, and whenever the admin creates a
// new account.
const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;

function isGmailEmail(email) {
    return GMAIL_REGEX.test((email || "").trim());
}

// Merges changes into the active session, but only if it belongs to
// userId, so the header/profile update without a fresh login.
function updateSession(userId, changes) {

    let session = getSession();

    if (session && session.id === userId) {
        let updated = JSON.stringify(Object.assign(session, changes));

        // Write back to whichever storage is currently holding the
        // session, so a "remembered" session stays remembered and a
        // this-tab-only session stays that way.
        if (localStorage.getItem(SESSION_KEY)) {
            localStorage.setItem(SESSION_KEY, updated);
        } else {
            sessionStorage.setItem(SESSION_KEY, updated);
        }
    }
}

// Shows a message in the page's #alertBox (login + forgot-password).
// The dashboard has its own alertMessage() in script.js.
function showAlert(message, type) {
    document.getElementById("alertBox").innerHTML =
        `<div class="alert ${type}">${message}</div>`;
}

function getUsers() {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
}

function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function findUserByEmail(email) {
    return getUsers().find(u =>
        u.email.toLowerCase() === email.toLowerCase()
    ) || null;
}

// Returns the pending reset requests. Requests whose account no longer
// exists (the admin removed the user) are dropped here, so they can
// never linger in the list or the nav badge.
function getResetRequests() {

    let requests = JSON.parse(localStorage.getItem(RESET_REQUESTS_KEY)) || [];

    let userIds = new Set(getUsers().map(u => u.id));

    let live = requests.filter(r => userIds.has(r.userId));

    if (live.length !== requests.length) {
        saveResetRequests(live);
    }

    return live;
}

function saveResetRequests(requests) {
    localStorage.setItem(RESET_REQUESTS_KEY, JSON.stringify(requests));
}

function resetPassword(userId, newPassword) {
    let users = getUsers();
    let user = users.find(u => u.id === userId);

    if (!user) {
        return { success: false, message: "User not found." };
    }

    user.password = newPassword;
    // An admin just set this password (fulfilling a reset request),
    // so treat it like a fresh admin-created account: nag the user
    // to pick their own password on next login.
    user.mustChangePassword = true;

    saveUsers(users);

    return { success: true };
}

// Used by the blocking "set your own password" modal that appears
// right after login when mustChangePassword is true. No current-
// password check here: the user already authenticated this session
// with the admin-set password, so re-asking for it would just be
// friction for no extra security.
function forceChangePassword(userId, newPassword) {

    let users = getUsers();
    let user = users.find(u => u.id === userId);

    if (!user) {
        return { success: false, message: "User not found." };
    }

    user.password = newPassword;
    user.mustChangePassword = false;

    saveUsers(users);

    updateSession(userId, { mustChangePassword: false });

    return { success: true };
}

function requestPasswordReset(email) {

    if (!isGmailEmail(email)) {
        return {
            success: false,
            message: "Please enter a valid @gmail.com email."
        };
    }

    let user = findUserByEmail(email);

    if (!user) {
        return { success: false, message: "No account found with that email." };
    }

    let requests = getResetRequests();

    if (requests.some(r => r.userId === user.id)) {
        return {
            success: true,
            message: "A reset request is already pending for this account."
        };
    }

    let requestId = Date.now();
    while (requests.some(r => r.id === requestId)) requestId++;

    requests.push({
        id: requestId,
        userId: user.id,
        name: user.name,
        email: user.email,
        requestedAt: Date.now()
    });

    saveResetRequests(requests);

    return {
        success: true,
        message: "Reset request sent. An admin will reset your password soon."
    };
}

function resolvePasswordResetRequest(requestId, newPassword) {
    let requests = getResetRequests();
    let request = requests.find(r => r.id === requestId);

    if (!request) {
        return { success: false, message: "Request not found." };
    }

    let result = resetPassword(request.userId, newPassword);

    if (!result.success) {
        return result;
    }

    saveResetRequests(requests.filter(r => r.id !== requestId));

    return { success: true };
}

// Clears a reset request without changing the user's password — for
// requests that were submitted by accident (e.g. an accidental tap
// on "Forgot password?").
function dismissPasswordResetRequest(requestId) {
    let requests = getResetRequests();
    let request = requests.find(r => r.id === requestId);

    if (!request) {
        return { success: false, message: "Request not found." };
    }

    saveResetRequests(requests.filter(r => r.id !== requestId));

    return { success: true };
}

// Makes sure the default admin exists. Also tidies up accounts that
// were left over from the old self-registration flow: anything that
// was still "pending" or "rejected" becomes "blocked" so the admin can
// see it in Manage Users and either remove it or reactivate it.
function seedAdmin() {
    let users = getUsers();
    let changed = false;

    if (!users.some(u => u.role === "admin")) {
        users.push({
            id: 1,
            name: "System Administrator",
            email: "admin@gmail.com",
            password: "admin123",
            role: "admin",
            status: "approved"
        });
        changed = true;
    }

    users.forEach(u => {
        if (u.status === "pending" || u.status === "rejected") {
            u.status = "blocked";
            changed = true;
        }
    });

    if (changed) {
        saveUsers(users);
    }
}

// Admin-only: creates an account for a teacher, staff member or
// student leader. There is no public sign-up, so this is the only
// way a non-admin account comes into existence.
function createUserAccount(name, email, password, role) {

    name = (name || "").trim();
    email = (email || "").trim();

    if (!name || !email || !password) {
        return { success: false, message: "Please fill in all fields." };
    }

    if (!isGmailEmail(email)) {
        return { success: false, message: "Email must be a @gmail.com address." };
    }

    if (!CREATABLE_ROLES.includes(role)) {
        return { success: false, message: "Please choose a valid role." };
    }

    if (password.length < 6) {
        return {
            success: false,
            message: "Password must be at least 6 characters."
        };
    }

    if (findUserByEmail(email)) {
        return {
            success: false,
            message: "An account with that email already exists."
        };
    }

    let users = getUsers();

    // Date.now() is the id, but bump it if two accounts are ever
    // created in the same millisecond so ids stay unique.
    let id = Date.now();
    while (users.some(u => u.id === id)) id++;

    users.push({
        id: id,
        name: name,
        email: email,
        password: password,
        role: role,
        createdAt: Date.now(),
        photo: null,
        status: "approved",
        // Set on every admin-created account. Cleared the first time
        // the user changes their own password from the Profile tab,
        // so the dashboard knows whether to still nag them about it.
        mustChangePassword: true
    });

    saveUsers(users);

    return { success: true };
}

// Updates a user's profile photo (used by the Profile tab).
function updateProfilePhoto(userId, dataUrl) {

    let users = getUsers();

    let user = users.find(u => u.id === userId);

    if (!user) {
        return { success: false, message: "User not found." };
    }

    user.photo = dataUrl;

    saveUsers(users);

    updateSession(userId, { photo: dataUrl });

    return { success: true };
}

function loginUser(email, password, remember) {

    if (!isGmailEmail(email)) {
        return {
            success: false,
            message: "Please enter a valid @gmail.com email."
        };
    }

    let user = findUserByEmail(email);

    if (!user) {
        return {
            success: false,
            message: "Account not found."
        };
    }

    if (user.password !== password) {
        return {
            success: false,
            message: "Incorrect password."
        };
    }

    if (user.status === "blocked") {
        return {
            success: false,
            message: "Your account has been blocked by the admin. Please contact the admin office."
        };
    }

    let sessionData = JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        photo: user.photo || null,
        mustChangePassword: user.mustChangePassword || false
    });

    // Remember me checked (default): session survives closing the
    // browser, and the email/password are saved so the login form
    // comes back pre-filled next time (even after logging out).
    // Unchecked: session only lasts for this tab, and nothing is saved.
    if (remember === false) {
        sessionStorage.setItem(SESSION_KEY, sessionData);
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(REMEMBER_KEY);
    } else {
        localStorage.setItem(SESSION_KEY, sessionData);
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email: user.email, password: password }));
    }

    return { success: true };
}

// Returns the saved { email, password }, or null if "remember me"
// hasn't been used / was cleared.
function getRememberedLogin() {
    return JSON.parse(localStorage.getItem(REMEMBER_KEY) || "null");
}

function getSession() {
    return JSON.parse(
        localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || null
    );
}

function requireAuth() {

    let session = getSession();

    if (!session) {
        window.location.href = "login.html";
        return null;
    }

    return session;
}

// Logging out ends the session but deliberately leaves any
// remembered email/password in place, so "Remember me" still
// pre-fills the login form and it's a one-click sign back in.
function logout() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = "login.html";
}

// Updates a user's own login email and/or password (Profile tab).
// changes = { email, currentPassword, newPassword }
// The current password must be correct whenever something changes.
function updateAccount(userId, changes) {

    let users = getUsers();

    let user = users.find(u => u.id === userId);

    if (!user) {
        return { success: false, message: "User not found." };
    }

    let newEmail = (changes.email || "").trim() || user.email;
    let newPassword = changes.newPassword || "";

    let emailChanged = newEmail !== user.email;
    let passwordChanged = newPassword.length > 0;

    if (!emailChanged && !passwordChanged) {
        return { success: false, message: "No changes to save." };
    }

    if (user.password !== changes.currentPassword) {
        return { success: false, message: "Current password is incorrect." };
    }

    if (emailChanged) {

        if (!isGmailEmail(newEmail)) {
            return { success: false, message: "Email must be a @gmail.com address." };
        }

        let taken = users.some(u =>
            u.id !== userId &&
            u.email.toLowerCase() === newEmail.toLowerCase()
        );

        if (taken) {
            return {
                success: false,
                message: "That email is already used by another account."
            };
        }
    }

    if (passwordChanged && newPassword.length < 6) {
        return {
            success: false,
            message: "New password must be at least 6 characters."
        };
    }

    let oldEmail = user.email;

    if (emailChanged) user.email = newEmail;
    if (passwordChanged) {
        user.password = newPassword;
        user.mustChangePassword = false;
    }

    saveUsers(users);

    if (passwordChanged) {
        updateSession(userId, { mustChangePassword: false });
    }

    if (emailChanged) {

        // Keep any open password-reset request pointing at the new email.
        let requests = getResetRequests();

        requests.forEach(r => {
            if (r.userId === userId) r.email = newEmail;
        });

        saveResetRequests(requests);

        updateSession(userId, { email: newEmail });
    }

    return {
        success: true,
        oldEmail: oldEmail,
        newEmail: user.email,
        emailChanged: emailChanged,
        passwordChanged: passwordChanged
    };
}

seedAdmin();

// Shared show/hide toggle for password fields across every page
// (login, forgot-password, dashboard's Create User and Profile forms)
// since auth.js is loaded everywhere a password input is.
function togglePasswordVisibility(btn, inputId) {

    let input = document.getElementById(inputId);

    if (!input) {
        return;
    }

    if (input.type === "password") {
        input.type = "text";
        btn.innerHTML = ICON_EYE_OFF;
        btn.setAttribute("aria-label", "Hide password");
    } else {
        input.type = "password";
        btn.innerHTML = ICON_EYE;
        btn.setAttribute("aria-label", "Show password");
    }
}
