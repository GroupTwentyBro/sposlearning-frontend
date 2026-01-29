import { app, auth } from '../js/firebaseConfig.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const db = getFirestore(app);
const container = document.getElementById('secure-container');

// 1. Check Auth
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log('User verified:', user.uid);
        try {
            await loadDashboardContent();
        } catch (error) {
            console.error("Access denied:", error);
            container.innerHTML = `<div class="alert alert-danger text-center m-5"><h1>403</h1><p>You are not an authorized administrator.</p></div>`;
        }
    } else {
        console.log('No user, redirecting...');
        window.location.href = '/'; // Or your login page
    }
});

// 2. Fetch HTML from Firestore
async function loadDashboardContent() {
    // Attempt to fetch the protected dashboard HTML
    const docRef = doc(db, "admin", "dashboard");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        // INJECT THE HTML
        container.innerHTML = docSnap.data().html;

        // NOW initialize buttons/listeners (because they finally exist in the DOM)
        initializeScripts();
    } else {
        container.innerHTML = "<h3>Error: Dashboard content not found in database.</h3>";
    }
}

// 3. Attach Listeners (Moved from HTML to here)
function initializeScripts() {
    // --- Logout Logic ---
    const logoutBtn = document.getElementById('logout-button');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => window.location.href = '/');
        });
    }

    // --- Theme Logic ---
    // We re-attach these listeners because the buttons were just created
    const darkBtn = document.getElementById("darktheme-btn");
    const lightBtn = document.getElementById("lighttheme-btn");
    const mikeBtn = document.getElementById("miketheme-btn");
    const hueshiftToggle = document.getElementById("hueSlider");
    const root = document.documentElement;
    const themeLink = document.getElementById("theme-link");

    // Re-define applyTheme locally or ensure it's global.
    // For safety, let's just trigger the window function we defined in HTML
    // or simply copy the logic here if preferred.

    if(darkBtn) darkBtn.addEventListener("click", () => window.applyTheme("dark"));
    if(lightBtn) lightBtn.addEventListener("click", () => window.applyTheme("light"));
    if(mikeBtn) mikeBtn.addEventListener("click", () => window.applyTheme("mike"));

    if(hueshiftToggle) {
        // Set initial slider value if using hueshift
        if (localStorage.getItem("theme") === 'hueshift') {
            hueshiftToggle.value = localStorage.getItem("hue-val") || 0;
        }

        hueshiftToggle.addEventListener('input', (e) => {
            const val = e.target.value;
            localStorage.setItem("hue-val", val);
            root.style.setProperty('--hue-val', val);

            if (localStorage.getItem("theme") !== "hueshift") {
                window.applyTheme("hueshift");
            }
        });
    }
}

// Expose applyTheme to window so the inline HTML script can see it (optional)
window.applyTheme = function(themeName) {
    const root = document.documentElement;
    const themeLink = document.getElementById("theme-link");
    let newHref = "";

    if (themeName === 'hueshift') {
        newHref = "/style/theme-hueshift.css";
        root.style.setProperty('--hue-val', localStorage.getItem("hue-val") || 0);
    } else if (themeName === 'mike') newHref = "/style/theme-mike.css";
    else if (themeName === 'dark') newHref = "/style/theme-dark.css";
    else newHref = "/style/theme-light.css";

    if (themeLink.getAttribute("href") !== newHref) {
        themeLink.href = newHref;
    }
    localStorage.setItem("theme", themeName);
}