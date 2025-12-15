
import React, { useState } from 'react';
import { api } from '../../services/api';
import { useStore } from '../../context/StoreContext';
import { Search, Globe, CheckCircle, RefreshCw, Loader2, Bot, Brain } from 'lucide-react';
import { SEOSubmission } from '../../types';

export const SEOManager: React.FC = () => {
    const { settings, user } = useStore();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [history, setHistory] = useState<SEOSubmission[]>([]);

    const targets = [
        { id: 'Google', icon: Search, label: 'Google Search' },
        { id: 'Bing', icon: Search, label: 'Bing / Yahoo' },
        { id: 'GoogleGemini', icon: Bot, label: 'Google Gemini' },
        { id: 'OpenAI', icon: Bot, label: 'ChatGPT (OpenAI)' },
        { id: 'Anthropic', icon: Bot, label: 'Claude (Anthropic)' },
        { id: 'Grok', icon: Brain, label: 'Grok (xAI)' },
        { id: 'Perplexity', icon: Brain, label: 'Perplexity.ai' },
        { id: 'BingChat', icon: Bot, label: 'Bing Chat' },
    ];

    const handleSubmit = async () => {
        if(!settings) return;
        setIsSubmitting(true);
        try {
            // Call backend to notify all selected services
            const targetIds = targets.map(t => t.id);
            const results = await api.notifySEO(settings, targetIds, user?.token);
            setHistory(prev => [...results, ...prev]);
        } catch (e) {
            console.error("SEO Submission failed", e);
            // Note: api.notifySEO now handles fallback, but if we get here, it's critical
            alert("Failed to submit to search engines.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in">
            {/* Header / Actions */}
            <div className="bg-white p-6 border shadow-sm rounded-lg">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h2 className="font-bold text-lg flex items-center gap-2"><Globe className="h-5 w-5 text-blue-600"/> Search & LLM Discovery</h2>
                        <p className="text-sm text-gray-500 mt-1">Notify search engines and AI crawlers about your latest products.</p>
                    </div>
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting}
                        className="bg-black text-white px-6 py-3 rounded-md font-bold uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}
                        Notify All Crawlers
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {targets.map(t => (
                        <div key={t.id} className="p-4 border rounded bg-gray-50 flex items-center gap-3">
                            <div className="bg-white p-2 rounded shadow-sm">
                                <t.icon className="h-5 w-5 text-gray-700" />
                            </div>
                            <span className="font-medium text-sm">{t.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* History Log */}
            <div className="bg-white p-6 border shadow-sm rounded-lg">
                <h3 className="font-bold text-gray-900 mb-4">Submission History</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 text-gray-500 uppercase font-bold text-xs border-b">
                            <tr>
                                <th className="p-3">Target</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Time</th>
                                <th className="p-3">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-400">No submissions yet.</td>
                                </tr>
                            ) : (
                                history.map((entry, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="p-3 font-medium">{entry.target}</td>
                                        <td className="p-3">
                                            {entry.status === 'success' ? (
                                                <span className="text-green-600 flex items-center gap-1 font-bold text-xs uppercase"><CheckCircle className="h-3 w-3"/> Success</span>
                                            ) : (
                                                <span className="text-red-600 font-bold text-xs uppercase">Failed</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-gray-500">{new Date(entry.lastSubmitted).toLocaleTimeString()}</td>
                                        <td className="p-3 text-gray-500">{entry.details}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
