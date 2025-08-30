import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    MessageCircle, 
    Send, 
    Trash2, 
    PlusCircle, 
    Menu, 
    X, 
    Loader2 
} from 'lucide-react';
import DatabaseService from '../services/database';
import GeminiService from '../services/gemini';
import MarkdownRenderer from '../components/MarkdownRenderer';
import ConfirmationModal from '../components/ConfirmationModal';

/**
 * Chat screen component for AI-powered financial conversations
 * @param {Array} invoices - User's invoices
 * @param {Array} budgets - User's budgets
 * @param {Array} goals - User's goals
 * @param {string} userId - Current user ID
 * @param {Function} setNotification - Function to show notifications
 */
const ChatScreen = ({ invoices, budgets, goals, userId, setNotification }) => {
    const [chatSessions, setChatSessions] = useState([]);
    const [activeChatSessionId, setActiveChatSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatContainerRef = useRef(null);
    const [chatToDelete, setChatToDelete] = useState(null);
    const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(window.innerWidth > 768);
    const [initialChatCreated, setInitialChatCreated] = useState(false);

    const handleNewChat = useCallback(async () => {
        const newChatSession = {
            title: "New Chat..."
        };
        const docRef = await DatabaseService.addChatSession(userId, newChatSession);
        setActiveChatSessionId(docRef.id);
        if (window.innerWidth <= 768) {
            setIsHistoryPanelOpen(false);
        }
    }, [userId]);

    // Fetch chat sessions and create one if none exist
    useEffect(() => {
        if (!userId) return;
        
        const unsubscribe = DatabaseService.subscribeToChatSessions(userId, (sessions) => {
            if (!initialChatCreated && sessions.length === 0) {
                handleNewChat();
                setInitialChatCreated(true);
            } else {
                setChatSessions(sessions);
                if (!activeChatSessionId && sessions.length > 0) {
                    setActiveChatSessionId(sessions[0].id);
                }
            }
        });
        
        return () => unsubscribe();
    }, [userId, initialChatCreated, activeChatSessionId, handleNewChat]);

    // Fetch messages for the active session
    useEffect(() => {
        if (!userId || !activeChatSessionId) {
            setMessages([]);
            return;
        }
        
        const unsubscribe = DatabaseService.subscribeToChatMessages(userId, activeChatSessionId, (newMessages) => {
            setMessages(newMessages);
        });
        
        return () => unsubscribe();
    }, [userId, activeChatSessionId]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const selectChatSession = (sessionId) => {
        setActiveChatSessionId(sessionId);
        if (window.innerWidth <= 768) {
            setIsHistoryPanelOpen(false);
        }
    };

    const handleDeleteChat = async () => {
        if (!chatToDelete) return;
        
        try {
            await DatabaseService.deleteChatSession(userId, chatToDelete);
            setNotification({ text: "Chat session deleted.", type: 'success' });
            setChatToDelete(null);
            if (activeChatSessionId === chatToDelete) {
                setActiveChatSessionId(null);
            }
        } catch (error) {
            setNotification({ text: "Failed to delete chat session.", type: 'error' });
        }
    };

    const generateChatTitle = async (sessionId, firstMessage) => {
        const title = await GeminiService.generateChatTitle(firstMessage, setNotification);
        if (title) {
            await DatabaseService.updateChatSession(userId, sessionId, { title });
        }
    };

    const handleSendMessage = async () => {
        if (!userInput.trim() || isLoading || !activeChatSessionId) return;
        
        const isFirstMessage = messages.length === 0;
        const userMessage = { text: userInput, role: 'user' };
        
        setUserInput('');
        await DatabaseService.addChatMessage(userId, activeChatSessionId, userMessage);
        
        if (isFirstMessage) {
            generateChatTitle(activeChatSessionId, userMessage.text);
        }

        setIsLoading(true);

        const currentMessages = [...messages, userMessage];
        const aiResponse = await GeminiService.generateChatResponse(
            currentMessages, 
            invoices, 
            budgets, 
            userMessage.text, 
            setNotification
        );
        
        const aiMessage = { text: aiResponse, role: 'ai' };
        await DatabaseService.addChatMessage(userId, activeChatSessionId, aiMessage);

        setIsLoading(false);
    };

    return (
        <div className="flex flex-col h-full">
            <ConfirmationModal 
                isOpen={!!chatToDelete}
                onClose={() => setChatToDelete(null)}
                onConfirm={handleDeleteChat}
                title="Delete Chat"
                message="Are you sure you want to permanently delete this chat session? This action cannot be undone."
            />
            
            <div className="flex flex-1 min-h-0">
                {/* Chat History Panel */}
                <AnimatePresence>
                    {isHistoryPanelOpen && (
                        <motion.div 
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="absolute top-0 left-0 h-full w-full md:w-1/4 md:relative bg-white/50 backdrop-blur-lg border border-white/20 rounded-2xl p-4 flex flex-col z-20"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold">Chat History</h2>
                                <button 
                                    onClick={() => setIsHistoryPanelOpen(false)} 
                                    className="md:hidden p-1"
                                >
                                    <X size={20}/>
                                </button>
                            </div>
                            
                            <motion.button 
                                whileHover={{ scale: 1.05 }} 
                                whileTap={{ scale: 0.95 }} 
                                onClick={handleNewChat} 
                                className="flex items-center justify-center space-x-2 w-full px-4 py-2 mb-4 rounded-lg bg-black text-white font-semibold hover:bg-gray-800"
                            >
                                <PlusCircle size={16} />
                                <span>New Chat</span>
                            </motion.button>
                            
                            <div className="flex-1 overflow-y-auto space-y-2">
                                {chatSessions.map(session => (
                                    <div 
                                        key={session.id} 
                                        onClick={() => selectChatSession(session.id)}
                                        className={`flex justify-between items-center p-2 rounded-lg cursor-pointer truncate ${
                                            activeChatSessionId === session.id ? 'bg-black text-white' : 'hover:bg-gray-200'
                                        }`}
                                    >
                                        <span className="truncate">{session.title}</span>
                                        <motion.button 
                                            whileHover={{ scale: 1.1 }} 
                                            whileTap={{ scale: 0.9 }} 
                                            onClick={(e) => {
                                                e.stopPropagation(); 
                                                setChatToDelete(session.id);
                                            }} 
                                            className="p-1 text-gray-400 hover:text-red-500"
                                        >
                                            <Trash2 size={14}/>
                                        </motion.button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Chat Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-center mb-4 md:hidden">
                        <button 
                            onClick={() => setIsHistoryPanelOpen(true)} 
                            className="p-2"
                        >
                            <Menu size={24} />
                        </button>
                    </div>
                    
                    <div 
                        ref={chatContainerRef} 
                        className="flex-1 overflow-y-auto space-y-4 p-4 bg-white/50 backdrop-blur-lg border border-white/20 rounded-2xl"
                    >
                        {messages.length === 0 && !isLoading && (
                            <div className="text-center text-gray-500 pt-10">
                                <MessageCircle size={48} className="mx-auto"/>
                                <p className="mt-2">Ask me anything about your finances!</p>
                                <p className="text-xs mt-2">e.g., "How much did I spend on shopping this month?"</p>
                            </div>
                        )}
                        
                        <AnimatePresence>
                            {messages.map((msg, index) => (
                                <motion.div 
                                    key={index} 
                                    initial={{ opacity: 0, y: 10 }} 
                                    animate={{ opacity: 1, y: 0 }} 
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-2xl ${
                                        msg.role === 'user' 
                                            ? 'bg-black text-white' 
                                            : 'bg-gray-200 text-gray-800'
                                    }`}>
                                        <MarkdownRenderer text={msg.text} />
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        
                        {isLoading && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                className="flex justify-start"
                            >
                                <div className="max-w-xs p-3 rounded-2xl bg-gray-200">
                                    <Loader2 className="animate-spin text-black"/>
                                </div>
                            </motion.div>
                        )}
                    </div>
                    
                    <div className="p-4 bg-transparent pb-24">
                        <div className="flex items-center space-x-2 bg-white/50 backdrop-blur-lg border border-white/20 p-2 rounded-xl">
                            <input 
                                type="text" 
                                value={userInput} 
                                onChange={(e) => setUserInput(e.target.value)} 
                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} 
                                placeholder="Ask about your spending..." 
                                className="w-full p-2 bg-transparent focus:outline-none"
                            />
                            <motion.button 
                                whileHover={{ scale: 1.1 }} 
                                whileTap={{ scale: 0.9 }} 
                                onClick={handleSendMessage} 
                                disabled={isLoading || !activeChatSessionId} 
                                className="bg-black text-white p-2 rounded-lg disabled:bg-gray-400"
                            >
                                <Send size={20}/>
                            </motion.button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatScreen;
