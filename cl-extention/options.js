// options.js — Options page logic
// Manages: API provider selection, key storage, model switching, resume management

import { getProviderConfig, setProviderConfig, saveApiKey, getApiKeys, getResumes, saveResume, deleteResume } from './utils/storage.js';
import { createResumeObject, NICHE_TAGS } from './resume/resume-manager.js';

// ─── DOM References ───

const $ = (id) => document.getElementById(id);

const els = {
    // Tabs
    tabs: document.querySelectorAll('.tab'),

    // Provider
    providerSelect: $('provider-select'),
    modelSelect: $('model-select'),
    apiKeyInput: $('api-key-input'),
    toggleKeyVisibility: $('toggle-key-visibility'),
    saveProviderBtn: $('save-provider-btn'),
    providerStatus: $('provider-status'),

    // Resumes
    optionsResumeList: $('options-resume-list'),
    optionsResumeUpload: $('options-resume-upload'),

    // Tag modal
    tagModalOverlay: $('options-tag-modal-overlay'),
    tagModalFilename: $('options-tag-modal-filename'),
    tagOptions: $('options-tag-options'),
    tagModalSave: $('options-tag-modal-save'),
    tagModalCancel: $('options-tag-modal-cancel'),

    // Toast
    toastContainer: $('toast-container'),
};

// ─── Provider Models (mirrored from provider classes) ───

const PROVIDER_MODELS = {
    google: [
        { id: 'gemini-3-pro', name: 'Gemini 3 Pro' },
        { id: 'gemini-3-flash', name: 'Gemini 3 Flash' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
        { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    ],
    openrouter: [
        { id: 'z-ai/glm-4.5-air:free', name: 'GLM 4.5 Air (Free)' },
        { id: 'openai/gpt-oss-120b:free', name: 'GPT-OSS 120B (Free)' },
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
        { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
        { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
        { id: 'openai/gpt-4o', name: 'GPT-4o' },
        { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
    ],
};

// ─── State ───

let pendingResumeData = null;
let selectedTags = new Set();

// ─── Initialize ───

async function init() {
    await loadProviderConfig();
    await loadResumes();
    setupEventListeners();
}

// ─── Provider Config ───

async function loadProviderConfig() {
    const config = await getProviderConfig();

    els.providerSelect.value = config.provider;
    updateModelDropdown(config.provider, config.model);

    // Load the API key for the current provider
    const apiKeys = config.apiKeys || {};
    const currentKey = apiKeys[config.provider] || '';
    els.apiKeyInput.value = currentKey;

    updateProviderStatus(config.provider, currentKey);
}

function updateModelDropdown(provider, selectedModel = '') {
    const models = PROVIDER_MODELS[provider] || [];
    els.modelSelect.innerHTML = '<option value="">Select a model</option>';

    models.forEach((m) => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        if (m.id === selectedModel) opt.selected = true;
        els.modelSelect.appendChild(opt);
    });
}

function updateProviderStatus(provider, apiKey) {
    if (apiKey) {
        const masked = apiKey.substring(0, 6) + '••••••' + apiKey.substring(apiKey.length - 4);
        els.providerStatus.innerHTML = `✅ ${provider} configured — Key: <code style="font-size: 11px; background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px;">${masked}</code>`;
        els.providerStatus.style.color = 'var(--success)';
    } else {
        els.providerStatus.textContent = '⚠️ No API key set for this provider.';
        els.providerStatus.style.color = 'var(--warning)';
    }
}

async function handleSaveProvider() {
    const provider = els.providerSelect.value;
    const model = els.modelSelect.value;
    const apiKey = els.apiKeyInput.value.trim();

    if (!model) {
        showToast('Please select a model.', 'warning');
        return;
    }

    // Save API key
    if (apiKey) {
        await saveApiKey(provider, apiKey);
    }

    // Save provider + model selection
    await setProviderConfig(provider, model);

    updateProviderStatus(provider, apiKey);
    showToast('Settings saved!', 'success');
}

// ─── Resume Management ───

async function loadResumes() {
    const resumes = await getResumes();
    renderResumeList(resumes);
}

function renderResumeList(resumes) {
    if (resumes.length === 0) {
        els.optionsResumeList.innerHTML = `
      <p style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 16px;">
        No resumes uploaded yet. Upload your first resume below.
      </p>`;
        return;
    }

    els.optionsResumeList.innerHTML = '';
    resumes.forEach((r) => {
        const item = document.createElement('div');
        item.className = 'resume-item';
        item.innerHTML = `
      <div class="resume-item-info">
        <span class="resume-item-name">${r.fileName}</span>
        <div class="tag-container">
          ${(r.tags || []).map((t) => `<span class="tag">${t}</span>`).join('')}
        </div>
        <span style="font-size: 10px; color: var(--text-muted);">
          Uploaded ${new Date(r.uploadedAt).toLocaleDateString()}
        </span>
      </div>
      <button class="resume-item-delete" data-id="${r.id}" title="Delete">🗑️</button>
    `;
        els.optionsResumeList.appendChild(item);
    });

    // Delete handlers
    els.optionsResumeList.querySelectorAll('.resume-item-delete').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            await deleteResume(id);
            showToast('Resume deleted', 'success');
            await loadResumes();
        });
    });
}

// ─── File Upload (Options) ───

async function handleFileUpload(file) {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showToast('File too large. Max 5 MB.', 'error');
        return;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    let rawText;

    try {
        if (ext === 'pdf') {
            rawText = await parsePDFFile(file);
        } else if (ext === 'docx') {
            rawText = await parseDOCXFile(file);
        } else {
            showToast('Unsupported file type. Use PDF or DOCX.', 'error');
            return;
        }
    } catch (e) {
        showToast(`Failed to parse: ${e.message}`, 'error');
        return;
    }

    if (!rawText || rawText.trim().length < 20) {
        showToast('Could not extract text from the file.', 'error');
        return;
    }

    pendingResumeData = { fileName: file.name, rawText };
    openTagModal(file.name);
}

async function parsePDFFile(file) {
    if (typeof pdfjsLib === 'undefined') throw new Error('PDF library not loaded');
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => item.str).join(' '));
    }
    return pages.join('\n\n');
}

async function parseDOCXFile(file) {
    if (typeof mammoth === 'undefined') throw new Error('DOCX library not loaded');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}

// ─── Tagging Modal ───

function openTagModal(fileName) {
    selectedTags.clear();
    els.tagModalFilename.textContent = fileName;

    els.tagOptions.innerHTML = NICHE_TAGS
        .map((tag) => `<span class="tag-option" data-tag="${tag}">${tag}</span>`)
        .join('');

    els.tagOptions.querySelectorAll('.tag-option').forEach((el) => {
        el.addEventListener('click', () => {
            const tag = el.dataset.tag;
            if (selectedTags.has(tag)) {
                selectedTags.delete(tag);
                el.classList.remove('selected');
            } else {
                selectedTags.add(tag);
                el.classList.add('selected');
            }
        });
    });

    els.tagModalOverlay.classList.add('active');
}

function closeTagModal() {
    els.tagModalOverlay.classList.remove('active');
    pendingResumeData = null;
    selectedTags.clear();
}

async function saveTaggedResume() {
    if (!pendingResumeData) return;

    const resume = createResumeObject(
        pendingResumeData.fileName,
        pendingResumeData.rawText,
        Array.from(selectedTags)
    );

    await saveResume(resume);
    showToast('Resume saved!', 'success');
    closeTagModal();
    await loadResumes();
}

// ─── Toast ───

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    els.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// ─── Event Listeners ───

function setupEventListeners() {
    // Tabs
    els.tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            els.tabs.forEach((t) => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // Provider change → update model dropdown + load key
    els.providerSelect.addEventListener('change', async () => {
        const provider = els.providerSelect.value;
        updateModelDropdown(provider);

        const keys = await getApiKeys();
        els.apiKeyInput.value = keys[provider] || '';
        updateProviderStatus(provider, keys[provider] || '');
    });

    // Toggle key visibility
    els.toggleKeyVisibility.addEventListener('click', () => {
        const input = els.apiKeyInput;
        if (input.type === 'password') {
            input.type = 'text';
            els.toggleKeyVisibility.textContent = '🙈';
        } else {
            input.type = 'password';
            els.toggleKeyVisibility.textContent = '👁️';
        }
    });

    // Save provider
    els.saveProviderBtn.addEventListener('click', handleSaveProvider);

    // Resume upload
    els.optionsResumeUpload.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            handleFileUpload(e.target.files[0]);
            e.target.value = '';
        }
    });

    // Tag modal
    els.tagModalSave.addEventListener('click', saveTaggedResume);
    els.tagModalCancel.addEventListener('click', closeTagModal);
    els.tagModalOverlay.addEventListener('click', (e) => {
        if (e.target === els.tagModalOverlay) closeTagModal();
    });
}

// ─── Start ───
init();
