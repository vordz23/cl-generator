// providers/openrouter.js — OpenRouter API provider

import { AIProvider } from './provider-interface.js';

export class OpenRouterProvider extends AIProvider {
    async generate(systemPrompt, userMessage) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'HTTP-Referer': chrome.runtime.getURL('/'),
                'X-Title': 'CL Generator',
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage },
                ],
                max_tokens: 512,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(
                `OpenRouter Error (${response.status}): ${err.error?.message || response.statusText}`
            );
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error('OpenRouter returned an empty response.');
        return text;
    }

    static getModels() {
        return [
            { id: 'z-ai/glm-4.5-air:free', name: 'GLM 4.5 Air (Free)' },
            { id: 'openai/gpt-oss-120b:free', name: 'GPT-OSS 120B (Free)' },
            { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
            { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
            { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
            { id: 'openai/gpt-4o', name: 'GPT-4o' },
            { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
        ];
    }
}
