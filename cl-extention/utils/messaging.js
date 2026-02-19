// utils/messaging.js — Message type constants and helpers

export const MSG = {
    JOB_SCRAPED: 'JOB_SCRAPED',
    GENERATE: 'GENERATE',
    GENERATE_RESULT: 'GENERATE_RESULT',
    GET_JOB: 'GET_JOB',
    PARSE_RESUME_AI: 'PARSE_RESUME_AI',
};

export function sendMessage(type, data = {}) {
    return chrome.runtime.sendMessage({ type, ...data });
}
