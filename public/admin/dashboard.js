// public/admin/dashboard.js

// --- Imports ---
import { auth } from '../js/firebaseConfig.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, serverTimestamp, getDoc, doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// --- !! IMPORTANT: CONFIGURE CLOUDINARY !! ---
const CLOUDINARY_CLOUD_NAME = "dmrefvudz"; // <-- PASTE YOUR CLOUD NAME
const CLOUDINARY_UPLOAD_PRESET = "sposlearning-upload-v1"; // <-- PASTE YOUR UPLOAD PRESET NAME
// ------------------------------------------------

// --- Initialize ---
const db = getFirestore();

// --- Get Elements ---
let logoutButton, pageForm, pageTypeSelect, saveButton;
let editorMarkdown, editorHTML, editorFiles;
let editorRedirection;
let pageTitle, pagePath, pageName;
let statusSuccess, statusError;

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
    pageName = document.getElementById('page-name');

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
            // --- 3a. Clean the fullPath ---
            let path = pagePath.value.trim();
            let name = pageName.value.trim();
            let fullPath = (path) ? `${path}/${name}` : name;
            // Remove leading/trailing slashes
            fullPath = fullPath.replace(/^\/+|\/+$/g, '');

            // --- 3b. Create the new Document ID ---
            const newDocId = fullPath.replace(/\//g, '|'); // e.g., "wep/html/div" -> "wep|html|div"
            if (newDocId.length === 0) {
                throw new Error("Page path and name cannot be empty.");
            }

            // --- 3c. Check if page already exists (using the new ID) ---
            const docRef = doc(db, 'pages', newDocId);
            const existingDoc = await getDoc(docRef); // We need getDoc, add it to the import
            if (existingDoc.exists()) {
                throw new Error(`A page already exists at this path: /${fullPath}`);
            }

            const pageData = {
                title: pageTitle.value,
                name: name,
                path: path,
                fullPath: fullPath,
                type: pageTypeSelect.value,
                content: null,
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser.email
            };

            // --- 3d. Get content based on type ---
            if (pageData.type === 'markdown') {
                pageData.content = document.getElementById('md-content').value;
            } else if (pageData.type === 'html') {
                pageData.content = document.getElementById('html-content').value;
            } else if (pageData.type === 'redirection') {
                let url = document.getElementById('redirect-url').value.trim();
                if (!url) {
                    throw new Error('Please enter a destination URL.');
                }

                // Check if it's NOT an external link
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    // Make it an absolute internal link
                    if (!url.startsWith('/')) {
                        url = '/' + url;
                    }
                }
                pageData.content = url; // Save the corrected URL
            } else if (pageData.type === 'files') {
                // ... (your file upload logic is unchanged) ...
                pageData.content = await uploadFilesToCloudinary(files);
            }

            // --- 3e. Save to Firestore using setDoc ---
            statusSuccess.textContent = 'Saving page to database...';
            // Use setDoc with our custom docRef instead of addDoc
            await setDoc(docRef, pageData);

            console.log('Page saved with ID:', newDocId);
            statusSuccess.textContent = `Success! Page created at /${fullPath}`;
            pageForm.reset();
            // Reset editor view
            pageTypeSelect.dispatchEvent(new Event('change'));

        } catch (error) {
            console.error('Save failed:', error);
            statusError.textContent = `Error: ${error.message}`;
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Save Page';
        }
    });
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