import { GEMINI_API_KEY } from '../constants';

/**
 * Service for interacting with Google's Gemini AI API
 */
class GeminiService {
    constructor() {
        this.apiKey = GEMINI_API_KEY;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';
    }

    /**
     * Make a generic API call to Gemini
     * @param {Object} payload - The request payload
     * @param {Function} setNotification - Notification callback function
     * @returns {string|null} The AI response text or null if failed
     */
    async callAPI(payload, setNotification) {
        try {
            if (!this.apiKey) {
                throw new Error("Gemini API Key not found.");
            }

            const apiUrl = `${this.baseUrl}?key=${this.apiKey}`;
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(errorBody?.error?.message || `API call failed with status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.candidates && result.candidates.length > 0 && result.candidates[0].content.parts[0].text) {
                return result.candidates[0].content.parts[0].text;
            } else {
                const finishReason = result.candidates?.[0]?.finishReason;
                if (finishReason === "SAFETY") {
                    throw new Error("AI analysis failed due to safety settings.");
                }
                throw new Error("AI returned an empty response.");
            }
        } catch (error) {
            if (setNotification) {
                setNotification({ text: `AI Error: ${error.message}`, type: 'error' });
            }
            console.error('Gemini API Error:', error);
            return null;
        }
    }

    /**
     * Parse invoice image using Gemini Vision
     * @param {string} imageData - Base64 encoded image data
     * @param {Function} setNotification - Notification callback function
     * @returns {Object|null} Parsed invoice data or null if failed
     */
    async parseInvoice(imageData, setNotification) {
        const prompt = `You are an expert receipt parser. Analyze the following receipt image and extract the information into the specified JSON format.
        - shortDescription: A 2-3 line summary of the purchase, including key items or the purpose of the expense.
        - vendorName: If the name is unclear, infer a type like "Restaurant" or "Gas Station".
        - totalAmount: The FINAL amount paid, after all discounts and taxes.
        - currency: Infer the 3-letter currency code (e.g., USD, INR). Default to USD if unsure.
        - invoiceDate: Default to today's date (${new Date().toISOString().split('T')[0]}) if not found.
        - lineItems: For each item, find the final price paid, considering any discounts applied to that specific item.
        `;
        
        const schema = {
            type: "OBJECT",
            properties: {
                vendorName: { type: "STRING" },
                shortDescription: { type: "STRING" },
                totalAmount: { type: "NUMBER" },
                invoiceDate: { type: "STRING", description: "Date in YYYY-MM-DD format" },
                currency: { type: "STRING", description: "3-letter currency code like USD, EUR, INR" },
                category: { 
                    type: "STRING", 
                    enum: ['Food & Dining', 'Transportation', 'Shopping', 'Utilities', 'Healthcare', 'Entertainment', 'Other'] 
                },
                lineItems: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            description: { type: "STRING" },
                            quantity: { type: "NUMBER" },
                            price: { type: "NUMBER" },
                        },
                        required: ["description", "price"]
                    }
                }
            },
            required: ["vendorName", "totalAmount", "invoiceDate", "category", "shortDescription"]
        };

        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: 'image/jpeg', data: imageData } }
                ]
            }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        };

        const result = await this.callAPI(payload, setNotification);
        if (!result) return null;

        try {
            return JSON.parse(result);
        } catch (e) {
            console.error("Failed to parse JSON from Gemini:", e, result);
            if (setNotification) {
                setNotification({ text: "Failed to parse invoice data from AI response.", type: 'error' });
            }
            return null;
        }
    }

    /**
     * Generate financial insights from invoice data
     * @param {Array} invoices - Array of invoice objects
     * @param {Function} setNotification - Notification callback function
     * @returns {Array} Array of insight strings
     */
    async generateInsights(invoices, setNotification) {
        if (invoices.length < 1) {
            return [];
        }

        const prompt = `You are a financial assistant. Analyze the user's invoices. Generate 3 short, interesting insights. Ideas: mention a high-spending category, point out a potential expiring warranty, identify a new subscription, or suggest a related purchase. Format as a JSON array of strings. Example: ["Your spending on Food & Dining was highest last week.", "Your car insurance may be expiring soon."]\n\nData: ${JSON.stringify(invoices)}`;
        
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        };

        const result = await this.callAPI(payload, setNotification);
        if (!result) return ["Could not generate new insights at this time."];

        try {
            const startIndex = result.indexOf('[');
            const endIndex = result.lastIndexOf(']');
            if (startIndex !== -1 && endIndex !== -1) {
                const jsonString = result.substring(startIndex, endIndex + 1);
                return JSON.parse(jsonString);
            } else {
                return ["Could not generate insights from the response."];
            }
        } catch (e) {
            console.error("Failed to parse insights JSON", e, result);
            return ["Could not generate new insights at this time."];
        }
    }

    /**
     * Generate chat response for financial queries
     * @param {Array} messages - Chat message history
     * @param {Array} invoices - User's invoices
     * @param {Array} budgets - User's budgets
     * @param {string} userMessage - Latest user message
     * @param {Function} setNotification - Notification callback function
     * @returns {string} AI response
     */
    async generateChatResponse(messages, invoices, budgets, userMessage, setNotification) {
        const prompt = `You are a helpful financial assistant AI. Answer questions about spending, budgets, and perform calculations like splitting a bill. Base your answers ONLY on the provided JSON data of their invoices, budgets, and the current conversation history. If the answer isn't in the data, say so. For calculations, provide a clear breakdown. Use markdown for formatting like **bold**.\n\nConversation History:\n${JSON.stringify(messages.map(m => ({role: m.role, text: m.text})))}\n\nInvoice Data:\n${JSON.stringify(invoices)}\n\nBudget Data:\n${JSON.stringify(budgets)}\n\nUser's latest request: "${userMessage}"`;
        
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        };

        const result = await this.callAPI(payload, setNotification);
        return result || "Sorry, I couldn't process that.";
    }

    /**
     * Generate a short chat title from the first message
     * @param {string} firstMessage - The first message in the chat
     * @param {Function} setNotification - Notification callback function
     * @returns {string} Generated title
     */
    async generateChatTitle(firstMessage, setNotification) {
        const prompt = `Generate a very short, 3-4 word title for a chat that starts with this message: "${firstMessage}".`;
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        };

        const title = await this.callAPI(payload, setNotification);        return title ? title.replace(/"/g, '') : "New Chat";
    }
}

// Export singleton instance
const geminiService = new GeminiService();
export default geminiService;
