// public/js/search.js

import {app, auth} from './firebaseConfig.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// --- Global cache for all pages ---
const db = getFirestore(app);
let allPages = [];
let currentPage = null;

// --- Get Elements from the HTML ---
const searchInput = document.getElementById('search-input');
const welcomeMessage = document.getElementById('welcome-message');
// const disclamerDev = document.getElementById('disclamer-dev');
const disclamerInfo = document.getElementById('disclamer-info');
const searchResultsContainer = document.getElementById('search-results');


/**
 * 1. Fetches all pages from Firestore on page load.
 */
async function fetchAllPages() {
    try {
        const querySnapshot = await getDocs(collection(db, 'pages'));


        querySnapshot.forEach((doc) => {
            const data = doc.data();

            if (data.type !== 'redirection') {
                allPages.push({
                    title: data.title, // The new human-readable title
                    path: data.fullPath, // The full URL path
                    // Only add content if it's text, not a file list
                    content: (data.type === 'markdown' || data.type === 'html') ? data.content.toLowerCase() : ''
                });
            }
        });

        console.log(`Loaded ${allPages.length} pages for search.`);
        searchInput.placeholder = "Hledej v zápisech...";
        searchInput.disabled = false;

    } catch (err) {
        console.error("Failed to fetch pages:", err);
        searchInput.placeholder = "Chyba při načítání...";
    }
}

/**
 * 2. Handles the search as the user types
 */
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();

    if (searchTerm.length < 2) {
        welcomeMessage.style.display = 'block';
        // disclamerDev.style.display = 'block';
        disclamerInfo.style.display = 'block';
        searchResultsContainer.style.display = 'none';
        searchResultsContainer.innerHTML = '';
        return;
    }

    const results = allPages.filter(page =>
        page.path.toLowerCase().includes(searchTerm) // || // Search the title
        // page.content.includes(searchTerm) // Search the content
    );

    welcomeMessage.style.display = 'none';
    // disclamerDev.style.display = 'none';
    disclamerInfo.style.display = 'none';
    searchResultsContainer.style.display = 'block';
    renderResults(results);
}

/**
 * 3. Renders the list of results
 */
function renderResults(results) {
    searchResultsContainer.innerHTML = '';

    if (results.length === 0) {
        searchResultsContainer.innerHTML = '<h3>Nebyly nalezeny žádné výsledky.</h3>';
        return;
    }

    // 1. Convert flat results to a tree structure
    const treeRoot = buildTree(results);

    // 2. Generate DOM from tree
    const treeContainer = document.createElement('ul');
    treeContainer.className = 'search-tree';

    // Append all top-level nodes
    Object.keys(treeRoot).sort().forEach(key => {
        treeContainer.appendChild(createTreeDOM(treeRoot[key]));
    });

    searchResultsContainer.appendChild(treeContainer);
}

function buildTree(results) {
    const root = {};

    results.forEach(page => {
        // Split path by '/', filter out empty strings
        const parts = page.path.split('/').filter(p => p);

        let currentLevel = root;
        let currentPathAccumulator = ''; // To reconstruct the full path as we go deep

        parts.forEach((part, index) => {
            // Reconstruct the path for the current level (e.g., "prg" then "prg/arrays")
            currentPathAccumulator += (index > 0 ? '/' : '') + part;

            // Create node if it doesn't exist
            if (!currentLevel[part]) {
                currentLevel[part] = {
                    children: {},
                    name: part,
                    pageData: null
                };

                // --- THE FIX IS HERE ---
                // Even if "prg" wasn't in the search results, check if it exists in our global database.
                // If it does, attach the data so it becomes a clickable link.
                const parentPageExists = allPages.find(p => p.path === currentPathAccumulator);
                if (parentPageExists) {
                    currentLevel[part].pageData = parentPageExists;
                }
            }

            // Ensure the specific result we found is definitely set (overwrites the check above if needed)
            if (index === parts.length - 1) {
                currentLevel[part].pageData = page;
            }

            // Move deeper
            currentLevel = currentLevel[part].children;
        });
    });

    return root;
}

/**
 * Helper: Recursively creates DOM elements for the tree
 */
function createTreeDOM(node) {
    const li = document.createElement('li');

    // 1. Create the content for this node
    let contentElement;

    if (node.pageData) {
        // It's a clickable page
        contentElement = document.createElement('a');
        contentElement.href = `/${node.pageData.path}`;
        contentElement.className = 'search-result-link';
        contentElement.textContent = node.pageData.title;
    } else {
        // It's just a folder structure (intermediate path not found in search results)
        contentElement = document.createElement('span');
        contentElement.className = 'search-result-folder';
        contentElement.textContent = node.name; // Use the path segment name
    }

    li.appendChild(contentElement);

    // 2. If it has children, recurse
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
    const logoutButton = document.getElementById('logout-button');

    // 1. Render the "Always Visible" part (The Home Button)
    // We use a container 'admin-controls' to keep styling consistent
    adminBar.innerHTML = `
        <div class="admin-controls">
            
            <div id="logged-in-buttons" style="display: flex; gap: 10px; align-items: center;"></div>
        </div>
    `;

    // 2. Check Auth state to add the rest
    const auth = getAuth(app);
    onAuthStateChanged(auth, (user) => {
        const loggedInContainer = document.getElementById('logged-in-buttons');

        if (user) {
            // User is logged in -> Add the extra buttons
            let editButton = '';
            let deleteButton = '';

            // Only show Edit/Delete if we are on a valid page (currentPage exists)
            if (currentPage) {
                // Edit Button logic
                if (currentPage.data.type === 'markdown' || currentPage.data.type === 'html') {
                    editButton = `<a href="/admin/edit.html?path=${currentPage.data.fullPath}" class="btn btn-sm btn-primary" id="edit-button">Upravit</a>`;
                }
                // Delete Button logic
                deleteButton = `<button id="delete-button" class="btn btn-sm btn-danger">Smazat</button>`;
            }

            // Inject buttons
            loggedInContainer.innerHTML = `
                ${editButton}
                ${deleteButton}
                <a href="/admin/dashboard" class="btn btn-sm btn-white">Dashboard</a>
                <button class="btn btn-sm btn-danger" id="logout-button">Logout</button>
            `;

            // Add event listener for delete (if it exists)
            const delBtn = document.getElementById('delete-button');
            if (delBtn) {
                delBtn.addEventListener('click', handleDeletePage);
            }
        } else {
            // User is not logged in -> Clear the container just in case
            loggedInContainer.innerHTML = '';
        }
    });


    logoutButton.addEventListener('click', async () => {
        try {
            await signOut(auth);
            console.log('User logged out.');
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
}

// --- 4. Initialize the search functionality ---
async function initializePage() {
    setupAdminTools();
}

initializePage();
fetchAllPages();
searchInput.addEventListener('input', handleSearch);