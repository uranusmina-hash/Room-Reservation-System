let rooms = [
    {
        id: 1,
        name: "Computer Lab",
        capacity: 30,
        location: "2nd Floor, Main Building",
        projector: true
    },
    {
        id: 2,
        name: "Science Room",
        capacity: 25,
        location: "1st Floor, Science Wing",
        projector: false
    },
    {
        id: 3,
        name: "Library",
        capacity: 15,
        location: "Ground Floor, Admin Building",
        projector: true
    },
    {
        id: 4,
        name: "Music Room",
        capacity: 20,
        location: "3rd Floor, Arts Wing",
        projector: false
    }
];

let bookings = [];

// The building's open hours. Free-choice start/end times in the
// booking form must fall within this window.
const OPERATING_HOURS = { start: "08:00", end: "17:00" };

// Pagination state
const ROOMS_PER_PAGE = 6;
const BOOKINGS_PER_PAGE = 5;
const USERS_PER_PAGE = 5;
const RESETS_PER_PAGE = 5;
let roomPage = 1;
let bookingPage = 1;
let userPage = 1;
let resetPage = 1;
let userStatusFilter = "all";

// Today's date as YYYY-MM-DD in the user's LOCAL time zone.
// (toISOString() uses UTC, which shows yesterday's date during the
// early morning hours in time zones ahead of UTC, such as the
// Philippines.)
function getTodayString() {
    let d = new Date();
    let month = String(d.getMonth() + 1).padStart(2, "0");
    let day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + month + "-" + day;
}

// The day the date inputs were last synced to, used to notice when
// midnight passes while the page is still open.
let lastKnownToday = null;

// Keeps the date inputs tied to the real current date:
// - the Rooms "Check Availability Date" jumps to today on load and
//   whenever a new day starts, and can never sit on a past date;
// - the Reserve form's date can never sit on a past date either.
function syncTodayDates() {

    let today = getTodayString();
    let dayChanged = lastKnownToday !== today;
    lastKnownToday = today;

    let availInput = document.getElementById("availabilityDate");
    let dateInput = document.getElementById("date");

    if (!availInput || !dateInput) {
        return;
    }

    availInput.min = today;
    dateInput.min = today;

    let availChanged = false;

    if (dayChanged || !availInput.value || availInput.value < today) {
        availChanged = availInput.value !== today;
        availInput.value = today;
    }

    let bookingDateCleared = false;

    if (dateInput.value && dateInput.value < today) {
        dateInput.value = "";
        bookingDateCleared = true;
    }

    if (availChanged) {
        displayRooms();
    }

    if (bookingDateCleared) {
        checkTimeAvailability();
    }
}

function loadData() {
    rooms = JSON.parse(localStorage.getItem("rooms")) || rooms;
    bookings = JSON.parse(localStorage.getItem("bookings")) || [];
}

function saveData() {
    localStorage.setItem("rooms", JSON.stringify(rooms));
    localStorage.setItem("bookings", JSON.stringify(bookings));
}

function alertMessage(message, type = "success") {

    let html = `<div class="alert ${type}">${message}</div>`;

    document.getElementById("alertBox").innerHTML = html;

    // A floating modal sits on top of everything else, so alertBox
    // (back in the page behind it) would be invisible while a modal
    // is open. Mirror the message into that modal's own alert slot.
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        if (overlay.style.display === "flex") {
            let slot = overlay.querySelector(".modal-alert");
            if (slot) slot.innerHTML = html;
        }
    });
}

// Blocking modal shown to anyone still on an admin-set password (a
// new account, or a password reset an admin fulfilled). Unlike a
// dismissible banner, this has no close/cancel button and the
// backdrop click is not wired to dismiss it — the only way out is to
// submit a new password, which is what actually clears
// mustChangePassword (in auth.js).
function checkForcePasswordChange() {

    let modal = document.getElementById("forcePasswordModal");

    if (!modal || !currentUser || !currentUser.mustChangePassword) {
        return;
    }

    modal.style.display = "flex";
}

function submitForcePasswordChange(event) {

    event.preventDefault();

    let next = document.getElementById("forcePwNew").value;
    let confirmNext = document.getElementById("forcePwConfirm").value;
    let slot = document.querySelector("#forcePasswordModal .modal-alert");

    function fail(message) {
        if (slot) slot.innerHTML = `<div class="alert error">${message}</div>`;
    }

    if (next.length < 6) {
        fail("New password must be at least 6 characters.");
        return;
    }

    if (next !== confirmNext) {
        fail("New passwords do not match.");
        return;
    }

    let result = forceChangePassword(currentUser.id, next);

    if (!result.success) {
        fail(result.message);
        return;
    }

    currentUser.mustChangePassword = false;

    document.getElementById("forcePasswordModal").style.display = "none";

    alertMessage("Password updated. You're all set.", "success");
}

// Escapes text before it goes into innerHTML (names/emails are typed
// in by the admin and users, so never trust them as raw HTML).
function escapeHtml(text) {
    return String(text == null ? "" : text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Human-readable label for a stored role value.
function roleLabel(role) {
    const labels = {
        student: "Student Leader",
        teacher: "Teacher",
        staff: "School Staff",
        admin: "Administrator"
    };
    return labels[role] || role;
}

function getInitials(name) {
    if (!name) return "?";
    let parts = name.trim().split(/\s+/);
    let initials = parts.slice(0, 2)
        .map(p => (p[0] || "").toUpperCase())
        .join("");
    return initials || "?";
}

// Opens/closes the sidebar Settings popover (profile / theme / logout).
function toggleSettingsMenu(e) {
    if (e) e.stopPropagation();
    let menu = document.getElementById("settingsMenu");
    if (!menu) return;
    let isOpen = menu.classList.toggle("open");
    menu.querySelector(".settings-trigger").setAttribute("aria-expanded", isOpen ? "true" : "false");
}

function closeSettingsMenu() {
    let menu = document.getElementById("settingsMenu");
    if (!menu) return;
    menu.classList.remove("open");
    menu.querySelector(".settings-trigger").setAttribute("aria-expanded", "false");
}

document.addEventListener("click", function (e) {
    let menu = document.getElementById("settingsMenu");
    if (menu && menu.classList.contains("open") && !menu.contains(e.target)) {
        closeSettingsMenu();
    }
});

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeSettingsMenu();
});

function displayUser() {

    let avatarHtml = currentUser.photo
        ? `<img src="${currentUser.photo}" class="userbar-avatar" alt="Profile">`
        : `<span class="userbar-avatar userbar-avatar-fallback">${getInitials(currentUser.name)}</span>`;

    document.getElementById("userBar").innerHTML = `
        <span class="userbar-identity">
            ${avatarHtml}
            <span class="userbar-text">
                <span class="userbar-name">${currentUser.name}</span>
                <span class="userbar-role">${roleLabel(currentUser.role)}</span>
            </span>
        </span>
    `;

    if (currentUser.role === "admin") {
        document.querySelectorAll(".admin-only").forEach(
            el => el.style.display = "inline-flex"
        );
        renderUsers();
        renderNavBadges();

        // The admin sees every user's reservations here (and approves
        // or rejects the pending ones), so "My Reservations" would be
        // misleading.
        document.getElementById("reservationsNavLabel").textContent =
            "All Reservations";
    }

    renderProfilePanel();
}

function renderNavBadges() {

    if (currentUser.role !== "admin") {
        return;
    }

    let pendingResetCount = getResetRequests().length;

    let pendingBookingCount = bookings.filter(
        b => b.status === "pending"
    ).length;

    setNavBadge("manage-users", pendingResetCount);
    setNavBadge("reservations", pendingBookingCount);
}

function setNavBadge(panelName, count) {

    let btn = document.querySelector(
        '.dash-nav-btn[data-panel="' + panelName + '"]'
    );

    if (!btn) {
        return;
    }

    let badge = btn.querySelector(".nav-badge");

    if (count > 0) {

        if (!badge) {
            badge = document.createElement("span");
            badge.className = "nav-badge";
            btn.appendChild(badge);
        }

        badge.textContent = count;

    } else if (badge) {
        badge.remove();
    }
}

// Switches which dashboard tab/panel is visible. All panels stay
// in the DOM (so their render functions keep working normally) —
// only the active one is shown.
function switchPanel(name) {

    document.querySelectorAll(".panel").forEach(
        p => p.classList.remove("active")
    );

    let panel = document.getElementById("panel-" + name);
    if (panel) panel.classList.add("active");

    document.querySelectorAll(".dash-nav-btn").forEach(
        b => b.classList.remove("active")
    );

    let btn = document.querySelector(
        '.dash-nav-btn[data-panel="' + name + '"]'
    );
    if (btn) btn.classList.add("active");

    // Accounts may have been created, blocked or removed since the
    // admin last looked, so refresh the "Reserve For" list on entry.
    if (name === "reserve") {
        populateReserveForUsers();
    }

    if (name === "rooms" || name === "reserve") {
        syncTodayDates();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Admin only: fills the "Reserve For" dropdown with the accounts a
// reservation can be made for. Each option shows name, role and email
// (names can repeat, the email is unique) and its value is the email.
// The admin is never listed - reservations are always for someone else.
function populateReserveForUsers() {

    let wrap = document.getElementById("reserveForWrap");
    let select = document.getElementById("reserveFor");

    if (!wrap || !select) {
        return;
    }

    if (currentUser.role !== "admin") {
        wrap.style.display = "none";
        select.required = false;
        return;
    }

    wrap.style.display = "block";
    select.required = true;

    let previous = select.value;

    let users = getUsers()
        .filter(u => u.role !== "admin" && u.status !== "blocked")
        .sort((a, b) => a.name.localeCompare(b.name));

    let html = `<option value="">Select a user...</option>`;

    users.forEach(u => {
        html += `
            <option value="${escapeHtml(u.email)}">
                ${escapeHtml(u.name)} - ${escapeHtml(u.email)} (${roleLabel(u.role)})
            </option>
        `;
    });

    select.innerHTML = html;

    // Keep the admin's choice if that account is still in the list.
    if (previous && users.some(u => u.email === previous)) {
        select.value = previous;
    }
}

// Fills in the profile details, the email field and the avatar preview.
// Also clears the password fields, so it doubles as the "Cancel" reset.
function renderProfilePanel() {

    document.getElementById("profileHeading").textContent =
        `👤 ${currentUser.name} (${roleLabel(currentUser.role)})`;
    document.getElementById("profileCurrentEmail").textContent = currentUser.email;

    document.getElementById("profileEmailInput").value = "";
    document.getElementById("profileCurrentPassword").value = "";
    document.getElementById("profileNewPassword").value = "";
    document.getElementById("profileConfirmPassword").value = "";

    let img = document.getElementById("profileAvatarImg");
    let initials = document.getElementById("profileAvatarInitials");

    if (currentUser.photo) {
        img.src = currentUser.photo;
        img.style.display = "block";
        initials.style.display = "none";
    } else {
        img.style.display = "none";
        initials.style.display = "flex";
        initials.textContent = getInitials(currentUser.name);
    }
}

// Profile is a floating modal now, not a dashboard panel — opening
// or cancelling it never touches switchPanel, so whatever panel was
// showing underneath stays exactly as it was.
function openProfileModal() {
    closeSettingsMenu();
    renderProfilePanel();
    clearModalAlert("profileModal");
    document.getElementById("profileModal").style.display = "flex";
}

function closeProfileModal() {
    document.getElementById("profileModal").style.display = "none";
    renderProfilePanel();
}

function openCreateUserModal() {
    document.getElementById("createUserForm").reset();
    clearModalAlert("createUserModal");
    document.getElementById("createUserModal").style.display = "flex";
}

function closeCreateUserModal() {
    document.getElementById("createUserModal").style.display = "none";
}

function clearModalAlert(modalId) {
    let modal = document.getElementById(modalId);
    let slot = modal && modal.querySelector(".modal-alert");
    if (slot) slot.innerHTML = "";
}

// Downsizes and compresses an uploaded photo before it's stored.
// Phone camera photos can be several MB straight out of the file
// picker; storing that raw in localStorage and re-rendering it for
// every user in the admin list is what was causing the slow,
// sometimes-white-screen dashboard on mobile. Shrinking to a small
// square JPEG keeps each avatar down to a few KB.
function resizeImageFile(file, maxWidth, maxHeight, quality) {

    return new Promise(function (resolve, reject) {

        if (!file.type || file.type.indexOf("image/") !== 0) {
            reject(new Error("Not an image file."));
            return;
        }

        let reader = new FileReader();

        reader.onerror = function () {
            reject(new Error("Could not read file."));
        };

        reader.onload = function (evt) {

            let img = new Image();

            img.onerror = function () {
                reject(new Error("Could not load image."));
            };

            img.onload = function () {

                let width = img.width;
                let height = img.height;

                let scale = Math.min(
                    1,
                    maxWidth / width,
                    maxHeight / height
                );

                let targetWidth = Math.max(1, Math.round(width * scale));
                let targetHeight = Math.max(1, Math.round(height * scale));

                let canvas = document.createElement("canvas");
                canvas.width = targetWidth;
                canvas.height = targetHeight;

                let ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                let dataUrl = canvas.toDataURL("image/jpeg", quality);

                resolve(dataUrl);
            };

            img.src = evt.target.result;
        };

        reader.readAsDataURL(file);
    });
}

function saveProfile() {

    let email =
        document.getElementById("profileEmailInput").value.trim();

    let current =
        document.getElementById("profileCurrentPassword").value;

    let next =
        document.getElementById("profileNewPassword").value;

    let confirmNext =
        document.getElementById("profileConfirmPassword").value;

    function fail(message) {
        alertMessage(message, "error");
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    let emailChanged = email.length > 0 && email !== currentUser.email;
    let passwordChanged = next.length > 0;

    if (!emailChanged && !passwordChanged) {
        fail("No changes to save.");
        return;
    }

    if (passwordChanged && next.length < 6) {
        fail("New password must be at least 6 characters.");
        return;
    }

    if (passwordChanged && next !== confirmNext) {
        fail("New passwords do not match.");
        return;
    }

    if (!current) {
        fail("Enter your current password to save these changes.");
        return;
    }

    let result = updateAccount(currentUser.id, {
        email: emailChanged ? email : currentUser.email,
        currentPassword: current,
        newPassword: next
    });

    if (!result.success) {
        fail(result.message);
        return;
    }

    if (result.emailChanged) {

        // Reservations are matched to their owner by email, so move
        // this user's existing reservations over to the new address.
        bookings.forEach(b => {
            if (b.email === result.oldEmail) {
                b.email = result.newEmail;
            }
        });

        saveData();

        currentUser.email = result.newEmail;

        displayBookings();
        renderStats();
    }

    if (result.passwordChanged) {
        currentUser.mustChangePassword = false;
    }

    renderProfilePanel();
    closeProfileModal();

    let what = result.emailChanged && result.passwordChanged
        ? "Email and password updated."
        : result.emailChanged
            ? "Email updated. Use it the next time you log in."
            : "Password updated.";

    alertMessage(what, "success");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ------------------------------------------------------------
// Manage Users (admin only)
// Accounts only come from the Create User form. The list is split
// into tabs by role so each group is easy to scan.
// ------------------------------------------------------------
const USER_ROLE_TABS = [
    { key: "all",     label: "All" },
    { key: "teacher", label: "Teachers" },
    { key: "staff",   label: "School Staff" },
    { key: "student", label: "Student Leaders" }
];

let userRoleTab = "all";

function createUserFromForm() {

    if (currentUser.role !== "admin") {
        return;
    }

    let name = document.getElementById("newUserName").value;
    let email = document.getElementById("newUserEmail").value;
    let password = document.getElementById("newUserPassword").value;
    let role = document.getElementById("newUserRole").value;

    let result = createUserAccount(name, email, password, role);

    window.scrollTo({ top: 0, behavior: "smooth" });

    if (!result.success) {
        alertMessage(result.message, "error");
        return;
    }

    document.getElementById("createUserForm").reset();
    closeCreateUserModal();

    // Jump to the tab the new account landed in so the admin sees it.
    userRoleTab = role;
    userStatusFilter = "all";
    document.getElementById("userStatusFilter").value = "all";
    userPage = 1;

    renderUsers();

    alertMessage(
        "Account created for " + escapeHtml(name.trim()) + " (" +
        roleLabel(role) + "). Give them the email and temporary password.",
        "success"
    );
}

function switchUserTab(key) {
    userRoleTab = key;
    userPage = 1;
    renderUsers();
}

function renderUsers() {

    if (currentUser.role !== "admin") {
        return;
    }

    renderResetRequests();

    // The admin manages their own login from the Profile tab, so the
    // list only holds the accounts the admin created.
    let users = getUsers().filter(u => u.role !== "admin");

    document.getElementById("statUsers").textContent = users.length;

    document.getElementById("statBlockedUsers").textContent =
        users.filter(u => u.status === "blocked").length;

    document.getElementById("userRoleTabs").innerHTML =
        USER_ROLE_TABS.map(t => {

            let count = t.key === "all"
                ? users.length
                : users.filter(u => u.role === t.key).length;

            return `
                <button
                    type="button"
                    class="role-tab ${t.key === userRoleTab ? "active" : ""}"
                    onclick="switchUserTab('${t.key}')"
                >
                    ${t.label}
                    <span class="role-tab-count">${count}</span>
                </button>
            `;

        }).join("");

    let visible = users;

    if (userRoleTab !== "all") {
        visible = visible.filter(u => u.role === userRoleTab);
    }

    if (userStatusFilter !== "all") {
        visible = visible.filter(
            u => (u.status || "approved") === userStatusFilter
        );
    }

    let totalPages = Math.max(1, Math.ceil(visible.length / USERS_PER_PAGE));
    if (userPage > totalPages) userPage = totalPages;
    if (userPage < 1) userPage = 1;

    let pageItems = visible.slice(
        (userPage - 1) * USERS_PER_PAGE,
        userPage * USERS_PER_PAGE
    );

    let html = "";

    if (visible.length === 0) {

        html = `
            <div class="empty">
                No accounts here yet. Use the form above to create one.
            </div>
        `;
    }

    pageItems.forEach(u => {

        let isBlocked = u.status === "blocked";

        let statusBadge = isBlocked
            ? `<span class="status blocked">🚫 Blocked</span>`
            : `<span class="status approved">✅ Active</span>`;

        let name = escapeHtml(u.name);

        let avatar = u.photo
            ? `<img src="${u.photo}" alt="${name}" class="user-row-avatar">`
            : `<span class="user-row-avatar user-row-avatar-fallback">${escapeHtml(getInitials(u.name))}</span>`;

        html += `
            <div class="user-row">
                <div class="user-row-photo">${avatar}</div>
                <div class="user-row-info">
                    <strong>${name}</strong>
                    <p>
                        ${escapeHtml(u.email)} &middot;
                        <select
                            class="role-select"
                            onchange="changeUserRole(${u.id}, this.value)"
                        >
                            <option value="teacher" ${u.role === "teacher" ? "selected" : ""}>Teacher</option>
                            <option value="staff" ${u.role === "staff" ? "selected" : ""}>School Staff</option>
                            <option value="student" ${u.role === "student" ? "selected" : ""}>Student Leader</option>
                        </select>
                    </p>
                </div>
                <div class="user-row-actions">
                    ${statusBadge}
                    ${
                        isBlocked
                        ? `<button class="btn success" onclick="reactivateUserAccount(${u.id})">Reactivate</button>`
                        : `<button class="btn" onclick="blockUserAccount(${u.id})">Block</button>`
                    }
                    <button class="btn danger" onclick="deleteUserAccount(${u.id})">Remove</button>
                </div>
            </div>
        `;
    });

    document.getElementById("userList").innerHTML = html;

    document.getElementById("userPagination").innerHTML =
        paginationHTML(userPage, totalPages, "goToUserPage");

    renderNavBadges();
}

function filterUsersByStatus() {
    userStatusFilter =
        document.getElementById("userStatusFilter").value;
    userPage = 1;
    renderUsers();
}

function goToUserPage(page) {
    userPage = page;
    renderUsers();
}

function blockUserAccount(id) {

    if (currentUser.role !== "admin") {
        return;
    }

    if (!confirm("Block this account? They will not be able to log in until reactivated.")) {
        return;
    }

    let users = getUsers();
    let user = users.find(u => u.id === id);

    if (!user || user.role === "admin") {
        return;
    }

    user.status = "blocked";

    saveUsers(users);

    renderUsers();

    alertMessage(
        escapeHtml(user.name) + " has been blocked.",
        "success"
    );
}

function reactivateUserAccount(id) {

    if (currentUser.role !== "admin") {
        return;
    }

    let users = getUsers();
    let user = users.find(u => u.id === id);

    if (!user) {
        return;
    }

    user.status = "approved";

    saveUsers(users);

    renderUsers();

    alertMessage(
        escapeHtml(user.name) + " has been reactivated.",
        "success"
    );
}

function changeUserRole(id, role) {

    if (currentUser.role !== "admin") {
        return;
    }

    if (!CREATABLE_ROLES.includes(role)) {
        return;
    }

    let users = getUsers();
    let user = users.find(u => u.id === id);

    if (!user || user.role === "admin") {
        return;
    }

    user.role = role;

    saveUsers(users);

    renderUsers();

    alertMessage(
        escapeHtml(user.name) + "'s role was changed to " + roleLabel(role) + ".",
        "success"
    );
}

function deleteUserAccount(id) {

    if (currentUser.role !== "admin") {
        return;
    }

    if (!confirm("Remove this user account?")) {
        return;
    }

    let users = getUsers().filter(u => u.id !== id || u.role === "admin");

    saveUsers(users);

    // Also clear any password reset request that belonged to this user.
    saveResetRequests(
        getResetRequests().filter(r => r.userId !== id)
    );

    renderUsers();

    alertMessage(
        "User account removed.",
        "success"
    );
}

function renderResetRequests() {

    if (currentUser.role !== "admin") {
        return;
    }

    let requests = getResetRequests();

    let box = document.getElementById("resetRequestsBox");
    let list = document.getElementById("resetRequestList");
    let pager = document.getElementById("resetPagination");

    if (requests.length === 0) {
        box.style.display = "none";
        list.innerHTML = "";
        pager.innerHTML = "";
        return;
    }

    box.style.display = "block";

    let totalPages = Math.max(1, Math.ceil(requests.length / RESETS_PER_PAGE));
    if (resetPage > totalPages) resetPage = totalPages;
    if (resetPage < 1) resetPage = 1;

    let pageItems = requests.slice(
        (resetPage - 1) * RESETS_PER_PAGE,
        resetPage * RESETS_PER_PAGE
    );

    let html = "";

    pageItems.forEach(r => {

        html += `
            <div class="user-row">
                <div class="user-row-info">
                    <strong>${escapeHtml(r.name)}</strong>
                    <p>${escapeHtml(r.email)}</p>
                </div>
                <div class="user-row-actions">
                    <button
                        class="btn success"
                        onclick="resolveResetRequest(${r.id})"
                    >
                        Set New Password
                    </button>
                    <button
                        class="btn ghost"
                        onclick="dismissResetRequest(${r.id})"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        `;
    });

    list.innerHTML = html;

    pager.innerHTML =
        paginationHTML(resetPage, totalPages, "goToResetPage");
}

function goToResetPage(page) {
    resetPage = page;
    renderResetRequests();
}

function resolveResetRequest(id) {

    if (currentUser.role !== "admin") {
        return;
    }

    let newPassword = prompt("Enter a new temporary password for this user (at least 6 characters):");

    if (newPassword === null) {
        return;
    }

    if (newPassword.length < 6) {
        alertMessage("Password must be at least 6 characters.", "error");
        return;
    }

    let result = resolvePasswordResetRequest(id, newPassword);

    if (result.success) {

        renderResetRequests();
        renderNavBadges();

        alertMessage(
            "Password reset. Let the user know their new temporary password.",
            "success"
        );

    } else {
        alertMessage(result.message, "error");
    }
}

function dismissResetRequest(id) {

    if (currentUser.role !== "admin") {
        return;
    }

    if (!confirm("Dismiss this reset request? The user's password will not be changed.")) {
        return;
    }

    let result = dismissPasswordResetRequest(id);

    if (result.success) {

        renderResetRequests();
        renderNavBadges();

        alertMessage("Reset request dismissed.", "success");

    } else {
        alertMessage(result.message, "error");
    }
}

// Updates the stat tiles at the top of the dashboard.
function renderStats() {

    let date = document.getElementById("availabilityDate").value;

    document.getElementById("statRooms").textContent = rooms.length;

    let availNowEl = document.getElementById("statAvailableNow");
    if (availNowEl) {
        availNowEl.textContent = getAvailableRoomsNow();
    }

    let openSlots = 0;

    if (date) {
        rooms.forEach(room => {
            openSlots += getRoomSegments(room.id, date)
                .filter(slot => slot.type === "available").length;
        });
    }

    document.getElementById("statAvailable").textContent = openSlots;

    let scope = currentUser.role === "admin"
        ? bookings
        : bookings.filter(b => b.email === currentUser.email);

    document.getElementById("statPending").textContent =
        scope.filter(b => b.status === "pending").length;

    document.getElementById("statApproved").textContent =
        scope.filter(b => b.status === "approved").length;

    let cancelledEl = document.getElementById("statCancelled");
    if (cancelledEl) {
        cancelledEl.textContent =
            scope.filter(b => b.status === "cancelled").length;
    }
}

// Counts rooms with no pending/approved booking covering right now.
// Used for the "Rooms Available Now" tile on the overview.
function getAvailableRoomsNow() {

    let now = new Date();
    let today = getTodayString();
    let nowTime =
        String(now.getHours()).padStart(2, "0") + ":" +
        String(now.getMinutes()).padStart(2, "0");

    return rooms.filter(room =>
        !bookings.some(b =>
            b.roomId == room.id &&
            b.date === today &&
            (b.status === "pending" || b.status === "approved") &&
            nowTime >= b.start &&
            nowTime < b.end
        )
    ).length;
}

function formatTime(time) {
    let [hour, minute] = time.split(":");
    hour = parseInt(hour);

    let ampm = hour >= 12 ? "PM" : "AM";
    let displayHour = hour % 12 || 12;

    return `${displayHour}:${minute} ${ampm}`;
}

function formatDate(dateStr) {
    if (!dateStr) return "";

    // Parse as local date (avoid UTC off-by-one from new Date("YYYY-MM-DD"))
    let [y, m, d] = dateStr.split("-").map(Number);
    let date = new Date(y, m - 1, d);

    return date.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

// Returns the status ("available", "pending", or "approved") and
// matching booking (if any) for a single fixed slot on a given
// room/date, based on time overlap with existing reservations.
function toMinutes(time) {
    let [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

function formatDuration(minutes) {
    let h = Math.floor(minutes / 60);
    let m = minutes % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
}

// Splits a room's day into back-to-back segments covering the whole
// operating window: an "available" segment for every open gap, and a
// segment for each existing pending/approved booking. This reflects
// real reservations (any start/end time) instead of 4 fixed blocks.
function getRoomSegments(roomId, date) {

    let dayBookings = bookings
        .filter(b =>
            b.roomId == roomId &&
            b.date == date &&
            (b.status === "pending" || b.status === "approved")
        )
        .sort((a, b) => a.start.localeCompare(b.start));

    let segments = [];
    let cursor = OPERATING_HOURS.start;

    dayBookings.forEach(b => {

        if (b.end <= cursor) {
            return; // fully covered by a previously-seen booking
        }

        let start = b.start > cursor ? b.start : cursor;

        if (start > cursor) {
            segments.push({ start: cursor, end: start, type: "available" });
        }

        segments.push({
            start: start,
            end: b.end,
            type: b.status,
            purpose: b.purpose,
            name: b.name
        });

        cursor = b.end;
    });

    if (cursor < OPERATING_HOURS.end) {
        segments.push({ start: cursor, end: OPERATING_HOURS.end, type: "available" });
    }

    return segments;
}

// Just the open windows from getRoomSegments — used to suggest
// alternative times once a requested reservation conflicts.
function getFreeWindows(roomId, date) {
    return getRoomSegments(roomId, date).filter(s => s.type === "available");
}

function displayRooms() {
    let date = document.getElementById("availabilityDate").value;
    let html = "";

    let filter = document.getElementById("roomFilter").value;
    let sortBy = document.getElementById("roomSort").value;

    let visibleRooms = rooms.slice();

    // "Available Only" only makes sense once a date is chosen —
    // otherwise there is nothing to check availability against.
    if (filter === "available" && date) {
        visibleRooms = visibleRooms.filter(room =>
            getRoomSegments(room.id, date)
                .some(slot => slot.type === "available")
        );
    }

    if (sortBy === "name") {
        visibleRooms.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "capacity-desc") {
        visibleRooms.sort((a, b) => b.capacity - a.capacity);
    } else if (sortBy === "capacity-asc") {
        visibleRooms.sort((a, b) => a.capacity - b.capacity);
    }

    let totalPages = Math.max(1, Math.ceil(visibleRooms.length / ROOMS_PER_PAGE));
    if (roomPage > totalPages) roomPage = totalPages;
    if (roomPage < 1) roomPage = 1;

    let pageRooms = visibleRooms.slice(
        (roomPage - 1) * ROOMS_PER_PAGE,
        roomPage * ROOMS_PER_PAGE
    );

    if (visibleRooms.length === 0) {

        html = `
            <div class="empty">
                No rooms match this filter.
            </div>
        `;
    }

    pageRooms.forEach(room => {

        let timeline = getRoomSegments(room.id, date);

        html += `
            <div class="room-card">
                <h3>${room.name}</h3>

                <p>👥 ${room.capacity} students</p>

                ${
                    room.location
                    ? `<p>📍 ${room.location}</p>`
                    : ""
                }

                <p>
                    📽 ${room.projector
                        ? "Has Projector"
                        : "No Projector"}
                </p>
        `;

        if (date) {

            let freeSegments = timeline.filter(s => s.type === "available");

            let freeMinutes = freeSegments.reduce(
                (sum, s) => sum + (toMinutes(s.end) - toMinutes(s.start)),
                0
            );

            let summaryClass =
                freeMinutes > 0 ? "available" : "full";

            let summaryLabel =
                freeMinutes > 0
                    ? `🟢 ${formatDuration(freeMinutes)} open`
                    : `🔴 Fully booked`;

            html += `
                <div class="room-summary ${summaryClass}">
                    ${summaryLabel}
                </div>
            `;

        } else {

            html += `
                <div class="available">
                    📅 Select a date
                </div>
            `;
        }

        html += `
            <button
                class="btn"
                onclick="showRoomDetails(${room.id})"
            >
                🔍 View Details
            </button>
        `;

        if (currentUser.role === "admin") {

            html += `
                <button
                    class="btn"
                    onclick="editRoom(${room.id})"
                >
                    ✏️ Edit
                </button>

                <button
                    class="btn danger"
                    onclick="deleteRoom(${room.id})"
                >
                    Remove
                </button>
            `;
        }

        html += `</div>`;
    });

    document.getElementById("roomGrid").innerHTML = html;

    document.getElementById("roomPagination").innerHTML =
        paginationHTML(roomPage, totalPages, "goToRoomPage");

    let select = document.getElementById("room");

    select.innerHTML =
        `<option value="">Select a room</option>`;

    rooms.forEach(room => {

        select.innerHTML += `
            <option value="${room.id}">
                ${room.name} (${room.capacity} seats)
            </option>
        `;
    });

    renderStats();
}

// Shared pagination control markup used by both the rooms grid
// and the reservations list.
function paginationHTML(page, totalPages, gotoFn) {

    if (totalPages <= 1) {
        return "";
    }

    return `
        <div class="pagination">
            <button
                type="button"
                class="btn"
                ${page <= 1 ? "disabled" : ""}
                onclick="${gotoFn}(${page - 1})"
            >
                ‹ Prev
            </button>

            <span class="page-indicator">
                Page ${page} of ${totalPages}
            </span>

            <button
                type="button"
                class="btn"
                ${page >= totalPages ? "disabled" : ""}
                onclick="${gotoFn}(${page + 1})"
            >
                Next ›
            </button>
        </div>
    `;
}

function goToRoomPage(page) {
    roomPage = page;
    displayRooms();
}

function goToBookingPage(page) {
    bookingPage = page;
    displayBookings();
}

// Shows the full details of a room (location, capacity, equipment,
// and its schedule for the currently selected availability date)
// in a modal, with a shortcut straight into the booking form.
function showRoomDetails(id) {

    let room = rooms.find(r => r.id == id);

    if (!room) {
        return;
    }

    let date =
        document.getElementById("availabilityDate").value ||
        getTodayString();

    let timeline = getRoomSegments(room.id, date);

    let scheduleHtml = timeline.map(slot => {

        let label = "";
        let extra = "";

        if (slot.type === "available") {
            label = "🟢 Available";
        } else if (slot.type === "pending") {
            label = "🟡 Pending";
            extra = ` &middot; ${slot.purpose} (${slot.name})`;
        } else if (slot.type === "approved") {
            label = "🔴 Booked";
            extra = ` &middot; ${slot.purpose} (${slot.name})`;
        }

        return `
            <div class="timeline-item ${slot.type}">
                <span>
                    ${formatTime(slot.start)} - ${formatTime(slot.end)}
                </span>
                <span>${label}${extra}</span>
            </div>
        `;
    }).join("");

    document.getElementById("roomModalBody").innerHTML = `
        <h2>${room.name}</h2>

        <p>👥 ${room.capacity} students</p>

        ${room.location ? `<p>📍 ${room.location}</p>` : ""}

        <p>📽 ${room.projector ? "Has Projector" : "No Projector"}</p>

        <div class="timeline">
            <b>🕐 Schedule for ${formatDate(date)}</b>
            ${scheduleHtml}
        </div>

        <button
            class="btn success"
            onclick="reserveFromModal(${room.id}, '${date}')"
        >
            📅 Reserve This Room
        </button>
    `;

    document.getElementById("roomModal").style.display = "flex";
}

function closeRoomModal() {
    document.getElementById("roomModal").style.display = "none";
}

// Jumps straight from the details modal into the booking form,
// with the room and date already filled in.
function reserveFromModal(roomId, date) {

    closeRoomModal();

    switchPanel("reserve");

    document.getElementById("room").value = roomId;
    document.getElementById("date").value = date;

    checkTimeAvailability();
}

function hasConflict(roomId, date, start, end) {

    return bookings.some(b =>
        b.roomId == roomId &&
        b.date == date &&
        (b.status === "pending" || b.status === "approved") &&
        start < b.end &&
        end > b.start
    );
}

// Live feedback under the Start/End time inputs in the booking form.
// Uses the same overlap check as hasConflict() — a chosen range can
// start or end mid-way through an existing booking and still conflict,
// it doesn't need to match any fixed block exactly.
function checkTimeAvailability() {

    let roomId = document.getElementById("room").value;
    let date = document.getElementById("date").value;
    let start = document.getElementById("startTime").value;
    let end = document.getElementById("endTime").value;
    let msgEl = document.getElementById("timeAvailabilityMsg");

    if (!msgEl) return;

    if (!roomId || !date || !start || !end) {
        msgEl.className = "time-availability-msg";
        msgEl.textContent = "Choose a room, date, start time, and end time.";
        return;
    }

    if (start >= end) {
        msgEl.className = "time-availability-msg conflict";
        msgEl.textContent = "❌ End time must be after start time.";
        return;
    }

    if (start < OPERATING_HOURS.start || end > OPERATING_HOURS.end) {
        msgEl.className = "time-availability-msg conflict";
        msgEl.textContent =
            `❌ Rooms can only be booked between ${formatTime(OPERATING_HOURS.start)} and ${formatTime(OPERATING_HOURS.end)}.`;
        return;
    }

    if (hasConflict(roomId, date, start, end)) {

        let freeWindows = getFreeWindows(roomId, date)
            .filter(w => toMinutes(w.end) - toMinutes(w.start) > 0);

        msgEl.className = "time-availability-msg conflict";

        if (freeWindows.length === 0) {
            msgEl.textContent =
                "❌ That time overlaps an existing reservation, and this room is fully booked for the rest of the day.";
            return;
        }

        let chips = freeWindows.map(w => `
            <button type="button" class="time-suggestion-chip"
                onclick="applySuggestedTime('${w.start}', '${w.end}')">
                ${formatTime(w.start)} - ${formatTime(w.end)}
            </button>
        `).join("");

        msgEl.innerHTML = `
            ❌ That time overlaps an existing reservation for this room.
            <div class="time-suggestions">
                <span>This room is free:</span>
                ${chips}
            </div>
        `;

        return;
    }

    msgEl.className = "time-availability-msg ok";
    msgEl.textContent =
        `🟢 ${formatTime(start)} - ${formatTime(end)} is available.`;
}

// Fills the Start/End inputs with a suggested free window (from the
// conflict message) and re-checks availability, so picking a
// suggestion is a single click.
function applySuggestedTime(start, end) {
    document.getElementById("startTime").value = start;
    document.getElementById("endTime").value = end;
    checkTimeAvailability();
}

function bookRoom() {

    let roomId =
        document.getElementById("room").value;

    let date =
        document.getElementById("date").value;

    let purpose =
        document.getElementById("purpose").value.trim();

    if (!roomId || !date || !purpose) {

        alertMessage(
            "Please fill in all fields.",
            "error"
        );

        return;
    }

    let start = document.getElementById("startTime").value;
    let end = document.getElementById("endTime").value;

    if (!start || !end) {

        alertMessage(
            "Please choose a start and end time.",
            "error"
        );

        return;
    }

    if (start >= end) {

        alertMessage(
            "End time must be after start time.",
            "error"
        );

        return;
    }

    if (start < OPERATING_HOURS.start || end > OPERATING_HOURS.end) {

        alertMessage(
            `Rooms can only be booked between ${formatTime(OPERATING_HOURS.start)} and ${formatTime(OPERATING_HOURS.end)}.`,
            "error"
        );

        return;
    }

    // Who the reservation belongs to. Regular users book for
    // themselves; the admin must pick another account to book for.
    let owner = currentUser;
    let isAdminBooking = currentUser.role === "admin";

    if (isAdminBooking) {

        let ownerEmail =
            document.getElementById("reserveFor").value;

        owner = getUsers().find(
            u => u.email === ownerEmail &&
                 u.role !== "admin" &&
                 u.status !== "blocked"
        );

        if (!owner) {

            alertMessage(
                "Please choose the user this reservation is for.",
                "error"
            );

            return;
        }
    }

    let today = getTodayString();

    if (date < today) {

        alertMessage(
            "You cannot select a past date.",
            "error"
        );

        return;
    }

    if (hasConflict(roomId, date, start, end)) {

        alertMessage(
            "❌ This room is already booked or pending at that time.",
            "error"
        );

        checkTimeAvailability();

        return;
    }

    bookings.push({

        id: Date.now(),

        roomId: roomId,

        name: owner.name,

        email: owner.email,

        role: owner.role,

        date: date,

        start: start,

        end: end,

        purpose: purpose,

        // The admin is the approver, so a reservation the admin makes
        // for someone is approved right away instead of waiting on
        // the admin's own review.
        status: isAdminBooking ? "approved" : "pending",

        reservedByAdmin: isAdminBooking ? currentUser.name : null
    });

    saveData();

    displayRooms();

    displayBookings();

    document
        .getElementById("bookingForm")
        .reset();

    checkTimeAvailability();

    populateReserveForUsers();

    if (isAdminBooking) {

        alertMessage(
            "Reservation approved for " + escapeHtml(owner.name) +
            " (" + escapeHtml(owner.email) + "). It now appears in their reservations.",
            "success"
        );

        return;
    }

    alertMessage(
        "Reservation submitted! The room is now temporarily reserved until the admin approves or cancels it.",
        "success"
    );
}

function displayBookings() {

    renderNavBadges();

    let list = bookings;

    if (currentUser.role !== "admin") {

        list = bookings.filter(
            b => b.email === currentUser.email
        );
    }

    let statusFilter =
        document.getElementById("statusFilter").value;

    if (statusFilter !== "all") {
        list = list.filter(b => b.status === statusFilter);
    }

    let sortOrder =
        document.getElementById("sortOrder").value;

    list = list.slice().sort((a, b) => {

        let cmp = a.date === b.date
            ? a.start.localeCompare(b.start)
            : a.date.localeCompare(b.date);

        return sortOrder === "oldest" ? cmp : -cmp;
    });

    let totalPages = Math.max(1, Math.ceil(list.length / BOOKINGS_PER_PAGE));
    if (bookingPage > totalPages) bookingPage = totalPages;
    if (bookingPage < 1) bookingPage = 1;

    if (list.length === 0) {

        document.getElementById("bookingList").innerHTML = `
            <div class="empty">
                No reservations match this filter.
            </div>
        `;

        document.getElementById("bookingPagination").innerHTML = "";

        renderStats();

        return;
    }

    let pageList = list.slice(
        (bookingPage - 1) * BOOKINGS_PER_PAGE,
        bookingPage * BOOKINGS_PER_PAGE
    );

    let html = "";

    pageList.forEach(b => {

        let room =
            rooms.find(r => r.id == b.roomId);

        let status = "";

        if (b.status === "pending") {

            status =
                `<span class="status pending">
                    ⏳ Pending
                </span>`;
        }

        if (b.status === "approved") {

            status =
                `<span class="status approved">
                    ✅ Approved
                </span>`;
        }

        if (b.status === "rejected") {

            status =
                `<span class="status rejected">
                    🚫 Rejected
                </span>`;
        }

        if (b.status === "cancelled") {

            status =
                `<span class="status cancelled">
                    ❌ Cancelled
                </span>`;
        }

        // Teachers get a priority cue on pending requests so admins
        // can spot class-related bookings that may need faster review.
        let priorityTag =
            b.status === "pending" && b.role === "teacher"
                ? `<span class="status priority">⭐ Priority</span>`
                : "";

        let canApproveReject =
            currentUser.role === "admin" &&
            b.status === "pending";

        let canCancel =
            (b.status === "pending" || b.status === "approved") &&
            (
                b.email === currentUser.email ||
                (currentUser.role === "admin" && b.status === "approved")
            );

        html += `
            <div class="booking">

                <div>

                    <h3>
                        ${room
                            ? room.name
                            : "Room Removed"}
                        - ${b.purpose}
                    </h3>

                    <p>👤 ${escapeHtml(b.name)}${
                        b.reservedByAdmin
                        ? ` <span class="note">(reserved by admin)</span>`
                        : ""
                    }</p>

                    <p>📅 ${formatDate(b.date)}</p>

                    <p>
                        🕐
                        ${formatTime(b.start)}
                        -
                        ${formatTime(b.end)}
                    </p>

                    <p>${status} ${priorityTag}</p>

                </div>

                <div>

                    ${
                        canApproveReject
                        ?
                        `
                        <button
                            class="btn success"
                            onclick="approveBooking(${b.id})"
                        >
                            ✔ Approve
                        </button>

                        <button
                            class="btn danger"
                            onclick="rejectBooking(${b.id})"
                        >
                            🚫 Reject
                        </button>
                        `
                        :
                        ""
                    }

                    ${
                        canCancel
                        ?
                        `
                        <button
                            class="btn danger"
                            onclick="cancelBooking(${b.id})"
                        >
                            ✖ Cancel
                        </button>
                        `
                        :
                        ""
                    }

                </div>

            </div>
        `;
    });

    document.getElementById("bookingList").innerHTML =
        html;

    document.getElementById("bookingPagination").innerHTML =
        paginationHTML(bookingPage, totalPages, "goToBookingPage");

    renderStats();
}

function approveBooking(id) {

    if (currentUser.role !== "admin") {
        return;
    }

    let booking =
        bookings.find(b => b.id === id);

    if (!booking) {
        return;
    }

    if (
        bookings.some(b =>
            b.id !== booking.id &&
            b.roomId == booking.roomId &&
            b.date == booking.date &&
            (b.status === "pending" || b.status === "approved") &&
            booking.start < b.end &&
            booking.end > b.start
        )
    ) {

        alertMessage(
            "This time conflicts with another reservation.",
            "error"
        );

        return;
    }

    booking.status = "approved";

    saveData();

    displayRooms();

    displayBookings();

    alertMessage(
        "Reservation approved!",
        "success"
    );
}

function rejectBooking(id) {

    if (currentUser.role !== "admin") {
        return;
    }

    let booking =
        bookings.find(b => b.id === id);

    if (!booking || booking.status !== "pending") {
        return;
    }

    if (!confirm("Reject this reservation request?")) {
        return;
    }

    booking.status = "rejected";

    saveData();

    displayRooms();

    displayBookings();

    alertMessage(
        "Reservation rejected.",
        "success"
    );
}

function cancelBooking(id) {

    let booking =
        bookings.find(b => b.id === id);

    if (!booking) {
        return;
    }

    if (
        currentUser.role !== "admin" &&
        booking.email !== currentUser.email
    ) {

        alertMessage(
            "You can only cancel your own reservation.",
            "error"
        );

        return;
    }

    if (!confirm("Cancel this reservation?")) {
        return;
    }

    booking.status = "cancelled";

    saveData();

    displayRooms();

    displayBookings();

    alertMessage(
        "Reservation cancelled. The room is available again.",
        "success"
    );
}

let editingRoomId = null;

function saveRoom() {

    if (currentUser.role !== "admin") {
        return;
    }

    let name =
        document.getElementById("roomName")
        .value.trim();

    let capacity =
        document.getElementById("capacity")
        .value;

    let location =
        document.getElementById("roomLocation")
        .value.trim();

    let projector =
        document.getElementById("projector")
        .value === "true";

    if (!name || !capacity) {

        alertMessage(
            "Please enter room name and capacity.",
            "error"
        );

        return;
    }

    if (editingRoomId) {

        let room =
            rooms.find(r => r.id === editingRoomId);

        if (room) {
            room.name = name;
            room.capacity = capacity;
            room.location = location;
            room.projector = projector;
        }

        saveData();

        cancelRoomEdit();

        displayRooms();

        alertMessage(
            "Room updated successfully.",
            "success"
        );

        return;
    }

    rooms.push({

        id: Date.now(),

        name: name,

        capacity: capacity,

        location: location,

        projector: projector
    });

    saveData();

    // Jump to the page that now contains the newly added room,
    // so the list never grows long on a single page.
    roomPage = Math.ceil(rooms.length / ROOMS_PER_PAGE);

    displayRooms();

    document
        .getElementById("roomForm")
        .reset();

    alertMessage(
        "Room added successfully.",
        "success"
    );
}

// Populates the admin room form with an existing room's data so it
// can be updated instead of adding a duplicate.
function editRoom(id) {

    if (currentUser.role !== "admin") {
        return;
    }

    let room = rooms.find(r => r.id == id);

    if (!room) {
        return;
    }

    editingRoomId = room.id;

    document.getElementById("roomName").value = room.name;
    document.getElementById("capacity").value = room.capacity;
    document.getElementById("roomLocation").value = room.location || "";
    document.getElementById("projector").value =
        room.projector ? "true" : "false";

    document.getElementById("roomFormTitle").textContent =
        "✏️ Edit Room";

    document.getElementById("roomSubmitBtn").textContent =
        "Update Room";

    document.getElementById("cancelEditBtn").style.display =
        "inline-flex";

    switchPanel("manage-rooms");
}

function cancelRoomEdit() {

    editingRoomId = null;

    document.getElementById("roomForm").reset();

    document.getElementById("roomFormTitle").textContent =
        "🏢 Add Room";

    document.getElementById("roomSubmitBtn").textContent =
        "Add Room";

    document.getElementById("cancelEditBtn").style.display =
        "none";
}

function deleteRoom(id) {

    if (currentUser.role !== "admin") {
        return;
    }

    if (!confirm("Remove this room?")) {
        return;
    }

    rooms =
        rooms.filter(r => r.id != id);

    if (editingRoomId === id) {
        cancelRoomEdit();
    }

    saveData();

    displayRooms();

    alertMessage(
        "Room removed.",
        "success"
    );
}

document.addEventListener(
    "DOMContentLoaded",
    function() {

        loadData();

        displayUser();

        checkForcePasswordChange();

        displayRooms();

        displayBookings();

        syncTodayDates();

        // Re-check the date when the person comes back to the tab
        // and once a minute, so a page left open past midnight (or
        // overnight) always shows the current day.
        document.addEventListener("visibilitychange", function() {
            if (!document.hidden) {
                syncTodayDates();
            }
        });

        window.addEventListener("focus", syncTodayDates);

        setInterval(syncTodayDates, 60000);

        document.getElementById(
            "availabilityDate"
        ).addEventListener(
            "change",
            displayRooms
        );

        document.getElementById("roomFilter")
            .addEventListener("change", function() {
                roomPage = 1;
                displayRooms();
            });

        document.getElementById("roomSort")
            .addEventListener("change", function() {
                roomPage = 1;
                displayRooms();
            });

        document.getElementById("statusFilter")
            .addEventListener("change", function() {
                bookingPage = 1;
                displayBookings();
            });

        document.getElementById("sortOrder")
            .addEventListener("change", function() {
                bookingPage = 1;
                displayBookings();
            });

        document.getElementById("room")
            .addEventListener("change", checkTimeAvailability);

        document.getElementById("date")
            .addEventListener("change", checkTimeAvailability);

        document.getElementById("startTime")
            .addEventListener("change", checkTimeAvailability);

        document.getElementById("endTime")
            .addEventListener("change", checkTimeAvailability);

        checkTimeAvailability();

        document.getElementById(
            "bookingForm"
        ).addEventListener(
            "submit",
            function(e) {

                e.preventDefault();

                bookRoom();
            }
        );

        document.getElementById(
            "roomForm"
        ).addEventListener(
            "submit",
            function(e) {

                e.preventDefault();

                saveRoom();
            }
        );

        document.getElementById(
            "profileForm"
        ).addEventListener(
            "submit",
            function(e) {

                e.preventDefault();

                saveProfile();
            }
        );

        document.getElementById(
            "createUserForm"
        ).addEventListener(
            "submit",
            function(e) {

                e.preventDefault();

                createUserFromForm();
            }
        );

        document.getElementById("profilePhotoInput")
            .addEventListener("change", function (e) {

                let file = e.target.files[0];

                if (!file) {
                    return;
                }

                resizeImageFile(file, 200, 200, 0.85).then(function (dataUrl) {

                    let result = updateProfilePhoto(currentUser.id, dataUrl);

                    if (result.success) {

                        currentUser.photo = dataUrl;

                        renderProfilePanel();
                        displayUser();

                        alertMessage(
                            "Profile photo updated.",
                            "success"
                        );

                    } else {

                        alertMessage(
                            result.message || "Could not update photo.",
                            "error"
                        );
                    }

                }).catch(function () {

                    alertMessage(
                        "Could not process that image. Please try a different photo.",
                        "error"
                    );
                });
            });
    }
);