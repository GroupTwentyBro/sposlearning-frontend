import { app, auth } from '../../js/firebaseConfig.js'; // Note the relative path
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const db = getFirestore(app);
const contentArea = document.getElementById('content-area');
const resolveBtn = document.getElementById('resolve-btn');
const deleteBtn = document.getElementById('delete-btn');

const params = new URLSearchParams(window.location.search);
const postId = params.get('id');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (!postId) {
            contentArea.innerHTML = "No Post ID specified.";
            return;
        }
        loadPost();
    } else {
        window.location.href = '/admin';
    }
});

async function loadPost() {
    try {
        const docRef = doc(db, 'feedback', postId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            contentArea.innerHTML = "Feedback post not found.";
            return;
        }

        const data = docSnap.data();
        const date = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleString() : 'Unknown';

        // Update UI state based on resolved status
        if (data.resolved) {
            resolveBtn.textContent = "Mark Unresolved";
            resolveBtn.classList.remove('btn-success');
            resolveBtn.classList.add('btn-warning');
        }

        contentArea.innerHTML = `
            <h2>${escapeHtml(data.type)}</h2>
            <div class="meta-row">
                <strong>From:</strong> ${escapeHtml(data.name)} &lt;${escapeHtml(data.contact)}&gt;<br>
                <strong>Date:</strong> ${date}<br>
                <strong>IP:</strong> <span class="code-info">${escapeHtml(data.ip)}</span><br>
                <strong>Page Context:</strong> <span class="code-info">${escapeHtml(data.relatedPage)}</span>
            </div>
            <div class="message-body">${escapeHtml(data.message)}</div>
            <hr>
            <small class="text-muted">User Agent: ${escapeHtml(data.userAgent)}</small>
        `;

        // Setup Buttons
        resolveBtn.onclick = async () => {
            const newState = !data.resolved;
            await updateDoc(docRef, { resolved: newState });
            location.reload();
        };

        deleteBtn.onclick = async () => {
            if (confirm("Permanently delete this feedback?")) {
                await deleteDoc(docRef);
                window.location.href = '/admin/feedback.html';
            }
        };

    } catch (error) {
        console.error(error);
        contentArea.innerHTML = "Error loading post.";
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}