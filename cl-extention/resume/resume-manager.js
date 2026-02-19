// resume/resume-manager.js — Resume structuring and management utilities

/**
 * Structure raw resume text into a JSON schema using heuristics.
 * This is a best-effort parser — for better accuracy, use the AI-powered parse later.
 */
export function structureResumeText(rawText) {
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

    return {
        name: lines[0] || 'Unknown',
        title: lines.length > 1 ? lines[1] : '',
        summary: extractSection(rawText, ['summary', 'about', 'profile', 'objective', 'overview']),
        skills: extractBulletList(rawText, ['skills', 'competencies', 'expertise', 'core skills']),
        tools: extractBulletList(rawText, ['tools', 'technologies', 'software', 'platforms', 'tech stack']),
        experience: extractExperience(rawText),
        achievements: extractBulletList(rawText, ['achievements', 'accomplishments', 'highlights', 'key results']),
        metrics: extractMetrics(rawText),
    };
}

/**
 * Extracts a text block under a section heading matching one of the keywords.
 */
function extractSection(text, keywords) {
    for (const keyword of keywords) {
        const regex = new RegExp(
            `(?:^|\\n)\\s*(?:${keyword})\\s*[:\\-—]?\\s*\\n([\\s\\S]*?)(?=\\n\\s*(?:[A-Z][A-Za-z\\s]{2,30}[:\\-—])\\s*\\n|$)`,
            'im'
        );
        const match = text.match(regex);
        if (match && match[1].trim().length > 10) {
            return match[1].trim().substring(0, 600);
        }
    }
    return '';
}

/**
 * Extracts bullet points under a section heading.
 */
function extractBulletList(text, keywords) {
    const section = extractSection(text, keywords);
    if (!section) return [];

    const items = section
        .split('\n')
        .map((line) => line.replace(/^[\s•●\-\*\u2022\u25CF]+/, '').trim())
        .filter((line) => line.length > 1 && line.length < 100);

    return items.slice(0, 15);
}

/**
 * Attempts to extract work experience entries.
 */
function extractExperience(text) {
    const entries = [];

    // Pattern: Role/Title at/- Company (Date range)
    const expRegex =
        /([A-Z][A-Za-z\s&,]+?)\s+(?:at|[-–—]|@)\s+([A-Za-z\s&,.]+?)\s*[|\-(]\s*(\d{4}\s*[-–—]\s*(?:\d{4}|[Pp]resent|[Cc]urrent))/g;

    let match;
    while ((match = expRegex.exec(text)) !== null && entries.length < 5) {
        const role = match[1].trim();
        const company = match[2].trim();
        const period = match[3].trim();

        // Find highlights: bullet points after this match
        const afterMatch = text.substring(match.index + match[0].length);
        const highlightLines = afterMatch
            .split('\n')
            .slice(0, 8)
            .map((l) => l.replace(/^[\s•●\-\*\u2022\u25CF]+/, '').trim())
            .filter((l) => l.length > 10 && l.length < 200);

        entries.push({
            role,
            company,
            period,
            highlights: highlightLines.slice(0, 4),
        });
    }

    return entries;
}

/**
 * Finds lines with quantifiable metrics (percentages, dollar amounts, counts).
 */
function extractMetrics(text) {
    const metricLines = text.split('\n').filter((line) =>
        /\d+%|\$[\d,]+|[\d,]+\s*\+?\s*(?:users|clients|visitors|leads|revenue|projects|sales|traffic|conversions|subscribers|followers)/i.test(
            line
        )
    );

    return metricLines
        .map((l) => l.replace(/^[\s•●\-\*\u2022\u25CF]+/, '').trim())
        .filter((l) => l.length > 5)
        .slice(0, 10);
}

/**
 * Creates a resume object ready for storage.
 */
export function createResumeObject(fileName, rawText, tags = []) {
    return {
        id: `resume_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        fileName,
        uploadedAt: new Date().toISOString(),
        tags,
        raw: rawText,
        structured: structureResumeText(rawText),
    };
}

/**
 * Predefined niche tags for resume categorization.
 */
export const NICHE_TAGS = [
    'SEO',
    'Lead Generation',
    'Digital Marketing',
    'Content Writing',
    'Copywriting',
    'Social Media',
    'Virtual Assistant',
    'Web Development',
    'Graphic Design',
    'Data Entry',
    'Email Marketing',
    'PPC / Ads',
    'Video Editing',
    'Project Management',
    'E-commerce',
    'Customer Support',
];
