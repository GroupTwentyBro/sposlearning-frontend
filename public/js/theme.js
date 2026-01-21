const btn = document.getElementById("theme-toggle");
const themeLink = document.getElementById("theme-link");

// 1. Check local storage on load
const currentTheme = localStorage.getItem("theme");
if (currentTheme == "dark") {
    themeLink.href = "//style/variables-dark.css";
    btn.innerText = "Switch to Light Mode";
}

// 2. Button Click Event
btn.addEventListener("click", function() {
    // Check if current source contains "light"
    if (themeLink.href.includes("//style/variables-light.css")) {

        // Switch to Dark
        themeLink.href = "//style/variables-dark.css";
        btn.innerText = "Switch to Light Mode";
        localStorage.setItem("theme", "dark");

    } else {

        // Switch to Light
        themeLink.href = "//style/variables-light.css";
        btn.innerText = "Switch to Dark Mode";
        localStorage.setItem("theme", "light");

    }
});