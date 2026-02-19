// background.js — Service Worker (MV3)
// Orchestrates: message routing, AI generation, job caching

import { GoogleAIProvider } from './providers/google-ai.js';
import { OpenRouterProvider } from './providers/openrouter.js';
import { truncateText } from './utils/sanitize.js';

// ─── Provider Registry ───

const PROVIDERS = {
    google: GoogleAIProvider,
    openrouter: OpenRouterProvider,
};

// ─── System Prompt (KISS Method) ───

const SYSTEM_PROMPT = `You are an expert Filipino freelancer who writes Upwork and OnlineJobs.ph cover letters using the KISS method popularized by Molongski.

KISS here means: Keep it Simple and Short, direct to the point, and focused on what the client needs instead of buzzwords or long stories.

Follow these rules strictly:

1. Start with 1–2 short sentences showing understanding of the client's problem (no generic greetings).
2. Add 3–5 bullet points connecting relevant experience directly to the job requirements. Include numbers, tools, and results.
3. Use simple conversational English with a slightly Filipino freelancer tone. Keep it professional.
4. Avoid jargon, clichés, or templates.
5. Keep it between 180–220 words.
6. End with 1–2 short questions that move the conversation forward plus a simple call to action.
7. Before writing, think about the top 3 priorities of the client and ensure every line addresses those priorities.
8. Do not explain the KISS method.`;

// ─── Provider Factory ───

async function getConfiguredProvider() {
    const data = await chrome.storage.local.get(['provider', 'model', 'apiKeys']);
    const providerName = data.provider || 'google';
    const apiKey = data.apiKeys?.[providerName] || '';
    const model = data.model || '';

    if (!apiKey) {
        throw new Error(`No API key configured for ${providerName}. Go to Settings (⚙️) to add one.`);
    }

    if (!model) {
        throw new Error(`No model selected. Go to Settings (⚙️) to choose a model.`);
    }

    const ProviderClass = PROVIDERS[providerName];
    if (!ProviderClass) {
        throw new Error(`Unknown provider: ${providerName}`);
    }

    return new ProviderClass({ apiKey, model });
}

// ─── Prompt Builder ───

function buildUserMessage(jobDescription, resume) {
    const s = resume.structured;

    const experienceBlock = s.experience && s.experience.length > 0
        ? s.experience
            .slice(0, 3)
            .map((e) => `• ${e.role} at ${e.company} (${e.period}): ${e.highlights.join('; ')}`)
            .join('\n')
        : 'No structured experience available.';

    const resumeSection = [
        `Name: ${s.name}`,
        s.title ? `Title: ${s.title}` : '',
        s.skills.length ? `Key Skills: ${s.skills.slice(0, 8).join(', ')}` : '',
        s.tools.length ? `Tools: ${s.tools.slice(0, 8).join(', ')}` : '',
        `\nRelevant Experience:\n${experienceBlock}`,
        s.achievements.length
            ? `\nKey Achievements:\n${s.achievements.slice(0, 5).map((a) => `• ${a}`).join('\n')}`
            : '',
    ]
        .filter(Boolean)
        .join('\n');

    const truncatedJob = truncateText(jobDescription, 3000);

    return `Write a cover letter for this job:

--- JOB DESCRIPTION ---
${truncatedJob}
--- END JOB DESCRIPTION ---

--- MY RESUME ---
${resumeSection}
--- END RESUME ---

Use the information above to craft a personalized cover letter.`;
}

// ─── Message Handler ───

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Validate that the message comes from our extension
    if (sender.id !== chrome.runtime.id) return;

    switch (message.type) {
        case 'JOB_SCRAPED':
            handleJobScraped(message.data);
            sendResponse({ success: true });
            break;

        case 'GET_JOB':
            handleGetJob().then(sendResponse);
            return true; // async

        case 'GENERATE':
            handleGenerate(message.jobDescription, message.resume)
                .then((coverLetter) => sendResponse({ success: true, coverLetter }))
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true; // async

        case 'GET_PROVIDERS':
            sendResponse({
                providers: Object.keys(PROVIDERS).map((key) => ({
                    id: key,
                    name: key.charAt(0).toUpperCase() + key.slice(1),
                    models: PROVIDERS[key].getModels(),
                })),
            });
            break;

        default:
            break;
    }
});

// ─── Handlers ───

async function handleJobScraped(data) {
    if (!data || !data.description) return;

    // Cache in session storage (ephemeral, lost when browser closes)
    await chrome.storage.session.set({ lastJob: data });

    // Update the badge to show a job is ready
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });

    console.log(`[CL Generator] Job scraped from ${data.platform}: ${data.title}`);
}

async function handleGetJob() {
    const data = await chrome.storage.session.get('lastJob');
    return data.lastJob || null;
}

async function handleGenerate(jobDescription, resume) {
    if (!jobDescription) throw new Error('No job description provided.');
    if (!resume) throw new Error('No resume selected.');

    const provider = await getConfiguredProvider();
    const userMessage = buildUserMessage(jobDescription, resume);

    console.log(`[CL Generator] Generating with ${resume.structured.name}'s resume...`);

    const coverLetter = await provider.generate(SYSTEM_PROMPT, userMessage);

    // Save to history
    try {
        const histData = await chrome.storage.local.get('history');
        const history = histData.history || [];
        history.unshift({
            id: `gen_${Date.now()}`,
            timestamp: new Date().toISOString(),
            jobTitle: jobDescription.substring(0, 80),
            resumeName: resume.fileName,
            coverLetter,
        });
        if (history.length > 50) history.length = 50;
        await chrome.storage.local.set({ history });
    } catch (e) {
        console.warn('[CL Generator] Failed to save to history:', e);
    }

    // Clear the badge
    chrome.action.setBadgeText({ text: '' });

    return coverLetter;
}

// ─── Startup ───
console.log('[CL Generator] Service worker started.');
