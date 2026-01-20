// public/admin/add-page.js

// --- Imports ---
import { auth } from '../js/firebaseConfig.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    getFirestore,
    serverTimestamp,
    getDoc,
    doc,
    setDoc,
    collection, // <--- ADDED
    getDocs     // <--- ADDED
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
// --- !! IMPORTANT: CONFIGURE CLOUDINARY !! ---
const CLOUDINARY_CLOUD_NAME = "dmrefvudz"; // <-- PASTE YOUR CLOUD NAME
const CLOUDINARY_UPLOAD_PRESET = "sposlearning-upload-v1"; // <-- PASTE YOUR UPLOAD PRESET NAME
// ------------------------------------------------

// --- Initialize ---
const db = getFirestore();

let currentPathSelection = "/"; // Defaults to root
let allPagesCache = []; // Store fetched pages here

// --- Get Elements ---
let logoutButton, pageForm, pageTypeSelect, saveButton;
let editorMarkdown, editorHTML, editorFiles;
let editorRedirection;
let pageTitle, pagePath;
let statusSuccess, statusError;

const pickPathButton = document.getElementById('pickpath-button');
const pathModal = document.getElementById('path-picker-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalTreeContainer = document.getElementById('path-tree-container');
const modalSelectedPathDisplay = document.getElementById('modal-selected-path');
const modalSelectBtn = document.getElementById('modal-select-btn');
const modalNewFolderBtn = document.getElementById('modal-new-folder-btn');

// --- Auth Check (The Page "Guard") ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('Welcome, admin user:', user.email);
        initializeDashboard();
    } else {
        console.log('No user logged in, redirecting...');
        window.location.href = '../admin';
    }
});

// --- Main Function ---
function initializeDashboard() {
    // Get all HTML elements
    logoutButton = document.getElementById('logout-button');
    pageForm = document.getElementById('page-form');
    pageTypeSelect = document.getElementById('page-type');
    saveButton = document.getElementById('save-button');

    editorMarkdown = document.getElementById('editor-markdown');
    editorHTML = document.getElementById('editor-html');
    editorFiles = document.getElementById('editor-files');
    editorRedirection = document.getElementById('editor-redirection');

    pageTitle = document.getElementById('page-title');
    pagePath = document.getElementById('page-path');

    statusSuccess = document.getElementById('page-success-status');
    statusError = document.getElementById('page-error-status');

    enableTabIndentation(document.getElementById('md-content'));
    enableTabIndentation(document.getElementById('html-content'));

    // --- 1. Logout ---
    logoutButton.addEventListener('click', async () => {
        try {
            await signOut(auth);
            console.log('User logged out.');
        } catch (error) {
            console.error('Logout error:', error);
        }
    });

    // --- 2. Show/Hide Editors based on Dropdown ---
    pageTypeSelect.addEventListener('change', (e) => {
        const type = e.target.value;

        editorMarkdown.style.display = (type === 'markdown') ? 'block' : 'none';
        editorHTML.style.display = (type === 'html') ? 'block' : 'none';
        editorFiles.style.display = (type === 'files') ? 'block' : 'none';
        editorRedirection.style.display = (type === 'redirection') ? 'block' : 'none';
    });

    // --- 3. Main Save Logic ---
    pageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';
        statusSuccess.textContent = '';
        statusError.textContent = '';

        try {
            // 1. Get the raw input (e.g., "/prg/arrays/my-file")
            let rawInput = pagePath.value.trim();

            // 2. Remove trailing slash if it exists (so "/prg/file/" becomes "/prg/file")
            // This ensures the last segment is treated as the file name, not an empty folder
            if (rawInput.endsWith('/')) {
                rawInput = rawInput.slice(0, -1);
            }

            // 3. LOGIC TO SPLIT PATH AND NAME
            const lastSlashIndex = rawInput.lastIndexOf('/');

            let path = ''; // The folder structure
            let name = ''; // The file slug

            if (lastSlashIndex === -1) {
                // Case: "myfile" (No slashes at all)
                path = '/';
                name = rawInput;
            } else if (lastSlashIndex === 0) {
                // Case: "/myfile" (Root level file)
                path = '/';
                name = rawInput.substring(1);
            } else {
                // Case: "/prg/arrays/myfile"
                path = rawInput.substring(0, lastSlashIndex); // "/prg/arrays"
                name = rawInput.substring(lastSlashIndex + 1); // "myfile"
            }

            // Validate that we actually have a name
            if (!name) {
                throw new Error("You must provide a page name at the end of the path.");
            }

            // 4. Construct Full Path for ID (No leading slashes)
            // e.g. "prg/arrays/myfile"
            let fullPath = (path === '/') ? name : `${path}/${name}`;
            fullPath = fullPath.replace(/^\/+/, ''); // Remove leading slash just in case

            // 5. Create Document ID (Replace / with |)
            const newDocId = fullPath.replace(/\//g, '|');

            // Check if exists
            const docRef = doc(db, 'pages', newDocId);
            const existingDoc = await getDoc(docRef);
            if (existingDoc.exists()) {
                throw new Error(`A page already exists at: /${fullPath}`);
            }

            // Prepare Data
            const pageData = {
                title: pageTitle.value,
                name: name,         // Saved separately
                path: path,         // Saved separately
                fullPath: fullPath, // Saved combined
                type: pageTypeSelect.value,
                content: null,
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser.email
            };

            // ... (Rest of your saving logic handles content based on type) ...
            if (pageData.type === 'markdown') {
                pageData.content = document.getElementById('md-content').value;
            } else if (pageData.type === 'html') {
                pageData.content = document.getElementById('html-content').value;
            } else if (pageData.type === 'redirection') {
                let url = document.getElementById('redirect-url').value.trim();
                // ... url logic ...
                pageData.content = url;
            } else if (pageData.type === 'files') {
                const fileInput = document.getElementById('file-upload-input');
                if (fileInput.files.length > 0) {
                    pageData.content = await uploadFilesToCloudinary(fileInput.files);
                } else {
                    pageData.content = [];
                }
            }

            // Final Save
            statusSuccess.textContent = 'Saving page to database...';
            await setDoc(docRef, pageData);

            console.log('Page saved with ID:', newDocId);
            statusSuccess.textContent = `Success! Page created at /${fullPath}`;
            pageForm.reset();
            pageTypeSelect.dispatchEvent(new Event('change'));

        } catch (error) {
            console.error('Save failed:', error);
            statusError.textContent = `Error: ${error.message}`;
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Save Page';
        }
    });

    pickPathButton.addEventListener('click', async (e) => {
        e.preventDefault(); // Prevent form submit
        pathModal.style.display = 'flex';
        modalTreeContainer.innerHTML = 'Loading directory structure...';
        currentPathSelection = "/"; // Reset selection to root
        updateSelectionDisplay();

        await fetchAndBuildTree();
    });

    closeModalBtn.addEventListener('click', () => {
        pathModal.style.display = 'none';
    });

    // Close on click outside
    pathModal.addEventListener('click', (e) => {
        if (e.target === pathModal) {
            pathModal.style.display = 'none';
        }
    });

    // 3. Select Button (Confirm)
    modalSelectBtn.addEventListener('click', () => {
        // Format: Ensure slashes at start and end
        let formattedPath = currentPathSelection;

        // Remove existing slashes to clean up, then add them back
        formattedPath = formattedPath.replace(/^\/+|\/+$/g, '');

        // Result: /path/to/folder/
        // If empty (root), it becomes // which we fix to /
        formattedPath = `/${formattedPath}/`.replace('//', '/');

        // Update the Input
        document.getElementById('page-path').value = formattedPath;

        // Close Modal
        pathModal.style.display = 'none';
    });

    // 4. New Folder Button
    modalNewFolderBtn.addEventListener('click', () => {
        const folderName = prompt("Enter new folder name (no spaces/slashes recommended):");
        if (folderName) {
            // Clean the name
            const cleanName = folderName.trim().replace(/\//g, '');

            // Append to current selection
            if (currentPathSelection.endsWith('/')) {
                currentPathSelection += cleanName;
            } else {
                currentPathSelection += '/' + cleanName;
            }

            // Update UI
            updateSelectionDisplay();
            // Re-render tree (optional, but good to deselect the previous node visual)
            renderModalTree(buildTreeFromCache());
        }
    });
}

async function fetchAndBuildTree() {
    try {
        const querySnapshot = await getDocs(collection(db, 'pages'));
        allPagesCache = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // We only need the full path
            if(data.fullPath) {
                allPagesCache.push(data.fullPath);
            }
        });

        const root = buildTreeFromCache();
        renderModalTree(root);

    } catch (error) {
        console.error("Error fetching pages:", error);
        modalTreeContainer.innerHTML = `<p class="text-danger">Failed to load tree.</p>`;
    }
}

function buildTreeFromCache() {
    const root = {};

    allPagesCache.forEach(path => {
        const parts = path.split('/').filter(p => p);
        let currentLevel = root;

        parts.forEach((part) => {
            if (!currentLevel[part]) {
                currentLevel[part] = {
                    name: part,
                    children: {}
                };
            }
            currentLevel = currentLevel[part].children;
        });
    });
    return root;
}

function renderModalTree(treeRoot) {
    modalTreeContainer.innerHTML = '';

    // Create Root "Home" node
    const rootUl = document.createElement('ul');
    rootUl.className = 'modal-tree';

    const rootLi = document.createElement('li');
    const rootDiv = document.createElement('div');
    rootDiv.className = 'tree-item';
    if(currentPathSelection === '/') rootDiv.classList.add('selected');
    rootDiv.innerHTML = `<icon>home</icon> Root (/)`;

    rootDiv.addEventListener('click', () => {
        selectPath('/');
        // Remove other selected classes
        document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
        rootDiv.classList.add('selected');
    });

    rootLi.appendChild(rootDiv);

    // Append children
    const childrenContainer = document.createElement('ul');
    Object.keys(treeRoot).sort().forEach(key => {
        childrenContainer.appendChild(createTreeNodeDOM(treeRoot[key], ""));
    });

    rootLi.appendChild(childrenContainer);
    rootUl.appendChild(rootLi);
    modalTreeContainer.appendChild(rootUl);
}

function createTreeNodeDOM(node, parentPath) {
    const li = document.createElement('li');

    // Construct full path
    const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;

    // Check for children
    const childKeys = Object.keys(node.children);
    const hasChildren = childKeys.length > 0;

    // Main Container for this row
    const div = document.createElement('div');
    div.className = hasChildren ? 'tree-item folder' : 'tree-item file';

    // --- 1. EXPANDER ICON (Chevron) ---
    // Only folders get the toggle arrow. Files get a blank spacer for alignment.
    if (hasChildren) {
        const toggleIcon = document.createElement('icon');
        toggleIcon.className = 'tree-toggle-icon material-symbols-outlined';
        toggleIcon.innerText = 'chevron_right'; // Default arrow pointing right

        // Click event: Toggle visibility of the children UL
        toggleIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            const ul = li.querySelector('.tree-children');
            if (ul) {
                // Toggle CSS classes
                ul.classList.toggle('expanded');
                toggleIcon.classList.toggle('expanded');
            }
        });

        div.appendChild(toggleIcon);
    } else {
        // Spacer for alignment if no children
        const spacer = document.createElement('span');
        spacer.className = 'tree-spacer';
        div.appendChild(spacer);
    }

    // --- 2. FOLDER/FILE ICON + NAME ---
    // We wrap this in a span so we can click just this part to select,
    // without triggering the expand/collapse if we don't want to.
    const contentSpan = document.createElement('span');
    contentSpan.style.display = 'inline-flex';
    contentSpan.style.alignItems = 'center';
    contentSpan.style.gap = '5px';

    const iconType = hasChildren ? 'folder' : 'description';
    contentSpan.innerHTML = `<icon>${iconType}</icon> ${node.name}`;

    // --- 3. SELECTION LOGIC ---
    // Clicking the text/icon selects the path
    div.addEventListener('click', (e) => {
        e.stopPropagation();
        selectPath('/' + fullPath);

        // Visual selection
        document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');

        // OPTIONAL: If you also want clicking the row to expand the folder, uncomment this:
        /*
        if(hasChildren) {
             const toggle = div.querySelector('.tree-toggle-icon');
             if(toggle) toggle.click(); // Programmatically click the chevron
        }
        */
    });

    // Check if this is the currently selected path (for initial load highlighting)
    if(currentPathSelection === fullPath || currentPathSelection === `/${fullPath}`) {
        div.classList.add('selected');
        // Optional: If selected, you might want to auto-expand parents,
        // but that requires complex parent-traversal logic.
        // For now, it stays minimized by default as requested.
    }

    div.appendChild(contentSpan);
    li.appendChild(div);

    // --- 4. CHILDREN CONTAINER (Hidden by Default) ---
    if (hasChildren) {
        const ul = document.createElement('ul');
        ul.className = 'tree-children'; // CSS hides this by default

        childKeys.sort().forEach(key => {
            ul.appendChild(createTreeNodeDOM(node.children[key], fullPath));
        });
        li.appendChild(ul);
    }

    return li;
}

function selectPath(path) {
    currentPathSelection = path;
    updateSelectionDisplay();
}

function updateSelectionDisplay() {
    // Format visual display to look like a file path
    let display = currentPathSelection;
    if(!display.startsWith('/')) display = '/' + display;
    if(!display.endsWith('/')) display = display + '/';

    modalSelectedPathDisplay.innerText = display;
}

/**
 * Uploads multiple files to Cloudinary and returns an array of file objects
 */
async function uploadFilesToCloudinary(files) {
    const fileList = [];
    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;

    // Loop through each file and upload it
    for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();
        if (result.error) {
            throw new Error(`Cloudinary upload failed: ${result.error.message}`);
        }

        fileList.push({
            name: result.original_filename,
            url: result.secure_url,
            bytes: result.bytes,
            format: result.format
        });
    }

    return fileList; // Returns the array to be saved in Firestore
}

// --- HELPER FUNCTION FOR TAB INDENTATION ---
function enableTabIndentation(textarea) {
    textarea.addEventListener('keydown', function(e) {
        // Check for Tab key
        if (e.key === 'Tab') {
            e.preventDefault(); // Stop the browser from changing focus

            // Get current cursor position
            var start = this.selectionStart;
            var end = this.selectionEnd;

            // --- Handle SHIFT + TAB (Un-indent) ---
            if (e.shiftKey) {
                // Find the start of the current line
                let lineStart = start;
                while (lineStart > 0 && this.value[lineStart - 1] !== '\n') {
                    lineStart--;
                }

                // If the line starts with a tab, remove it
                if (this.value.substring(lineStart, lineStart + 1) === '\t') {
                    this.value = this.value.substring(0, lineStart) + this.value.substring(lineStart + 1);
                    // Adjust cursor
                    this.selectionStart = start - 1;
                    this.selectionEnd = end - 1;
                }
            }

            // --- Handle TAB (Indent) ---
            else {
                // Insert a tab character
                this.value = this.value.substring(0, start) + '\t' + this.value.substring(end);

                // Put cursor back in the right place
                this.selectionStart = this.selectionEnd = start + 1;
            }
        }
    });
}