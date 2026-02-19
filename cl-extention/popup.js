// popup.js — Main popup logic
// Handles: job preview, resume selection, generation, output, resume management

import { getResumes, saveResume, deleteResume } from './utils/storage.js';
import { createResumeObject, NICHE_TAGS } from './resume/resume-manager.js';

// ─── DOM References ───

const $ = (id) => document.getElementById(id);

const els = {
    // Job
    jobCard: $('job-card'),
    jobEmpty: $('job-empty'),
    jobPreviewWrap: $('job-preview-wrap'),
    jobPreviewText: $('job-preview-text'),
    manualPasteToggle: $('manual-paste-toggle'),
    manualPasteWrap: $('manual-paste-wrap'),
    manualJobInput: $('manual-job-input'),
    usePastedJob: $('use-pasted-job'),
    cancelPaste: $('cancel-paste'),
    editJobBtn: $('edit-job-btn'),
    platformBadge: $('platform-badge'),

    // Resume
    resumeSelect: $('resume-select'),
    selectedResumeTags: $('selected-resume-tags'),
    manageResumesBtn: $('manage-resumes-btn'),
    resumeManageCard: $('resume-manage-card'),
    closeManageBtn: $('close-manage-btn'),
    resumeUploadInput: $('resume-upload-input'),
    resumeList: $('resume-list'),

    // Generate
    generateBtn: $('generate-btn'),

    // Output
    outputCard: $('output-card'),
    outputText: $('output-text'),
    wordCount: $('word-count'),
    copyBtn: $('copy-btn'),
    regenerateBtn: $('regenerate-btn'),

    // Modal
    tagModalOverlay: $('tag-modal-overlay'),
    tagModalFilename: $('tag-modal-filename'),
    tagOptions: $('tag-options'),
    tagModalSave: $('tag-modal-save'),
    tagModalCancel: $('tag-modal-cancel'),

    // Settings
    openSettings: $('open-settings'),

    // Toast
    toastContainer: $('toast-container'),
};

// ─── State ───

let currentJob = null;
let resumes = [];
let pendingResumeData = null; // For the tagging modal
let selectedTags = new Set();
let isGenerating = false;

// ─── Initialize ───

async function init() {
    await loadJob();
    await loadResumes();
    updateGenerateButton();
    setupEventListeners();
}

// ─── Job Loading ───

async function loadJob() {
    try {
        const job = await chrome.runtime.sendMessage({ type: 'GET_JOB' });
        if (job && job.description) {
            setJob(job);
        }
    } catch (e) {
        console.warn('Could not load job:', e);
    }
}

function setJob(job) {
    currentJob = job;
    els.jobEmpty.classList.add('hidden');
    els.manualPasteWrap.classList.add('hidden');
    els.jobPreviewWrap.classList.remove('hidden');
    els.jobPreviewText.textContent = job.description.substring(0, 300) + (job.description.length > 300 ? '…' : '');

    // Platform badge
    const platform = (job.platform || '').toLowerCase();
    els.platformBadge.classList.remove('hidden');

    if (platform.includes('upwork')) {
        els.platformBadge.className = 'badge badge-upwork';
        els.platformBadge.textContent = '🟢 Upwork';
    } else if (platform.includes('indeed')) {
        els.platformBadge.className = 'badge badge-indeed';
        els.platformBadge.textContent = '🔵 Indeed';
    } else if (platform.includes('onlinejobs')) {
        els.platformBadge.className = 'badge badge-onlinejobs';
        els.platformBadge.textContent = '🟠 OnlineJobs.ph';
    }

    if (job.fallback) {
        const fallbackBadge = document.createElement('span');
        fallbackBadge.className = 'badge badge-fallback';
        fallbackBadge.textContent = '⚠️ Auto-detected';
        fallbackBadge.style.marginLeft = '6px';
        els.platformBadge.parentElement.appendChild(fallbackBadge);
    }

    updateGenerateButton();
}

// ─── Resume Loading ───

async function loadResumes() {
    resumes = await getResumes();
    renderResumeDropdown();
    renderResumeList();
}

function renderResumeDropdown() {
    els.resumeSelect.innerHTML = '';

    if (resumes.length === 0) {
        els.resumeSelect.innerHTML = '<option value="">No resumes uploaded</option>';
        els.resumeSelect.disabled = true;
    } else {
        els.resumeSelect.disabled = false;
        resumes.forEach((r) => {
            const opt = document.createElement('option');
            opt.value = r.id;
            const tags = r.tags && r.tags.length ? ` [${r.tags.join(', ')}]` : '';
            opt.textContent = `${r.fileName}${tags}`;
            els.resumeSelect.appendChild(opt);
        });
    }

    updateSelectedResumeTags();
    updateGenerateButton();
}

function updateSelectedResumeTags() {
    const selectedId = els.resumeSelect.value;
    const resume = resumes.find((r) => r.id === selectedId);

    if (resume && resume.tags && resume.tags.length > 0) {
        els.selectedResumeTags.classList.remove('hidden');
        els.selectedResumeTags.innerHTML = resume.tags
            .map((t) => `<span class="tag">${t}</span>`)
            .join('');
    } else {
        els.selectedResumeTags.classList.add('hidden');
    }
}

function renderResumeList() {
    els.resumeList.innerHTML = '';

    if (resumes.length === 0) {
        els.resumeList.innerHTML = '<p style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 8px;">No resumes uploaded yet</p>';
        return;
    }

    resumes.forEach((r) => {
        const item = document.createElement('div');
        item.className = 'resume-item';
        item.innerHTML = `
      <div class="resume-item-info">
        <span class="resume-item-name">${r.fileName}</span>
        <div class="tag-container">
          ${(r.tags || []).map((t) => `<span class="tag">${t}</span>`).join('')}
        </div>
      </div>
      <button class="resume-item-delete" data-id="${r.id}" title="Delete">🗑️</button>
    `;
        els.resumeList.appendChild(item);
    });

    // Attach delete handlers
    els.resumeList.querySelectorAll('.resume-item-delete').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            await deleteResume(id);
            showToast('Resume deleted', 'success');
            await loadResumes();
        });
    });
}

// ─── File Upload ───

async function handleFileUpload(file) {
    if (!file) return;

    // Validate size (5 MB max)
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
        console.error('Parse error:', e);
        showToast(`Failed to parse ${ext.toUpperCase()}: ${e.message}`, 'error');
        return;
    }

    if (!rawText || rawText.trim().length < 20) {
        showToast('Could not extract text from the file. Try a different format.', 'error');
        return;
    }

    // Store pending data and open tagging modal
    pendingResumeData = { fileName: file.name, rawText };
    openTagModal(file.name);
}

// PDF/DOCX parsing — using globals loaded via <script> tags
async function parsePDFFile(file) {
    if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF library not loaded');
    }

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
    if (typeof mammoth === 'undefined') {
        throw new Error('DOCX library not loaded');
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}

// ─── Tagging Modal ───

function openTagModal(fileName) {
    selectedTags.clear();
    els.tagModalFilename.textContent = fileName;

    // Render tag options
    els.tagOptions.innerHTML = NICHE_TAGS
        .map((tag) => `<span class="tag-option" data-tag="${tag}">${tag}</span>`)
        .join('');

    // Attach click handlers
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

    // Auto-select the new resume
    els.resumeSelect.value = resume.id;
    updateSelectedResumeTags();
    updateGenerateButton();
}

// ─── Generation ───

function updateGenerateButton() {
    const hasJob = currentJob && currentJob.description;
    const hasResume = els.resumeSelect.value && els.resumeSelect.value !== '';
    els.generateBtn.disabled = !hasJob || !hasResume || isGenerating;
}

async function handleGenerate() {
    if (isGenerating) return;

    const resumeId = els.resumeSelect.value;
    const resume = resumes.find((r) => r.id === resumeId);
    if (!resume || !currentJob) return;

    isGenerating = true;
    els.generateBtn.disabled = true;
    els.generateBtn.innerHTML = '<span class="spinner"></span> Generating...';
    els.outputCard.classList.remove('hidden');
    els.outputText.value = '';
    els.outputText.placeholder = 'Generating your cover letter...';

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'GENERATE',
            jobDescription: currentJob.description,
            resume: resume,
        });

        if (response.success) {
            els.outputText.value = response.coverLetter;
            els.outputText.readOnly = false;
            updateWordCount(response.coverLetter);
            showToast('Cover letter generated!', 'success');
        } else {
            els.outputText.placeholder = '';
            showToast(response.error || 'Generation failed', 'error');
        }
    } catch (e) {
        console.error('Generate error:', e);
        showToast('Failed to generate. Check your API key in Settings.', 'error');
    } finally {
        isGenerating = false;
        els.generateBtn.innerHTML = '✨ Generate Cover Letter';
        updateGenerateButton();
    }
}

function updateWordCount(text) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    els.wordCount.textContent = `${words} words`;

    if (words < 180) {
        els.wordCount.style.color = 'var(--warning)';
    } else if (words > 220) {
        els.wordCount.style.color = 'var(--warning)';
    } else {
        els.wordCount.style.color = 'var(--success)';
    }
}

// ─── Copy ───

async function handleCopy() {
    const text = els.outputText.value;
    if (!text) return;

    try {
        await navigator.clipboard.writeText(text);
        els.copyBtn.textContent = '✅ Copied!';
        setTimeout(() => {
            els.copyBtn.textContent = '📋 Copy';
        }, 2000);
        showToast('Copied to clipboard!', 'success');
    } catch (e) {
        showToast('Failed to copy', 'error');
    }
}

// ─── Manual Paste ───

function showManualPaste() {
    els.jobEmpty.classList.add('hidden');
    els.jobPreviewWrap.classList.add('hidden');
    els.manualPasteWrap.classList.remove('hidden');
    els.manualJobInput.focus();
}

function hideManualPaste() {
    els.manualPasteWrap.classList.add('hidden');
    if (currentJob) {
        els.jobPreviewWrap.classList.remove('hidden');
    } else {
        els.jobEmpty.classList.remove('hidden');
    }
}

function usePastedJob() {
    const text = els.manualJobInput.value.trim();
    if (text.length < 20) {
        showToast('Please paste a longer job description.', 'warning');
        return;
    }

    setJob({
        platform: 'Manual',
        title: 'Pasted Job Description',
        url: '',
        description: text,
        extractedAt: new Date().toISOString(),
        fallback: false,
    });

    els.manualPasteWrap.classList.add('hidden');
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
    // Settings
    els.openSettings.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // Manual paste
    els.manualPasteToggle.addEventListener('click', showManualPaste);
    els.editJobBtn.addEventListener('click', () => {
        els.manualJobInput.value = currentJob ? currentJob.description : '';
        showManualPaste();
    });
    els.usePastedJob.addEventListener('click', usePastedJob);
    els.cancelPaste.addEventListener('click', hideManualPaste);

    // Resume management
    els.manageResumesBtn.addEventListener('click', () => {
        els.resumeManageCard.classList.toggle('hidden');
    });
    els.closeManageBtn.addEventListener('click', () => {
        els.resumeManageCard.classList.add('hidden');
    });

    // Resume selection change
    els.resumeSelect.addEventListener('change', () => {
        updateSelectedResumeTags();
        updateGenerateButton();
    });

    // File upload
    els.resumeUploadInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            handleFileUpload(e.target.files[0]);
            e.target.value = ''; // Reset so same file can be re-uploaded
        }
    });

    // Tag modal
    els.tagModalSave.addEventListener('click', saveTaggedResume);
    els.tagModalCancel.addEventListener('click', closeTagModal);
    els.tagModalOverlay.addEventListener('click', (e) => {
        if (e.target === els.tagModalOverlay) closeTagModal();
    });

    // Generate
    els.generateBtn.addEventListener('click', handleGenerate);

    // Output actions
    els.copyBtn.addEventListener('click', handleCopy);
    els.regenerateBtn.addEventListener('click', handleGenerate);

    // Output text change → update word count
    els.outputText.addEventListener('input', () => {
        updateWordCount(els.outputText.value);
    });

    // Listen for new job scrapes while popup is open
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'JOB_SCRAPED' && message.data) {
            setJob(message.data);
            showToast(`Job captured from ${message.data.platform}!`, 'success');
        }
    });
}

// ─── Start ───
init();
