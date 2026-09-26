const USERS_KEY = "users";
const SESSION_KEY = "session";
const RESET_REQUESTS_KEY = "passwordResetRequests";

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

function getResetRequests() {
    return JSON.parse(localStorage.getItem(RESET_REQUESTS_KEY)) || [];
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

    saveUsers(users);

    return { success: true };
}

function requestPasswordReset(email) {
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

    requests.push({
        id: Date.now(),
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

function seedAdmin() {
    let users = getUsers();

    if (!users.some(u => u.role === "admin")) {
        users.push({
            id: 1,
            name: "System Administrator",
            email: "admin@school.com",
            password: "admin123",
            role: "admin",
            status: "approved"
        });

        saveUsers(users);
    }
}

function registerUser(name, email, password, role, photo, faceVerified, faceDescriptor) {
    let users = getUsers();

    if (users.some(u =>
        u.email.toLowerCase() === email.toLowerCase()
    )) {
        return {
            success: false,
            message: "Email is already registered."
        };
    }

    let newUser = {
        id: Date.now(),
        name: name,
        email: email,
        password: password,
        role: role,
        createdAt: Date.now(),
        photo: photo || null,
        faceVerified: !!faceVerified,
        faceDescriptor: faceDescriptor || null,
        status: "pending"
    };

    users.push(newUser);

    saveUsers(users);

    return {
        success: true,
        status: "pending",
        message: "Registration submitted. Your account is pending admin approval before you can log in."
    };
}

// Updates a user's profile photo (used both by the registration
// verification step and by the Profile tab later on).
function updateProfilePhoto(userId, dataUrl) {

    let users = getUsers();

    let user = users.find(u => u.id === userId);

    if (!user) {
        return { success: false, message: "User not found." };
    }

    user.photo = dataUrl;

    saveUsers(users);

    // Keep the active session in sync so the new photo shows up
    // immediately without requiring the user to log in again.
    let session = getSession();

    if (session && session.id === userId) {
        session.photo = dataUrl;
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }

    return { success: true };
}

function loginUser(email, password) {

    let user = getUsers().find(u =>
        u.email.toLowerCase() === email.toLowerCase()
    );

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

    let status = user.status || "approved";

    if (status === "pending") {
        return {
            success: false,
            message: "Your account is pending admin approval. Please check back soon."
        };
    }

    if (status === "rejected") {
        return {
            success: false,
            message: "Your registration was not approved. Please contact the admin office."
        };
    }

    if (status === "blocked") {
        return {
            success: false,
            message: "Your account has been blocked by the admin. Please contact the admin office."
        };
    }

    localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            photo: user.photo || null
        })
    );

    return {
        success: true,
        user: user
    };
}

function getSession() {
    return JSON.parse(
        localStorage.getItem(SESSION_KEY)
    );
}

function requireAuth() {

    seedAdmin();

    let session = getSession();

    if (!session) {
        window.location.href = "login.html";
        return null;
    }

    return session;
}

function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "login.html";
}

// Updates a user's password after verifying their current one.
function changePassword(userId, currentPassword, newPassword) {

    let users = getUsers();

    let user = users.find(u => u.id === userId);

    if (!user) {
        return {
            success: false,
            message: "User not found."
        };
    }

    if (user.password !== currentPassword) {
        return {
            success: false,
            message: "Current password is incorrect."
        };
    }

    user.password = newPassword;

    saveUsers(users);

    return {
        success: true,
        message: "Password updated successfully."
    };
}

seedAdmin();

// ============================================================
// Account trust / troll-signup detection
//
// This is a prototype, so there is no real backend to run email
// verification, CAPTCHAs, or IP throttling. Instead we score each
// account against a set of common troll/spam signup patterns so
// the admin has something concrete to review before trusting an
// account, rather than having to guess.
// ============================================================

const TROLL_NAME_BLOCKLIST = [
    "test", "testing", "test123", "asdf", "asdfasdf", "asdasd",
    "fake", "faketroll", "troll", "trolling", "trollface",
    "abc", "abcabc", "abcd", "xxx", "xxxx", "idk", "idontknow",
    "none", "n a", "na", "qwerty", "qwerty123", "admin",
    "administrator", "user", "sample", "nobody", "anonymous",
    "hacker", "haha", "lol", "lolol", "spam"
];

const KEYBOARD_MASH_PATTERNS = [
    "qwert", "asdf", "zxcv", "12345", "09876", "wertyu", "sdfgh"
];

const DISPOSABLE_EMAIL_DOMAINS = [
    "mailinator.com", "tempmail.com", "temp-mail.org",
    "guerrillamail.com", "yopmail.com", "10minutemail.com",
    "throwaway.email", "fakeinbox.com", "trashmail.com",
    "getnada.com", "dispostable.com", "sharklasers.com",
    "maildrop.cc"
];

const SCHOOL_EMAIL_DOMAINS = [];

// Scores a single account against troll/spam signup heuristics.
// Returns { score, level, flags[] }. Higher score = more suspicious.
function analyzeAccountTrust(user, allUsers) {

    let flags = [];
    let score = 0;

    let rawName = (user.name || "").trim();
    let name = rawName.toLowerCase();
    let nameNoSpace = name.replace(/\s+/g, "");

    let email = (user.email || "").toLowerCase();
    let atIndex = email.indexOf("@");
    let localPart = atIndex > -1 ? email.slice(0, atIndex) : email;
    let domain = atIndex > -1 ? email.slice(atIndex + 1) : "";

    // Admin accounts are provisioned by the system, not self-registered.
    if (user.role === "admin") {
        return { score: 0, level: "low", flags: [] };
    }

    if (rawName.length > 0 && rawName.length < 3) {
        flags.push("Unusually short name");
        score += 15;
    }

    if (TROLL_NAME_BLOCKLIST.includes(nameNoSpace)) {
        flags.push("Placeholder-style name");
        score += 40;
    }

    if (/^(.)\1{2,}$/.test(nameNoSpace)) {
        flags.push("Repetitive characters in name");
        score += 35;
    }

    if (KEYBOARD_MASH_PATTERNS.some(p => nameNoSpace.includes(p))) {
        flags.push("Keyboard-mash pattern in name");
        score += 30;
    }

    if (
        nameNoSpace.length >= 4 &&
        /^[a-z]+$/.test(nameNoSpace) &&
        !/[aeiou]/.test(nameNoSpace)
    ) {
        flags.push("No vowels — possibly random text");
        score += 20;
    }

    if (domain && DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
        flags.push("Disposable/temporary email domain");
        score += 35;
    }

    if (SCHOOL_EMAIL_DOMAINS.length > 0 && domain && !SCHOOL_EMAIL_DOMAINS.includes(domain)) {
        flags.push("Email domain does not match the school's official domain");
        score += 25;
    }

    if (
        localPart.length >= 5 &&
        /^[a-z]*\d{4,}$/.test(localPart)
    ) {
        flags.push("Suspicious auto-generated-looking email");
        score += 20;
    }

    // Signup burst: several accounts created within a few minutes
    // of each other often indicates a spam/troll wave rather than
    // organic registrations.
    if (user.createdAt && Array.isArray(allUsers)) {

        let windowMs = 3 * 60 * 1000;

        let nearby = allUsers.filter(u =>
            u.id !== user.id &&
            u.createdAt &&
            Math.abs(u.createdAt - user.createdAt) <= windowMs
        );

        if (nearby.length >= 2) {
            flags.push("Part of a rapid signup burst");
            score += 15;
        }
    }

    // Photo verification at signup. This does not confirm identity —
    // only that a photo was provided and, if the face-check model
    // was available, that a face was clearly visible in it.
    if (!user.photo) {
        flags.push("No verification photo provided");
        score += 25;
    } else if (user.faceVerified === false) {
        flags.push("Face not clearly detected in verification photo");
        score += 20;
    }

    score = Math.min(score, 100);

    let level = "low";
    if (score >= 50) level = "high";
    else if (score >= 20) level = "medium";

    return { score, level, flags };
}
// Shared show/hide toggle for password fields across every page
// (login, register, forgot-password, dashboard's Change Password
// modal) since auth.js is loaded everywhere a password input is.
function togglePasswordVisibility(btn, inputId) {

    let input = document.getElementById(inputId);

    if (!input) {
        return;
    }

    if (input.type === "password") {
        input.type = "text";
        btn.textContent = "🙈";
        btn.setAttribute("aria-label", "Hide password");
    } else {
        input.type = "password";
        btn.textContent = "👁️";
        btn.setAttribute("aria-label", "Show password");
    }
}
