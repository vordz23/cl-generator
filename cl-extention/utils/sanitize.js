// utils/sanitize.js — Text cleaning for scraped job descriptions

/**
 * Strips HTML tags and normalizes whitespace.
 */
export function sanitizeText(html) {
    // Remove HTML tags
    let text = html.replace(/<[^>]*>/g, ' ');

    // Decode common HTML entities
    text = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');

    // Normalize whitespace: collapse multiple spaces/tabs into one
    text = text.replace(/[ \t]+/g, ' ');

    // Normalize line breaks: collapse 3+ newlines into 2
    text = text.replace(/\n{3,}/g, '\n\n');

    // Trim each line
    text = text
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        .trim();

    return text;
}

/**
 * Truncates text to maxLength characters, ending at a word boundary.
 */
export function truncateText(text, maxLength = 3000) {
    if (text.length <= maxLength) return text;
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > maxLength * 0.8 ? truncated.substring(0, lastSpace) : truncated) + '…';
}
