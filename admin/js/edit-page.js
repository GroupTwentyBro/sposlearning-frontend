import { CONFIG } from "/js/config.js";
import { initAuth, getUser, getAccessToken } from "/js/auth.js";
import { initAutocorrect } from "/js/autocorrect.js";

const API_URL = CONFIG.API_URL;
let currentUser = null;
let toc = [];
let tocCounter = 0;
let cmEditor = null;
let originalPath = '';
let loadedPageId = null;

const previewContent = document.getElementById('preview-content');
const toggleViewBtn = document.getElementById('toggle-view');
const editorPanel = document.getElementById('editor-panel');
const previewPanel = document.getElementById('preview-panel');

function getEditorContent() {
    if (cmEditor) {
        return cmEditor.getValue();
    }
    const el = document.getElementById('editor');
    return el ? el.value : '';
}

function setEditorContent(val) {
    if (cmEditor) {
        cmEditor.setValue(val || '');
    } else {
        const el = document.getElementById('editor');
        if (el) el.value = val || '';
    }
    renderPreview();
}

async function checkAuth() {
    try {
        const loggedIn = await initAuth();
        if (!loggedIn) { window.location.href = '/login'; return; }
        currentUser = getUser();
        if (!currentUser.roles.includes('admin')) { window.location.href = '/'; return; }
    } catch (e) {
        console.error('Auth check failed:', e);
        window.location.href = '/login';
        return;
    }

    try {
        initializeEditor();
        await loadPageFromDB();
    } catch (err) {
        console.error('Editor/Page load error:', err);
    }
}

async function loadPageFromDB() {
    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get('id');
    const pathParam = urlParams.get('path');
    const sidParam = urlParams.get('sid');   // submission id

    // ── Load from a submission ──────────────────────────────────────────────
    if (sidParam) {
        try {
            const token = await getAccessToken().catch(() => null);
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const res = await fetch(`${API_URL}/submissions/${encodeURIComponent(sidParam)}`, { headers });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const sub = await res.json();

            const titleEl = document.getElementById('article-title');
            const pathEl = document.getElementById('article-path');
            const gradeEl = document.getElementById('article-grade');

            if (titleEl) titleEl.value = sub.title || '';
            if (pathEl) pathEl.value = (sub.suggested_path || '').replace(/^\/|\/$/g, '');
            if (gradeEl) gradeEl.value = sub.grade ?? 1;

            originalPath = sub.suggested_path || '';

            if (sub.content) setEditorContent(sub.content);

            showNotification(`Loaded submission from ${sub.submitted_by}`);

            // Show a banner so it's obvious this is a submission review
            const banner = document.createElement('div');
            banner.style.cssText = 'background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);border-radius:8px;padding:10px 16px;margin-bottom:16px;font-size:0.85rem;color:#a5b4fc;display:flex;align-items:center;gap:8px;';
            banner.innerHTML = `<span class="icon" style="font-size:1rem;">rate_review</span> Editing submission by <strong>${sub.submitted_by}</strong> &mdash; save changes then go back to <a href="/admin/submissions" style="color:#818cf8;">Submission Review</a> to approve.`;
            document.querySelector('.editor-container, #editor-panel, main')?.prepend(banner);
        } catch (e) {
            console.error('Failed to load submission:', e);
            showNotification(`Error loading submission: ${e.message}`, 'error');
        }
        return;
    }

    // ── Load from pages table ───────────────────────────────────────────────
    if (!idParam && !pathParam) {
        showNotification('No page specified in URL parameters', 'error');
        return;
    }

    try {
        const endpoint = idParam
            ? `${API_URL}/page-content?id=${encodeURIComponent(idParam)}`
            : `${API_URL}/page-content?path=${encodeURIComponent(pathParam)}`;
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`Failed to load page content (${response.status})`);
        }
        const pageData = await response.json();
        loadedPageId = pageData.id;
        originalPath = pageData.fullPath || pageData.path || pathParam || '';

        const titleEl = document.getElementById('article-title');
        const pathEl = document.getElementById('article-path');
        const adminEl = document.getElementById('article-admin');
        const gradeEl = document.getElementById('article-grade');

        if (titleEl) titleEl.value = pageData.title || '';
        if (pathEl) pathEl.value = originalPath || '';
        if (adminEl) adminEl.checked = (pageData.accessLevel || '').toLowerCase() === 'admin';
        if (gradeEl) gradeEl.value = pageData.grade || 0;

        if (pageData.content) {
            setEditorContent(pageData.content);
        }
        showNotification('Page loaded successfully');
    } catch (e) {
        console.error('Failed to load page data:', e);
        showNotification(`Error loading page: ${e.message}`, 'error');
    }
}

function saveDraftSilently() {
    const draft = {
        title: document.getElementById('article-title').value,
        path: document.getElementById('article-path').value,
        admin: document.getElementById('article-admin').checked,
        content: getEditorContent(),
        timestamp: new Date().toISOString()
    };
    localStorage.setItem(`edit-page-draft-${originalPath}`, JSON.stringify(draft));
}

function saveDraft() {
    saveDraftSilently();
    showNotification('Draft saved to browser');
}

function clearDraft() {
    if (originalPath) {
        localStorage.removeItem(`edit-page-draft-${originalPath}`);
    }
}

function initializeEditor() {
    const textarea = document.getElementById('editor');
    if (window.CodeMirror && textarea && !cmEditor) {
        cmEditor = CodeMirror.fromTextArea(textarea, {
            mode: {
                name: 'gfm',
                tokenTypeOverrides: {
                    emoji: 'emoji'
                }
            },
            lineWrapping: true,
            theme: 'default',
            viewportMargin: Infinity,
            inputStyle: 'contenteditable',
            spellcheck: true
        });

        cmEditor.addOverlay({
            token: function (stream) {
                if (stream.match(/<!--\s*TOC_MARKER:[^>]*-->/i)) {
                    return 'toc-badge';
                }
                if (stream.match(/<discl[^>]*type="important-green"[^>]*>.*?<\/discl>/i)) {
                    return 'discl-badge-important-green';
                }
                if (stream.match(/<discl[^>]*type="(warning|warn)"[^>]*>.*?<\/discl>/i)) {
                    return 'discl-badge-warning';
                }
                if (stream.match(/<discl[^>]*type="info"[^>]*>.*?<\/discl>/i)) {
                    return 'discl-badge-info';
                }
                if (stream.match(/<discl[^>]*>.*?<\/discl>/i)) {
                    return 'discl-badge-important';
                }

                if (stream.match(/<span class="hint">/i) || stream.match(/<span class="hint-tip">/i) || stream.match(/<\/span>/i)) {
                    return 'hint-tag';
                }
                if (stream.match(/^[^<]+(?=<span class="hint-tip">)/i)) {
                    return 'hint-text';
                }
                if (stream.match(/^[^<]+(?=<\/span>)/i)) {
                    return 'hint-tip-text';
                }

                stream.next();
                return null;
            }
        });

        cmEditor.on('change', () => {
            renderPreview();
            saveDraftSilently();
        });
    } else if (textarea) {
        textarea.addEventListener('input', () => {
            renderPreview();
            saveDraftSilently();
        });
    }

    setupToolbar();
    initAutocorrect({ cmEditor, titleInputId: 'article-title', toolbarBtnId: 'btn-autocorrect' });

    if (toggleViewBtn) {
        toggleViewBtn.addEventListener('click', togglePreview);
    }

    const saveDraftBtn = document.getElementById('save-draft-btn');
    if (saveDraftBtn) saveDraftBtn.addEventListener('click', saveDraft);

    const publishBtn = document.getElementById('publish-btn');
    if (publishBtn) publishBtn.addEventListener('click', updateArticle);

    const deletePageBtn = document.getElementById('delete-page-btn');
    if (deletePageBtn) deletePageBtn.addEventListener('click', deletePage);

    const previewBtn = document.getElementById('preview-btn');
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            previewPanel?.classList.remove('hidden');
            editorPanel?.classList.add('hidden');
            const icon = document.getElementById('toggle-view-icon');
            if (icon) icon.textContent = 'edit';
        });
    }

    window.addEventListener('beforeunload', (e) => {
        if (getEditorContent().trim()) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    renderPreview();
}

function renderPreview() {
    if (!previewContent) return;
    const markdown = getEditorContent();
    const processedMarkdown = markdown.replace(/!\[(.*?)\]\((.*?)\)\{width=(.*?) height=(.*?)\}/g, (match, alt, url, w, h) => {
        return `<img src="${url}" alt="${alt}" style="width:${w}; height:${h}; max-width: 100%;" />`;
    });
    let html = (window.marked && typeof window.marked.parse === 'function')
        ? marked.parse(processedMarkdown)
        : processedMarkdown;

    const temp = document.createElement('div');
    temp.innerHTML = html;
    if (window.hljs) {
        temp.querySelectorAll('pre code').forEach((block) => {
            if (block.classList.length === 0) return;
            hljs.highlightElement(block);
        });
    }

    previewContent.innerHTML = temp.innerHTML;
    generateTOC();
    displayTOC();
}

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
        const html = `<span class="hint">${text}<span class="hint-tip">${tip}</span></span>`;
        insertMarkdown(html, '');
    });
    document.getElementById('btn-box')?.addEventListener('click', () => insertMarkdown('<div class="box">\n', '\n</div>'));
    document.getElementById('btn-toc-manager')?.addEventListener('click', () => {
        document.getElementById('toc-section')?.scrollIntoView({ behavior: 'smooth' });
    });
    document.getElementById('toc-refresh-btn')?.addEventListener('click', generateTOC);
}

function insertMarkdown(before, after) {
    if (cmEditor) {
        const selection = cmEditor.getSelection();
        const replacement = before + (selection || '') + (after || '');
        cmEditor.replaceSelection(replacement);
        cmEditor.focus();
    } else {
        const textarea = document.getElementById('editor');
        if (!textarea) return;
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const selected = textarea.value.substring(start, end);
        const text = before + selected + (after || '');
        textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
        textarea.selectionStart = start + before.length;
        textarea.selectionEnd = start + before.length + selected.length;
        textarea.focus();
    }
    renderPreview();
    saveDraftSilently();
}

function openImageModal() {
    const modal = document.getElementById('image-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const uploadZone = document.getElementById('upload-zone');
    const imageInput = document.getElementById('image-input');
    const previewImg = document.getElementById('preview-img');
    const imagePreview = document.getElementById('image-preview');
    let selectedFile = null;

    if (uploadZone && imageInput) {
        uploadZone.onclick = () => imageInput.click();
        uploadZone.ondragover = (e) => { e.preventDefault(); uploadZone.style.borderColor = 'var(--accent-primary)'; };
        uploadZone.ondragleave = () => { uploadZone.style.borderColor = 'var(--border-color)'; };
        uploadZone.ondrop = (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = 'var(--border-color)';
            if (e.dataTransfer.files.length > 0) handleImageSelect(e.dataTransfer.files[0]);
        };
        imageInput.onchange = (e) => {
            if (e.target.files.length > 0) handleImageSelect(e.target.files[0]);
        };
    }

    function handleImageSelect(file) {
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            if (previewImg) previewImg.src = e.target.result;
            if (imagePreview) imagePreview.classList.remove('hidden');
            if (uploadZone) uploadZone.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    document.getElementById('image-modal-close')?.addEventListener('click', () => { modal.classList.add('hidden'); resetImageModal(); });
    document.getElementById('image-modal-cancel')?.addEventListener('click', () => { modal.classList.add('hidden'); resetImageModal(); });
    document.getElementById('image-modal-insert')?.addEventListener('click', () => {
        if (!selectedFile) { showNotification('Please select an image', 'error'); return; }
        const alt = document.getElementById('img-alt')?.value || 'Image';
        const width = document.getElementById('img-width')?.value || '100';
        const height = document.getElementById('img-height')?.value || 'auto';
        uploadImage(selectedFile, alt, width, height);
        modal.classList.add('hidden');
        resetImageModal();
    });

    function resetImageModal() {
        if (imageInput) imageInput.value = '';
        const altEl = document.getElementById('img-alt');
        const widthEl = document.getElementById('img-width');
        const heightEl = document.getElementById('img-height');
        if (altEl) altEl.value = '';
        if (widthEl) widthEl.value = '100';
        if (heightEl) heightEl.value = 'auto';
        if (imagePreview) imagePreview.classList.add('hidden');
        if (uploadZone) uploadZone.style.display = 'block';
        selectedFile = null;
    }
}

async function uploadImage(file, alt, width, height) {
    showNotification('Uploading image to media.sposlearning.cz...', 'info');
    try {
        const formData = new FormData();
        formData.append('image', file);

        const token = await getAccessToken();
        const response = await fetch(`${API_URL}/upload-page-image`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Upload failed');
        }

        const data = await response.json();
        if (data.url) {
            const markdown = `![${alt}](${data.url}){width=${width}% height=${height}}`;
            insertMarkdown(markdown, '');
            showNotification('Image uploaded successfully!');
        } else {
            throw new Error('No URL returned from media server');
        }
    } catch (err) {
        console.error('Image Upload Error:', err);
        showNotification(`Upload failed: ${err.message}`, 'error');
    }
}

function openLinkModal() {
    const modal = document.getElementById('link-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    document.getElementById('link-modal-close')?.addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('link-modal-cancel')?.addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('link-modal-insert')?.addEventListener('click', () => {
        const text = document.getElementById('link-text')?.value || 'link';
        const url = document.getElementById('link-url')?.value;
        if (!url) { showNotification('Please enter a URL', 'error'); return; }
        insertMarkdown(`[${text}](${url})`, '');
        modal.classList.add('hidden');
        const textEl = document.getElementById('link-text');
        const urlEl = document.getElementById('link-url');
        if (textEl) textEl.value = '';
        if (urlEl) urlEl.value = '';
    });
}

function openDisclModal() {
    const modal = document.getElementById('discl-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    document.getElementById('discl-modal-close')?.addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('discl-modal-cancel')?.addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('discl-modal-insert')?.addEventListener('click', () => {
        const type = document.getElementById('discl-type')?.value;
        const text = document.getElementById('discl-text')?.value;
        if (!text) { showNotification('Please enter text', 'error'); return; }
        let markdown = type ? `<discl type="${type}">${text}</discl>` : `<discl>${text}</discl>`;
        insertMarkdown(markdown, '');
        modal.classList.add('hidden');
        const typeEl = document.getElementById('discl-type');
        const textEl = document.getElementById('discl-text');
        if (typeEl) typeEl.value = '';
        if (textEl) textEl.value = '';
    });
}

function insertTOCMarker() {
    tocCounter++;
    const defaultName = `Marker ${tocCounter}`;
    const name = prompt('Enter a custom title for this TOC Marker:', defaultName);
    if (name === null) return;
    const cleanName = name.trim() || defaultName;
    const markdown = `<!-- TOC_MARKER:${cleanName} -->`;
    insertMarkdown(markdown, '');
}

function generateTOC() {
    if (!previewContent) return;
    const headings = previewContent.querySelectorAll('h1, h2, h3');
    const autoEntries = [];
    let idx = 0;
    headings.forEach((heading) => {
        const level = heading.tagName === 'H1' ? 1 : (heading.tagName === 'H2' ? 2 : 3);
        const title = heading.textContent.trim() || `Heading ${idx + 1}`;
        if (!heading.id) {
            heading.id = `heading-${Date.now()}-${idx}`;
        }
        autoEntries.push({
            id: `auto-${Date.now()}-${idx}`,
            level,
            title,
            isManual: false,
            headingId: heading.id,
            markerId: null
        });
        idx++;
    });

    const markdown = getEditorContent();
    const markerRegex = /<!--\s*TOC_MARKER:([^>]+?)\s*-->/g;
    const manualEntries = [];
    let match;
    while ((match = markerRegex.exec(markdown)) !== null) {
        const rawContent = match[1].trim();
        let markerTitle = rawContent;
        if (rawContent.includes(':')) {
            const parts = rawContent.split(':');
            markerTitle = parts.slice(1).join(':').trim() || parts[0].trim();
        }
        manualEntries.push({
            id: `manual-${rawContent}`,
            level: 0,
            title: `📌 ${markerTitle}`,
            isManual: true,
            headingId: null,
            markerId: rawContent
        });
    }

    const existingManual = toc.filter(t => t.isManual);
    const existingManualMap = {};
    existingManual.forEach(t => { existingManualMap[t.id] = t; });

    const mergedManual = manualEntries.map(m => {
        if (existingManualMap[m.id]) {
            return { ...existingManualMap[m.id], title: m.title };
        }
        return m;
    });

    toc = [...autoEntries, ...mergedManual];

    const seen = new Set();
    toc = toc.filter(t => {
        if (t.isManual) {
            if (seen.has(t.markerId)) return false;
            seen.add(t.markerId);
        }
        return true;
    });

    displayTOC();
}

function displayTOC() {
    const tocList = document.getElementById('toc-list');
    if (!tocList) return;

    if (!toc || toc.length === 0) {
        tocList.innerHTML =
            `<div style="color: var(--text-tertiary); font-size: 0.85rem; text-align: center; padding: 20px 0;">No headings or TOC markers</div>`;
        return;
    }

    tocList.innerHTML = toc.map((item, index) => `
        <div class="toc-item ${item.isManual ? 'manual' : 'auto'}" data-index="${index}">
          <div class="toc-content">
            <strong>${item.title}</strong>
            <small>${item.isManual ? 'Manual' : 'H' + item.level}</small>
          </div>
          <div class="toc-actions">
            <button class="btn-small danger" data-action="remove" data-index="${index}" title="Remove">✕</button>
            <button class="btn-small" data-action="up" data-index="${index}" title="Move up">↑</button>
            <button class="btn-small" data-action="down" data-index="${index}" title="Move down">↓</button>
          </div>
        </div>
      `).join('');

    tocList.querySelectorAll('.btn-small').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.target.closest('button').dataset.action;
            const idx = parseInt(e.target.closest('button').dataset.index);
            if (isNaN(idx)) return;

            if (action === 'remove') {
                toc.splice(idx, 1);
            } else if (action === 'up' && idx > 0) {
                [toc[idx], toc[idx - 1]] = [toc[idx - 1], toc[idx]];
            } else if (action === 'down' && idx < toc.length - 1) {
                [toc[idx], toc[idx + 1]] = [toc[idx + 1], toc[idx]];
            }
            displayTOC();
        });
    });
}

function togglePreview() {
    const icon = document.getElementById('toggle-view-icon');
    if (!editorPanel || !previewPanel) return;
    if (editorPanel.classList.contains('hidden')) {
        editorPanel.classList.remove('hidden');
        previewPanel.classList.add('hidden');
        if (icon) icon.textContent = 'preview';
        if (cmEditor) cmEditor.refresh();
    } else {
        editorPanel.classList.add('hidden');
        previewPanel.classList.remove('hidden');
        if (icon) icon.textContent = 'edit';
    }
}

async function updateArticle() {
    const title = document.getElementById('article-title')?.value.trim() || '';
    const path = document.getElementById('article-path')?.value.trim() || '';
    const isAdmin = document.getElementById('article-admin')?.checked || false;
    const content = getEditorContent().trim();

    if (!title || !path || !content) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    const formattedPath = path.replace(/^\/|\/$/g, '');
    const author = currentUser
        ? (currentUser.preferred_username || currentUser.username || currentUser.name || 'admin')
        : 'admin';

    const headers = { 'Content-Type': 'application/json' };
    try {
        const token = await getAccessToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    } catch (e) {
        console.warn('Could not retrieve access token:', e);
    }

    const grade = parseInt(document.getElementById('article-grade')?.value || 0, 10);

    try {
        let response = await fetch(`${API_URL}/pages`, {
            method: 'PUT',
            headers: headers,
            credentials: 'include',
            body: JSON.stringify({
                id: loadedPageId,
                title,
                fullPath: formattedPath,
                originalPath: originalPath || formattedPath,
                accessLevel: isAdmin ? 'admin' : 'public',
                grade,
                content,
                lastEditedBy: author
            })
        });

        if (!response.ok && (response.status === 404 || response.status === 405)) {
            response = await fetch(`${API_URL}/pages`, {
                method: 'POST',
                headers: headers,
                credentials: 'include',
                body: JSON.stringify({
                    title,
                    fullPath: formattedPath,
                    content,
                    type: 'markdown',
                    accessLevel: isAdmin ? 'admin' : 'public',
                    grade,
                    createdBy: author
                })
            });
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update page');
        }

        showNotification('Page updated successfully!');
        clearDraft();
        setTimeout(() => { window.location.href = `/${formattedPath}`; }, 1500);
    } catch (e) {
        showNotification(`Error: ${e.message}`, 'error');
    }
}

async function deletePage() {
    const titleVal = document.getElementById('article-title')?.value || 'this page';
    if (!confirm(`Are you sure you want to permanently delete "${titleVal}"? This action cannot be undone.`)) {
        return;
    }

    const deleteBtn = document.getElementById('delete-page-btn');
    if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = `<span class="icon spinner">sync</span> Deleting...`;
    }

    try {
        const token = await getAccessToken();
        const urlParams = new URLSearchParams(window.location.search);
        const idParam = urlParams.get('id');
        const pathParam = urlParams.get('path');

        const url = idParam ? `${API_URL}/page?id=${idParam}` : `${API_URL}/page?path=${encodeURIComponent(pathParam || originalPath)}`;

        const res = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to delete page');
        }

        showNotification('Page deleted successfully!');
        clearDraft();
        setTimeout(() => {
            window.location.href = '/admin/dashboard';
        }, 1000);

    } catch (err) {
        console.error('Delete Error:', err);
        showNotification(`Delete error: ${err.message}`, 'error');
        if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = `<span class="icon">delete</span> Delete Page`;
        }
    }
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    notification.textContent = message;
    notification.classList.remove('hidden', 'error');
    if (type === 'error') notification.classList.add('error');
    clearTimeout(notification._timeout);
    notification._timeout = setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuth);
} else {
    checkAuth();
}
