// resume/pdf-parser.js — PDF text extraction using pdf.js
// pdf.js is loaded via <script> tags in popup.html (non-module context bridge)

/**
 * Extracts all text from a PDF File object.
 * Requires pdfjsLib to be available globally (loaded via lib/pdf.min.js).
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function parsePDF(file) {
    if (typeof pdfjsLib === 'undefined') {
        throw new Error('pdf.js library not loaded. Check that lib/pdf.min.js is included.');
    }

    // Set the worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
            .map((item) => item.str)
            .join(' ')
            .replace(/\s+/g, ' ');
        pages.push(pageText.trim());
    }

    return pages.join('\n\n');
}
