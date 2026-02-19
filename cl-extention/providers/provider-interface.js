// providers/provider-interface.js — Base class for AI providers

export class AIProvider {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.model = config.model;
    }

    /**
     * Generate a cover letter.
     * @param {string} systemPrompt - The KISS system instruction
     * @param {string} userMessage  - Job description + resume data
     * @returns {Promise<string>}   - The generated cover letter text
     */
    async generate(systemPrompt, userMessage) {
        throw new Error('generate() must be implemented by subclass');
    }

    /**
     * Returns the list of available models for this provider.
     * @returns {Array<{id: string, name: string}>}
     */
    static getModels() {
        throw new Error('getModels() must be implemented by subclass');
    }
}
