import {app, auth} from './firebaseConfig.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// --- Global cache ---
const db = getFirestore(app);
let allPages = [];
let currentPage = null;
let currentUser = null;

// --- Elements ---
const searchInput = document.getElementById('search-input');
const welcomeMessage = document.getElementById('welcome-message');
const disclamerInfo = document.getElementById('disclamer-info');
const searchResultsContainer = document.getElementById('search-results');

/**
 * Helper to safely extract access level from messy data
 */
function getAccessLevel(data) {
    // Check all common naming conventions
    const rawValue = data['access-level'] || data['accessLevel'] || data['access_level'] || 'public';
    // clean it up (e.g. "Admin " -> "admin")
    return String(rawValue).toLowerCase().trim();
}

/**
 * 1. Fetch Pages
 */
async function fetchAllPages() {
    try {
        const querySnapshot = await getDocs(collection(db, 'pages'));
        allPages = []; // Reset to prevent duplicates on re-runs

        querySnapshot.forEach((doc) => {
            const data = doc.data();

            if (data.type !== 'redirection') {
                const detectedAccess = getAccessLevel(data);

                // DEBUG LOG: Check your console to see what the code actually finds
                if(detectedAccess === 'admin') {
                    console.log(`Protected Page found: ${data.title}`);
                }

                allPages.push({
                    title: data.title,
                    path: data.fullPath,
                    accessLevel: detectedAccess, // stored as 'admin' or 'public'
                    content: (data.type === 'markdown' || data.type === 'html') ? data.content.toLowerCase() : ''
                });
            }
        });

        console.log(`Loaded ${allPages.length} pages.`);
        searchInput.placeholder = "Hledej v zápisech...";
        searchInput.disabled = false;

    } catch (err) {
        console.error("Failed to fetch pages:", err);
    }
}

/**
 * 2. Handle Search
 */
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();

    // Basic UI Toggle
    if (searchTerm.length < 2) {
        welcomeMessage.style.display = 'block';
        if(disclamerInfo) disclamerInfo.style.display = 'block';
        searchResultsContainer.style.display = 'none';
        searchResultsContainer.innerHTML = '';
        return;
    }

    // --- KEY FILTERING LOGIC ---
    const results = allPages.filter(page => {
        // 1. Access Check
        if (page.accessLevel === 'admin') {
            // If user is NOT logged in, hide this page immediately
            if (!currentUser) return false;
        }

        // 2. Search Term Check
        return page.path.toLowerCase().includes(searchTerm);
        // || page.content.includes(searchTerm) // Uncomment to search content too
    });

    welcomeMessage.style.display = 'none';
    if(disclamerInfo) disclamerInfo.style.display = 'none';
    searchResultsContainer.style.display = 'block';

    renderResults(results);
}

/**
 * 3. Render Results (Tree View)
 */
function renderResults(results) {
    searchResultsContainer.innerHTML = '';

    if (results.length === 0) {
        searchResultsContainer.innerHTML = '<h3>Nebyly nalezeny žádné výsledky.</h3>';
        return;
    }

    const treeRoot = buildTree(results);
    const treeContainer = document.createElement('ul');
    treeContainer.className = 'search-tree';

    Object.keys(treeRoot).sort().forEach(key => {
        treeContainer.appendChild(createTreeDOM(treeRoot[key]));
    });

    searchResultsContainer.appendChild(treeContainer);
}

function buildTree(results) {
    const root = {};

    results.forEach(page => {
        const parts = page.path.split('/').filter(p => p);
        let currentLevel = root;
        let currentPathAccumulator = '';

        parts.forEach((part, index) => {
            currentPathAccumulator += (index > 0 ? '/' : '') + part;

            if (!currentLevel[part]) {
                currentLevel[part] = {
                    children: {},
                    name: part,
                    pageData: null
                };

                // Check if this folder is actually a page itself
                const parentPageExists = allPages.find(p => p.path === currentPathAccumulator);

                // If the parent folder is a page, ensure we respect its privacy too
                if (parentPageExists) {
                    const isHidden = (parentPageExists.accessLevel === 'admin' && !currentUser);
                    if (!isHidden) {
                        currentLevel[part].pageData = parentPageExists;
                    }
                }
            }

            if (index === parts.length - 1) {
                currentLevel[part].pageData = page;
            }

            currentLevel = currentLevel[part].children;
        });
    });

    return root;
}

function createTreeDOM(node) {
    const li = document.createElement('li');
    let contentElement;

    if (node.pageData) {
        contentElement = document.createElement('a');
        contentElement.href = `/${node.pageData.path}`;
        contentElement.className = 'search-result-link';
        contentElement.textContent = node.pageData.title;

        // Optional: Visual indicator for admins so they know it's a hidden page
        if(node.pageData.accessLevel === 'admin') {
            contentElement.innerHTML += ' <span style="font-size:0.8em; color:red;">(Admin)</span>';
        }
    } else {
        contentElement = document.createElement('span');
        contentElement.className = 'search-result-folder';
        contentElement.textContent = node.name;
    }

    li.appendChild(contentElement);

    const childKeys = Object.keys(node.children);
    if (childKeys.length > 0) {
        const ul = document.createElement('ul');
        childKeys.sort().forEach(key => {
            ul.appendChild(createTreeDOM(node.children[key]));
        });
        li.appendChild(ul);
    }

    return li;
}

function setupAdminTools() {
    const adminBar = document.getElementById('admin-bar');
    if(!adminBar) return; // Safety if admin bar doesn't exist on page

    adminBar.innerHTML = `<div class="admin-controls"><div id="logged-in-buttons" style="display: flex; gap: 10px; align-items: center;"></div></div>`;

    const auth = getAuth(app);
    onAuthStateChanged(auth, (user) => {
        currentUser = user; // UPDATE GLOBAL STATE
        console.log("Auth State Changed. User is:", user ? "Logged In" : "Logged Out");

        // Trigger a re-search if the user types are already there, so results update instantly upon login/logout
        if(searchInput.value.length >= 2) {
            searchInput.dispatchEvent(new Event('input'));
        }

        const loggedInContainer = document.getElementById('logged-in-buttons');
        if (user) {
            let editButton = '';
            let deleteButton = '';
            // (Your existing button logic here...)
            loggedInContainer.innerHTML = `
            <a href="/admin/dashboard" className="btn btn-sm btn-white">Dashboard</a>
            <button class="btn btn-sm btn-danger" id="logout-button">Logout</button>
            `;

            document.getElementById('logout-button').addEventListener('click', () => {
                signOut(auth)
                    .then(() => {
                        console.log("User signed out successfully");
                        // The onAuthStateChanged listener will trigger automatically and update UI
                    })
                    .catch((error) => {
                        console.error("Error signing out:", error);
                    });
            });
        } else {
            loggedInContainer.innerHTML = '';
        }
    });
}

// --- Initialize ---
async function initializePage() {
    setupAdminTools();
}

initializePage();
fetchAllPages();
searchInput.addEventListener('input', handleSearch);