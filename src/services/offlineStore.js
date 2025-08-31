import localforage from 'localforage';

/**
 * Service for managing offline data storage using IndexedDB
 */
class OfflineStoreService {
  constructor() {
    // Initialize localforage instances for different data types
    this.chatStore = localforage.createInstance({
      name: 'offlineData',
      storeName: 'chats'
    });
    
    this.summarizationStore = localforage.createInstance({
      name: 'offlineData',
      storeName: 'summaries'
    });
    
    this.pendingSyncStore = localforage.createInstance({
      name: 'offlineData',
      storeName: 'pendingSync'
    });
    
    this.analyticsStore = localforage.createInstance({
      name: 'offlineData',
      storeName: 'analytics'
    });
    
    // Initialize analytics if not exists
    this._initAnalytics();
  }

  /**
   * Initialize analytics data
   * @private
   */
  async _initAnalytics() {
    try {
      const analytics = await this.analyticsStore.getItem('usage');
      if (!analytics) {
        await this.analyticsStore.setItem('usage', {
          localModelUses: 0,
          apiCalls: 0,
          fallbackUses: 0,
          estimatedSavings: 0,
          errors: [],
          usageByType: {},
          lastReset: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Failed to initialize analytics:', error);
    }
  }
  
  /**
   * Store chat message that was processed offline
   * @param {string} userId - User ID
   * @param {string} sessionId - Chat session ID
   * @param {Object} message - Message object
   * @returns {Promise<string>} - Generated ID for the message
   */
  async storeOfflineChatMessage(userId, sessionId, message) {
    try {
      const messageId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const messageWithMeta = {
        ...message,
        id: messageId,
        timestamp: new Date().toISOString(),
        processedOffline: true
      };
      
      // Create a compound key for storage
      const storageKey = `${userId}:${sessionId}:${messageId}`;
      
      // Store the message
      await this.chatStore.setItem(storageKey, messageWithMeta);
      
      // Add to pending sync queue
      await this.addToPendingSync('chat', {
        userId,
        sessionId,
        messageId,
        action: 'create'
      });
      
      return messageId;
    } catch (error) {
      console.error('Failed to store offline chat message:', error);
      throw error;
    }
  }

  /**
   * Get all chat messages for a session that were processed offline
   * @param {string} userId - User ID
   * @param {string} sessionId - Chat session ID
   * @returns {Promise<Array<Object>>} - Array of messages
   */
  async getOfflineChatMessages(userId, sessionId) {
    try {
      const messages = [];
      const prefix = `${userId}:${sessionId}:`;
      
      // Iterate through all keys and find matching messages
      await this.chatStore.iterate((value, key) => {
        if (key.startsWith(prefix)) {
          messages.push(value);
        }
      });
      
      // Sort by timestamp
      return messages.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
    } catch (error) {
      console.error('Failed to get offline chat messages:', error);
      return [];
    }
  }

  /**
   * Store text summarization that was processed offline
   * @param {string} userId - User ID
   * @param {string} originalText - The text that was summarized
   * @param {string} summary - Generated summary
   * @returns {Promise<string>} - Generated ID for the summary
   */
  async storeOfflineSummary(userId, originalText, summary) {
    try {
      const summaryId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const summaryWithMeta = {
        id: summaryId,
        userId,
        originalText,
        summary,
        timestamp: new Date().toISOString(),
        processedOffline: true
      };
      
      // Create a compound key for storage
      const storageKey = `${userId}:${summaryId}`;
      
      // Store the summary
      await this.summarizationStore.setItem(storageKey, summaryWithMeta);
      
      // Add to pending sync queue
      await this.addToPendingSync('summary', {
        userId,
        summaryId,
        action: 'create'
      });
      
      return summaryId;
    } catch (error) {
      console.error('Failed to store offline summary:', error);
      throw error;
    }
  }

  /**
   * Get all summaries for a user that were processed offline
   * @param {string} userId - User ID
   * @returns {Promise<Array<Object>>} - Array of summaries
   */
  async getOfflineSummaries(userId) {
    try {
      const summaries = [];
      const prefix = `${userId}:`;
      
      // Iterate through all keys and find matching summaries
      await this.summarizationStore.iterate((value, key) => {
        if (key.startsWith(prefix)) {
          summaries.push(value);
        }
      });
      
      // Sort by timestamp
      return summaries.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
    } catch (error) {
      console.error('Failed to get offline summaries:', error);
      return [];
    }
  }

  /**
   * Add an operation to the pending sync queue
   * @param {string} type - Type of data ('chat' or 'summary')
   * @param {Object} details - Operation details
   * @returns {Promise<void>}
   */
  async addToPendingSync(type, details) {
    try {
      const syncId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      await this.pendingSyncStore.setItem(syncId, {
        id: syncId,
        type,
        details,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to add to pending sync:', error);
    }
  }

  /**
   * Get all operations in the pending sync queue
   * @returns {Promise<Array<Object>>} - Array of pending sync operations
   */
  async getPendingSyncOperations() {
    try {
      const operations = [];
      
      await this.pendingSyncStore.iterate((value) => {
        operations.push(value);
      });
      
      return operations.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
    } catch (error) {
      console.error('Failed to get pending sync operations:', error);
      return [];
    }
  }

  /**
   * Remove an operation from the pending sync queue
   * @param {string} syncId - Sync operation ID
   * @returns {Promise<void>}
   */
  async removePendingSync(syncId) {
    try {
      await this.pendingSyncStore.removeItem(syncId);
    } catch (error) {
      console.error('Failed to remove pending sync operation:', error);
    }
  }

  /**
   * Record local model usage for analytics
   * @param {string} taskType - Type of task performed
   * @returns {Promise<void>}
   */
  async recordLocalModelUse(taskType = 'default') {
    try {
      const analytics = await this.analyticsStore.getItem('usage') || {
        localModelUses: 0,
        apiCalls: 0,
        fallbackUses: 0,
        estimatedSavings: 0,
        errors: [],
        usageByType: {},
        lastReset: new Date().toISOString()
      };
      
      // Increment counters
      analytics.localModelUses++;
      
      // Track by task type
      if (!analytics.usageByType[taskType]) {
        analytics.usageByType[taskType] = 0;
      }
      analytics.usageByType[taskType]++;
      
      // Calculate estimated cost savings (approx $0.0005 per API call)
      analytics.estimatedSavings += 0.0005;
      
      await this.analyticsStore.setItem('usage', analytics);
    } catch (error) {
      console.error('Failed to record local model use:', error);
    }
  }
  
  /**
   * Record API fallback usage
   * @param {string} reason - Reason for fallback
   * @returns {Promise<void>}
   */
  async recordFallbackUse(reason = 'unknown') {
    try {
      const analytics = await this.analyticsStore.getItem('usage') || {
        localModelUses: 0,
        apiCalls: 0,
        fallbackUses: 0,
        estimatedSavings: 0,
        errors: [],
        usageByType: {},
        lastReset: new Date().toISOString()
      };
      
      analytics.fallbackUses++;
      
      // Track fallback reasons
      if (!analytics.fallbackReasons) {
        analytics.fallbackReasons = {};
      }
      
      if (!analytics.fallbackReasons[reason]) {
        analytics.fallbackReasons[reason] = 0;
      }
      analytics.fallbackReasons[reason]++;
      
      await this.analyticsStore.setItem('usage', analytics);
    } catch (error) {
      console.error('Failed to record fallback use:', error);
    }
  }
  
  /**
   * Record error for analytics
   * @param {string} type - Error type
   * @param {string} message - Error message
   * @returns {Promise<void>}
   */
  async recordError(type, message) {
    try {
      const analytics = await this.analyticsStore.getItem('usage') || {
        localModelUses: 0,
        apiCalls: 0,
        fallbackUses: 0,
        estimatedSavings: 0,
        errors: [],
        usageByType: {},
        lastReset: new Date().toISOString()
      };
      
      // Store the error with timestamp
      analytics.errors.push({
        type,
        message,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 50 errors
      if (analytics.errors.length > 50) {
        analytics.errors = analytics.errors.slice(-50);
      }
      
      await this.analyticsStore.setItem('usage', analytics);
    } catch (error) {
      console.error('Failed to record error:', error);
    }
  }
  
  /**
   * Record API call (when using cloud API)
   * @param {string} endpoint - API endpoint used
   * @returns {Promise<void>}
   */
  async recordApiCall(endpoint = 'default') {
    try {
      const analytics = await this.analyticsStore.getItem('usage') || {
        localModelUses: 0,
        apiCalls: 0,
        fallbackUses: 0,
        estimatedSavings: 0,
        errors: [],
        usageByType: {},
        lastReset: new Date().toISOString()
      };
      
      analytics.apiCalls++;
      
      // Track by endpoint
      if (!analytics.apiCallsByEndpoint) {
        analytics.apiCallsByEndpoint = {};
      }
      
      if (!analytics.apiCallsByEndpoint[endpoint]) {
        analytics.apiCallsByEndpoint[endpoint] = 0;
      }
      analytics.apiCallsByEndpoint[endpoint]++;
      
      await this.analyticsStore.setItem('usage', analytics);
    } catch (error) {
      console.error('Failed to record API call:', error);
    }
  }
  
  /**
   * Get usage statistics
   * @returns {Promise<Object>} Usage statistics
   */
  async getStats() {
    try {
      const analytics = await this.analyticsStore.getItem('usage') || {
        localModelUses: 0,
        apiCalls: 0,
        fallbackUses: 0,
        estimatedSavings: 0,
        errors: [],
        usageByType: {},
        lastReset: new Date().toISOString()
      };
      
      // Calculate additional metrics
      const totalRequests = analytics.localModelUses + analytics.apiCalls;
      const offlinePercentage = totalRequests === 0 ? 0 : 
          (analytics.localModelUses / totalRequests) * 100;
      
      return {
        ...analytics,
        totalRequests,
        offlinePercentage: Math.round(offlinePercentage * 10) / 10,
        formattedSavings: `$${analytics.estimatedSavings.toFixed(2)}`
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        localModelUses: 0,
        apiCalls: 0,
        fallbackUses: 0,
        estimatedSavings: 0,
        totalRequests: 0,
        offlinePercentage: 0,
        formattedSavings: '$0.00'
      };
    }
  }
  
  /**
   * Reset analytics data
   * @returns {Promise<void>}
   */
  async resetAnalytics() {
    try {
      await this.analyticsStore.setItem('usage', {
        localModelUses: 0,
        apiCalls: 0,
        fallbackUses: 0,
        estimatedSavings: 0,
        errors: [],
        usageByType: {},
        lastReset: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to reset analytics:', error);
    }
  }
  
  /**
   * Clear all offline data including analytics
   * @returns {Promise<void>}
   */
  async clearAllData() {
    try {
      await Promise.all([
        this.chatStore.clear(),
        this.summarizationStore.clear(),
        this.pendingSyncStore.clear(),
        this.analyticsStore.clear()
      ]);
      
      // Reinitialize analytics
      await this._initAnalytics();
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  }
}

export default new OfflineStoreService();