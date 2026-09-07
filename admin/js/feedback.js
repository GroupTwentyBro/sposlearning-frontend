import { CONFIG } from "/js/config.js";
import { initAuth, getUser, getAccessToken } from "/js/auth.js";

const API_URL = CONFIG.API_URL;
let currentUser = null;
let allFeedback = [];
let activeKpiFilter = 'all';
let selectedItem = null;

const feedbackList = document.getElementById('feedback-list');
const searchInput = document.getElementById('feedback-search-input');
const statusFilter = document.getElementById('status-filter');
const priorityFilter = document.getElementById('priority-filter');
const categoryFilter = document.getElementById('category-filter');
const sortFilter = document.getElementById('sort-filter');
const refreshBtn = document.getElementById('refresh-btn');

const detailModal = document.getElementById('detail-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalTitle = document.getElementById('modal-title');
const modalPage = document.getElementById('modal-page');
const modalContact = document.getElementById('modal-contact');
const modalDate = document.getElementById('modal-date');
const modalIp = document.getElementById('modal-ip');
const modalMessage = document.getElementById('modal-message');
const modalTakenBy = document.getElementById('modal-taken-by');
const modalBtnTake = document.getElementById('modal-btn-take');
const modalStatusSelect = document.getElementById('modal-status-select');
const modalPrioritySelect = document.getElementById('modal-priority-select');
const modalCategorySelect = document.getElementById('modal-category-select');
const modalDeleteBtn = document.getElementById('modal-delete-btn');
const modalSaveBtn = document.getElementById('modal-save-btn');

async function checkAuth() {
    try {
        const loggedIn = await initAuth();
        if (!loggedIn) { window.location.href = '/login'; return; }
        currentUser = getUser();
        if (!currentUser.roles.includes('admin')) { window.location.href = '/'; return; }

        setupControls();
        await fetchFeedbackData();
    } catch (e) {
        console.error('Auth error:', e);
        window.location.href = '/login';
    }
}

async function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    try {
        const token = await getAccessToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch (e) {
        console.warn('Could not retrieve access token:', e);
    }
    return headers;
}

async function fetchFeedbackData() {
    try {
        feedbackList.innerHTML = `
            <div class="empty-state">
                <span class="icon">hourglass_empty</span>
                <p>Loading feedback submissions…</p>
            </div>
        `;
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_URL}/feedback`, { headers, credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

        allFeedback = await res.json();
        updateKPIs();
        renderFilteredFeedback();
    } catch (err) {
        console.error('Fetch Feedback Error:', err);
        showNotification(`Failed to load feedback: ${err.message}`, 'error');
        feedbackList.innerHTML = `
            <div class="empty-state">
                <span class="icon">error</span>
                <p>Error loading feedback data from API.</p>
                <button class="btn btn-secondary" style="margin-top: 10px;" id="retry-btn">Retry</button>
            </div>
        `;
        document.getElementById('retry-btn')?.addEventListener('click', fetchFeedbackData);
    }
}

async function updateFeedbackItem(id, updatePayload) {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_URL}/feedback/${id}`, {
            method: 'PUT',
            headers: headers,
            credentials: 'include',
            body: JSON.stringify(updatePayload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to update feedback');
        }

        showNotification('Feedback status updated!');
        await fetchFeedbackData();
    } catch (err) {
        console.error('Update Error:', err);
        showNotification(`Update error: ${err.message}`, 'error');
    }
}

async function deleteFeedbackItem(id) {
    if (!confirm('Are you sure you want to permanently delete this feedback submission?')) return;
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_URL}/feedback/${id}`, {
            method: 'DELETE',
            headers: headers,
            credentials: 'include'
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to delete feedback');
        }

        showNotification('Feedback deleted successfully!');
        closeModal();
        await fetchFeedbackData();
    } catch (err) {
        console.error('Delete Error:', err);
        showNotification(`Delete error: ${err.message}`, 'error');
    }
}

function updateKPIs() {
    const total = allFeedback.length;
    const open = allFeedback.filter(i => (i.status || 'open') === 'open').length;
    const progress = allFeedback.filter(i => i.status === 'in-progress').length;
    const resolved = allFeedback.filter(i => i.status === 'resolved').length;
    const highPrio = allFeedback.filter(i => i.priority === 'high').length;

    document.getElementById('kpi-total').textContent = total;
    document.getElementById('kpi-open').textContent = open;
    document.getElementById('kpi-progress').textContent = progress;
    document.getElementById('kpi-resolved').textContent = resolved;
    document.getElementById('kpi-high').textContent = highPrio;
}

function setupControls() {
    searchInput?.addEventListener('input', renderFilteredFeedback);
    statusFilter?.addEventListener('change', renderFilteredFeedback);
    priorityFilter?.addEventListener('change', renderFilteredFeedback);
    categoryFilter?.addEventListener('change', renderFilteredFeedback);
    sortFilter?.addEventListener('change', renderFilteredFeedback);
    refreshBtn?.addEventListener('click', fetchFeedbackData);

    document.querySelectorAll('.kpi-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.kpi-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            activeKpiFilter = card.dataset.kpi;
            renderFilteredFeedback();
        });
    });

    modalCloseBtn?.addEventListener('click', closeModal);
    detailModal?.addEventListener('click', (e) => {
        if (e.target === detailModal) closeModal();
    });
    modalSaveBtn?.addEventListener('click', async () => {
        if (!selectedItem) return;
        const newStatus = modalStatusSelect.value;
        const newPriority = modalPrioritySelect.value;
        const newCategory = modalCategorySelect.value;
        await updateFeedbackItem(selectedItem.id, {
            status: newStatus,
            priority: newPriority,
            category: newCategory,
            resolved: newStatus === 'resolved'
        });
        closeModal();
    });

    modalDeleteBtn?.addEventListener('click', async () => {
        if (!selectedItem) return;
        await deleteFeedbackItem(selectedItem.id);
    });

    modalBtnTake?.addEventListener('click', async () => {
        if (!selectedItem || !currentUser) return;
        const takenByData = JSON.stringify({
            uid: currentUser.id,
            email: currentUser.email,
            name: currentUser.name
        });
        await updateFeedbackItem(selectedItem.id, { taken_by: takenByData });
        closeModal();
    });
}

function renderFilteredFeedback() {
    const term = (searchInput?.value || '').trim().toLowerCase();
    const statusVal = statusFilter?.value || 'all';
    const prioVal = priorityFilter?.value || 'all';
    const catVal = categoryFilter?.value || 'all';
    const sortVal = sortFilter?.value || 'date-desc';

    let filtered = allFeedback.filter(item => {
        const itemStatus = item.status || (item.resolved ? 'resolved' : 'open');
        const itemPriority = item.priority || 'medium';
        const itemCategory = item.category || 'other';

        if (activeKpiFilter === 'open' && itemStatus !== 'open') return false;
        if (activeKpiFilter === 'in-progress' && itemStatus !== 'in-progress') return false;
        if (activeKpiFilter === 'resolved' && itemStatus !== 'resolved') return false;
        if (activeKpiFilter === 'high' && itemPriority !== 'high') return false;

        if (statusVal !== 'all' && itemStatus !== statusVal) return false;
        if (prioVal !== 'all' && itemPriority !== prioVal) return false;
        if (catVal !== 'all' && itemCategory !== catVal) return false;

        if (term) {
            const matchesText =
                (item.title || '').toLowerCase().includes(term) ||
                (item.message || '').toLowerCase().includes(term) ||
                (item.page || '').toLowerCase().includes(term) ||
                (item.contact || '').toLowerCase().includes(term) ||
                (item.name || '').toLowerCase().includes(term) ||
                (item.ip || '').toLowerCase().includes(term);
            if (!matchesText) return false;
        }

        return true;
    });

    filtered.sort((a, b) => {
        if (sortVal === 'date-asc') {
            return new Date(a.timestamp) - new Date(b.timestamp);
        }
        if (sortVal === 'prio-desc') {
            const weights = { high: 1, medium: 2, low: 3 };
            const pA = weights[a.priority || 'medium'] || 2;
            const pB = weights[b.priority || 'medium'] || 2;
            if (pA !== pB) return pA - pB;
        }
        return new Date(b.timestamp) - new Date(a.timestamp);
    });

    if (filtered.length === 0) {
        feedbackList.innerHTML = `
            <div class="empty-state">
                <span class="icon">inbox</span>
                <p>No feedback submissions found matching your filters.</p>
            </div>
        `;
        return;
    }

    feedbackList.innerHTML = '';
    filtered.forEach(item => {
        const status = item.status || (item.resolved ? 'resolved' : 'open');
        const priority = item.priority || 'medium';
        const category = item.category || 'other';
        const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A';

        let takenByDisplay = '';
        let takenByBadge = '';
        let takeButton = '';
        if (item.taken_by) {
            try {
                const tb = JSON.parse(item.taken_by);
                takenByDisplay = tb.name || tb.email || tb.uid || 'Unknown';
            } catch (e) {
                takenByDisplay = item.taken_by;
            }
            takenByBadge = `<span class="badge-taken"><span class="icon" style="font-size: 0.8rem; vertical-align: middle;">person</span> ${escapeHtml(takenByDisplay)}</span>`;
        } else {
            takeButton = `<button class="btn btn-secondary btn-take-inline" style="padding: 2px 6px; font-size: 0.75rem;" onclick="event.stopPropagation();"><span class="icon" style="font-size: 0.8rem;">front_hand</span> Take</button>`;
        }

        const submitterDisplayName = item.name || item.contact || 'Anonymous User';
        const displayIp = item.ip || '';

        const card = document.createElement('div');
        card.className = `feedback-card ${priority === 'high' ? 'high-priority' : ''} status-${status}`;
        card.innerHTML = `
            <div class="card-top">
                <div class="card-tags">
                    <span class="badge-status ${status}">${escapeHtml(status.replace('-', ' '))}</span>
                    <span class="badge-priority ${priority}">${escapeHtml(priority)} prio</span>
                    <span class="badge-category"><span class="icon" style="font-size: 0.8rem; vertical-align: middle;">label</span> ${escapeHtml(category)}</span>
                    ${takenByBadge}
                </div>
                <div class="card-meta-right">
                    ${takeButton}
                    <span><span class="icon" style="font-size: 0.85rem; vertical-align: middle;">schedule</span> ${dateStr}</span>
                </div>
            </div>

            <div class="card-title-row">
                <span class="card-title">${escapeHtml(item.title || 'Untitled Feedback')}</span>
                ${item.page ? `<a href="/${escapeHtml(item.page.replace(/^\//, ''))}" class="card-page" target="_blank" onclick="event.stopPropagation();">/${escapeHtml(item.page.replace(/^\//, ''))}</a>` : ''}
            </div>

            <div class="card-preview">${escapeHtml(item.message || '')}</div>

            <div class="card-bottom">
                <div>From: <strong>${escapeHtml(submitterDisplayName)}</strong> ${displayIp ? `(${escapeHtml(displayIp)})` : ''}</div>
                <div style="display: flex; gap: 8px;" onclick="event.stopPropagation();">
                    <select class="filter-select inline-status-select" data-id="${item.id}" style="padding: 4px 8px; font-size: 0.78rem;">
                        <option value="open" ${status === 'open' ? 'selected' : ''}>Open</option>
                        <option value="in-progress" ${status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                        <option value="resolved" ${status === 'resolved' ? 'selected' : ''}>Resolved</option>
                        <option value="denied" ${status === 'denied' ? 'selected' : ''}>Denied</option>
                    </select>
                    <button class="btn btn-danger btn-delete-inline" data-id="${item.id}" style="padding: 4px 8px; font-size: 0.78rem;" title="Delete">
                        <span class="icon" style="font-size: 0.9rem;">delete</span>
                    </button>
                </div>
            </div>
        `;

        card.addEventListener('click', () => openModal(item));

        card.querySelector('.inline-status-select')?.addEventListener('change', async (e) => {
            const newStatus = e.target.value;
            await updateFeedbackItem(item.id, {
                status: newStatus,
                priority: item.priority || 'medium',
                category: item.category || 'other',
                resolved: newStatus === 'resolved'
            });
        });

        card.querySelector('.btn-delete-inline')?.addEventListener('click', async () => {
            await deleteFeedbackItem(item.id);
        });

        card.querySelector('.btn-take-inline')?.addEventListener('click', async (e) => {
            if (!currentUser) return;
            const takenByData = JSON.stringify({
                uid: currentUser.id,
                email: currentUser.email,
                name: currentUser.name
            });
            await updateFeedbackItem(item.id, { taken_by: takenByData });
        });

        feedbackList.appendChild(card);
    });
}

function openModal(item) {
    selectedItem = item;
    const status = item.status || (item.resolved ? 'resolved' : 'open');
    const priority = item.priority || 'medium';
    const category = item.category || 'other';

    const submitterDisplayName = item.name || item.contact || 'Anonymous User';
    const displayIp = item.ip || 'Unknown';

    modalTitle.textContent = item.title || 'Feedback Details';
    modalPage.innerHTML = item.page
        ? `<a href="/${escapeHtml(item.page.replace(/^\//, ''))}" target="_blank" style="color: var(--accent-primary);">/${escapeHtml(item.page.replace(/^\//, ''))}</a>`
        : 'General Website Feedback';
    modalContact.textContent = submitterDisplayName;
    modalDate.textContent = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A';
    modalIp.textContent = displayIp;
    modalMessage.textContent = item.message || '(No text content)';

    if (item.taken_by) {
        try {
            const tb = JSON.parse(item.taken_by);
            modalTakenBy.textContent = tb.name || tb.email || tb.uid || 'Unknown';
        } catch (e) {
            modalTakenBy.textContent = item.taken_by;
        }
        if (modalBtnTake) modalBtnTake.classList.add('hidden');
    } else {
        modalTakenBy.textContent = 'None';
        if (modalBtnTake) modalBtnTake.classList.remove('hidden');
    }

    modalStatusSelect.value = status;
    modalPrioritySelect.value = priority;
    modalCategorySelect.value = category;

    const imagesContainer = document.getElementById('modal-images-container');
    const imagesList = document.getElementById('modal-images');
    if (imagesContainer && imagesList) {
        imagesList.innerHTML = '';
        let imagesArr = [];
        try {
            if (typeof item.images === 'string') imagesArr = JSON.parse(item.images);
            else if (Array.isArray(item.images)) imagesArr = item.images;
        } catch (e) { }

        if (imagesArr && imagesArr.length > 0) {
            imagesContainer.classList.remove('hidden');
            imagesArr.forEach(url => {
                const a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.rel = 'noopener';
                a.innerHTML = `<img src="${escapeHtml(url)}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-color); cursor: pointer;" alt="Attachment" />`;
                imagesList.appendChild(a);
            });
        } else {
            imagesContainer.classList.add('hidden');
        }
    }

    detailModal.classList.remove('hidden');
}

function closeModal() {
    detailModal.classList.add('hidden');
    selectedItem = null;
}

function showNotification(message, type = 'success') {
    const toast = document.getElementById('notification');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `notification ${type === 'error' ? 'error' : ''}`;
    toast.classList.remove('hidden');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.add('hidden'), 3500);
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuth);
} else {
    checkAuth();
}
