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
   * Clear all offline data
   * @returns {Promise<void>}
   */
  async clearAllData() {
    try {
      await Promise.all([
        this.chatStore.clear(),
        this.summarizationStore.clear(),
        this.pendingSyncStore.clear()
      ]);
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  }
}

export default new OfflineStoreService();