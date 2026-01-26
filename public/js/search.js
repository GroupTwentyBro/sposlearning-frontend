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
    const rawValue = data['access-level'] || data['accessLevel'] || data['access_level'] || 'public';
    return String(rawValue).toLowerCase().trim();
}

/**
 * 1. Fetch Pages
 */
async function fetchAllPages() {
    try {
        const querySnapshot = await getDocs(collection(db, 'pages'));
        allPages = []; 

        querySnapshot.forEach((doc) => {
            const data = doc.data();

            if (data.type !== 'redirection') {
                const detectedAccess = getAccessLevel(data);

                if(detectedAccess === 'admin') {
                    console.log(`Protected Page found: ${data.title}`);
                }

                allPages.push({
                    title: data.title,
                    path: data.fullPath,
                    accessLevel: detectedAccess, 
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

    // A. Pre-calculate paths of pages that match the TITLE
    // We do this first so we don't have to re-scan for every single page.
    const matchedTitlePaths = allPages
        .filter(p => {
            // Security: Don't use a parent path if the user isn't allowed to see that parent
            if (p.accessLevel === 'admin' && !currentUser) return false;
            return p.title.toLowerCase().includes(searchTerm);
        })
        .map(p => p.path);

    // B. Filter the actual results
    const results = allPages.filter(page => {
        // 1. Access Check (Security)
        if (page.accessLevel === 'admin') {
            if (!currentUser) return false;
        }

        // 2. Direct Match Checks
        const matchesPath = page.path.toLowerCase().includes(searchTerm);
        const matchesTitle = page.title.toLowerCase().includes(searchTerm);

        // 3. Parent Logic Check
        // Does this page's path include any of the paths we found in Step A?
        const isChildOfTitleMatch = matchedTitlePaths.some(parentPath =>
            page.path.includes(parentPath)
        );

        return matchesPath || matchesTitle || isChildOfTitleMatch;
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
    if(!adminBar) return; 

    adminBar.innerHTML = `
        <div class="admin-controls">
            <div id="logged-in-buttons" style="display: flex; gap: 10px; align-items: center;">
            </div>
        </div>`;

    const auth = getAuth(app);
    onAuthStateChanged(auth, (user) => {
        currentUser = user; 
        console.log("Auth State Changed. User is:", user ? "Logged In" : "Logged Out");

        if(searchInput.value.length >= 2) {
            searchInput.dispatchEvent(new Event('input'));
        }

        const loggedInContainer = document.getElementById('logged-in-buttons');
        if (user) {
            loggedInContainer.innerHTML = `
            <a href="/admin/dashboard" class="btn btn-sm btn-white pc" id="homeButton">Dashboard</a>
            <button class="btn btn-sm btn-danger pc" id="logout-button">Logout</button>
            <a href="/admin/dashboard" class="btn btn-sm btn-white ctrl-btn mobile">
                <span class="icon">team_dashboard</span>
            </a>
            <button class="btn btn-sm btn-danger ctrl-btn mobile" id="logout-button">
                <span class="icon">logout</span>
            </button>
            `;

            document.getElementById('logout-button').addEventListener('click', () => {
                signOut(auth)
                    .then(() => {
                        console.log("User signed out successfully");
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
