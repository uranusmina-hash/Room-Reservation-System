// Landing page behavior: mobile nav toggle, swapping CTAs for anyone
// who's already signed in, and the live 3D room scene in the hero.
(function () {

    var toggle = document.getElementById("navToggle");
    var navbar = document.getElementById("navbar");

    if (toggle && navbar) {
        toggle.addEventListener("click", function () {
            navbar.classList.toggle("nav-open");
        });

        navbar.querySelectorAll(".nav-links a").forEach(function (link) {
            link.addEventListener("click", function () {
                navbar.classList.remove("nav-open");
            });
        });
    }

    if (typeof getSession === "function") {

        var session = getSession();

        if (session) {

            document
                .querySelectorAll(
                    'a[href="login.html"], a[href="register.html"]'
                )
                .forEach(function (el) {
                    el.textContent = "Go to Dashboard";
                    el.href = "dashboard.html";
                });
        }
    }

})();

// Switches which section of the landing page is visible, so the
// page reads as a short, focused view instead of one long scroll.
// Global (not in the IIFE above) since it's called from inline
// onclick attributes in index.html.
function switchLandingPanel(name) {

    document.querySelectorAll(".landing-panel").forEach(function (p) {
        p.classList.remove("active");
    });

    var panel = document.getElementById("lp-" + name);
    if (panel) panel.classList.add("active");

    document.querySelectorAll(".nav-links a").forEach(function (a) {
        a.classList.remove("active");
    });

    var navbar = document.getElementById("navbar");
    if (navbar) navbar.classList.remove("nav-open");

    window.scrollTo({ top: 0, behavior: "smooth" });
}


// ------------------------------------------------------------
// Live 3D room scene
// Rooms cycle open -> pending -> booked -> open, mirroring the
// real request/approval flow. The whole scene sways gently and
// tilts toward the pointer. It pauses when off-screen, when the
// tab is hidden, and is left still for "reduce motion" users.
// ------------------------------------------------------------
(function () {

    var scene = document.getElementById("roomScene");
    if (!scene) return;

    // Add or rename rooms here. x / y are grid positions (0 or 1).
    var rooms = [
        { name: "Computer Lab", x: 0, y: 0, s: "open" },
        { name: "Library",      x: 1, y: 0, s: "booked" },
        { name: "Science Room", x: 0, y: 1, s: "pending" },
        { name: "Music Room",   x: 1, y: 1, s: "open" }
    ];

    var SIZE = 150, GAP = 30, PAD = 15;
    var NEXT = { open: "pending", pending: "booked", booked: "open" };

    var roomsHtml = '<div class="floor"></div>';
    var slotsHtml = "";

    rooms.forEach(function (r, i) {

        var pos = "left:" + (PAD + r.x * (SIZE + GAP)) + "px;top:" +
                  (PAD + r.y * (SIZE + GAP)) + "px;animation-delay:" +
                  (i * 0.08) + "s";

        roomsHtml +=
            '<div class="room" data-s="' + r.s + '" style="' + pos + '">' +
            '<span class="glow"></span>' +
            '<span class="face north"></span>' +
            '<span class="face west"></span>' +
            '<span class="face south"></span>' +
            '<span class="face east"></span>' +
            '<span class="face top"></span>' +
            '</div>';

        slotsHtml +=
            '<div class="slot" data-s="' + r.s + '" style="' + pos + '">' +
            '<span class="tag"><span class="chip"><i></i>' + r.name +
            '</span></span></div>';
    });

    scene.innerHTML =
        '<div class="layer"><div class="stage">' + roomsHtml + '</div></div>' +
        '<div class="layer labels"><div class="stage">' + slotsHtml + '</div></div>';

    var roomEls = scene.querySelectorAll(".room");
    var slotEls = scene.querySelectorAll(".slot");

    if (window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    var hero = scene.closest(".hero") || scene;
    var target = { x: 0, y: 0 };
    var cur = { x: 0, y: 0 };
    var start = performance.now();
    var raf = 0;
    var timer = 0;
    var last = -1;

    hero.addEventListener("pointermove", function (e) {
        var b = hero.getBoundingClientRect();
        target.x = ((e.clientX - b.left) / b.width - 0.5) * 2;
        target.y = ((e.clientY - b.top) / b.height - 0.5) * 2;
    });

    hero.addEventListener("pointerleave", function () {
        target.x = 0;
        target.y = 0;
    });

    function frame(now) {

        var t = (now - start) / 1000;

        cur.x += (target.x - cur.x) * 0.06;
        cur.y += (target.y - cur.y) * 0.06;

        var rz = -38 + Math.sin(t * 0.45) * 5 + cur.x * 10;
        var rx = 58 - cur.y * 6 + Math.sin(t * 0.6) * 1.5;

        scene.style.setProperty("--rz", rz.toFixed(2) + "deg");
        scene.style.setProperty("--rx", rx.toFixed(2) + "deg");

        raf = requestAnimationFrame(frame);
    }

    function advance() {

        var i;
        do {
            i = Math.floor(Math.random() * roomEls.length);
        } while (i === last && roomEls.length > 1);

        last = i;

        var next = NEXT[roomEls[i].dataset.s];
        roomEls[i].dataset.s = next;
        slotEls[i].dataset.s = next;
    }

    function run() {
        if (!raf) raf = requestAnimationFrame(frame);
        if (!timer) timer = setInterval(advance, 2200);
    }

    function pause() {
        cancelAnimationFrame(raf);
        clearInterval(timer);
        raf = 0;
        timer = 0;
    }

    var onScreen = true;

    function sync() {
        if (onScreen && !document.hidden) run(); else pause();
    }

    if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
            onScreen = entries[0].isIntersecting;
            sync();
        }).observe(scene);
    }

    document.addEventListener("visibilitychange", sync);

    sync();

})();
