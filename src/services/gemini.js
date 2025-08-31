import { GEMINI_API_KEY } from '../constants';
import LocalModelService from './localModel';
import OfflineStoreService from './offlineStore';

/**
 * Service for interacting with Google's Gemini AI API
 * and managing fallback to local model
 */
class GeminiService {
    constructor() {
        this.apiKey = GEMINI_API_KEY;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';
        this.isOfflineMode = false;
    }    
    /**
     * Set the offline mode state
     * @param {boolean} isOffline - Whether offline mode is enabled
     */
    setOfflineMode(isOffline) {
        console.log('GeminiService: Setting offline mode to:', isOffline);
        if (this.isOfflineMode !== isOffline) {
            this.isOfflineMode = isOffline;
            
            // Store the preference
            localStorage.setItem('geminiServiceOfflineMode', isOffline.toString());
            
            // Broadcast an event that offline mode has changed
            window.dispatchEvent(new CustomEvent('offlineModeChanged', { 
                detail: { 
                    isOfflineMode: isOffline,
                    timestamp: Date.now()
                } 
            }));
            
            // Log mode change for analytics/debugging
            console.log(`AI Processing mode switched to: ${isOffline ? 'Offline (Local)' : 'Online (Cloud)'}`);
        }
    }

    /**
     * Make a generic API call to Gemini or use local model if in offline mode
     * @param {Object} payload - The request payload
     * @param {Function} setNotification - Notification callback function
     * @returns {string|null} The AI response text or null if failed
     */    async callAPI(payload, setNotification) {
        const startTime = performance.now();
        let usedLocalModel = false;
        
        try {
            // First check if we're offline at the network level
            if (!navigator.onLine) {
                if (LocalModelService.isModelReady) {
                    console.log('Network offline, using local model');
                    usedLocalModel = true;
                    const response = await this.generateWithLocalModel(payload);
                    
                    const endTime = performance.now();
                    console.log(`AI response generated using local model in ${Math.round(endTime - startTime)}ms`);
                    
                    // Record offline usage
                    OfflineStoreService.recordFallbackUse('offline');
                    
                    return response;
                } else {
                    throw new Error("You are offline and local model is not available");
                }
            }
            
            // Check if we should use local model based on settings
            if (this.isOfflineMode && LocalModelService.isModelReady) {
                console.log('Offline mode enabled, using local model');
                usedLocalModel = true;
                const response = await this.generateWithLocalModel(payload);
                
                const endTime = performance.now();
                console.log(`AI response generated using local model in ${Math.round(endTime - startTime)}ms`);
                
                // Record intentional local model usage
                OfflineStoreService.recordLocalModelUse(payload.task || 'intentional_offline');
                
                return response;
            }
            
            if (!this.apiKey) {
                throw new Error("Gemini API Key not found.");
            }

            console.log('Using Gemini cloud API');
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
                const endTime = performance.now();
                console.log(`AI response generated using Gemini cloud in ${Math.round(endTime - startTime)}ms`);
                
                // Record API usage for analytics
                OfflineStoreService.recordApiCall(payload.task || 'text_generation');
                
                return result.candidates[0].content.parts[0].text;
            } else {
                const finishReason = result.candidates?.[0]?.finishReason;
                if (finishReason === "SAFETY") {
                    throw new Error("AI analysis failed due to safety settings.");
                }
                throw new Error("AI returned an empty response.");
            }
        } catch (error) {
            // If online API fails and we have the local model ready, fall back to it
            if (!usedLocalModel && LocalModelService.isModelReady) {
                setNotification?.({ 
                    text: `Online API unavailable. Falling back to local model.`, 
                    type: 'warning',
                    duration: 3000
                });
                
                try {
                    console.log('Falling back to local model after cloud API failure');
                    const response = await this.generateWithLocalModel(payload);
                    
                    const endTime = performance.now();
                    console.log(`AI response generated using local model fallback in ${Math.round(endTime - startTime)}ms`);
                    
                    // Save this interaction to the offline store to track API cost savings
                    OfflineStoreService.recordFallbackUse('api_failure');
                    
                    return response;
                } catch (localError) {
                    console.error('Local model fallback also failed:', localError);
                    throw new Error(`Cloud API error: ${error.message}. Local fallback also failed.`);
                }
            }
            
            if (setNotification) {
                setNotification({ 
                    text: `AI Error: ${error.message}`, 
                    type: 'error',
                    duration: 5000
                });
            }
            console.error('Gemini API Error:', error);
            return null;
        }
    }    
    /**
     * Generate text using the local model
     * @param {Object} payload - The request payload
     * @returns {Promise<string>} - Generated text
     */
    async generateWithLocalModel(payload) {
        try {
            // Extract the prompt from the payload
            let prompt = '';
            
            if (payload.contents && payload.contents.length > 0) {
                // Extract text from parts
                for (const content of payload.contents) {
                    if (content.parts && content.parts.length > 0) {
                        for (const part of content.parts) {
                            if (part.text) {
                                prompt += part.text + ' ';
                            }
                        }
                    }
                }
            }
            
            if (!prompt) {
                throw new Error("Could not extract prompt from payload");
            }
            
            // Check if model is ready
            if (!LocalModelService.isModelReady) {
                console.warn('Local model is not ready, attempting initialization');
                const initialized = await LocalModelService.init();
                if (!initialized) {
                    throw new Error("Local model is not initialized and could not be loaded");
                }
            }
            
            // Record the request for offline analytics
            OfflineStoreService.recordLocalModelUse(payload.task || 'text_generation');
            
            // Use the local model to generate a response with timeout protection
            const timeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Local model generation timed out after 30 seconds')), 30000);
            });
            
            const generationPromise = LocalModelService.generate(prompt.trim());
            const response = await Promise.race([generationPromise, timeout]);
            
            return response;
        } catch (error) {
            console.error('Local model generation failed:', error);
            
            // Record the failure for analytics
            OfflineStoreService.recordError('local_model_generation', error.message);
            
            throw error;
        }
    }

    /**
     * Parse invoice image using Gemini Vision
     * @param {string} imageData - Base64 encoded image data
     * @param {Function} setNotification - Notification callback function
     * @returns {Object|null} Parsed invoice data or null if failed
     */
    async parseInvoice(imageData, setNotification) {
        // Note: Image processing requires online mode
        if (this.isOfflineMode) {
            setNotification?.({ 
                text: `Image processing requires online mode. Please disable offline mode temporarily.`, 
                type: 'warning' 
            });
            return null;
        }
        
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
     * @param {string} userId - User ID
     * @param {string} sessionId - Chat session ID
     * @returns {string} AI response
     */
    async generateChatResponse(messages, invoices, budgets, userMessage, setNotification, userId, sessionId) {
        const prompt = `You are a helpful financial assistant AI. Answer questions about spending, budgets, and perform calculations like splitting a bill. Base your answers ONLY on the provided JSON data of their invoices, budgets, and the current conversation history. If the answer isn't in the data, say so. For calculations, provide a clear breakdown. Use markdown for formatting like **bold**.\n\nConversation History:\n${JSON.stringify(messages.map(m => ({role: m.role, text: m.text})))}\n\nInvoice Data:\n${JSON.stringify(invoices)}\n\nBudget Data:\n${JSON.stringify(budgets)}\n\nUser's latest request: "${userMessage}"`;
        
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        };

        try {
            const result = await this.callAPI(payload, setNotification);
            
            // If in offline mode, store the response for later sync
            if (this.isOfflineMode && userId && sessionId) {
                await OfflineStoreService.storeOfflineChatMessage(userId, sessionId, {
                    role: 'model',
                    text: result,
                    prompt: userMessage
                });
            }
            
            return result || "Sorry, I couldn't process that.";
        } catch (error) {
            console.error('Chat response generation failed:', error);
            return "Sorry, I couldn't process that.";
        }
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

        try {
            const title = await this.callAPI(payload, setNotification);
            return title ? title.replace(/"/g, '') : "New Chat";
        } catch (error) {
            console.error('Chat title generation failed:', error);
            // In case of error or offline mode with no model, return basic title
            const firstWords = firstMessage.split(' ').slice(0, 3).join(' ');
            return firstWords.length > 20 ? firstMessage.substring(0, 20) + '...' : firstWords;
        }
    }
    
    /**
     * Generate text summarization
     * @param {string} text - Text to summarize
     * @param {Function} setNotification - Notification callback function
     * @param {string} userId - User ID for offline storage
     * @returns {string} Summarized text
     */
    async generateSummary(text, setNotification, userId) {
        const prompt = `Summarize the following text in 3-4 concise sentences, preserving the key information:\n\n${text}`;
        
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        };

        try {
            const result = await this.callAPI(payload, setNotification);
            
            // If in offline mode, store the summary for later sync
            if (this.isOfflineMode && userId) {
                await OfflineStoreService.storeOfflineSummary(userId, text, result);
            }
            
            return result || "Could not generate summary.";
        } catch (error) {
            console.error('Summary generation failed:', error);
            return "Could not generate summary.";
        }
    }
}

// Export singleton instance
const geminiService = new GeminiService();
export default geminiService;
