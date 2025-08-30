import { 
    collection, 
    addDoc, 
    deleteDoc, 
    updateDoc, 
    doc, 
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp,
    writeBatch,
    getDocs
} from 'firebase/firestore';
import { db } from './firebase';
import { APP_ID } from '../constants';

/**
 * Database service for handling Firestore operations
 */
class DatabaseService {
    constructor() {
        this.db = db;
        this.appId = APP_ID;
    }

    // Helper method to get collection path
    getCollectionPath(userId, collectionName) {
        return `artifacts/${this.appId}/users/${userId}/${collectionName}`;
    }

    // Generic methods for CRUD operations
    async addDocument(userId, collectionName, data) {
        const collectionRef = collection(this.db, this.getCollectionPath(userId, collectionName));
        return await addDoc(collectionRef, {
            ...data,
            createdAt: serverTimestamp()
        });
    }

    async deleteDocument(userId, collectionName, docId) {
        const docRef = doc(this.db, this.getCollectionPath(userId, collectionName), docId);
        return await deleteDoc(docRef);
    }

    async updateDocument(userId, collectionName, docId, data) {
        const docRef = doc(this.db, this.getCollectionPath(userId, collectionName), docId);
        return await updateDoc(docRef, data);
    }

    // Subscribe to collection changes
    subscribeToCollection(userId, collectionName, callback, orderByField = 'createdAt', orderDirection = 'desc') {
        const collectionRef = collection(this.db, this.getCollectionPath(userId, collectionName));
        const q = orderByField ? query(collectionRef, orderBy(orderByField, orderDirection)) : collectionRef;
        
        return onSnapshot(q, (snapshot) => {
            const documents = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(documents);
        }, (error) => {
            console.error(`Error fetching ${collectionName}:`, error);
        });
    }

    // Invoice-specific methods
    async addInvoice(userId, invoiceData) {
        return this.addDocument(userId, 'invoices', {
            ...invoiceData,
            totalAmount: parseFloat(invoiceData.totalAmount) || 0
        });
    }

    async deleteInvoice(userId, invoiceId) {
        return this.deleteDocument(userId, 'invoices', invoiceId);
    }

    subscribeToInvoices(userId, callback) {
        return this.subscribeToCollection(userId, 'invoices', callback);
    }

    // Budget-specific methods
    async addBudget(userId, budgetData) {
        return this.addDocument(userId, 'budgets', {
            ...budgetData,
            amount: parseFloat(budgetData.amount) || 0
        });
    }

    async deleteBudget(userId, budgetId) {
        return this.deleteDocument(userId, 'budgets', budgetId);
    }

    subscribeToBudgets(userId, callback) {
        return this.subscribeToCollection(userId, 'budgets', callback);
    }

    // Goal-specific methods
    async addGoal(userId, goalData) {
        return this.addDocument(userId, 'goals', {
            ...goalData,
            targetAmount: parseFloat(goalData.targetAmount) || 0,
            savedAmount: parseFloat(goalData.savedAmount) || 0
        });
    }

    async deleteGoal(userId, goalId) {
        return this.deleteDocument(userId, 'goals', goalId);
    }

    subscribeToGoals(userId, callback) {
        return this.subscribeToCollection(userId, 'goals', callback);
    }

    // Alert-specific methods
    async addAlert(userId, alertData) {
        return this.addDocument(userId, 'alerts', {
            ...alertData,
            amount: parseFloat(alertData.amount) || 0,
            dueDate: new Date(alertData.dueDate),
            paid: false
        });
    }

    async deleteAlert(userId, alertId) {
        return this.deleteDocument(userId, 'alerts', alertId);
    }

    subscribeToAlerts(userId, callback) {
        return this.subscribeToCollection(userId, 'alerts', callback);
    }

    // Chat-specific methods
    async addChatSession(userId, sessionData) {
        return this.addDocument(userId, 'chats', sessionData);
    }

    async deleteChatSession(userId, sessionId) {
        // Delete all messages in the chat session first
        const batch = writeBatch(this.db);
        const messagesQuery = query(collection(this.db, `${this.getCollectionPath(userId, 'chats')}/${sessionId}/messages`));
        const messagesSnapshot = await getDocs(messagesQuery);
        
        messagesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Delete the chat session
        const chatDocRef = doc(this.db, this.getCollectionPath(userId, 'chats'), sessionId);
        batch.delete(chatDocRef);
        
        return await batch.commit();
    }

    async addChatMessage(userId, sessionId, messageData) {
        const collectionRef = collection(this.db, `${this.getCollectionPath(userId, 'chats')}/${sessionId}/messages`);
        return await addDoc(collectionRef, {
            ...messageData,
            createdAt: serverTimestamp()
        });
    }

    subscribeToChatSessions(userId, callback) {
        return this.subscribeToCollection(userId, 'chats', callback);
    }

    subscribeToChatMessages(userId, sessionId, callback) {
        const collectionRef = collection(this.db, `${this.getCollectionPath(userId, 'chats')}/${sessionId}/messages`);
        const q = query(collectionRef, orderBy('createdAt'));
        
        return onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(messages);
        });
    }

    async updateChatSession(userId, sessionId, updateData) {
    }
}

// Export singleton instance
const databaseService = new DatabaseService();
export default databaseService;
