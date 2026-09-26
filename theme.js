// Theme toggle: dark (default) / light, persisted in localStorage.
// (The initial theme is applied by an inline script in <head> to avoid a flash.)
function toggleTheme() {
    var isLight = document.documentElement.getAttribute("data-theme") === "light";
    if (isLight) {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("rr-theme", "dark");
    } else {
        document.documentElement.setAttribute("data-theme", "light");
        localStorage.setItem("rr-theme", "light");
    }
    var thumbs = document.querySelectorAll(".theme-toggle-thumb");
    thumbs.forEach(function (t) {
        t.textContent = document.documentElement.getAttribute("data-theme") === "light" ? "☀️" : "🌙";
    });
    document.dispatchEvent(new Event("themechange"));
}

document.addEventListener("DOMContentLoaded", function () {
    var thumbs = document.querySelectorAll(".theme-toggle-thumb");
    var isLight = document.documentElement.getAttribute("data-theme") === "light";
    thumbs.forEach(function (t) {
        t.textContent = isLight ? "☀️" : "🌙";
    });
});
