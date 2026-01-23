document.addEventListener("DOMContentLoaded", () => {

    // --- Syntax Highlighting ---
    if (typeof hljs !== 'undefined') {
        hljs.highlightAll();
    }

    // --- Theme Toggle Logic ---
    const btn = document.getElementById("theme-toggle");
    const themeLink = document.getElementById("theme-link");

    // Helper: Update button visual state
    function updateButtonState(theme) {
        if (theme === "dark") {
            btn.classList.add("is-dark"); // Adds class for moon icon
        } else {
            btn.classList.remove("is-dark"); // Removes class for sun icon
        }
    }

    // 1. Initial State Check
    // We check what the <head> script decided.
    // If the href is dark, we set the button to dark.
    if (themeLink.href.includes("variables-dark.css")) {
        updateButtonState("dark");
    } else {
        updateButtonState("light");
    }

    // 2. Button Click Event
    btn.addEventListener("click", function() {
        if (themeLink.href.includes("variables-light.css")) {
            // Switch to Dark
            themeLink.href = "/style/variables-dark.css";
            localStorage.setItem("theme", "dark");
            updateButtonState("dark");
        } else {
            // Switch to Light
            themeLink.href = "/style/variables-light.css";
            localStorage.setItem("theme", "light");
            updateButtonState("light");
        }
    });
});