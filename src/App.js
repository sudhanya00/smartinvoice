import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, CreditCard, FileText, Settings, Upload, Search, Plus, X, AlertCircle, CheckCircle, Loader2, Sparkles, Trash2, Send, MessageCircle, LogOut, Eye, EyeOff, ChevronDown, RefreshCw } from 'lucide-react';

// --- Firebase Configuration for Local Development ---
const firebaseConfigString = process.env.REACT_APP_FIREBASE_CONFIG;
let firebaseConfig = {};
try {
    if (firebaseConfigString) {
        firebaseConfig = JSON.parse(firebaseConfigString);
    } else {
        console.error("Firebase config not found. Please set REACT_APP_FIREBASE_CONFIG in your .env file.");
    }
} catch (error) {
    console.error("Error parsing Firebase config:", error);
}
const appId = process.env.REACT_APP_APP_ID || 'default-app-id';

// --- Reusable Components ---
const Notification = ({ notification, onDismiss }) => {
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => onDismiss(), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification, onDismiss]);

    if (!notification) return null;
    
    const isError = notification.type === 'error';
    const bgColor = isError ? 'bg-red-500' : 'bg-green-500';
    const Icon = isError ? AlertCircle : CheckCircle;
    
    return (
        <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className={`fixed top-5 right-5 ${bgColor} text-white p-4 rounded-lg shadow-xl flex items-center z-50`}
        >
            <Icon className="mr-3" /><span>{notification.text}</span>
            <button onClick={onDismiss} className="ml-4 font-bold"><X size={20} /></button>
        </motion.div>
    );
};

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => (
    <AnimatePresence>
        {isOpen && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50" 
                onClick={onClose}
            >
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white/80 backdrop-blur-lg border border-white/20 rounded-2xl shadow-xl p-6 w-full max-w-sm m-4" 
                    onClick={e => e.stopPropagation()}
                >
                    <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                    <p className="text-sm text-gray-700 mt-2">{message}</p>
                    <div className="mt-6 flex justify-end space-x-3">
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200/50 text-gray-800 font-semibold hover:bg-gray-300/70">
                            Cancel
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700">
                            Confirm
                        </motion.button>
                    </div>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
);

// --- Gemini API Caller ---
const callGeminiAPI = async (payload, setNotification) => {
    try {
        const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
        if (!apiKey) throw new Error("Gemini API Key not found.");
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
        
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(errorBody?.error?.message || `API call failed with status: ${response.status}`);
        }
        const result = await response.json();
        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content.parts[0].text) {
            return result.candidates[0].content.parts[0].text;
        } else {
             const finishReason = result.candidates?.[0]?.finishReason;
             if (finishReason === "SAFETY") throw new Error("AI analysis failed due to safety settings.");
             throw new Error("AI returned an empty response.");
        }
    } catch (error) {
        setNotification({ text: `AI Error: ${error.message}`, type: 'error' });
        return null;
    }
};

// --- Smart OCR Parsing with Gemini ---
const parseInvoiceWithGemini = async (imageData, setNotification) => {
    const prompt = `You are an expert receipt parser. Analyze the following receipt image and extract the information into the specified JSON format. Infer the currency from symbols like $, £, €, ₹ or codes like USD, EUR, INR. Default to USD if no currency is found.`;
    
    const schema = {
        type: "OBJECT",
        properties: {
            vendorName: { type: "STRING" },
            totalAmount: { type: "NUMBER" },
            invoiceDate: { type: "STRING", description: "Date in YYYY-MM-DD format" },
            currency: { type: "STRING", description: "3-letter currency code like USD, EUR, INR" },
            category: { type: "STRING", enum: ['Food & Dining', 'Transportation', 'Shopping', 'Utilities', 'Healthcare', 'Entertainment', 'Other'] },
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
        required: ["vendorName", "totalAmount", "invoiceDate", "category"]
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

    const result = await callGeminiAPI(payload, setNotification);
    if (!result) return null;
    try {
        return JSON.parse(result);
    } catch (e) {
        console.error("Failed to parse JSON from Gemini:", e, result);
        return null;
    }
};

// --- Currency Symbol Helper ---
const getCurrencySymbol = (currencyCode) => {
    const symbols = {
        'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹', 'JPY': '¥', 'CAD': '$', 'AUD': '$'
    };
    return symbols[currencyCode] || '$';
};

// --- Main App Component ---
const App = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let app;
        try { app = initializeApp(firebaseConfig); } catch(e) { console.error("Firebase init error", e) }
        const auth = getAuth(app);
        const unsubscribe = onAuthStateChanged(auth, (user) => { setUser(user); setLoading(false); });
        return () => unsubscribe();
    }, []);

    if (loading) return <div className="w-screen h-screen flex justify-center items-center bg-gray-100"><Loader2 className="animate-spin text-black" size={48} /></div>;

    return user ? <MainApp user={user} /> : <LoginScreen />;
};

// --- Login / Auth Screen ---
const LoginScreen = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault(); setLoading(true); setError('');
        const auth = getAuth();
        try {
            if (isLogin) await signInWithEmailAndPassword(auth, email, password);
            else await createUserWithEmailAndPassword(auth, email, password);
        } catch (err) { setError(err.message); }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4 antialiased">
             <div className="max-w-md w-full mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-5xl font-bold text-black tracking-wide">Welcome</h1>
                    <p className="text-gray-600 mt-2">{isLogin ? "Sign in to continue." : "Create an account."}</p>
                </div>
                <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-8 rounded-2xl shadow-xl">
                    <form onSubmit={handleAuth} className="space-y-6">
                        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" required />
                        <div className="relative">
                            <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" required />
                            <motion.button type="button" whileHover={{scale: 1.1}} whileTap={{scale:0.9}} onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                                {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                            </motion.button>
                        </div>
                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={loading} className="w-full bg-black text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition-colors disabled:bg-gray-400 shadow-lg">
                            {loading ? <Loader2 className="animate-spin mx-auto"/> : (isLogin ? 'Sign In' : 'Create Account')}
                        </motion.button>
                    </form>
                    <p className="text-center text-sm text-gray-600 mt-6">
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                        <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="font-semibold text-black hover:underline ml-1">
                            {isLogin ? 'Sign Up' : 'Sign In'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

// --- Main Application after Login ---
const MainApp = ({ user }) => {
    const [activeScreen, setActiveScreen] = useState('Dashboard');
    const [db, setDb] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        try { setDb(getFirestore(initializeApp(firebaseConfig))); } catch (error) { console.error("Firebase init failed in MainApp:", error); }
    }, []);

    useEffect(() => {
        if (user && db) {
            const q = query(collection(db, `artifacts/${appId}/users/${user.uid}/invoices`));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setIsLoading(false);
            }, () => setIsLoading(false));
            return () => unsubscribe();
        } else if (user) {} 
        else setIsLoading(false);
    }, [user, db]);

    const renderScreen = () => (
        <AnimatePresence mode="wait">
            <motion.div
                key={activeScreen}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
            >
                {
                    {
                        'Dashboard': <DashboardScreen invoices={invoices} setNotification={setNotification} />,
                        'Scan': <ScanScreen db={db} userId={user.uid} setActiveScreen={setActiveScreen} setNotification={setNotification} />,
                        'Invoices': <InvoicesScreen invoices={invoices} db={db} userId={user.uid} setNotification={setNotification} />,
                        'Chat': <ChatScreen invoices={invoices} setNotification={setNotification} />,
                        'Profile': <ProfileScreen user={user} />
                    }[activeScreen]
                }
            </motion.div>
        </AnimatePresence>
    );

    return (
        <div className="bg-gray-100 text-gray-900 font-sans h-screen flex flex-col antialiased subpixel-antialiased" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
            <Notification notification={notification} onDismiss={() => setNotification(null)} />
            <main className="flex-1 overflow-y-auto p-4 md:p-6">{renderScreen()}</main>
            <BottomNavBar activeScreen={activeScreen} setActiveScreen={setActiveScreen} />
        </div>
    );
};

const DashboardScreen = ({ invoices, setNotification }) => {
    const [insights, setInsights] = useState([]);
    const [isInsightsLoading, setIsInsightsLoading] = useState(false);
    const prevInvoiceCount = useRef(invoices.length);

    const getDashboardInsights = useCallback(async () => {
        if (invoices.length < 1) {
            setInsights([]);
            return;
        }
        setIsInsightsLoading(true);
        const prompt = `You are a financial assistant. Analyze the user's invoices. Generate 3 short, interesting insights. Ideas: mention a high-spending category, point out a potential expiring warranty, identify a new subscription, or suggest a related purchase. Format as a JSON array of strings. Example: ["Your spending on Food & Dining was highest last week.", "Your car insurance may be expiring soon."]\n\nData: ${JSON.stringify(invoices)}`;
        
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
        const result = await callGeminiAPI(payload, setNotification);
        if(result){
            try {
                const startIndex = result.indexOf('[');
                const endIndex = result.lastIndexOf(']');
                if(startIndex !== -1 && endIndex !== -1) {
                     const jsonString = result.substring(startIndex, endIndex + 1);
                     setInsights(JSON.parse(jsonString));
                } else {
                     setInsights(["Could not generate insights from the response."]);
                }
            } catch (e) {
                console.error("Failed to parse insights JSON", e, result);
                setInsights(["Could not generate new insights at this time."]);
            }
        }
        setIsInsightsLoading(false);
    }, [invoices, setNotification]);

    useEffect(() => {
        if (invoices.length > prevInvoiceCount.current) {
            getDashboardInsights();
        } else if (insights.length === 0 && invoices.length > 1) {
            getDashboardInsights();
        }
        
        prevInvoiceCount.current = invoices.length;

    }, [invoices, getDashboardInsights, insights.length]);

    const totalSpent = invoices.reduce((sum, inv) => sum + (parseFloat(inv.totalAmount) || 0), 0);
    const categoryData = Object.entries(
        invoices.reduce((acc, inv) => {
            acc[inv.category || 'Uncategorized'] = (acc[inv.category || 'Uncategorized'] || 0) + (parseFloat(inv.totalAmount) || 0);
            return acc;
        }, {})
    ).sort(([,a],[,b]) => b-a);

    return (
        <div className="space-y-6">
            <h1 className="text-4xl font-bold text-black tracking-wide">Dashboard</h1>
            <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-5 rounded-2xl shadow-xl">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-lg font-semibold flex items-center text-black"><Sparkles size={20} className="mr-2 text-black"/>Smart Insights</h2>
                    <motion.button whileHover={{scale: 1.1}} whileTap={{scale: 0.9}} onClick={getDashboardInsights} disabled={isInsightsLoading} className="text-black hover:text-gray-700 disabled:opacity-50">
                        <RefreshCw size={16} className={isInsightsLoading ? 'animate-spin' : ''}/>
                    </motion.button>
                </div>
                <div className="text-sm text-gray-700 space-y-2">
                    {isInsightsLoading ? <div className="flex items-center space-x-2 text-gray-500"><Loader2 className="animate-spin" size={16}/><span>Analyzing...</span></div>
                        : insights.length > 0 ? insights.map((insight, index) => <p key={index}>• {insight}</p>)
                        : <p className="text-gray-500">Scan more invoices to unlock personalized insights!</p>
                    }
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-5 rounded-2xl shadow-xl flex items-center space-x-4">
                    <div className="bg-gray-100 p-3 rounded-xl"><CreditCard className="text-black" /></div>
                    <div>
                        <p className="text-sm text-gray-600">Total Spent</p>
                        <p className="text-2xl font-semibold text-black">{getCurrencySymbol(invoices[0]?.currency || 'USD')}{totalSpent.toFixed(2)}</p>
                    </div>
                </div>
                <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-5 rounded-2xl shadow-xl flex items-center space-x-4">
                    <div className="bg-gray-100 p-3 rounded-xl"><FileText className="text-black" /></div>
                    <div>
                        <p className="text-sm text-gray-600">Invoices</p>
                        <p className="text-2xl font-semibold text-black">{invoices.length}</p>
                    </div>
                </div>
            </div>
            <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-5 rounded-2xl shadow-xl">
                <h2 className="text-lg font-semibold text-black mb-4">Top Categories</h2>
                <div className="space-y-3">
                    {categoryData.length > 0 ? categoryData.map(([category, amount]) => (
                        <div key={category}>
                            <div className="flex justify-between items-center mb-1 text-sm">
                                <span className="font-medium text-gray-700">{category}</span>
                                <span className="text-gray-500">{getCurrencySymbol(invoices[0]?.currency || 'USD')}{amount.toFixed(2)}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-black h-2 rounded-full" style={{ width: `${(amount / totalSpent) * 100}%` }}></div></div>
                        </div>
                    )) : <p className="text-center text-sm text-gray-500 py-5">No spending data yet.</p>}
                </div>
            </div>
        </div>
    );
};

const InvoicesScreen = ({ invoices, db, userId, setNotification }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);
    const [invoiceToDelete, setInvoiceToDelete] = useState(null);

    const filteredInvoices = invoices.filter(invoice =>
        (invoice.vendorName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (invoice.category?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    ).sort((a,b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));

    const handleToggleExpand = (invoiceId) => {
        setExpandedInvoiceId(expandedInvoiceId === invoiceId ? null : invoiceId);
    };
    
    const handleDeleteInvoice = async () => {
        if (!invoiceToDelete) return;

        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/invoices`, invoiceToDelete));
            setNotification({ text: "Invoice deleted successfully", type: 'success' });
        } catch (error) {
            setNotification({ text: "Failed to delete invoice.", type: 'error' });
        } finally {
            setInvoiceToDelete(null); 
        }
    };


    return (
        <div className="space-y-6">
            <ConfirmationModal 
                isOpen={!!invoiceToDelete}
                onClose={() => setInvoiceToDelete(null)}
                onConfirm={handleDeleteInvoice}
                title="Delete Invoice"
                message="Are you sure you want to permanently delete this invoice? This action cannot be undone."
            />
            <h1 className="text-4xl font-bold text-black tracking-wide">Invoices</h1>
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input type="text" placeholder="Search invoices..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-3 pl-11 bg-white/50 backdrop-blur-lg border border-white/20 rounded-xl focus:ring-2 focus:ring-black outline-none"
                />
            </div>
            <div className="space-y-3">
                {filteredInvoices.map(invoice => (
                    <motion.div layout key={invoice.id} className="bg-white/50 backdrop-blur-lg border border-white/20 rounded-xl shadow-xl overflow-hidden">
                        <motion.div layout className="p-4 flex items-center justify-between cursor-pointer" onClick={() => handleToggleExpand(invoice.id)}>
                            <div>
                                <p className="font-semibold text-black">{invoice.vendorName || 'N/A'}</p>
                                <p className="text-sm text-gray-500">{invoice.invoiceDate}</p>
                            </div>
                            <div className="flex items-center space-x-4">
                                <div className="text-right">
                                    <p className="font-bold text-lg text-black">{getCurrencySymbol(invoice.currency)}{(parseFloat(invoice.totalAmount) || 0).toFixed(2)}</p>
                                    <p className="text-sm text-gray-500">{invoice.category}</p>
                                </div>
                                <motion.div animate={{ rotate: expandedInvoiceId === invoice.id ? 180 : 0 }}><ChevronDown /></motion.div>
                            </div>
                        </motion.div>
                        <AnimatePresence>
                        {expandedInvoiceId === invoice.id && (
                           <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                               <div className="px-4 pb-4 border-t border-white/20">
                                    <div className="flex justify-between items-center pt-3 mb-2">
                                         <h4 className="font-semibold text-sm text-gray-600">Item Details</h4>
                                         <motion.button whileHover={{scale: 1.1}} whileTap={{scale: 0.9}} onClick={() => setInvoiceToDelete(invoice.id)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full">
                                             <Trash2 size={16}/>
                                         </motion.button>
                                    </div>
                                    <div className="space-y-1 text-sm text-gray-600">
                                         {invoice.lineItems && invoice.lineItems.length > 0 ? (
                                             invoice.lineItems.map((item, index) => (
                                                 <div key={index} className="flex justify-between">
                                                     <span>{item.description} (x{item.quantity || 1})</span>
                                                     <span>{getCurrencySymbol(invoice.currency)}{(parseFloat(item.price) || 0).toFixed(2)}</span>
                                                 </div>
                                             ))
                                         ) : (
                                            <p className="text-xs">No detailed items were extracted for this invoice.</p>
                                         )}
                                    </div>
                               </div>
                           </motion.div>
                        )}
                        </AnimatePresence>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

const ScanScreen = ({ db, userId, setActiveScreen, setNotification }) => {
    const [invoiceData, setInvoiceData] = useState({ vendorName: '', totalAmount: '', invoiceDate: new Date().toISOString().split('T')[0], category: 'Other', lineItems: [], rawText: '', currency: 'USD' });
    const [imageUri, setImageUri] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef(null);
    
    const processImageWithAI = async (file) => {
        if (!file) return;
        setIsProcessing(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async (e) => {
                const base64ImageData = e.target.result.split(',')[1];
                const structuredData = await parseInvoiceWithGemini(base64ImageData, setNotification);
                if (structuredData) {
                    setInvoiceData({
                        vendorName: structuredData.vendorName || '', totalAmount: structuredData.totalAmount || '',
                        invoiceDate: structuredData.invoiceDate || new Date().toISOString().split('T')[0],
                        category: structuredData.category || 'Other', lineItems: structuredData.lineItems || [],
                        currency: structuredData.currency || 'USD',
                    });
                    setNotification({ text: "Invoice details extracted!", type: "success" });
                } else {
                    setNotification({ text: "AI couldn't extract details. Please enter manually.", type: 'error' });
                    setInvoiceData({ vendorName: '', totalAmount: '', invoiceDate: new Date().toISOString().split('T')[0], category: 'Other', lineItems: [], currency: 'USD' });
                }
                setIsProcessing(false);
            };
        } catch (error) {
            setNotification({ text: 'Could not process image.', type: 'error' });
            setIsProcessing(false);
        }
    };

    const handleImagePick = (event) => {
        const file = event.target.files[0];
        if (file) {
            setImageUri(URL.createObjectURL(file));
            processImageWithAI(file);
        }
    };
    
    const handleSaveInvoice = async () => {
        if (!invoiceData.vendorName || !invoiceData.totalAmount) {
            setNotification({text: "Vendor Name and Total Amount are required.", type: 'error'}); return;
        }
        if (!db || !userId) {
            setNotification({text: "Database not ready. Cannot save.", type: 'error'}); return;
        }
        setIsSaving(true);
        try {
            await addDoc(collection(db, `artifacts/${appId}/users/${userId}/invoices`), { ...invoiceData, totalAmount: parseFloat(invoiceData.totalAmount) || 0, createdAt: serverTimestamp() });
            setNotification({text: 'Invoice saved successfully!', type: 'success'});
            setActiveScreen('Invoices');
        } catch (error) {
            setNotification({text: `Failed to save invoice: ${error.message}`, type: 'error'});
        } finally {
            setIsSaving(false);
        }
    };
    
    const defaultCategories = ['Food & Dining', 'Transportation', 'Shopping', 'Utilities', 'Healthcare', 'Entertainment', 'Other'];
    const currencies = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD'];

    return (
        <div className="space-y-6">
            <h1 className="text-4xl font-bold text-black tracking-wide">Scan Invoice</h1>
            <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-6 rounded-2xl shadow-xl">
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImagePick} className="hidden" />
                {isProcessing ? (<div className="text-center mb-4"><Loader2 className="animate-spin text-black mx-auto" size={32} /><p className="mt-2 text-black">AI is analyzing the details...</p></div>)
                : imageUri ? (
                    <div className="flex items-center space-x-4 mb-4">
                        <img src={imageUri} alt="Preview" className="w-16 h-16 rounded-lg object-cover" />
                        <div className="flex-1">
                            <button onClick={() => fileInputRef.current.click()} className="text-sm font-semibold text-black hover:underline">Scan Another</button>
                            <button onClick={() => setImageUri(null)} className="ml-4 text-sm font-semibold text-red-600 hover:underline">Remove</button>
                        </div>
                    </div>
                ) : (
                    <motion.button whileHover={{scale: 1.02}} whileTap={{scale: 0.98}} onClick={() => fileInputRef.current.click()} className="w-full flex flex-col items-center justify-center p-8 bg-white/30 hover:bg-white/50 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 transition-colors">
                        <Upload size={32} />
                        <span className="mt-2 font-semibold">Tap to Scan or Upload</span>
                    </motion.button>
                )}
                
                <div className="space-y-4">
                     <div><label className="text-sm font-medium text-gray-600">Vendor Name</label><input type="text" value={invoiceData.vendorName || ''} onChange={e => setInvoiceData({...invoiceData, vendorName: e.target.value})} className="w-full mt-1 p-3 bg-white/50 border border-white/20 rounded-lg" placeholder="e.g., Cafe Express" /></div>
                     <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2"><label className="text-sm font-medium text-gray-600">Total Amount</label><input type="number" value={invoiceData.totalAmount || ''} onChange={e => setInvoiceData({...invoiceData, totalAmount: e.target.value})} className="w-full mt-1 p-3 bg-white/50 border border-white/20 rounded-lg" placeholder="e.g., 25.50" /></div>
                        <div><label className="text-sm font-medium text-gray-600">Currency</label><select value={invoiceData.currency || 'USD'} onChange={e => setInvoiceData({...invoiceData, currency: e.target.value})} className="w-full mt-1 p-3 bg-white/50 border border-white/20 rounded-lg">{currencies.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                     </div>
                    <div><label className="text-sm font-medium text-gray-600">Invoice Date</label><input type="date" value={invoiceData.invoiceDate || ''} onChange={e => setInvoiceData({...invoiceData, invoiceDate: e.target.value})} className="w-full mt-1 p-3 bg-white/50 border border-white/20 rounded-lg" /></div>
                    <div><label className="text-sm font-medium text-gray-600">Category</label><select value={invoiceData.category || 'Other'} onChange={e => setInvoiceData({...invoiceData, category: e.target.value})} className="w-full mt-1 p-3 bg-white/50 border border-white/20 rounded-lg">{defaultCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                     <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSaveInvoice} disabled={isSaving || isProcessing} className="w-full bg-black text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 shadow-lg"> {isSaving ? 'Saving...' : 'Save Invoice'} </motion.button>
                </div>
            </div>
        </div>
    );
};

const ChatScreen = ({ invoices, setNotification }) => {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatContainerRef = useRef(null);

    useEffect(() => {
        if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }, [messages]);

    const handleSendMessage = async () => {
        if (!userInput.trim() || isLoading) return;
        const newMessages = [...messages, { text: userInput, role: 'user' }];
        setMessages(newMessages);
        const question = userInput;
        setUserInput('');
        setIsLoading(true);
        const prompt = `You are a helpful financial assistant AI. Answer questions about spending, and perform calculations like splitting a bill. Base your answers ONLY on the provided JSON data of invoices. If the answer isn't in the data, say so. For calculations, provide a clear breakdown.\n\nInvoice Data:\n${JSON.stringify(invoices)}\n\nUser's request: "${question}"`;
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
        const aiResponse = await callGeminiAPI(payload, setNotification);
        setMessages([...newMessages, { text: aiResponse || "Sorry, I couldn't process that.", role: 'ai' }]);
        setIsLoading(false);
    };

    return (
        <div className="flex flex-col h-full">
            <h1 className="text-4xl font-bold text-black tracking-wide mb-4 px-1">AI Chat Assistant</h1>
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-4 p-4 bg-white/50 backdrop-blur-lg border border-white/20 rounded-2xl">
                {messages.length === 0 && !isLoading && (
                    <div className="text-center text-gray-500 pt-10">
                        <MessageCircle size={48} className="mx-auto"/><p className="mt-2">Ask me anything about your invoices!</p>
                        <p className="text-xs mt-2">e.g., "Split the bill from Don Cafe between 4 people"</p>
                    </div>
                )}
                <AnimatePresence>
                {messages.map((msg, index) => (<motion.div key={index} initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-2xl ${msg.role === 'user' ? 'bg-black text-white' : 'bg-gray-200 text-gray-800'}`}><p className="text-sm whitespace-pre-wrap">{msg.text}</p></div></motion.div>))}
                </AnimatePresence>
                {isLoading && (<motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} className="flex justify-start"><div className="max-w-xs p-3 rounded-2xl bg-gray-200"><Loader2 className="animate-spin text-black"/></div></motion.div>)}
            </div>
            <div className="p-4 bg-transparent">
                <div className="flex items-center space-x-2 bg-white/50 backdrop-blur-lg border border-white/20 p-2 rounded-xl"><input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Ask about your spending..." className="w-full p-2 bg-transparent focus:outline-none"/><motion.button whileHover={{scale: 1.1}} whileTap={{scale: 0.9}} onClick={handleSendMessage} disabled={isLoading} className="bg-black text-white p-2 rounded-lg disabled:bg-gray-400"><Send size={20}/></motion.button></div>
            </div>
        </div>
    );
};

const ProfileScreen = ({ user }) => {
    const handleLogout = () => {
        signOut(getAuth());
    };
    return (
        <div className="space-y-6">
            <h1 className="text-4xl font-bold text-black tracking-wide">Profile</h1>
            <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-5 rounded-2xl shadow-xl">
                 <h2 className="text-lg font-semibold text-black mb-4">Account</h2>
                 <p className="text-sm text-gray-600">Email</p>
                 <p className="font-semibold text-gray-800 mb-4">{user.email}</p>
                 <motion.button whileHover={{scale: 1.02}} whileTap={{scale: 0.98}} onClick={handleLogout} className="w-full text-left p-3 flex items-center bg-white/50 rounded-lg text-red-500 font-semibold hover:bg-red-100/50"><LogOut size={16} className="mr-2"/> Sign Out</motion.button>
            </div>
        </div>
    );
};

const BottomNavBar = ({ activeScreen, setActiveScreen }) => {
    const navItems = [ { name: 'Dashboard', icon: LineChart }, { name: 'Invoices', icon: FileText }, { name: 'Scan', icon: Plus }, { name: 'Chat', icon: MessageCircle }, { name: 'Profile', icon: Settings } ];
    return (
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 500, damping: 50 }} className="bg-white/30 backdrop-blur-lg border-t border-white/20 shadow-2xl shadow-black/30">
            <div className="flex justify-around items-center max-w-lg mx-auto h-20">
                {navItems.map((item) => {
                    const isActive = activeScreen === item.name;
                    if (item.name === 'Scan') {
                        return (
                            <div key={item.name} className="w-20 flex justify-center">
                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setActiveScreen(item.name)} className="-mt-12 bg-black text-white rounded-full w-20 h-20 flex items-center justify-center shadow-xl shadow-black/30 ring-4 ring-white/20">
                                    <item.icon size={32} />
                                </motion.button>
                            </div>
                        );
                    }
                    return (
                        <div key={item.name} className="w-20">
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setActiveScreen(item.name)} className={`flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${isActive ? 'text-black' : 'text-gray-500 hover:text-black'}`}>
                                <item.icon size={24} />
                                {isActive && <motion.div layoutId="active-pill" className="absolute bottom-2 w-2 h-2 bg-black rounded-full"/>}
                            </motion.button>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
};

export default App;
