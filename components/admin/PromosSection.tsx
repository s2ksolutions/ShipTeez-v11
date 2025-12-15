
import React, { useState } from 'react';
import { PromoCode } from '../../types';
import { db } from '../../services/db';
import { generatePromoIdea } from '../../services/geminiService';
import { Plus, Trash2, RefreshCw, BarChart3, Tag, DollarSign, Calendar, Sparkles, Loader2, Layers } from 'lucide-react';

interface PromosSectionProps {
    promos: PromoCode[];
    onRefresh: () => Promise<void>;
}

export const PromosSection: React.FC<PromosSectionProps> = ({ promos, onRefresh }) => {
    const [newPromo, setNewPromo] = useState<PromoCode>({ 
        code: '', 
        discountType: 'percentage', 
        value: 10, 
        isActive: true, 
        usageCount: 0,
        maxUses: undefined,
        minOrderValue: undefined 
    });
    const [promoExpiry, setPromoExpiry] = useState('');
    const [aiTheme, setAiTheme] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Bulk State
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [bulkCount, setBulkCount] = useState(10);
    const [bulkPrefix, setBulkPrefix] = useState('PROMO-');

    const totalUsage = promos.reduce((acc, p) => acc + (p.usageCount || 0), 0);
    const activeCount = promos.filter(p => p.isActive).length;

    const handleGenerateAi = async () => {
        if (!aiTheme.trim()) return;
        setIsGenerating(true);
        try {
            const idea = await generatePromoIdea(aiTheme);
            setNewPromo({ ...newPromo, code: idea.code, discountType: idea.discountType, value: idea.value });
        } catch (e) {
            alert('Failed to generate promo. Try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCreate = async () => {
        const expiresAt = promoExpiry ? new Date(promoExpiry).getTime() : undefined;
        
        if (isBulkMode) {
            if(bulkCount > 50) { alert("Max 50 codes at once."); return; }
            const promises = [];
            for(let i=0; i<bulkCount; i++) {
                const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
                const code = `${bulkPrefix}${randomSuffix}`;
                promises.push(db.savePromo({ ...newPromo, code, expiresAt }));
            }
            await Promise.all(promises);
            alert(`Generated ${bulkCount} unique codes.`);
        } else {
            if(!newPromo.code) return alert("Code required");
            await db.savePromo({ ...newPromo, expiresAt });
            alert("Promo code created successfully.");
        }
        
        setNewPromo({ code: '', discountType: 'percentage', value: 10, isActive: true, usageCount: 0 }); 
        setPromoExpiry(''); 
        setAiTheme(''); 
        onRefresh(); 
    };

    return (
        <div className="space-y-8 animate-in fade-in">
            
            {/* Stats Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 border shadow-sm rounded-lg flex items-center gap-4">
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-full"><Tag className="h-6 w-6"/></div>
                    <div><p className="text-xs font-bold uppercase text-gray-500">Active Codes</p><p className="text-2xl font-bold">{activeCount}</p></div>
                </div>
                <div className="bg-white p-6 border shadow-sm rounded-lg flex items-center gap-4">
                    <div className="p-3 bg-green-100 text-green-600 rounded-full"><BarChart3 className="h-6 w-6"/></div>
                    <div><p className="text-xs font-bold uppercase text-gray-500">Total Redemptions</p><p className="text-2xl font-bold">{totalUsage}</p></div>
                </div>
                <div className="bg-white p-6 border shadow-sm rounded-lg flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><DollarSign className="h-6 w-6"/></div>
                    <div><p className="text-xs font-bold uppercase text-gray-500">Est. Savings Given</p><p className="text-2xl font-bold">$--</p></div>
                </div>
            </div>

            <div className="bg-white p-6 border shadow-sm flex flex-col xl:flex-row gap-8">
                {/* Creator Form */}
                <div className="xl:w-1/3 space-y-6">
                    <div className="flex justify-between items-center border-b pb-4">
                        <h2 className="font-bold text-lg">Create Campaign</h2>
                        <button 
                            onClick={() => setIsBulkMode(!isBulkMode)}
                            className={`text-xs px-2 py-1 border rounded uppercase font-bold flex items-center gap-1 ${isBulkMode ? 'bg-black text-white' : 'text-gray-500'}`}
                        >
                            <Layers className="h-3 w-3" /> Bulk Mode
                        </button>
                    </div>
                    
                    {/* AI Helper */}
                    {!isBulkMode && (
                        <div className="bg-purple-50 p-4 border border-purple-100 rounded-lg">
                            <label className="text-xs font-bold uppercase text-purple-800 mb-2 flex items-center gap-2"><Sparkles className="h-3 w-3"/> AI Idea Generator</label>
                            <div className="flex gap-2">
                                <input 
                                    className="flex-1 border-purple-200 text-sm p-2 rounded bg-white" 
                                    placeholder="e.g. Summer Sale, Black Friday" 
                                    value={aiTheme}
                                    onChange={e => setAiTheme(e.target.value)}
                                />
                                <button onClick={handleGenerateAi} disabled={isGenerating || !aiTheme} className="bg-purple-600 text-white px-3 py-2 text-xs font-bold uppercase rounded hover:bg-purple-700 disabled:opacity-50">
                                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Generate'}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        {isBulkMode ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Prefix</label>
                                    <input className="border p-3 w-full rounded font-mono" value={bulkPrefix} onChange={e => setBulkPrefix(e.target.value.toUpperCase())} placeholder="SALE-" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Count (Max 50)</label>
                                    <input type="number" className="border p-3 w-full rounded" value={bulkCount} onChange={e => setBulkCount(parseInt(e.target.value))} max={50} min={1} />
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Promo Code</label>
                                <input className="border p-3 w-full uppercase font-mono tracking-wider rounded" value={newPromo.code} onChange={e => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })} placeholder="SUMMER2024" />
                            </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Value</label>
                                <input type="number" className="border p-2 w-full rounded" value={newPromo.value} onChange={e => setNewPromo({ ...newPromo, value: parseFloat(e.target.value) })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Type</label>
                                <select className="border p-2 w-full rounded bg-white" value={newPromo.discountType} onChange={e => setNewPromo({ ...newPromo, discountType: e.target.value as any })}>
                                    <option value="percentage">% Percentage</option>
                                    <option value="fixed">$ Fixed Amount</option>
                                </select>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded border space-y-3">
                            <h4 className="font-bold text-xs uppercase text-gray-500">Conditions (Optional)</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <input type="number" placeholder="Max Uses" className="border p-2 text-sm rounded" value={newPromo.maxUses || ''} onChange={e => setNewPromo({ ...newPromo, maxUses: parseInt(e.target.value) })} />
                                <input type="number" placeholder="Min Order $" className="border p-2 text-sm rounded" value={newPromo.minOrderValue || ''} onChange={e => setNewPromo({ ...newPromo, minOrderValue: parseFloat(e.target.value) })} />
                            </div>
                            <div className="relative">
                                <Calendar className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
                                <input type="date" className="border p-2 pl-9 w-full text-sm rounded" value={promoExpiry} onChange={e => setPromoExpiry(e.target.value)} />
                            </div>
                        </div>

                        <button onClick={handleCreate} className="w-full bg-black text-white px-4 py-3 font-bold uppercase flex items-center justify-center gap-2 hover:bg-gray-800 rounded shadow-md">
                            <Plus className="h-4 w-4" /> {isBulkMode ? 'Generate Bulk Codes' : 'Launch Promo'}
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 border-l xl:pl-8 overflow-y-auto max-h-[600px]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-sm text-gray-500 uppercase">Active Campaigns</h3>
                        <button onClick={() => onRefresh()} className="text-gray-400 hover:text-black"><RefreshCw className="h-4 w-4"/></button>
                    </div>
                    <div className="space-y-3">
                        {promos.map(p => (
                            <div key={p.code} className="group flex items-center justify-between p-4 border rounded-lg bg-white hover:shadow-md transition-all">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono font-bold text-lg text-indigo-600 tracking-wider bg-indigo-50 px-2 rounded">{p.code}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wide ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.isActive ? 'Active' : 'Inactive'}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-2 flex gap-4">
                                        <span className="font-bold text-gray-700">{p.discountType === 'percentage' ? `${p.value}% Off` : `$${p.value} Off`}</span>
                                        <span>• Used: {p.usageCount} {p.maxUses ? `/ ${p.maxUses}` : ''}</span>
                                        {p.minOrderValue && <span>• Min: ${p.minOrderValue}</span>}
                                        {p.expiresAt && <span className={p.expiresAt < Date.now() ? 'text-red-500' : ''}>• Exp: {new Date(p.expiresAt).toLocaleDateString()}</span>}
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={async () => { await db.savePromo({ ...p, isActive: !p.isActive }); onRefresh(); }} className="p-2 border rounded hover:bg-gray-50 text-gray-600" title="Toggle Active">
                                        <RefreshCw className="h-4 w-4" />
                                    </button>
                                    <button onClick={async () => { if (confirm('Delete promo?')) { await db.deletePromo(p.code); onRefresh(); } }} className="p-2 border rounded hover:bg-red-50 text-red-500" title="Delete">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
