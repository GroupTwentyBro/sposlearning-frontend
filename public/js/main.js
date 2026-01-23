document.addEventListener("DOMContentLoaded", () => {

    // --- Syntax Highlighting (if used) ---
    if (typeof hljs !== 'undefined') {
        hljs.highlightAll();
    }

    // --- Theme Toggle Logic ---
    const btn = document.getElementById("theme-toggle");
    const themeLink = document.getElementById("theme-link");

    // Helper: Update button visual state
    function updateButtonState(theme) {
        if (theme === "dark") {
            btn.classList.add("is-dark");
        } else {
            btn.classList.remove("is-dark");
        }
    }

    // 1. Initial State Check (Visuals only)
    // The actual CSS swap already happened in <head>, we just match the button to it.
    if (themeLink.href.includes("variables-dark.css")) {
        updateButtonState("dark");
    } else {
        updateButtonState("light");
    }

    // 2. Button Click Event
    btn.addEventListener("click", function() {
        // Check current state based on the href
        const isDark = themeLink.href.includes("variables-dark.css");

        if (isDark) {
            // Switch to Light
            themeLink.href = "/style/variables-light.css";
            localStorage.setItem("theme", "light");
            updateButtonState("light");
        } else {
            // Switch to Dark
            themeLink.href = "/style/variables-dark.css";
            localStorage.setItem("theme", "dark");
            updateButtonState("dark");
        }
    });
});