import { app, auth } from '../js/firebaseConfig.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const db = getFirestore(app);
const listContainer = document.getElementById('feedback-list');
const loading = document.getElementById('loading');

// New DOM Elements
const sortSelect = document.getElementById('sort-select');
const hideResolvedCheckbox = document.getElementById('hide-resolved');

// State Variables
let currentSort = 'desc'; // Default to Recent
let hideResolved = false;

onAuthStateChanged(auth, (user) => {
    if (user) {
        // Initial load
        loadFeedback();
        setupControls();
    } else {
        // Redirect or handle unauthorized
        window.location.href = '/admin';
    }
});

function setupControls() {
    // Listen for Sort changes
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        loadFeedback();
    });

    // Listen for Filter changes
    hideResolvedCheckbox.addEventListener('change', (e) => {
        hideResolved = e.target.checked;
        loadFeedback();
    });
}

async function loadFeedback() {
    // Show loading state while fetching
    loading.style.display = 'block';
    listContainer.innerHTML = '';

    try {
        // Dynamic Query: Uses 'currentSort' (desc or asc)
        const q = query(collection(db, 'feedback'), orderBy('timestamp', currentSort));
        const snapshot = await getDocs(q);

        loading.style.display = 'none';

        if (snapshot.empty) {
            listContainer.innerHTML = '<p class="text-center">No feedback found.</p>';
            return;
        }

        let visibleCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            const id = doc.id;

            // --- FILTER LOGIC ---
            // If "Hide Resolved" is checked AND the item is resolved, skip it.
            if (hideResolved && data.resolved) {
                return;
            }

            visibleCount++;

            // Format Preview (max 100 chars)
            let preview = data.message || '';
            if (preview.length > 100) preview = preview.substring(0, 100) + '...';

            // Create Element
            const a = document.createElement('a');
            a.href = `/admin/feedback/post?id=${id}`;
            a.className = `feedback-item list-group-item-action ${data.resolved ? 'read' : ''}`;

            a.innerHTML = `
                <div class="feedback-header">
                    <div class="feedback-title">
                        ${escapeHtml(data.page)} - ${escapeHtml(data.title)}
                        ${data.resolved ? '<span class="badge badge-success ml-2">Resolved</span>' : ''}
                    </div>
                    <div class="feedback-meta">
                        <div>${escapeHtml(data.contact)}</div>
                        <div>IP: ${escapeHtml(data.ip)}</div>
                    </div>
                </div>
                <div class="feedback-preview">
                    ${escapeHtml(preview)}
                </div>
            `;

            listContainer.appendChild(a);
        });

        // If we filtered out everything, show a message
        if (visibleCount === 0) {
            listContainer.innerHTML = '<p class="text-center">No matching feedback.</p>';
        }

    } catch (error) {
        console.error(error);
        loading.textContent = 'Error loading feedback.';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}