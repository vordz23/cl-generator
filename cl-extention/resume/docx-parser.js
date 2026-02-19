// resume/docx-parser.js — DOCX text extraction using mammoth.js
// mammoth.js is loaded via <script> tag in popup.html

/**
 * Extracts plain text from a DOCX File object.
 * Requires mammoth to be available globally (loaded via lib/mammoth.browser.min.js).
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function parseDOCX(file) {
    if (typeof mammoth === 'undefined') {
        throw new Error('mammoth.js library not loaded. Check that lib/mammoth.browser.min.js is included.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });

    if (result.messages && result.messages.length > 0) {
        console.warn('DOCX parse warnings:', result.messages);
    }

    return result.value.trim();
}
