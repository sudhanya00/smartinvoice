import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, Loader2 } from 'lucide-react';
import { DEFAULT_CATEGORIES, SUPPORTED_CURRENCIES } from '../constants';
import GeminiService from '../services/gemini';
import DatabaseService from '../services/database';

/**
 * Scan screen component for uploading and processing invoices
 * @param {string} userId - Current user ID
 * @param {Function} setActiveScreen - Function to change active screen
 * @param {Function} setNotification - Function to show notifications
 */
const ScanScreen = ({ userId, setActiveScreen, setNotification }) => {
    const [invoiceData, setInvoiceData] = useState({
        vendorName: '',
        totalAmount: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        category: 'Other',
        lineItems: [],
        currency: 'USD',
        shortDescription: ''
    });
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
                const structuredData = await GeminiService.parseInvoice(base64ImageData, setNotification);
                
                if (structuredData) {
                    setInvoiceData({
                        vendorName: structuredData.vendorName || '',
                        totalAmount: structuredData.totalAmount || '',
                        invoiceDate: structuredData.invoiceDate || new Date().toISOString().split('T')[0],
                        category: structuredData.category || 'Other',
                        lineItems: structuredData.lineItems || [],
                        currency: structuredData.currency || 'USD',
                        shortDescription: structuredData.shortDescription || ''
                    });
                    setNotification({ text: "Invoice details extracted!", type: "success" });
                } else {
                    setNotification({ text: "AI couldn't extract details. Please enter manually.", type: 'error' });
                    setInvoiceData({
                        vendorName: '',
                        totalAmount: '',
                        invoiceDate: new Date().toISOString().split('T')[0],
                        category: 'Other',
                        lineItems: [],
                        currency: 'USD',
                        shortDescription: ''
                    });
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
            setNotification({ text: "Vendor Name and Total Amount are required.", type: 'error' });
            return;
        }
        
        setIsSaving(true);
        try {
            await DatabaseService.addInvoice(userId, invoiceData);
            setNotification({ text: 'Invoice saved successfully!', type: 'success' });
            setActiveScreen('Invoices');
        } catch (error) {
            setNotification({ text: `Failed to save invoice: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-6 p-4 md:p-6 pb-32">
            <h1 className="text-4xl font-bold text-black tracking-wide">Scan Invoice</h1>
            
            <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-6 rounded-2xl shadow-xl">
                <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    onChange={handleImagePick} 
                    className="hidden" 
                />
                
                {isProcessing ? (
                    <div className="text-center mb-4">
                        <Loader2 className="animate-spin text-black mx-auto" size={32} />
                        <p className="mt-2 text-black">AI is analyzing the details...</p>
                    </div>
                ) : imageUri ? (
                    <div className="flex items-center space-x-4 mb-4">
                        <img src={imageUri} alt="Preview" className="w-16 h-16 rounded-lg object-cover" />
                        <div className="flex-1">
                            <button 
                                onClick={() => fileInputRef.current.click()} 
                                className="text-sm font-semibold text-black hover:underline"
                            >
                                Scan Another
                            </button>
                            <button 
                                onClick={() => setImageUri(null)} 
                                className="ml-4 text-sm font-semibold text-red-600 hover:underline"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                ) : (
                    <motion.button 
                        whileHover={{ scale: 1.02 }} 
                        whileTap={{ scale: 0.98 }} 
                        onClick={() => fileInputRef.current.click()} 
                        className="w-full flex flex-col items-center justify-center p-8 bg-white/30 hover:bg-white/50 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 transition-colors"
                    >
                        <Upload size={32} />
                        <span className="mt-2 font-semibold">Tap to Scan or Upload</span>
                    </motion.button>
                )}
                
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-600">Vendor Name</label>
                        <input 
                            type="text" 
                            value={invoiceData.vendorName || ''} 
                            onChange={e => setInvoiceData({ ...invoiceData, vendorName: e.target.value })} 
                            className="w-full mt-1 p-3 bg-white/50 border border-white/20 rounded-lg" 
                            placeholder="e.g., Cafe Express" 
                        />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label className="text-sm font-medium text-gray-600">Total Amount</label>
                            <input 
                                type="number" 
                                value={invoiceData.totalAmount || ''} 
                                onChange={e => setInvoiceData({ ...invoiceData, totalAmount: e.target.value })} 
                                className="w-full mt-1 p-3 bg-white/50 border border-white/20 rounded-lg" 
                                placeholder="e.g., 25.50" 
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-600">Currency</label>
                            <select 
                                value={invoiceData.currency || 'USD'} 
                                onChange={e => setInvoiceData({ ...invoiceData, currency: e.target.value })} 
                                className="w-full mt-1 p-3 bg-white/50 border border-white/20 rounded-lg"
                            >
                                {SUPPORTED_CURRENCIES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label className="text-sm font-medium text-gray-600">Invoice Date</label>
                        <input 
                            type="date" 
                            value={invoiceData.invoiceDate || ''} 
                            onChange={e => setInvoiceData({ ...invoiceData, invoiceDate: e.target.value })} 
                            className="w-full mt-1 p-3 bg-white/50 border border-white/20 rounded-lg" 
                        />
                    </div>
                    
                    <div>
                        <label className="text-sm font-medium text-gray-600">Category</label>
                        <select 
                            value={invoiceData.category || 'Other'} 
                            onChange={e => setInvoiceData({ ...invoiceData, category: e.target.value })} 
                            className="w-full mt-1 p-3 bg-white/50 border border-white/20 rounded-lg"
                        >
                            {DEFAULT_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    
                    <motion.button 
                        whileHover={{ scale: 1.02 }} 
                        whileTap={{ scale: 0.98 }} 
                        onClick={handleSaveInvoice} 
                        disabled={isSaving || isProcessing} 
                        className="w-full bg-black text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 shadow-lg"
                    >                    {isSaving ? 'Saving...' : 'Save Invoice'}
                    </motion.button>
                </div>
            </div>
        </div>
        </div>
    );
};

export default ScanScreen;
