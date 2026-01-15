import { app, auth } from '../js/firebaseConfig.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const db = getFirestore(app);
const listContainer = document.getElementById('feedback-list');
const loading = document.getElementById('loading');

onAuthStateChanged(auth, (user) => {
    if (user) {
        loadFeedback();
    } else {
        loadFeedback();
    }
});

async function loadFeedback() {
    try {
        const q = query(collection(db, 'feedback'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);

        loading.style.display = 'none';
        listContainer.innerHTML = '';

        if (snapshot.empty) {
            listContainer.innerHTML = '<p class="text-center">No feedback found.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const id = doc.id;

            // Format Preview (max 100 chars)
            let preview = data.message || '';
            if (preview.length > 100) preview = preview.substring(0, 100) + '...';

            // Create Element
            const a = document.createElement('a');
            a.href = `./feedback/post?id=${id}`;
            a.className = `feedback-item list-group-item-action ${data.resolved ? 'read' : ''}`;

            a.innerHTML = `
                <div class="feedback-header">
                    <div class="feedback-title">
                        ${escapeHtml(data.type)} - ${escapeHtml(data.name)}
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

    } catch (error) {
        console.error(error);
        loading.textContent = 'Error loading feedback.';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}