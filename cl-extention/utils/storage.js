// utils/storage.js — Promise wrappers for chrome.storage.local

export async function storageGet(keys) {
  return chrome.storage.local.get(keys);
}

export async function storageSet(data) {
  return chrome.storage.local.set(data);
}

export async function storageRemove(keys) {
  return chrome.storage.local.remove(keys);
}

// ─── Resume helpers ───

export async function getResumes() {
  const data = await storageGet('resumes');
  return data.resumes || [];
}

export async function saveResume(resume) {
  const resumes = await getResumes();
  resumes.push(resume);
  await storageSet({ resumes });
}

export async function deleteResume(id) {
  let resumes = await getResumes();
  resumes = resumes.filter(r => r.id !== id);
  await storageSet({ resumes });
}

export async function getResumeById(id) {
  const resumes = await getResumes();
  return resumes.find(r => r.id === id) || null;
}

export async function updateResume(id, updates) {
  const resumes = await getResumes();
  const idx = resumes.findIndex(r => r.id === id);
  if (idx === -1) return false;
  resumes[idx] = { ...resumes[idx], ...updates };
  await storageSet({ resumes });
  return true;
}

// ─── API Key helpers ───

export async function getApiKeys() {
  const data = await storageGet('apiKeys');
  return data.apiKeys || {};
}

export async function saveApiKey(provider, key) {
  const apiKeys = await getApiKeys();
  apiKeys[provider] = key;
  await storageSet({ apiKeys });
}

export async function getProviderConfig() {
  const data = await storageGet(['provider', 'model', 'apiKeys']);
  return {
    provider: data.provider || 'google',
    model: data.model || '',
    apiKeys: data.apiKeys || {},
  };
}

export async function setProviderConfig(provider, model) {
  await storageSet({ provider, model });
}

// ─── Job cache helpers ───

export async function cacheJob(jobData) {
  await chrome.storage.session.set({ lastJob: jobData });
}

export async function getCachedJob() {
  const data = await chrome.storage.session.get('lastJob');
  return data.lastJob || null;
}

// ─── Generation history ───

export async function getHistory() {
  const data = await storageGet('history');
  return data.history || [];
}

export async function saveToHistory(entry) {
  const history = await getHistory();
  history.unshift(entry); // newest first
  // Keep last 50 entries
  if (history.length > 50) history.length = 50;
  await storageSet({ history });
}
