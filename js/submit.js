import { CONFIG } from "/js/config.js";
import { initAuth, getUser, getAccessToken } from "/js/auth.js";
import { initAutocorrect } from "/js/autocorrect.js";

const API_URL = CONFIG.API_URL;

let currentUser = null;
let toc = [];
let tocCounter = 0;
let cmEditor = null;
let editingId = null;      // submission ID when editing an existing draft
let isEditingLive = false; // true when re-editing an already-approved submission

const previewContent = document.getElementById('preview-content');
const toggleViewBtn = document.getElementById('toggle-view');
const editorPanel = document.getElementById('editor-panel');
const previewPanel = document.getElementById('preview-panel');
const publishBtn = document.getElementById('publish-btn');
const publishBtnText = document.getElementById('publish-btn-text');
const breadcrumbLabel = document.getElementById('breadcrumb-label');
const banner = document.getElementById('submit-banner');

// ─── Helpers ───────────────────────────────────────────────────────────────

function getEditorContent() {
    if (cmEditor) return cmEditor.getValue();
    const el = document.getElementById('editor');
    return el ? el.value : '';
}

function setEditorContent(val) {
    if (cmEditor) cmEditor.setValue(val || '');
    else {
        const el = document.getElementById('editor');
        if (el) el.value = val || '';
    }
    renderPreview();
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ─── Auth ──────────────────────────────────────────────────────────────────

async function checkAuth() {
    try {
        const loggedIn = await initAuth();
        if (!loggedIn) {
            window.location.href = '/login';
            return;
        }
        currentUser = getUser();
    } catch (e) {
        console.error('Auth check failed:', e);
        window.location.href = '/login';
        return;
    }

    // Check for ?id= edit mode
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
        editingId = id;
        await loadExistingSubmission(id);
    }

    initializeEditor();
}

// ─── Load existing submission for editing ─────────────────────────────────

async function loadExistingSubmission(id) {
    try {
        const token = await getAccessToken();
        const res = await fetch(`${API_URL}/submissions/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Could not load submission');
        const sub = await res.json();

        // Populate fields
        document.getElementById('article-title').value = sub.title || '';
        document.getElementById('article-path').value = sub.suggested_path || '';
        document.getElementById('article-grade').value = sub.grade ?? 0;

        // Set content after editor init (will be called from initializeEditor)
        window._pendingContent = sub.content || '';

        isEditingLive = sub.status === 'approved';

        // Update UI for edit mode
        breadcrumbLabel.textContent = 'Edit Submission';
        publishBtnText.textContent = isEditingLive ? 'Resubmit for Review' : 'Update Submission';
        publishBtn.querySelector('.icon').textContent = isEditingLive ? 'refresh' : 'send';

        banner.classList.add('edit-mode');
        banner.innerHTML = `
            <span class="icon">${isEditingLive ? 'refresh' : 'edit'}</span>
            <div>
                <strong>${isEditingLive ? 'Resubmitting live page' : 'Editing draft'}</strong> —
                ${isEditingLive
                    ? 'The live page will remain unchanged until your updated version is approved.'
                    : 'Your changes will be sent back for admin review.'}
                <a href="/account/submissions">← My Submissions</a>
            </div>
        `;

        // Show admin note if status is needs_changes
        if (sub.status === 'needs_changes' && sub.admin_note) {
            showAdminNote(sub.admin_note);
        }

    } catch (e) {
        console.error('Failed to load submission:', e);
        showNotification('Could not load submission', 'error');
    }
}

function showAdminNote(note) {
    const existing = document.getElementById('admin-note-panel');
    if (existing) return;

    const panel = document.createElement('div');
    panel.id = 'admin-note-panel';
    panel.innerHTML = `
        <span class="icon">feedback</span>
        <div class="note-body">
            <div class="note-label">Admin Feedback</div>
            <div class="note-text">${escapeHtml(note)}</div>
        </div>
    `;

    // Insert below banner
    banner.insertAdjacentElement('afterend', panel);
}

// ─── Draft (localStorage) ─────────────────────────────────────────────────

function saveDraftSilently() {
    if (editingId) return; // Don't use localStorage drafts in edit mode
    const draft = {
        title: document.getElementById('article-title').value,
        path: document.getElementById('article-path').value,
        grade: document.getElementById('article-grade').value,
        content: getEditorContent(),
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('submit-draft', JSON.stringify(draft));
}

function saveDraft() {
    if (editingId) {
        showNotification('Use "Update Submission" to save changes', 'info');
        return;
    }
    saveDraftSilently();
    showNotification('Draft saved to browser');
}

function loadDraft() {
    if (editingId) return; // loaded from API instead
    const draft = localStorage.getItem('submit-draft');
    if (draft) {
        try {
            const data = JSON.parse(draft);
            document.getElementById('article-title').value = data.title || '';
            document.getElementById('article-path').value = data.path || '';
            document.getElementById('article-grade').value = data.grade || 0;
            setEditorContent(data.content || '');
        } catch (e) { console.error('Failed to load draft', e); }
    }
}

function clearDraft() {
    localStorage.removeItem('submit-draft');
}

// ─── Editor init ──────────────────────────────────────────────────────────

function initializeEditor() {
    const textarea = document.getElementById('editor');
    if (window.CodeMirror) {
        cmEditor = CodeMirror.fromTextArea(textarea, {
            mode: { name: 'gfm', tokenTypeOverrides: { emoji: 'emoji' } },
            lineWrapping: true,
            theme: 'default',
            viewportMargin: Infinity,
            inputStyle: 'contenteditable',
            spellcheck: true
        });
        cmEditor.addOverlay({
            token: function (stream) {
                if (stream.match(/<!--\s*TOC_MARKER:[^>]*-->/i)) return 'toc-badge';
                if (stream.match(/<discl[^>]*type="important-green"[^>]*>.*?<\/discl>/i)) return 'discl-badge-important-green';
                if (stream.match(/<discl[^>]*type="(warning|warn)"[^>]*>.*?<\/discl>/i)) return 'discl-badge-warning';
                if (stream.match(/<discl[^>]*type="info"[^>]*>.*?<\/discl>/i)) return 'discl-badge-info';
                if (stream.match(/<discl[^>]*>.*?<\/discl>/i)) return 'discl-badge-important';
                stream.next();
                return null;
            }
        });
        cmEditor.on('change', () => { renderPreview(); saveDraftSilently(); });

        // Apply pending content from API load
        if (window._pendingContent) {
            cmEditor.setValue(window._pendingContent);
            window._pendingContent = null;
            renderPreview();
        }
    } else {
        textarea.addEventListener('input', () => { renderPreview(); saveDraftSilently(); });
        if (window._pendingContent) {
            textarea.value = window._pendingContent;
            window._pendingContent = null;
            renderPreview();
        }
    }

    loadDraft();
    setupToolbar();
    initAutocorrect({ cmEditor, titleInputId: 'article-title', toolbarBtnId: 'btn-autocorrect' });

    toggleViewBtn?.addEventListener('click', togglePreview);
    document.getElementById('save-draft-btn')?.addEventListener('click', saveDraft);
    publishBtn?.addEventListener('click', submitArticle);

    window.addEventListener('beforeunload', (e) => {
        if (getEditorContent().trim()) { e.preventDefault(); e.returnValue = ''; }
    });

    renderPreview();
}

// ─── Preview ──────────────────────────────────────────────────────────────

function renderPreview() {
    const markdown = getEditorContent();
    const processed = markdown.replace(/!\[(.*?)\]\((.*?)\)\{width=(.*?) height=(.*?)\}/g,
        (_, alt, url, w, h) => `<img src="${url}" alt="${alt}" style="width:${w}; height:${h}; max-width:100%;" />`);
    let html = marked.parse(processed);
    const temp = document.createElement('div');
    temp.innerHTML = html;
    temp.querySelectorAll('pre code').forEach(b => { if (b.classList.length) hljs.highlightElement(b); });
    previewContent.innerHTML = temp.innerHTML;
    generateTOC();
    displayTOC();
}

// ─── Toolbar ──────────────────────────────────────────────────────────────

function setupToolbar() {
    document.getElementById('btn-h1')?.addEventListener('click', () => insertMarkdown('# ', ' Heading'));
    document.getElementById('btn-h2')?.addEventListener('click', () => insertMarkdown('## ', ' Heading'));
    document.getElementById('btn-h3')?.addEventListener('click', () => insertMarkdown('### ', ' Heading'));
    document.getElementById('btn-bold')?.addEventListener('click', () => insertMarkdown('**', '**'));
    document.getElementById('btn-italic')?.addEventListener('click', () => insertMarkdown('*', '*'));
    document.getElementById('btn-code')?.addEventListener('click', () => insertMarkdown('`', '`'));
    document.getElementById('btn-link')?.addEventListener('click', openLinkModal);
    document.getElementById('btn-ul')?.addEventListener('click', () => insertMarkdown('- ', ''));
    document.getElementById('btn-ol')?.addEventListener('click', () => insertMarkdown('1. ', ''));
    document.getElementById('btn-codeblock')?.addEventListener('click', () => insertMarkdown('```javascript\n', '\n```'));
    document.getElementById('btn-image')?.addEventListener('click', openImageModal);
    document.getElementById('btn-toc')?.addEventListener('click', insertTOCMarker);
    document.getElementById('btn-discl')?.addEventListener('click', openDisclModal);
    document.getElementById('btn-hint')?.addEventListener('click', () => {
        const tip = prompt('Tooltip text:', 'tooltip text') || 'tooltip text';
        const text = prompt('Hover text:', 'hover text') || 'hover text';
        insertMarkdown(`<span class="hint">${text}<span class="hint-tip">${tip}</span></span>`, '');
    });
    document.getElementById('btn-box')?.addEventListener('click', () => insertMarkdown('<div class="box">\n', '\n</div>'));
    document.getElementById('btn-toc-manager')?.addEventListener('click', () =>
        document.getElementById('toc-section')?.scrollIntoView({ behavior: 'smooth' }));
    document.getElementById('toc-refresh-btn')?.addEventListener('click', generateTOC);
}

function insertMarkdown(before, after) {
    if (cmEditor) {
        const sel = cmEditor.getSelection();
        cmEditor.replaceSelection(before + (sel || '') + (after || ''));
        cmEditor.focus();
    } else {
        const ta = document.getElementById('editor');
        const s = ta.selectionStart, e = ta.selectionEnd;
        const sel = ta.value.substring(s, e);
        ta.value = ta.value.substring(0, s) + before + sel + (after || '') + ta.value.substring(e);
        ta.selectionStart = s + before.length;
        ta.selectionEnd = s + before.length + sel.length;
        ta.focus();
    }
    renderPreview();
    saveDraftSilently();
}

// ─── Image upload ─────────────────────────────────────────────────────────

function openImageModal() {
    const modal = document.getElementById('image-modal');
    modal.classList.remove('hidden');
    const uploadZone = document.getElementById('upload-zone');
    const imageInput = document.getElementById('image-input');
    const previewImg = document.getElementById('preview-img');
    const imagePreview = document.getElementById('image-preview');
    let selectedFile = null;

    uploadZone.onclick = () => imageInput.click();
    uploadZone.ondragover = e => { e.preventDefault(); uploadZone.style.borderColor = 'var(--accent-primary)'; };
    uploadZone.ondragleave = () => { uploadZone.style.borderColor = 'var(--border-color)'; };
    uploadZone.ondrop = e => {
        e.preventDefault();
        uploadZone.style.borderColor = 'var(--border-color)';
        if (e.dataTransfer.files[0]) handleImageSelect(e.dataTransfer.files[0]);
    };
    imageInput.onchange = e => { if (e.target.files[0]) handleImageSelect(e.target.files[0]); };

    function handleImageSelect(file) {
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = e => { previewImg.src = e.target.result; imagePreview.classList.remove('hidden'); uploadZone.style.display = 'none'; };
        reader.readAsDataURL(file);
    }

    document.getElementById('image-modal-close').onclick = () => { modal.classList.add('hidden'); resetImageModal(); };
    document.getElementById('image-modal-cancel').onclick = () => { modal.classList.add('hidden'); resetImageModal(); };
    document.getElementById('image-modal-insert').onclick = () => {
        if (!selectedFile) { showNotification('Please select an image', 'error'); return; }
        const alt = document.getElementById('img-alt').value || 'Image';
        const width = document.getElementById('img-width').value || '100';
        const height = document.getElementById('img-height').value || 'auto';
        uploadImage(selectedFile, alt, width, height);
        modal.classList.add('hidden');
        resetImageModal();
    };

    function resetImageModal() {
        document.getElementById('image-input').value = '';
        document.getElementById('img-alt').value = '';
        document.getElementById('img-width').value = '100';
        document.getElementById('img-height').value = 'auto';
        document.getElementById('image-preview').classList.add('hidden');
        document.getElementById('upload-zone').style.display = 'block';
        selectedFile = null;
    }
}

async function uploadImage(file, alt, width, height) {
    showNotification('Uploading image…', 'info');
    try {
        const formData = new FormData();
        formData.append('image', file);
        const token = await getAccessToken();
        const res = await fetch(`${API_URL}/upload-page-image`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');
        const data = await res.json();
        if (data.url) {
            insertMarkdown(`![${alt}](${data.url}){width=${width}% height=${height}}`, '');
            showNotification('Image uploaded!');
        } else throw new Error('No URL returned');
    } catch (err) {
        showNotification(`Upload failed: ${err.message}`, 'error');
    }
}

// ─── Link / Discl modals ─────────────────────────────────────────────────

function openLinkModal() {
    const modal = document.getElementById('link-modal');
    modal.classList.remove('hidden');
    document.getElementById('link-modal-close').onclick = () => modal.classList.add('hidden');
    document.getElementById('link-modal-cancel').onclick = () => modal.classList.add('hidden');
    document.getElementById('link-modal-insert').onclick = () => {
        const text = document.getElementById('link-text').value || 'link';
        const url = document.getElementById('link-url').value;
        if (!url) { showNotification('Please enter a URL', 'error'); return; }
        insertMarkdown(`[${text}](${url})`, '');
        modal.classList.add('hidden');
        document.getElementById('link-text').value = '';
        document.getElementById('link-url').value = '';
    };
}

function openDisclModal() {
    const modal = document.getElementById('discl-modal');
    modal.classList.remove('hidden');
    document.getElementById('discl-modal-close').onclick = () => modal.classList.add('hidden');
    document.getElementById('discl-modal-cancel').onclick = () => modal.classList.add('hidden');
    document.getElementById('discl-modal-insert').onclick = () => {
        const type = document.getElementById('discl-type').value;
        const text = document.getElementById('discl-text').value;
        if (!text) { showNotification('Please enter text', 'error'); return; }
        insertMarkdown(type ? `<discl type="${type}">${text}</discl>` : `<discl>${text}</discl>`, '');
        modal.classList.add('hidden');
        document.getElementById('discl-text').value = '';
    };
}

// ─── TOC ──────────────────────────────────────────────────────────────────

function insertTOCMarker() {
    tocCounter++;
    const defaultName = `Marker ${tocCounter}`;
    const name = prompt('Enter a custom title for this TOC Marker:', defaultName);
    if (name === null) return;
    insertMarkdown(`<!-- TOC_MARKER:${name.trim() || defaultName} -->`, '');
}

function generateTOC() {
    const headings = previewContent.querySelectorAll('h1, h2, h3');
    const autoEntries = [];
    headings.forEach((h, i) => {
        if (!h.id) h.id = `heading-${Date.now()}-${i}`;
        autoEntries.push({ id: `auto-${i}`, level: parseInt(h.tagName[1]), title: h.textContent.trim(), isManual: false, headingId: h.id });
    });
    const markerRegex = /<!--\s*TOC_MARKER:([^>]+?)\s*-->/g;
    const manualEntries = [];
    let match;
    while ((match = markerRegex.exec(getEditorContent())) !== null) {
        const raw = match[1].trim();
        manualEntries.push({ id: `manual-${raw}`, level: 0, title: `📌 ${raw}`, isManual: true, markerId: raw });
    }
    toc = [...autoEntries, ...manualEntries];
    displayTOC();
}

function displayTOC() {
    const tocList = document.getElementById('toc-list');
    if (!toc || toc.length === 0) {
        tocList.innerHTML = `<div style="color:var(--text-tertiary);font-size:0.85rem;text-align:center;padding:20px 0;">No headings or TOC markers</div>`;
        return;
    }
    tocList.innerHTML = toc.map((item, index) => `
        <div class="toc-item ${item.isManual ? 'manual' : 'auto'}" data-index="${index}">
          <div class="toc-content"><strong>${item.isManual ? '📌 ' : ''}${item.title}</strong><small>${item.isManual ? 'Manual' : 'H' + item.level}</small></div>
          <div class="toc-actions">
            <button class="btn-small danger" data-action="remove" data-index="${index}">✕</button>
            <button class="btn-small" data-action="up" data-index="${index}">↑</button>
            <button class="btn-small" data-action="down" data-index="${index}">↓</button>
          </div>
        </div>`).join('');
    tocList.querySelectorAll('.btn-small').forEach(btn => {
        btn.addEventListener('click', e => {
            const action = e.target.closest('button').dataset.action;
            const idx = parseInt(e.target.closest('button').dataset.index);
            if (action === 'remove') toc.splice(idx, 1);
            else if (action === 'up' && idx > 0) [toc[idx], toc[idx - 1]] = [toc[idx - 1], toc[idx]];
            else if (action === 'down' && idx < toc.length - 1) [toc[idx], toc[idx + 1]] = [toc[idx + 1], toc[idx]];
            displayTOC();
        });
    });
}

// ─── Toggle preview ───────────────────────────────────────────────────────

function togglePreview() {
    const icon = document.getElementById('toggle-view-icon');
    if (editorPanel.classList.contains('hidden')) {
        editorPanel.classList.remove('hidden');
        previewPanel.classList.add('hidden');
        icon.textContent = 'preview';
        if (cmEditor) cmEditor.refresh();
    } else {
        editorPanel.classList.add('hidden');
        previewPanel.classList.remove('hidden');
        icon.textContent = 'edit';
    }
}

// ─── Submit / Update ──────────────────────────────────────────────────────

async function submitArticle() {
    const title = document.getElementById('article-title').value.trim();
    const path = document.getElementById('article-path').value.trim();
    const grade = parseInt(document.getElementById('article-grade').value || 0, 10);
    const content = getEditorContent().trim();

    if (!title || !path || !content) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    const author = currentUser?.preferred_username || currentUser?.username || currentUser?.name || 'unknown';

    const body = {
        title,
        suggested_path: path.replace(/^\/|\/$/g, ''),
        content,
        grade,
        submitted_by: author,
        submitted_by_id: currentUser?.sub || ''
    };

    const headers = { 'Content-Type': 'application/json' };
    try {
        const token = await getAccessToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch (e) { /* ignore */ }

    publishBtn.disabled = true;
    publishBtnText.textContent = 'Submitting…';

    try {
        let res;
        if (editingId) {
            // PUT — update existing submission (resets status to pending)
            res = await fetch(`${API_URL}/submissions/${editingId}`, {
                method: 'PUT',
                headers,
                credentials: 'include',
                body: JSON.stringify(body)
            });
        } else {
            // POST — new submission
            res = await fetch(`${API_URL}/submissions`, {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify(body)
            });
        }

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to submit');
        }

        showNotification(editingId ? 'Submission updated!' : 'Article submitted for review!');
        clearDraft();
        setTimeout(() => { window.location.href = '/account/submissions'; }, 1500);
    } catch (e) {
        showNotification(`Error: ${e.message}`, 'error');
        publishBtn.disabled = false;
        publishBtnText.textContent = editingId ? 'Update Submission' : 'Submit for Review';
    }
}

// ─── Notification ────────────────────────────────────────────────────────

function showNotification(message, type = 'success') {
    const n = document.getElementById('notification');
    n.textContent = message;
    n.classList.remove('hidden', 'error', 'info');
    if (type === 'error') n.classList.add('error');
    if (type === 'info') n.classList.add('info');
    clearTimeout(n._timeout);
    n._timeout = setTimeout(() => n.classList.add('hidden'), 3000);
}

// ─── Init ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', checkAuth);
