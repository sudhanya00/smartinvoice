import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';
import { LineChart, CreditCard, FileText, Settings, Upload, Search, Plus, X, AlertCircle, CheckCircle, Loader2, Sparkles, Trash2, Send, MessageCircle, LogOut, Sun, Moon, Eye, EyeOff, ChevronDown, RefreshCw } from 'lucide-react';

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
        <div className={`fixed top-5 right-5 ${bgColor} text-white p-4 rounded-lg shadow-lg flex items-center z-50 animate-fade-in-down`}>
            <Icon className="mr-3" /><span>{notification.text}</span>
            <button onClick={onDismiss} className="ml-4 font-bold"><X size={20} /></button>
        </div>
    );
};

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 w-full max-w-sm m-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{message}</p>
                <div className="mt-6 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700">
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Gemini API Caller ---
const callGeminiAPI = async (prompt, setNotification) => {
    try {
        const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("Gemini API Key not found. Please set REACT_APP_GEMINI_API_KEY in your .env.local file.");
        }
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            const errorMessage = errorBody?.error?.message || `API call failed with status: ${response.status}`;
            throw new Error(errorMessage);
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
        console.error("Gemini API Error:", error);
        setNotification({ text: `AI Error: ${error.message}`, type: 'error' });
        return null;
    }
};

// --- Smart OCR Parsing with Gemini (More Robust) ---
const parseInvoiceWithGemini = async (text, setNotification) => {
    const prompt = `
        You are an expert receipt parser. Analyze the following raw OCR text and extract the information into a valid JSON object.
        The JSON object must have: "vendorName", "totalAmount", "invoiceDate" (YYYY-MM-DD), "category", and "lineItems" (array of objects with "description", "quantity", "price").
        - "category" must be one of: Food & Dining, Transportation, Shopping, Utilities, Healthcare, Entertainment, Other.
        - "lineItems" price and quantity should be numbers. Default quantity to 1 if not found.
        - Be strict with the JSON format. Do not add trailing commas. Return ONLY the JSON object.
        Raw Text:
        ---
        ${text}
        ---
    `;
    const result = await callGeminiAPI(prompt, setNotification);
    if (!result) return null;
    
    try {
        const startIndex = result.indexOf('{');
        const endIndex = result.lastIndexOf('}');
        if (startIndex === -1 || endIndex === -1) throw new Error("Valid JSON not found.");
        let jsonString = result.substring(startIndex, endIndex + 1);
        jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("Failed to parse JSON from Gemini:", e, result);
        return null;
    }
};


// --- Main App Component ---
const App = () => {
    const [theme, setTheme] = useState('light');
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let app;
        try {
            app = initializeApp(firebaseConfig);
        } catch(e) {
            console.error("Firebase initialization error", e)
        }
        const auth = getAuth(app);
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    if (loading) {
        return <div className="w-screen h-screen flex justify-center items-center bg-gray-50 dark:bg-gray-900"><Loader2 className="animate-spin text-blue-500" size={48} /></div>;
    }

    return user ? <MainApp user={user} theme={theme} setTheme={setTheme} /> : <LoginScreen />;
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
        e.preventDefault();
        setLoading(true);
        setError('');
        const auth = getAuth();
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
        } catch (err) {
            setError(err.message);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
             <div className="max-w-md w-full mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900">Welcome</h1>
                    <p className="text-gray-500 mt-2">{isLogin ? "Sign in to continue." : "Create an account to get started."}</p>
                </div>
                <div className="bg-white p-8 rounded-2xl shadow-lg">
                    <form onSubmit={handleAuth} className="space-y-6">
                        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                        <div className="relative">
                            <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                                {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                            </button>
                        </div>
                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:bg-gray-400">
                            {loading ? <Loader2 className="animate-spin mx-auto"/> : (isLogin ? 'Sign In' : 'Create Account')}
                        </button>
                    </form>
                    <p className="text-center text-sm text-gray-500 mt-6">
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                        <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="font-semibold text-blue-600 hover:underline ml-1">
                            {isLogin ? 'Sign Up' : 'Sign In'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};


// --- Main Application after Login ---
const MainApp = ({ user, theme, setTheme }) => {
    const [activeScreen, setActiveScreen] = useState('Dashboard');
    const [db, setDb] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState(null);
    const [isOcrReady, setIsOcrReady] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line no-undef
        if (window.Tesseract) setIsOcrReady(true);
        try {
            setDb(getFirestore(initializeApp(firebaseConfig)));
        } catch (error) {
            console.error("Firebase init failed in MainApp:", error);
        }
    }, []);

    useEffect(() => {
        if (user && db) {
            const q = query(collection(db, `artifacts/${appId}/users/${user.uid}/invoices`));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setIsLoading(false);
            }, (error) => {
                console.error("Fetch error:", error);
                setNotification({ text: 'Could not fetch invoices. Check Firestore rules.', type: 'error' });
                setIsLoading(false);
            });
            return () => unsubscribe();
        } else if (user) {
            // db might not be ready yet
        } else {
            setIsLoading(false);
        }
    }, [user, db]);

    const renderScreen = () => {
        switch (activeScreen) {
            case 'Dashboard': return <DashboardScreen invoices={invoices} setNotification={setNotification} />;
            case 'Scan': return <ScanScreen db={db} userId={user.uid} setActiveScreen={setActiveScreen} setNotification={setNotification} isOcrReady={isOcrReady} />;
            case 'Invoices': return <InvoicesScreen invoices={invoices} db={db} userId={user.uid} setNotification={setNotification} />;
            case 'Chat': return <ChatScreen invoices={invoices} setNotification={setNotification} />;
            case 'Profile': return <ProfileScreen user={user} theme={theme} setTheme={setTheme} />;
            default: return <DashboardScreen invoices={invoices} setNotification={setNotification}/>;
        }
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans h-screen flex flex-col antialiased" style={{ fontFamily: 'Inter, sans-serif' }}>
            <Notification notification={notification} onDismiss={() => setNotification(null)} />
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                {isLoading ? (<div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-blue-500" size={48} /></div>) : (renderScreen())}
            </main>
            <BottomNavBar activeScreen={activeScreen} setActiveScreen={setActiveScreen} />
        </div>
    );
};

// Screen Components
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
        
        const result = await callGeminiAPI(prompt, setNotification);
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
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Dashboard</h1>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-lg font-semibold flex items-center text-gray-800 dark:text-white"><Sparkles size={20} className="mr-2 text-blue-500"/>Smart Insights</h2>
                    <button onClick={getDashboardInsights} disabled={isInsightsLoading} className="text-blue-500 hover:text-blue-700 disabled:opacity-50">
                        <RefreshCw size={16} className={isInsightsLoading ? 'animate-spin' : ''}/>
                    </button>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                    {isInsightsLoading ? <div className="flex items-center space-x-2 text-gray-500"><Loader2 className="animate-spin" size={16}/><span>Analyzing...</span></div>
                        : insights.length > 0 ? insights.map((insight, index) => <p key={index}>• {insight}</p>)
                        : <p className="text-gray-500">Scan more invoices to unlock personalized insights!</p>
                    }
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm flex items-center space-x-4">
                    <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-xl"><CreditCard className="text-blue-500" /></div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Spent</p>
                        <p className="text-2xl font-semibold text-gray-800 dark:text-white">${totalSpent.toFixed(2)}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm flex items-center space-x-4">
                    <div className="bg-green-100 dark:bg-green-900/50 p-3 rounded-xl"><FileText className="text-green-500" /></div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Invoices</p>
                        <p className="text-2xl font-semibold text-gray-800 dark:text-white">{invoices.length}</p>
                    </div>
                </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Top Categories</h2>
                <div className="space-y-3">
                    {categoryData.length > 0 ? categoryData.map(([category, amount]) => (
                        <div key={category}>
                            <div className="flex justify-between items-center mb-1 text-sm">
                                <span className="font-medium text-gray-600 dark:text-gray-300">{category}</span>
                                <span className="text-gray-500 dark:text-gray-400">${amount.toFixed(2)}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(amount / totalSpent) * 100}%` }}></div></div>
                        </div>
                    )) : <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-5">No spending data yet.</p>}
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
            console.error("Error deleting invoice: ", error);
            setNotification({ text: "Failed to delete invoice.", type: 'error' });
        } finally {
            setInvoiceToDelete(null); // Close modal
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
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Invoices</h1>
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input type="text" placeholder="Search invoices..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-3 pl-11 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>
            <div className="space-y-3">
                {filteredInvoices.map(invoice => (
                    <div key={invoice.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm transition-all duration-300">
                        <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => handleToggleExpand(invoice.id)}>
                            <div>
                                <p className="font-semibold text-gray-800 dark:text-white">{invoice.vendorName || 'N/A'}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{invoice.invoiceDate}</p>
                            </div>
                            <div className="flex items-center space-x-4">
                                <div className="text-right">
                                    <p className="font-bold text-lg text-gray-800 dark:text-white">${(parseFloat(invoice.totalAmount) || 0).toFixed(2)}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{invoice.category}</p>
                                </div>
                                <ChevronDown className={`transform transition-transform duration-300 ${expandedInvoiceId === invoice.id ? 'rotate-180' : ''}`} />
                            </div>
                        </div>
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedInvoiceId === invoice.id ? 'max-h-96' : 'max-h-0'}`}>
                           <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
                                <div className="flex justify-between items-center pt-3 mb-2">
                                     <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-300">Item Details</h4>
                                     <button onClick={() => setInvoiceToDelete(invoice.id)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full">
                                         <Trash2 size={16}/>
                                     </button>
                                </div>
                                <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
                                     {invoice.lineItems && invoice.lineItems.length > 0 ? (
                                         invoice.lineItems.map((item, index) => (
                                             <div key={index} className="flex justify-between">
                                                 <span>{item.description} (x{item.quantity || 1})</span>
                                                 <span>${(parseFloat(item.price) || 0).toFixed(2)}</span>
                                             </div>
                                         ))
                                     ) : (
                                        <p className="text-xs">No detailed items were extracted for this invoice.</p>
                                     )}
                                </div>
                           </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ScanScreen = ({ db, userId, setActiveScreen, setNotification, isOcrReady }) => {
    const [invoiceData, setInvoiceData] = useState({ vendorName: '', totalAmount: '', invoiceDate: new Date().toISOString().split('T')[0], category: 'Other', lineItems: [], rawText: '' });
    const [imageUri, setImageUri] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [ocrProgress, setOcrProgress] = useState({ status: '', progress: 0 });
    const fileInputRef = useRef(null);
    
    const runSmartOCR = async (file) => {
        // eslint-disable-next-line no-undef
        if (!file || !window.Tesseract) return;
        setIsProcessing(true);
        try {
            setOcrProgress({ status: 'Reading text from image...', progress: 0 });
            // eslint-disable-next-line no-undef
            const worker = await Tesseract.createWorker('eng', 1, { logger: m => { if (m.status === 'recognizing text') setOcrProgress(p => ({ ...p, progress: parseInt(m.progress * 100) })) } });
            // eslint-disable-next-line no-undef
            const { data: { text } } = await worker.recognize(file);
            // eslint-disable-next-line no-undef
            await worker.terminate();
            setOcrProgress({ status: 'AI is analyzing the details...', progress: 100 });
            const structuredData = await parseInvoiceWithGemini(text, setNotification);
            if (structuredData) {
                setInvoiceData({
                    vendorName: structuredData.vendorName || '', totalAmount: structuredData.totalAmount || '',
                    invoiceDate: structuredData.invoiceDate || new Date().toISOString().split('T')[0],
                    category: structuredData.category || 'Other', lineItems: structuredData.lineItems || [],
                    rawText: text,
                });
                setNotification({ text: "Invoice details extracted!", type: "success" });
            } else {
                setNotification({ text: "AI couldn't extract details. Please enter manually.", type: 'error' });
                setInvoiceData({ vendorName: '', totalAmount: '', invoiceDate: new Date().toISOString().split('T')[0], category: 'Other', lineItems: [], rawText: text });
            }
        } catch (error) {
            setNotification({ text: 'Could not process image.', type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleImagePick = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => setImageUri(e.target.result);
            reader.readAsDataURL(file);
            runSmartOCR(file);
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
            await addDoc(collection(db, `artifacts/${appId}/users/${userId}/invoices`), { ...invoiceData, totalAmount: parseFloat(invoiceData.totalAmount) || 0, createdAt: serverTimestamp(), imageUrl: imageUri ? 'simulated_image_url' : null });
            setNotification({text: 'Invoice saved successfully!', type: 'success'});
            setActiveScreen('Invoices');
        } catch (error) {
            setNotification({text: `Failed to save invoice: ${error.message}`, type: 'error'});
        } finally {
            setIsSaving(false);
        }
    };
    
    const defaultCategories = ['Food & Dining', 'Transportation', 'Shopping', 'Utilities', 'Healthcare', 'Entertainment', 'Other'];
    const handleItemChange = (index, field, value) => {
        const updatedItems = [...invoiceData.lineItems];
        updatedItems[index][field] = value;
        setInvoiceData({...invoiceData, lineItems: updatedItems});
    };
    const removeItem = (index) => setInvoiceData({...invoiceData, lineItems: invoiceData.lineItems.filter((_, i) => i !== index)});

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Scan Invoice</h1>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm">
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImagePick} className="hidden" />
                {isProcessing ? (<div className="text-center mb-4"><Loader2 className="animate-spin text-blue-500 mx-auto" size={32} /><p className="mt-2 text-blue-500">{ocrProgress.status} ({ocrProgress.progress}%)</p></div>)
                : imageUri ? (
                    <div className="flex items-center space-x-4 mb-4">
                        <img src={imageUri} alt="Preview" className="w-16 h-16 rounded-lg object-cover" />
                        <div className="flex-1">
                            <button onClick={() => fileInputRef.current.click()} className="text-sm font-semibold text-blue-600 hover:underline">Scan Another</button>
                            <button onClick={() => setImageUri(null)} className="ml-4 text-sm font-semibold text-red-600 hover:underline">Remove</button>
                        </div>
                    </div>
                ) : (
                    <button onClick={() => fileInputRef.current.click()} disabled={!isOcrReady} className="w-full flex flex-col items-center justify-center p-8 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-700/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 transition-colors disabled:opacity-50">
                        <Upload size={32} />
                        <span className="mt-2 font-semibold">{isOcrReady ? 'Tap to Scan or Upload' : 'Initializing Scanner...'}</span>
                    </button>
                )}
                
                <div className="space-y-4">
                     <div><label className="text-sm font-medium text-gray-600 dark:text-gray-400">Vendor Name</label><input type="text" value={invoiceData.vendorName || ''} onChange={e => setInvoiceData({...invoiceData, vendorName: e.target.value})} className="w-full mt-1 p-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg" placeholder="e.g., Cafe Express" /></div>
                    <div><label className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Amount</label><input type="number" value={invoiceData.totalAmount || ''} onChange={e => setInvoiceData({...invoiceData, totalAmount: e.target.value})} className="w-full mt-1 p-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg" placeholder="e.g., 25.50" /></div>
                    <div><label className="text-sm font-medium text-gray-600 dark:text-gray-400">Invoice Date</label><input type="date" value={invoiceData.invoiceDate || ''} onChange={e => setInvoiceData({...invoiceData, invoiceDate: e.target.value})} className="w-full mt-1 p-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg" /></div>
                    <div><label className="text-sm font-medium text-gray-600 dark:text-gray-400">Category</label><select value={invoiceData.category || 'Other'} onChange={e => setInvoiceData({...invoiceData, category: e.target.value})} className="w-full mt-1 p-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg">{defaultCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                    {invoiceData.lineItems && invoiceData.lineItems.length > 0 && (
                        <div>
                            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Extracted Items</label>
                            <div className="space-y-2 mt-1">{invoiceData.lineItems.map((item, index) => (<div key={index} className="grid grid-cols-12 gap-2 items-center">
                                <input type="text" value={item.description || ''} onChange={e => handleItemChange(index, 'description', e.target.value)} placeholder="Item" className="col-span-6 p-2 bg-gray-50 dark:bg-gray-600 rounded-md text-sm" />
                                <input type="number" value={item.quantity || ''} onChange={e => handleItemChange(index, 'quantity', e.target.value)} placeholder="Qty" className="col-span-2 p-2 bg-gray-50 dark:bg-gray-600 rounded-md text-sm" />
                                <input type="number" value={item.price || ''} onChange={e => handleItemChange(index, 'price', e.target.value)} placeholder="Price" className="col-span-3 p-2 bg-gray-50 dark:bg-gray-600 rounded-md text-sm" />
                                <button onClick={() => removeItem(index)} className="col-span-1 text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                            </div>))}</div>
                        </div>
                    )}
                     <button onClick={handleSaveInvoice} disabled={isSaving || isProcessing} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"> {isSaving ? 'Saving...' : 'Save Invoice'} </button>
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
        const aiResponse = await callGeminiAPI(prompt, setNotification);
        setMessages([...newMessages, { text: aiResponse || "Sorry, I couldn't process that.", role: 'ai' }]);
        setIsLoading(false);
    };

    return (
        <div className="flex flex-col h-full">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-4 px-1">AI Chat Assistant</h1>
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-4 p-4 bg-white dark:bg-gray-800 rounded-2xl">
                {messages.length === 0 && !isLoading && (
                    <div className="text-center text-gray-500 pt-10">
                        <MessageCircle size={48} className="mx-auto"/><p className="mt-2">Ask me anything about your invoices!</p>
                        <p className="text-xs mt-2">e.g., "Split the bill from Don Cafe between 4 people"</p>
                    </div>
                )}
                {messages.map((msg, index) => (<div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-2xl ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}><p className="text-sm whitespace-pre-wrap">{msg.text}</p></div></div>))}
                {isLoading && (<div className="flex justify-start"><div className="max-w-xs p-3 rounded-2xl bg-gray-200 dark:bg-gray-700"><Loader2 className="animate-spin text-blue-500"/></div></div>)}
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-b-2xl border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-2"><input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Ask about your spending..." className="w-full p-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"/><button onClick={handleSendMessage} disabled={isLoading} className="bg-blue-600 text-white p-3 rounded-lg disabled:bg-gray-400"><Send size={20}/></button></div>
            </div>
        </div>
    );
};

const ProfileScreen = ({ user, theme, setTheme }) => {
    const handleLogout = () => {
        signOut(getAuth());
    };
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Profile</h1>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm">
                 <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Account</h2>
                 <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                 <p className="font-semibold text-gray-700 dark:text-gray-200 mb-4">{user.email}</p>
                 <button onClick={handleLogout} className="w-full text-left p-3 flex items-center bg-gray-100 dark:bg-gray-700/50 rounded-lg text-red-500 font-semibold hover:bg-red-100 dark:hover:bg-red-900/50"><LogOut size={16} className="mr-2"/> Sign Out</button>
            </div>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm">
                 <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Appearance</h2>
                 <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Dark Mode</span>
                    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}>
                        {theme === 'dark' ? <Moon size={20}/> : <Sun size={20}/>}
                    </button>
                 </div>
            </div>
        </div>
    );
};

const BottomNavBar = ({ activeScreen, setActiveScreen }) => {
    const navItems = [ { name: 'Dashboard', icon: LineChart }, { name: 'Invoices', icon: FileText }, { name: 'Scan', icon: Plus }, { name: 'Chat', icon: MessageCircle }, { name: 'Profile', icon: Settings } ];
    return (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-around items-center max-w-lg mx-auto h-16">
                {navItems.map((item) => {
                    const isActive = activeScreen === item.name;
                    if (item.name === 'Scan') {
                        return (
                            <div key={item.name} className="w-20 flex justify-center">
                                <button onClick={() => setActiveScreen(item.name)} className="-mt-8 bg-blue-600 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg hover:bg-blue-700 transform hover:scale-110 transition-transform">
                                    <item.icon size={28} />
                                </button>
                            </div>
                        );
                    }
                    return (
                        <div key={item.name} className="w-20">
                            <button onClick={() => setActiveScreen(item.name)} className={`flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-300'}`}>
                                <item.icon size={22} />
                                <span className="text-xs mt-1">{item.name}</span>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default App;
