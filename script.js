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

const OPEN_TIME = "08:00";
const CLOSE_TIME = "17:00";

// Fixed, bookable time slots for every room.
// Users can only reserve one of these blocks, so availability
// is always clear-cut: a slot is either open, pending, or booked.
const TIME_SLOTS = [
    { id: "slot1", start: "08:00", end: "09:30" },
    { id: "slot2", start: "10:00", end: "11:30" },
    { id: "slot3", start: "13:00", end: "14:30" },
    { id: "slot4", start: "15:00", end: "17:00" }
];

// Currently highlighted slot in the booking form (set by clicking a slot card)
let selectedSlot = null;

// Pagination state
const ROOMS_PER_PAGE = 4;
const BOOKINGS_PER_PAGE = 5;
const USERS_PER_PAGE = 5;
let roomPage = 1;
let bookingPage = 1;
let userPage = 1;
let userStatusFilter = "all";

function loadData() {
    rooms = JSON.parse(localStorage.getItem("rooms")) || rooms;
    bookings = JSON.parse(localStorage.getItem("bookings")) || [];

    if (localStorage.getItem("bookings") === null) {
        bookings = seedBookings();
        saveData();
    }
}

function saveData() {
    localStorage.setItem("rooms", JSON.stringify(rooms));
    localStorage.setItem("bookings", JSON.stringify(bookings));
}

// Builds a small set of realistic example reservations anchored to
// today's actual date, so the schedule always looks current instead
// of showing stale, hardcoded dates from the past.
function seedBookings() {

    function addDays(days) {
        let d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString().split("T")[0];
    }

    let today = addDays(0);
    let tomorrow = addDays(1);
    let in2 = addDays(2);
    let in3 = addDays(3);
    let in5 = addDays(5);

    return [
        {
            id: 1001,
            roomId: 1,
            name: "Maria Santos",
            email: "maria.santos@school.com",
            role: "teacher",
            date: today,
            start: "08:00",
            end: "09:30",
            purpose: "Intro to Programming Class",
            status: "approved"
        },
        {
            id: 1002,
            roomId: 1,
            name: "James Cruz",
            email: "james.cruz@school.com",
            role: "student",
            date: today,
            start: "13:00",
            end: "14:30",
            purpose: "Robotics Club Practice",
            status: "pending"
        },
        {
            id: 1003,
            roomId: 2,
            name: "Angela Reyes",
            email: "angela.reyes@school.com",
            role: "teacher",
            date: today,
            start: "10:00",
            end: "11:30",
            purpose: "Chemistry Lab Session",
            status: "approved"
        },
        {
            id: 1004,
            roomId: 3,
            name: "Paolo Mendoza",
            email: "paolo.mendoza@school.com",
            role: "student",
            date: tomorrow,
            start: "08:00",
            end: "09:30",
            purpose: "Study Group - Reading Circle",
            status: "pending"
        },
        {
            id: 1005,
            roomId: 4,
            name: "Karla Dizon",
            email: "karla.dizon@school.com",
            role: "staff",
            date: tomorrow,
            start: "15:00",
            end: "17:00",
            purpose: "Choir Rehearsal",
            status: "approved"
        },
        {
            id: 1006,
            roomId: 1,
            name: "Ramon Torres",
            email: "ramon.torres@school.com",
            role: "teacher",
            date: in2,
            start: "10:00",
            end: "11:30",
            purpose: "Web Design Workshop",
            status: "approved"
        },
        {
            id: 1007,
            roomId: 2,
            name: "Ella Navarro",
            email: "ella.navarro@school.com",
            role: "student",
            date: in3,
            start: "13:00",
            end: "14:30",
            purpose: "Science Fair Prep",
            status: "pending"
        },
        {
            id: 1008,
            roomId: 3,
            name: "Vince Aquino",
            email: "vince.aquino@school.com",
            role: "staff",
            date: in5,
            start: "15:00",
            end: "17:00",
            purpose: "Faculty Book Club",
            status: "approved"
        },
        {
            id: 1009,
            roomId: 4,
            name: "Bea Fernandez",
            email: "bea.fernandez@school.com",
            role: "student",
            date: tomorrow,
            start: "10:00",
            end: "11:30",
            purpose: "Dance Practice",
            status: "rejected"
        }
    ];
}

function alertMessage(message, type = "success") {
    document.getElementById("alertBox").innerHTML =
        `<div class="alert ${type}">${message}</div>`;
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

function displayUser() {

    let avatarHtml = currentUser.photo
        ? `<img src="${currentUser.photo}" class="userbar-avatar" alt="Profile">`
        : `<span class="userbar-avatar userbar-avatar-fallback">${getInitials(currentUser.name)}</span>`;

    document.getElementById("userBar").innerHTML = `
        ${avatarHtml}
        <span>${currentUser.name} (${roleLabel(currentUser.role)})</span>
        <button class="btn" onclick="openPasswordModal()">🔑 Change Password</button>
        <button class="btn" onclick="logout()">Logout</button>
    `;

    if (currentUser.role === "admin") {
        document.querySelectorAll(".admin-only").forEach(
            el => el.style.display = "inline-flex"
        );
        renderUsers();
        renderNavBadges();
    }

    renderProfilePanel();
}

function renderNavBadges() {

    if (currentUser.role !== "admin") {
        return;
    }

    let pendingUserCount = getUsers().filter(
        u => (u.status || "approved") === "pending"
    ).length;

    let pendingResetCount = getResetRequests().length;

    let pendingBookingCount = bookings.filter(
        b => b.status === "pending"
    ).length;

    setNavBadge("manage-users", pendingUserCount + pendingResetCount);
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

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Fills in the read-only profile fields and the avatar preview.
function renderProfilePanel() {

    document.getElementById("profileName").textContent = currentUser.name;
    document.getElementById("profileEmail").textContent = currentUser.email;
    document.getElementById("profileRole").textContent = roleLabel(currentUser.role);

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

function openPasswordModal() {
    document.getElementById("passwordForm").reset();
    document.getElementById("passwordModal").style.display = "flex";
}

function closePasswordModal() {
    document.getElementById("passwordModal").style.display = "none";
}

function submitPasswordChange() {

    let current =
        document.getElementById("currentPassword").value;

    let next =
        document.getElementById("newPassword").value;

    let confirmNext =
        document.getElementById("confirmPassword").value;

    if (!current || !next || !confirmNext) {

        alertMessage(
            "Please fill in all fields.",
            "error"
        );

        return;
    }

    if (next.length < 6) {

        alertMessage(
            "New password must be at least 6 characters.",
            "error"
        );

        return;
    }

    if (next !== confirmNext) {

        alertMessage(
            "New passwords do not match.",
            "error"
        );

        return;
    }

    let result = changePassword(currentUser.id, current, next);

    if (!result.success) {

        alertMessage(
            result.message,
            "error"
        );

        return;
    }

    closePasswordModal();

    alertMessage(
        "Password updated successfully.",
        "success"
    );
}

// Lists all registered accounts for the admin, with the ability
// to remove a non-admin account.
let showFlaggedOnly = false;

function renderUsers() {

    if (currentUser.role !== "admin") {
        return;
    }

    renderResetRequests();

    let users = getUsers();

    // Score every non-admin account against the troll/spam heuristics.
    let scored = users.map(u => ({
        user: u,
        trust: analyzeAccountTrust(u, users)
    }));

    let flaggedCount = scored.filter(
        s => s.trust.level !== "low"
    ).length;

    let pendingCount = users.filter(
        u => (u.status || "approved") === "pending"
    ).length;

    document.getElementById("statUsers").textContent = users.length;

    document.getElementById("statFlagged").textContent = flaggedCount;

    document.getElementById("statPendingUsers").textContent = pendingCount;

    let visible = scored;

    if (showFlaggedOnly) {
        visible = visible.filter(s => s.trust.level !== "low");
    }

    if (userStatusFilter !== "all") {
        visible = visible.filter(
            s => (s.user.status || "approved") === userStatusFilter
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
                No users match the current filters.
            </div>
        `;
    }

    pageItems.forEach(({ user: u, trust }) => {

        let trustBadge = `<span class="status approved">Admin</span>`;

        if (u.role !== "admin") {

            if (trust.level === "high") {
                trustBadge = `<span class="status trust-high">🚩 Likely Fake</span>`;
            } else if (trust.level === "medium") {
                trustBadge = `<span class="status trust-medium">⚠️ Needs Review</span>`;
            } else {
                trustBadge = `<span class="status trust-low">✅ Looks Legit</span>`;
            }
        }

        let approvalStatus = u.role === "admin"
            ? "approved"
            : (u.status || "approved");

        let approvalBadge = `<span class="status approved">✅ Approved</span>`;

        if (approvalStatus === "pending") {
            approvalBadge = `<span class="status pending">⏳ Pending</span>`;
        } else if (approvalStatus === "rejected") {
            approvalBadge = `<span class="status trust-high">⛔ Rejected</span>`;
        } else if (approvalStatus === "blocked") {
            approvalBadge = `<span class="status blocked">🚫 Blocked</span>`;
        }

        let roleControl = u.role === "admin"
            ? `<span class="user-row-role-fixed">${roleLabel(u.role)}</span>`
            : `
                <select
                    class="role-select"
                    onchange="changeUserRole(${u.id}, this.value)"
                >
                    <option value="student" ${u.role === "student" ? "selected" : ""}>Student Leader</option>
                    <option value="teacher" ${u.role === "teacher" ? "selected" : ""}>Teacher</option>
                    <option value="staff" ${u.role === "staff" ? "selected" : ""}>School Staff</option>
                </select>
            `;

        html += `
            <div class="user-row">
                <div class="user-row-photo">
                    ${
                        u.photo
                        ? `<img src="${u.photo}" alt="${u.name}" class="user-row-avatar">`
                        : `<span class="user-row-avatar user-row-avatar-fallback">${getInitials(u.name)}</span>`
                    }
                </div>
                <div class="user-row-info">
                    <strong>${u.name}</strong>
                    <p>${u.email} &middot; ${roleControl}</p>
                    ${
                        trust.flags.length > 0
                        ? `<p class="trust-flags">🔍 ${trust.flags.join(" &middot; ")}</p>`
                        : ""
                    }
                </div>

                <div class="user-row-actions">

                    ${approvalBadge}
                    ${trustBadge}

                    ${
                        u.role !== "admin" && (approvalStatus === "pending" || approvalStatus === "rejected")
                        ?
                        `
                        <button
                            class="btn success"
                            onclick="approveUserAccount(${u.id})"
                        >
                            Approve
                        </button>
                        `
                        :
                        ""
                    }

                    ${
                        u.role !== "admin" && approvalStatus === "pending"
                        ?
                        `
                        <button
                            class="btn"
                            onclick="rejectUserAccount(${u.id})"
                        >
                            Reject
                        </button>
                        `
                        :
                        ""
                    }

                    ${
                        u.role !== "admin" && approvalStatus === "approved"
                        ?
                        `
                        <button
                            class="btn"
                            onclick="blockUserAccount(${u.id})"
                        >
                            Block
                        </button>
                        `
                        :
                        ""
                    }

                    ${
                        u.role !== "admin" && approvalStatus === "blocked"
                        ?
                        `
                        <button
                            class="btn success"
                            onclick="reactivateUserAccount(${u.id})"
                        >
                            Reactivate
                        </button>
                        `
                        :
                        ""
                    }

                    ${
                        u.role !== "admin"
                        ?
                        `
                        <button
                            class="btn danger"
                            onclick="deleteUserAccount(${u.id})"
                        >
                            Remove
                        </button>
                        `
                        :
                        ""
                    }

                </div>
            </div>
        `;
    });

    document.getElementById("userList").innerHTML = html;

    document.getElementById("userPagination").innerHTML =
        paginationHTML(userPage, totalPages, "goToUserPage");

    renderNavBadges();
}

function toggleFlaggedOnly() {
    showFlaggedOnly =
        document.getElementById("flaggedOnlyFilter").checked;
    userPage = 1;
    renderUsers();
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

function approveUserAccount(id) {

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
        user.name + " has been approved.",
        "success"
    );
}

function rejectUserAccount(id) {

    if (currentUser.role !== "admin") {
        return;
    }

    if (!confirm("Reject this account? The user will not be able to log in.")) {
        return;
    }

    let users = getUsers();
    let user = users.find(u => u.id === id);

    if (!user) {
        return;
    }

    user.status = "rejected";

    saveUsers(users);

    renderUsers();

    alertMessage(
        user.name + " has been rejected.",
        "success"
    );
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

    if (!user) {
        return;
    }

    user.status = "blocked";

    saveUsers(users);

    renderUsers();

    alertMessage(
        user.name + " has been blocked.",
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
        user.name + " has been reactivated.",
        "success"
    );
}

function changeUserRole(id, role) {

    if (currentUser.role !== "admin") {
        return;
    }

    let users = getUsers();
    let user = users.find(u => u.id === id);

    if (!user) {
        return;
    }

    user.role = role;

    saveUsers(users);

    renderUsers();

    alertMessage(
        user.name + "'s role was changed to " + roleLabel(role) + ".",
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

    let users = getUsers().filter(u => u.id !== id);

    saveUsers(users);

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

    if (requests.length === 0) {
        box.style.display = "none";
        list.innerHTML = "";
        return;
    }

    box.style.display = "block";

    let html = "";

    requests.forEach(r => {

        html += `
            <div class="user-row">
                <div class="user-row-info">
                    <strong>${r.name}</strong>
                    <p>${r.email}</p>
                </div>
                <div class="user-row-actions">
                    <button
                        class="btn success"
                        onclick="resolveResetRequest(${r.id})"
                    >
                        Set New Password
                    </button>
                </div>
            </div>
        `;
    });

    list.innerHTML = html;
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

// Updates the four stat tiles at the top of the dashboard.
function renderStats() {

    let date = document.getElementById("availabilityDate").value;

    document.getElementById("statRooms").textContent = rooms.length;

    let openSlots = 0;

    if (date) {
        rooms.forEach(room => {
            openSlots += getTimeline(room.id, date)
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
function getSlotStatus(roomId, date, slot) {

    let match = bookings.find(b =>
        b.roomId == roomId &&
        b.date == date &&
        (b.status === "pending" || b.status === "approved") &&
        slot.start < b.end &&
        slot.end > b.start
    );

    if (!match) {
        return { type: "available" };
    }

    return {
        type: match.status,
        purpose: match.purpose,
        name: match.name
    };
}

function getTimeline(roomId, date) {

    return TIME_SLOTS.map(slot => {
        let status = getSlotStatus(roomId, date, slot);

        return {
            start: slot.start,
            end: slot.end,
            type: status.type,
            purpose: status.purpose,
            name: status.name
        };
    });
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
            getTimeline(room.id, date)
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

        let timeline = getTimeline(room.id, date);

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

            let openCount =
                timeline.filter(s => s.type === "available").length;

            let summaryClass =
                openCount > 0 ? "available" : "full";

            let summaryLabel =
                openCount > 0
                    ? `🟢 ${openCount} slot${openCount === 1 ? "" : "s"} open`
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
        new Date().toISOString().split("T")[0];

    let timeline = getTimeline(room.id, date);

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

    renderSlotPicker();
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

// Renders the clickable slot cards in the booking form based on the
// currently selected room + date. Booked/pending slots are shown but
// disabled, so the user can immediately see which other times are free.
function renderSlotPicker() {

    let roomId = document.getElementById("room").value;
    let date = document.getElementById("date").value;
    let container = document.getElementById("slotPicker");

    selectedSlot = null;

    if (!roomId || !date) {
        container.innerHTML = `
            <p class="note">
                Choose a room and date to see available time slots.
            </p>
        `;
        return;
    }

    let html = `<div class="slot-grid">`;

    TIME_SLOTS.forEach(slot => {

        let status = getSlotStatus(roomId, date, slot);
        let timeLabel =
            `${formatTime(slot.start)} - ${formatTime(slot.end)}`;

        if (status.type === "available") {
            html += `
                <div
                    class="slot-option available"
                    onclick="pickSlot('${slot.id}')"
                    data-slot="${slot.id}"
                >
                    <span class="slot-time">${timeLabel}</span>
                    <span class="slot-status">🟢 Available</span>
                </div>
            `;
        } else {
            let label =
                status.type === "pending" ? "🟡 Pending" : "🔴 Booked";

            html += `
                <div class="slot-option disabled ${status.type}">
                    <span class="slot-time">${timeLabel}</span>
                    <span class="slot-status">${label}</span>
                    <span class="slot-purpose">${status.purpose}</span>
                </div>
            `;
        }
    });

    html += `</div>`;

    container.innerHTML = html;
}

function pickSlot(slotId) {

    selectedSlot = TIME_SLOTS.find(s => s.id === slotId);

    document
        .querySelectorAll(".slot-option")
        .forEach(el => el.classList.remove("selected"));

    document
        .querySelector(`.slot-option[data-slot="${slotId}"]`)
        .classList.add("selected");
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

    if (!selectedSlot) {

        alertMessage(
            "Please choose an available time slot.",
            "error"
        );

        return;
    }

    let start = selectedSlot.start;
    let end = selectedSlot.end;

    let today =
        new Date().toISOString().split("T")[0];

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

        renderSlotPicker();

        return;
    }

    bookings.push({

        id: Date.now(),

        roomId: roomId,

        name: currentUser.name,

        email: currentUser.email,

        role: currentUser.role,

        date: date,

        start: start,

        end: end,

        purpose: purpose,

        status: "pending"
    });

    saveData();

    displayRooms();

    displayBookings();

    document
        .getElementById("bookingForm")
        .reset();

    selectedSlot = null;

    renderSlotPicker();

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

                    <p>👤 ${b.name}</p>

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

        displayRooms();

        displayBookings();

        let today =
            new Date()
            .toISOString()
            .split("T")[0];

        document.getElementById("date").min =
            today;

        document.getElementById(
            "availabilityDate"
        ).min = today;

        document.getElementById(
            "availabilityDate"
        ).value = today;

        displayRooms();

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
            .addEventListener("change", renderSlotPicker);

        document.getElementById("date")
            .addEventListener("change", renderSlotPicker);

        renderSlotPicker();

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
            "passwordForm"
        ).addEventListener(
            "submit",
            function(e) {

                e.preventDefault();

                submitPasswordChange();
            }
        );

        document.getElementById("profilePhotoInput")
            .addEventListener("change", function (e) {

                let file = e.target.files[0];

                if (!file) {
                    return;
                }

                let reader = new FileReader();

                reader.onload = function (evt) {

                    let dataUrl = evt.target.result;

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
                };

                reader.readAsDataURL(file);
            });
    }
);