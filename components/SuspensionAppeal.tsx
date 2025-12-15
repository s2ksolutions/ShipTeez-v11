
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { SuspensionCase, AppealDocument } from '../types';
import { ShieldAlert, Upload, Send, CheckCircle, FileText, Loader2, AlertCircle, X, Clock, Ban } from 'lucide-react';

export const SuspensionAppeal: React.FC<{ userId: string }> = ({ userId }) => {
    const [kase, setKase] = useState<SuspensionCase | null>(null);
    const [statement, setStatement] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedDocs, setUploadedDocs] = useState<AppealDocument[]>([]);
    const [viewDoc, setViewDoc] = useState<string | null>(null);

    useEffect(() => {
        loadCase();
    }, [userId]);

    const loadCase = async () => {
        const c = await db.getSuspensionCase(userId);
        if (c) {
            setKase(c);
            if (c.customerStatement) setStatement(c.customerStatement);
            setUploadedDocs(c.documents || []);
        }
    };

    const handleAppeal = async () => {
        if (!statement.trim()) return;
        setIsSubmitting(true);
        try {
            await db.appealSuspension(statement);
            await loadCase();
            // No alert needed, UI updates based on status
        } catch (e) {
            alert("Failed to submit appeal.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
        if (e.target.files?.[0]) {
            setIsUploading(true);
            try {
                const res = await db.uploadAppealDoc(type, e.target.files[0]);
                if (res?.document) {
                    setUploadedDocs(prev => [...prev, res.document]);
                }
            } catch (e) {
                alert("Upload failed. File might be too large.");
            } finally {
                setIsUploading(false);
            }
        }
    };

    const hasID = uploadedDocs.some(d => d.type.startsWith('id_'));

    // --- RENDER STATES ---

    // 1. Rejected State
    if (kase?.status === 'Rejected') {
        return (
            <div className="max-w-2xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 text-center">
                <div className="bg-red-50 border border-red-200 rounded-xl p-12 shadow-sm">
                    <div className="bg-white p-6 rounded-full inline-block mb-6 shadow-sm">
                        <Ban className="h-16 w-16 text-red-600" />
                    </div>
                    <h1 className="text-3xl font-display font-bold text-red-900 mb-4">Permanently Suspended</h1>
                    <p className="text-red-700 text-lg max-w-lg mx-auto leading-relaxed">
                        Your account has been permanently suspended following a review of your activity. This decision is final and cannot be appealed further.
                    </p>
                    <div className="mt-8 pt-8 border-t border-red-100">
                        <p className="text-xs text-red-500 uppercase font-bold">Case ID: {kase.id}</p>
                    </div>
                </div>
            </div>
        );
    }

    // 2. Under Review State
    if (kase?.status === 'Under Review') {
        return (
            <div className="max-w-2xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 text-center">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-12 shadow-sm">
                    <div className="bg-white p-6 rounded-full inline-block mb-6 shadow-sm">
                        <Clock className="h-16 w-16 text-blue-600" />
                    </div>
                    <h1 className="text-3xl font-display font-bold text-blue-900 mb-4">Under Review</h1>
                    <p className="text-blue-700 text-lg max-w-lg mx-auto leading-relaxed mb-6">
                        Thank you for submitting your appeal. Our security team is currently reviewing your information. You will be notified via email once a decision has been made.
                    </p>
                    <div className="bg-white p-4 rounded-lg inline-block text-left border border-blue-100">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Submitted Documents</p>
                        <div className="flex gap-2">
                            {uploadedDocs.map((doc, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => setViewDoc(doc.url)}
                                    className="h-12 w-12 border rounded overflow-hidden hover:opacity-80 transition-opacity"
                                >
                                    <img src={doc.url} className="h-full w-full object-cover" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                {/* Document Modal */}
                {viewDoc && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setViewDoc(null)}>
                        <div className="relative max-w-4xl max-h-[90vh] w-full">
                            <button onClick={() => setViewDoc(null)} className="absolute -top-12 right-0 text-white hover:text-gray-300"><X className="h-8 w-8"/></button>
                            <img src={viewDoc} className="w-full h-full object-contain rounded shadow-2xl" onClick={e => e.stopPropagation()} />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // 3. Action Required State (Form)
    return (
        <div className="max-w-3xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4">
            
            {/* Document Preview Modal */}
            {viewDoc && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setViewDoc(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] w-full">
                        <button onClick={() => setViewDoc(null)} className="absolute -top-12 right-0 text-white hover:text-gray-300"><X className="h-8 w-8"/></button>
                        <img src={viewDoc} className="w-full h-full object-contain rounded shadow-2xl" onClick={e => e.stopPropagation()} />
                    </div>
                </div>
            )}

            <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center mb-8 shadow-sm">
                <div className="bg-white p-4 rounded-full inline-block mb-4 shadow-sm">
                    <ShieldAlert className="h-12 w-12 text-red-600" />
                </div>
                <h1 className="text-3xl font-display font-bold text-red-900 mb-2">Account Suspended</h1>
                <p className="text-red-700 max-w-lg mx-auto">
                    Your account has been flagged for security review. You cannot place orders or access features until this restriction is lifted.
                </p>
                {kase && (
                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white border border-red-200 rounded-full text-sm font-bold text-red-800">
                        Status: Action Required
                    </div>
                )}
            </div>

            <div className="bg-white border shadow-sm rounded-xl overflow-hidden">
                <div className="p-6 bg-gray-50 border-b">
                    <h2 className="text-lg font-bold text-gray-900">Submit Appeal</h2>
                    <p className="text-sm text-gray-500">Please provide information to verify your identity and restore access.</p>
                </div>
                
                <div className="p-8 space-y-8">
                    {/* Step 1: Statement */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">1. Explanation</label>
                        <textarea 
                            className="w-full border rounded-lg p-4 h-32 focus:ring-black focus:border-black"
                            placeholder="Please explain recent activity or why this suspension is an error..."
                            value={statement}
                            onChange={e => setStatement(e.target.value)}
                        />
                    </div>

                    {/* Step 2: ID Verification */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-4">2. Identity Verification (Required)</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors relative">
                                {uploadedDocs.find(d => d.type === 'id_front') ? (
                                    <div className="text-green-600 flex flex-col items-center">
                                        <CheckCircle className="h-8 w-8 mb-2"/>
                                        <span className="text-sm font-bold">Front Uploaded</span>
                                        <button onClick={() => setViewDoc(uploadedDocs.find(d => d.type === 'id_front')?.url || null)} className="mt-2 text-xs underline text-gray-500">View</button>
                                    </div>
                                ) : (
                                    <label className="cursor-pointer block">
                                        <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2"/>
                                        <span className="text-sm font-bold text-gray-600">Upload Driver's License (Front)</span>
                                        <input type="file" className="hidden" accept="image/*" onChange={e => handleUpload(e, 'id_front')} disabled={isUploading} />
                                    </label>
                                )}
                            </div>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors relative">
                                {uploadedDocs.find(d => d.type === 'utility_bill') ? (
                                    <div className="text-green-600 flex flex-col items-center">
                                        <CheckCircle className="h-8 w-8 mb-2"/>
                                        <span className="text-sm font-bold">Bill Uploaded</span>
                                        <button onClick={() => setViewDoc(uploadedDocs.find(d => d.type === 'utility_bill')?.url || null)} className="mt-2 text-xs underline text-gray-500">View</button>
                                    </div>
                                ) : (
                                    <label className="cursor-pointer block">
                                        <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2"/>
                                        <span className="text-sm font-bold text-gray-600">Upload Utility Bill (Address)</span>
                                        <input type="file" className="hidden" accept="image/*" onChange={e => handleUpload(e, 'utility_bill')} disabled={isUploading} />
                                    </label>
                                )}
                            </div>
                        </div>
                        {isUploading && <p className="text-xs text-blue-600 mt-2 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin"/> Uploading securely...</p>}
                    </div>

                    <div className="pt-4 border-t">
                        <button 
                            onClick={handleAppeal} 
                            disabled={!statement || !hasID || isSubmitting}
                            className="w-full bg-black text-white py-4 rounded-lg font-bold uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin"/> : <Send className="h-5 w-5" />}
                            Submit Appeal
                        </button>
                        {!hasID && <p className="text-xs text-center text-red-500 mt-2 flex items-center justify-center gap-1"><AlertCircle className="h-3 w-3"/> ID Document required to submit</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};
