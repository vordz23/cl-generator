// content.js — Job description scraper for Upwork, OnlineJobs.ph, and Indeed
// This file runs as a content script on matched job page URLs.
// It does NOT use ES modules (content scripts can't use type:module).

(function () {
    'use strict';

    // ─── Platform Configurations ───

    const PLATFORM_CONFIGS = {
        'www.upwork.com': {
            name: 'Upwork',
            selectors: [
                '[data-test="Description"] .break',
                '[data-test="job-description-text"]',
                '.job-description .break',
                '[data-cy="description"]',
                '.up-card-section .text-body',
            ],
            titleSelectors: [
                '[data-test="job-title"]',
                'h4.job-title',
                '.up-card-header h4',
            ],
        },
        'www.onlinejobs.ph': {
            name: 'OnlineJobs.ph',
            selectors: [
                '.job-description-container',
                '#job-description',
                '.jobpost-content',
                '.description-container',
            ],
            titleSelectors: [
                'h1.job-title',
                '.job-header h1',
                'h1',
            ],
        },
        'www.indeed.com': {
            name: 'Indeed',
            selectors: [
                '#jobDescriptionText',
                '.jobsearch-JobComponent-description',
                '.jobsearch-jobDescriptionText',
                '[id="jobDescriptionText"]',
            ],
            titleSelectors: [
                '.jobsearch-JobInfoHeader-title',
                'h1.jobsearch-JobInfoHeader-title',
                'h1[data-testid="jobsearch-JobInfoHeader-title"]',
                'h2.jobTitle',
            ],
        },
    };

    // ─── Detection ───

    function detectPlatform() {
        const hostname = window.location.hostname;
        return PLATFORM_CONFIGS[hostname] || null;
    }

    // ─── Extraction ───

    function queryFirst(selectors) {
        for (const selector of selectors) {
            try {
                const el = document.querySelector(selector);
                if (el && el.innerText.trim().length > 0) {
                    return el;
                }
            } catch (e) {
                // Invalid selector, skip
            }
        }
        return null;
    }

    function extractJobDescription(platform) {
        const descEl = queryFirst(platform.selectors);
        if (!descEl || descEl.innerText.trim().length < 50) return null;

        const titleEl = queryFirst(platform.titleSelectors);

        return {
            platform: platform.name,
            title: titleEl ? titleEl.innerText.trim() : document.title,
            url: window.location.href,
            description: descEl.innerText.trim(),
            extractedAt: new Date().toISOString(),
            fallback: false,
        };
    }

    function extractWithFallback(platform) {
        // Primary: use selectors
        const result = extractJobDescription(platform);
        if (result) return result;

        // Fallback: find the largest text block on the page
        const candidates = document.querySelectorAll('div, section, article, main');
        let bestEl = null;
        let bestLength = 0;

        candidates.forEach((el) => {
            const text = el.innerText.trim();
            // Look for substantial content blocks (not too small, not the entire page)
            if (text.length > bestLength && text.length > 200 && text.length < 15000) {
                // Avoid nav, header, footer
                const tag = el.tagName.toLowerCase();
                const role = el.getAttribute('role') || '';
                if (!['nav', 'header', 'footer'].includes(tag) && !['navigation', 'banner', 'contentinfo'].includes(role)) {
                    bestLength = text.length;
                    bestEl = el;
                }
            }
        });

        if (bestEl) {
            return {
                platform: platform.name,
                title: document.title,
                url: window.location.href,
                description: bestEl.innerText.trim(),
                extractedAt: new Date().toISOString(),
                fallback: true,
            };
        }

        return null;
    }

    // ─── Send to Background ───

    function sendJobData(data) {
        chrome.runtime.sendMessage({ type: 'JOB_SCRAPED', data }, (response) => {
            if (chrome.runtime.lastError) {
                // Extension context may be invalidated, silently ignore
                return;
            }
        });
    }

    // ─── Main Extraction Loop ───

    function tryExtract(retries = 5) {
        const platform = detectPlatform();
        if (!platform) return;

        const data = extractWithFallback(platform);
        if (data) {
            sendJobData(data);
            // Inject a subtle indicator that the extension captured the job
            showCaptureIndicator(data.platform, data.fallback);
            return;
        }

        if (retries > 0) {
            setTimeout(() => tryExtract(retries - 1), 1500);
        }
    }

    // ─── Visual Indicator ───

    function showCaptureIndicator(platform, isFallback) {
        // Don't show duplicate indicators
        if (document.getElementById('cl-gen-indicator')) return;

        const indicator = document.createElement('div');
        indicator.id = 'cl-gen-indicator';
        indicator.innerHTML = isFallback
            ? `✨ CL Generator — Job detected (auto-detect mode)`
            : `✨ CL Generator — ${platform} job captured`;

        Object.assign(indicator.style, {
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            padding: '10px 16px',
            background: 'rgba(99, 102, 241, 0.9)',
            color: 'white',
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontSize: '13px',
            fontWeight: '500',
            borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)',
            backdropFilter: 'blur(12px)',
            zIndex: '99999',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: '0',
            transform: 'translateY(10px)',
        });

        document.body.appendChild(indicator);

        // Animate in
        requestAnimationFrame(() => {
            indicator.style.opacity = '1';
            indicator.style.transform = 'translateY(0)';
        });

        // Fade out after 3 seconds
        setTimeout(() => {
            indicator.style.opacity = '0';
            indicator.style.transform = 'translateY(10px)';
            setTimeout(() => indicator.remove(), 400);
        }, 3000);
    }

    // ─── SPA Navigation Detection ───

    let lastUrl = location.href;

    const observer = new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            // Re-extract after navigation (SPA like Upwork)
            setTimeout(() => tryExtract(), 2000);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // ─── Start ───
    tryExtract();
})();
