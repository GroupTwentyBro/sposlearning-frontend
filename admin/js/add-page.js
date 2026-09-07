import { CONFIG } from "/js/config.js";
import { initAuth, getUser, getAccessToken } from "/js/auth.js";

const API_URL = CONFIG.API_URL;
let currentUser = null;
let toc = [];
let tocCounter = 0;
let cmEditor = null;
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
        loadDraft();
    } catch (err) {
        console.error('Editor initialization error:', err);
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
    localStorage.setItem('article-draft', JSON.stringify(draft));
}
function saveDraft() {
    saveDraftSilently();
    showNotification('Draft saved to browser');
}
function loadDraft() {
    const draft = localStorage.getItem('article-draft');
    if (draft) {
        try {
            const data = JSON.parse(draft);
            document.getElementById('article-title').value = data.title || '';
            document.getElementById('article-path').value = data.path || '';
            document.getElementById('article-admin').checked = data.admin || false;
            setEditorContent(data.content || '');
        } catch (e) { console.error('Failed to load draft', e); }
    }
}
function clearDraft() { localStorage.removeItem('article-draft'); }

function initializeEditor() {
    const textarea = document.getElementById('editor');
    if (window.CodeMirror) {
        cmEditor = CodeMirror.fromTextArea(textarea, {
            mode: {
                name: 'gfm',
                tokenTypeOverrides: {
                    emoji: 'emoji'
                }
            },
            lineWrapping: true,
            theme: 'default',
            viewportMargin: Infinity
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
    } else {
        textarea.addEventListener('input', () => {
            renderPreview();
            saveDraftSilently();
        });
    }
    setupToolbar();
    toggleViewBtn?.addEventListener('click', togglePreview);
    document.getElementById('save-draft-btn')?.addEventListener('click', saveDraft);
    document.getElementById('publish-btn')?.addEventListener('click', publishArticle);
    document.getElementById('preview-btn')?.addEventListener('click', () => {
        if (previewPanel) previewPanel.classList.remove('hidden');
        if (editorPanel) editorPanel.classList.add('hidden');
        const icon = document.getElementById('toggle-view-icon');
        if (icon) icon.textContent = 'edit';
    });
    window.addEventListener('beforeunload', (e) => {
        if (getEditorContent().trim()) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
    renderPreview();
}

function renderPreview() {
    const markdown = getEditorContent();
    const processedMarkdown = markdown.replace(/!\[(.*?)\]\((.*?)\)\{width=(.*?) height=(.*?)\}/g, (match, alt, url, w, h) => {
        return `<img src="${url}" alt="${alt}" style="width:${w}; height:${h}; max-width: 100%;" />`;
    });
    let html = marked.parse(processedMarkdown);
    const temp = document.createElement('div');
    temp.innerHTML = html;
    temp.querySelectorAll('pre code').forEach((block) => {
        if (block.classList.length === 0) return;
        hljs.highlightElement(block);
    });
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
    document.getElementById('btn-codeblock')?.addEventListener('click', () => {
        insertMarkdown('```javascript\n', '\n```');
    });
    document.getElementById('btn-image')?.addEventListener('click', openImageModal);
    document.getElementById('btn-toc')?.addEventListener('click', insertTOCMarker);
    document.getElementById('btn-discl')?.addEventListener('click', openDisclModal);
    document.getElementById('btn-hint')?.addEventListener('click', () => {
        const tip = prompt('Tooltip text:', 'tooltip text') || 'tooltip text';
        const text = prompt('Hover text:', 'hover text') || 'hover text';
        const html = `<span class="hint">${text}<span class="hint-tip">${tip}</span></span>`;
        insertMarkdown(html, '');
    });
    document.getElementById('btn-box')?.addEventListener('click', () => {
        insertMarkdown('<div class="box">\n', '\n</div>');
    });
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
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
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
    modal.classList.remove('hidden');
    const uploadZone = document.getElementById('upload-zone');
    const imageInput = document.getElementById('image-input');
    const previewImg = document.getElementById('preview-img');
    const imagePreview = document.getElementById('image-preview');
    let selectedFile = null;
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
    function handleImageSelect(file) {
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            imagePreview.classList.remove('hidden');
            uploadZone.style.display = 'none';
        };
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
        let markdown = type ? `<discl type="${type}">${text}</discl>` : `<discl>${text}</discl>`;
        insertMarkdown(markdown, '');
        modal.classList.add('hidden');
        document.getElementById('discl-type').value = '';
        document.getElementById('discl-text').value = '';
    };
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
    if (!toc || toc.length === 0) {
        tocList.innerHTML =
            `<div style="color: var(--text-tertiary); font-size: 0.85rem; text-align: center; padding: 20px 0;">No headings or TOC markers</div>`;
        return;
    }
    tocList.innerHTML = toc.map((item, index) => `
        <div class="toc-item ${item.isManual ? 'manual' : 'auto'}" data-index="${index}">
          <div class="toc-content">
            <strong>${item.isManual ? '📌 ' : ''}${item.title}</strong>
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

async function publishArticle() {
    const title = document.getElementById('article-title').value.trim();
    const path = document.getElementById('article-path').value.trim();
    const isAdmin = document.getElementById('article-admin').checked;
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
        const response = await fetch(`${API_URL}/pages`, {
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
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to publish');
        }
        showNotification('Article published!');
        clearDraft();
        setTimeout(() => { window.location.href = `/${formattedPath}`; }, 1500);
    } catch (e) {
        showNotification(`Error: ${e.message}`, 'error');
    }
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.remove('hidden', 'error');
    if (type === 'error') notification.classList.add('error');
    clearTimeout(notification._timeout);
    notification._timeout = setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});