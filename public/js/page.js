// public/js/page.js

import { app } from './firebaseConfig.js';
// Added Auth imports
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
// Imports are complete
import { getFirestore, collection, query, where, getDoc, getDocs, doc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Initialize
const db = getFirestore(app);
const contentContainer = document.getElementById('wiki-content-container');

// This will store the loaded page's ID and data
let currentPage = null;

/**
 * Main function to load and render content
 */
async function loadContent() {
    let fullPath = window.location.pathname.substring(1);
    fullPath = fullPath.replace(/\/+$/, '');

    if (fullPath === '') {
        window.location.href = '/';
        return;
    }

    try {
        const newDocId = fullPath.replace(/\//g, '|');
        const docRef = doc(db, 'pages', newDocId);
        let docSnap = await getDoc(docRef);
        let pageDoc = docSnap; // This will hold the final document

        // 2. If not found, try searching by the fullPath field (OLD method)
        if (!docSnap.exists()) {
            console.log("Page not found with new ID, trying old query method...");
            const pagesRef = collection(db, 'pages');
            const q = query(pagesRef, where("fullPath", "==", fullPath));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                console.log("Found page with old ID.");
                pageDoc = querySnapshot.docs[0]; // Get the document from the query
            }
        }

        // 3. Now, check if we found a page by *either* method
        if (!pageDoc.exists()) {
            renderError(fullPath);
            return;
        }

        // 4. We found it! Get the data.
        const pageData = pageDoc.data();
        currentPage = { id: pageDoc.id, data: pageData }; // Store the ID (new or old)

        // Set the browser tab title
        document.title = pageData.title;

        // 6. Render the content based on its type
        if (pageData.type === 'markdown') {
            contentContainer.innerHTML = marked.parse(pageData.content, { breaks: true });
        } else if (pageData.type === 'html') {
            contentContainer.innerHTML = pageData.content;
        } else if (pageData.type === 'files') {
            renderFileExplorer(pageData.title, pageData.content);
        } else if (pageData.type === 'redirection') {
            const destination = pageData.content;

            // Check if it's an external link
            if (destination.startsWith('http://') || destination.startsWith('https://')) {
                // It's external. Use replace() to act like a real redirect.
                window.location.replace(destination);
            } else {
                // It's internal. Use href to navigate like a normal link.
                window.location.href = destination;
            }
        }

        contentContainer.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });

        if (window.MathJax) {
            // Tell MathJax to scan the new content for equations
            window.MathJax.typesetPromise([contentContainer]).catch((err) => console.log(err));
        }

    } catch (error) {
        console.error("Error loading content:", error);
        renderError(fullPath, error);
    }
}

/**
 * Helper function to render the new File Explorer page
 */
function renderFileExplorer(title, files) {
    let fileListHtml = files.map(file => {
        // Simple file size formatter
        const size = (file.bytes / (1024 * 1024) > 1)
            ? `${(file.bytes / (1024 * 1024)).toFixed(2)} MB`
            : `${(file.bytes / 1024).toFixed(0)} KB`;

        return `
            <a href="${file.url}" target="_blank" rel="noopener noreferrer" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                ${file.name}
                <span class="badge badge-primary badge-pill">${size}</span>
            </a>
        `;
    }).join('');

    contentContainer.innerHTML = `
        <h1>${title}</h1>
        <p>Soubory ke stažení:</p>
        <div class="list-group">
            ${fileListHtml}
        </div>
    `;
}

/**
 * Helper function to show a 404 error
 */
function renderError(slug) {
    contentContainer.innerHTML = `
        <h1>404 - Stránka nenalezena</h1>
        <hr>
        <p>Bohužel, stránka s názvem "<code>${slug}</code>" neexistuje.</p>
        <a href="/">Vrátit se domů</a>
    `;
}

// --- NEW Admin Tools Section ---

/**
 * Adds Edit/Delete buttons if the user is logged in
 */
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

/**
 * Handles the delete page logic
 */
async function handleDeletePage() {
    if (!currentPage) return;

    const title = currentPage.data.title;
    if (confirm(`Opravdu chcete smazat stránku "${title}"?\n\nTato akce je nevratná.`)) {
        try {
            // Delete the document from Firestore using its unique ID
            await deleteDoc(doc(db, 'pages', currentPage.id));
            alert('Stránka byla smazána.');
            window.location.href = '/'; // Redirect to home page
        } catch (error) {
            console.error('Error deleting page:', error);
            alert('Chyba: Stránka nemohla být smazána.');
        }
    }
}


// --- NEW Run the app ---
// We create an async function to make sure we wait
// for the page to load BEFORE we try to add the admin buttons.
async function initializePage() {
    await loadContent(); // 1. Wait for page data to load (and set currentPage)
    setupAdminTools(); // 2. Now set up admin tools, which depend on currentPage
}

initializePage();