import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, Download, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils';
import DatabaseService from '../services/database';
import ConfirmationModal from '../components/ConfirmationModal';

/**
 * Invoices screen component for viewing and managing invoices
 * @param {Array} invoices - Array of invoices
 * @param {string} userId - Current user ID
 * @param {Function} setNotification - Function to show notifications
 */
const InvoicesScreen = ({ invoices, userId, setNotification }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);
    const [invoiceToDelete, setInvoiceToDelete] = useState(null);

    const filteredInvoices = invoices
        .filter(invoice =>
            (invoice.vendorName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (invoice.category?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));

    const handleToggleExpand = (invoiceId) => {
        setExpandedInvoiceId(expandedInvoiceId === invoiceId ? null : invoiceId);
    };
    
    const handleDeleteInvoice = async () => {
        if (!invoiceToDelete) return;

        try {
            await DatabaseService.deleteInvoice(userId, invoiceToDelete);
            setNotification({ text: "Invoice deleted successfully", type: 'success' });
        } catch (error) {
            setNotification({ text: "Failed to delete invoice.", type: 'error' });
        } finally {
            setInvoiceToDelete(null); 
        }
    };
    
    const handleDownloadCsv = () => {
        if (invoices.length === 0) {
            setNotification({ text: "No invoices to download.", type: 'info' });
            return;
        }

        const headers = ['Vendor Name', 'Date', 'Category', 'Total Amount', 'Currency', 'Description'];
        const csvRows = [headers.join(',')];

        invoices.forEach(invoice => {
            const row = [
                `"${invoice.vendorName || ''}"`,
                `"${invoice.invoiceDate || ''}"`,
                `"${invoice.category || ''}"`,
                invoice.totalAmount || 0,
                `"${invoice.currency || ''}"`,
                `"${(invoice.shortDescription || '').replace(/"/g, '""')}"`
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'invoices.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-6 p-4 md:p-6 pb-32">
            <ConfirmationModal 
                isOpen={!!invoiceToDelete}
                onClose={() => setInvoiceToDelete(null)}
                onConfirm={handleDeleteInvoice}
                title="Delete Invoice"
                message="Are you sure you want to permanently delete this invoice? This action cannot be undone."
            />
            
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-4xl font-bold text-black tracking-wide">Invoices</h1>
                <motion.button 
                    whileHover={{ scale: 1.1 }} 
                    whileTap={{ scale: 0.9 }} 
                    onClick={handleDownloadCsv} 
                    className="flex items-center justify-center md:space-x-2 md:px-4 md:py-2 p-2 rounded-lg bg-black text-white font-semibold hover:bg-gray-800"
                >
                    <Download size={16} />
                    <span className="hidden md:inline">Download as CSV</span>
                </motion.button>
            </div>
            
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                    type="text" 
                    placeholder="Search invoices..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-3 pl-11 bg-white/50 backdrop-blur-lg border border-white/20 rounded-xl focus:ring-2 focus:ring-black outline-none"
                />
            </div>
            
            {/* Invoices List */}
            <div className="space-y-3">
                {filteredInvoices.map(invoice => (
                    <motion.div 
                        layout 
                        key={invoice.id} 
                        className="bg-white/50 backdrop-blur-lg border border-white/20 rounded-xl shadow-xl overflow-hidden"
                    >
                        <motion.div 
                            layout 
                            className="p-4 flex items-center justify-between cursor-pointer" 
                            onClick={() => handleToggleExpand(invoice.id)}
                        >
                            <div>
                                <p className="font-semibold text-black">{invoice.vendorName || 'N/A'}</p>
                                <p className="text-sm text-gray-500">{formatDate(invoice.invoiceDate)}</p>
                            </div>
                            <div className="flex items-center space-x-4">
                                <div className="text-right">
                                    <p className="font-bold text-lg text-black">
                                        {formatCurrency(invoice.totalAmount, invoice.currency)}
                                    </p>
                                    <p className="text-sm text-gray-500">{invoice.category}</p>
                                </div>
                                <motion.div 
                                    animate={{ rotate: expandedInvoiceId === invoice.id ? 180 : 0 }}
                                >
                                    <ChevronDown />
                                </motion.div>
                            </div>
                        </motion.div>
                        
                        <AnimatePresence>
                            {expandedInvoiceId === invoice.id && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }} 
                                    animate={{ height: 'auto', opacity: 1 }} 
                                    exit={{ height: 0, opacity: 0 }} 
                                    className="overflow-hidden"
                                >
                                    <div className="px-4 pb-4 border-t border-white/20">
                                        <div className="flex justify-between items-center pt-3 mb-2">
                                            <h4 className="font-semibold text-sm text-gray-600">Item Details</h4>
                                            <motion.button 
                                                whileHover={{ scale: 1.1 }} 
                                                whileTap={{ scale: 0.9 }} 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setInvoiceToDelete(invoice.id);
                                                }} 
                                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full"
                                            >
                                                <Trash2 size={16}/>
                                            </motion.button>
                                        </div>
                                        <div className="space-y-1 text-sm text-gray-600">
                                            {invoice.lineItems && invoice.lineItems.length > 0 ? (
                                                invoice.lineItems.map((item, index) => (
                                                    <div key={index} className="flex justify-between">
                                                        <span>{item.description} (x{item.quantity || 1})</span>
                                                        <span>{formatCurrency(item.price, invoice.currency)}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-xs">No detailed items were extracted for this invoice.</p>
                                            )}
                                        </div>
                                        {invoice.shortDescription && (
                                            <div className="mt-3 pt-3 border-t border-white/20">
                                                <h5 className="font-medium text-xs text-gray-600 mb-1">Description</h5>
                                                <p className="text-sm text-gray-700">{invoice.shortDescription}</p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                ))}
                  {filteredInvoices.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                        <p>No invoices found matching your search.</p>
                    </div>
                )}
            </div>
        </div>
        </div>
    );
};

export default InvoicesScreen;
