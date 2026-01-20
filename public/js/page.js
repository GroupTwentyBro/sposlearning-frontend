// public/js/page.js

import { app } from './firebaseConfig.js';
// Added Auth imports
import { getAuth, onAuthStateChanged, signOut, EmailAuthProvider,
    reauthenticateWithCredential } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
// Imports are complete
import { getFirestore, collection, query, where, getDoc, getDocs, doc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Initialize
const db = getFirestore(app);
const contentContainer = document.getElementById('wiki-content-container');


// This will store the loaded page's ID and data
let currentPage = null;

const mathExtension = {
    name: 'math',
    level: 'inline',
    start(src) { return src.indexOf('$'); },
    tokenizer(src) {
        // Match $$ block math $$
        const blockRule = /^\$\$\s*([\s\S]*?)\s*\$\$/;
        const blockMatch = blockRule.exec(src);
        if (blockMatch) {
            return { type: 'text', raw: blockMatch[0], text: blockMatch[0] };
        }
        // Match $ inline math $
        const inlineRule = /^\$((?:[^\$\\]|\\.)*)\$/;
        const inlineMatch = inlineRule.exec(src);
        if (inlineMatch) {
            return { type: 'text', raw: inlineMatch[0], text: inlineMatch[0] };
        }
    },
    renderer(token) { return token.text; }
};

marked.use({ extensions: [mathExtension] });

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
            contentContainer.classList.add('tex2jax_process');
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

        if (window.MathJax && window.MathJax.typesetPromise) {
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

            const logoutButton = document.getElementById('logout-button');
            logoutButton.addEventListener('click', async () => {
                try {
                    await signOut(auth);
                    console.log('User logged out.');
                    // Optional: redirect to home after logout
                    window.location.reload();
                } catch (error) {
                    console.error('Logout error:', error);
                }
            });

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
}

/**
 * Handles the delete page logic
 */
async function handleDeletePage() {
    if (!currentPage) return;

    const auth = getAuth(app);
    const user = auth.currentUser;

    if (!user) {
        alert("Musíte být přihlášeni.");
        return;
    }

    // Use our new custom modal instead of prompt()
    const password = await requestPassword();

    if (!password) return; // User cancelled or entered nothing

    try {
        // Show a temporary "processing" state if you like
        const credential = EmailAuthProvider.credential(user.email, password);

        // Re-authenticate
        await reauthenticateWithCredential(user, credential);

        // Proceed with deletion
        await deleteDoc(doc(db, 'pages', currentPage.id));

        alert('Stránka byla úspěšně smazána.');
        window.location.href = '/';

    } catch (error) {
        console.error('Error during deletion:', error);

        if (error.code === 'auth/wrong-password') {
            alert('Chybné heslo. Stránka nebyla smazána.');
        } else if (error.code === 'auth/too-many-requests') {
            alert('Příliš mnoho pokusů. Zkuste to později.');
        } else {
            alert('Chyba: ' + error.message);
        }
    }
}

/**
 * Custom Promise-based password prompt
 */
function requestPassword() {
    return new Promise((resolve) => {
        const overlay = document.getElementById('password-modal-overlay');
        const input = document.getElementById('modal-password-input');
        const confirmBtn = document.getElementById('modal-confirm-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');

        overlay.style.display = 'flex';
        input.value = '';
        input.focus();

        const handleConfirm = () => {
            const val = input.value;
            cleanup();
            resolve(val);
        };

        const handleCancel = () => {
            cleanup();
            resolve(null);
        };

        const cleanup = () => {
            overlay.style.display = 'none';
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);

        // Allow pressing "Enter" to submit
        input.onkeydown = (e) => { if (e.key === 'Enter') handleConfirm(); };
    });
}

function setupFeedbackLink() {
    const feedbackLink = document.getElementById("feedback-button");
    if (feedbackLink && !feedbackLink.href.includes('?page=' + window.location.pathname)) {
        feedbackLink.href += window.location.pathname;
    }
}

async function initializePage() {
    await loadContent();
    setupAdminTools();
    setupFeedbackLink();
}

initializePage();