
import React, { useState, useEffect } from 'react';
import { StoreContent, Subscriber, Unsubscriber, User } from '../../types';
import { Megaphone, Tag, Mail, Download, Save, Monitor, Trash2, CheckCircle, Clock, Search, Plus, Ban, UserX } from 'lucide-react';
import { AITextGenerator } from './AITextGenerator';
import { db } from '../../services/db';

interface MarketingSectionProps {
    content: StoreContent;
    subscribers: Subscriber[];
    users?: User[]; // Optional props from parent
    onUpdateContent: (fn: (c: StoreContent) => StoreContent) => void;
    onSaveContent: () => Promise<void>;
}

export const MarketingSection: React.FC<MarketingSectionProps> = ({ content, subscribers, users, onUpdateContent, onSaveContent }) => {
    const [activeListTab, setActiveListTab] = useState<'subscribers' | 'unsubscribes' | 'account_optouts'>('subscribers');
    const [subTab, setSubTab] = useState<'verified' | 'pending'>('verified'); // For active subs
    const [isCleaning, setIsCleaning] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [unsubscribers, setUnsubscribers] = useState<Unsubscriber[]>([]);
    const [manualEmail, setManualEmail] = useState('');

    useEffect(() => {
        if (activeListTab === 'unsubscribes') {
            loadUnsubscribers();
        }
    }, [activeListTab]);

    const loadUnsubscribers = async () => {
        const list = await db.getUnsubscribers();
        setUnsubscribers(list);
    };

    const handleExportSubscribers = () => {
        const csv = "Email,Joined,Status\n" + subscribers.map(s => `${s.email},${new Date(s.createdAt).toLocaleDateString()},${s.isVerified ? 'Verified' : 'Pending'}`).join("\n");
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'subscribers.csv'; a.click();
    };

    const updateAds = (key: string, val: any) => {
        onUpdateContent(c => ({
            ...c,
            marketing: {
                ...c.marketing,
                ads: { ...c.marketing.ads!, [key]: val }
            }
        }));
    };

    const handleDeleteSubscriber = async (email: string) => {
        if(confirm(`Unsubscribe ${email}? They will be moved to the unsubscribe list.`)) {
            await db.unsubscribeNewsletter(email);
            // In a real app we'd trigger a parent refresh, here we manually filter for immediate UI update
            // Note: Parent refresh is handled by the page, but might lag.
            alert("Unsubscribed.");
        }
    };

    const handleRemoveFromBlocklist = async (email: string) => {
        if(confirm(`Remove ${email} from unsubscribe list? This allows them to re-subscribe.`)) {
            await db.removeUnsubscriber(email);
            await loadUnsubscribers();
        }
    };

    const handleManualAdd = async () => {
        if (!manualEmail.includes('@')) return alert("Invalid email");
        
        if (activeListTab === 'subscribers') {
            await db.subscribeNewsletter(manualEmail);
            alert("Added to subscribers (Pending verification)");
        } else {
            await db.addUnsubscriber(manualEmail);
            await loadUnsubscribers();
            alert("Added to unsubscribe blocklist");
        }
        setManualEmail('');
    };

    const handleCleanup = async () => {
        if(confirm("Delete all unverified emails older than 24 hours?")) {
            setIsCleaning(true);
            const count = await db.cleanupSubscribers(24);
            setIsCleaning(false);
            alert(`Cleaned up ${count} subscribers.`);
        }
    };

    // Filter Logic
    let displayList: any[] = [];
    if (activeListTab === 'subscribers') {
        displayList = subscribers.filter(s => {
            if (subTab === 'verified' && !s.isVerified) return false;
            if (subTab === 'pending' && s.isVerified) return false;
            return s.email.toLowerCase().includes(searchQuery.toLowerCase());
        });
    } else if (activeListTab === 'unsubscribes') {
        displayList = unsubscribers.filter(u => u.email.toLowerCase().includes(searchQuery.toLowerCase()));
    } else if (activeListTab === 'account_optouts' && users) {
        // Filter registered users who have disabled account emails
        displayList = users.filter(u => 
            u.preferences?.account === false && 
            (u.email.toLowerCase().includes(searchQuery.toLowerCase()) || u.name.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
            <div className="space-y-6">
                
                {/* Banner */}
                <div className="bg-white p-6 border shadow-sm">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Megaphone className="h-5 w-5" /> Announcement Banner</h3>
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <label className="text-xs font-bold uppercase text-gray-500 w-24">Text</label>
                            <input className="border p-2 flex-1" value={content.marketing.banner.text} onChange={e => onUpdateContent(c => ({ ...c, marketing: { ...c.marketing, banner: { ...c.marketing.banner, text: e.target.value } } }))} />
                            <AITextGenerator className="p-2" context="Short banner announcement text for sale" onGenerate={t => onUpdateContent(c => ({ ...c, marketing: { ...c.marketing, banner: { ...c.marketing.banner, text: t } } }))} />
                        </div>
                        <div className="flex items-center gap-4"><label className="text-xs font-bold uppercase text-gray-500 w-24">Link</label><input className="border p-2 flex-1" value={content.marketing.banner.link || ''} onChange={e => onUpdateContent(c => ({ ...c, marketing: { ...c.marketing, banner: { ...c.marketing.banner, link: e.target.value } } }))} /></div>
                        <div className="flex items-center gap-4"><label className="text-xs font-bold uppercase text-gray-500 w-24">Colors</label><div className="flex gap-2"><input type="color" value={content.marketing.banner.bgColor} onChange={e => onUpdateContent(c => ({ ...c, marketing: { ...c.marketing, banner: { ...c.marketing.banner, bgColor: e.target.value } } }))} /><input type="color" value={content.marketing.banner.textColor} onChange={e => onUpdateContent(c => ({ ...c, marketing: { ...c.marketing, banner: { ...c.marketing.banner, textColor: e.target.value } } }))} /></div></div>
                        <div className="flex items-center gap-2 pt-2"><input type="checkbox" checked={content.marketing.banner.enabled} onChange={e => onUpdateContent(c => ({ ...c, marketing: { ...c.marketing, banner: { ...c.marketing.banner, enabled: e.target.checked } } }))} /> <span className="text-sm font-bold">Enable Banner</span></div>
                    </div>
                </div>

                {/* Popups */}
                <div className="bg-white p-6 border shadow-sm">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Tag className="h-5 w-5" /> Popups</h3>
                    <div className="space-y-6">
                        <div className="p-4 bg-gray-50 border rounded">
                            <h4 className="font-bold text-sm mb-2 flex justify-between">Welcome Popup (Timer) <AITextGenerator className="p-1" context="Welcome popup description for new visitors offering discount" onGenerate={t => onUpdateContent(c => ({ ...c, marketing: { ...c.marketing, welcomePopup: { ...c.marketing.welcomePopup, description: t } } }))} /></h4>
                            <div className="grid grid-cols-2 gap-4 mb-2">
                                <input className="border p-1 text-sm" placeholder="Title" value={content.marketing.welcomePopup.title} onChange={e => onUpdateContent(c => ({ ...c, marketing: { ...c.marketing, welcomePopup: { ...c.marketing.welcomePopup, title: e.target.value } } }))} />
                                <input className="border p-1 text-sm" placeholder="Promo Code" value={content.marketing.welcomePopup.promoCode || ''} onChange={e => onUpdateContent(c => ({ ...c, marketing: { ...c.marketing, welcomePopup: { ...c.marketing.welcomePopup, promoCode: e.target.value } } }))} />
                            </div>
                            <textarea className="border p-1 text-sm w-full mb-2 h-16" placeholder="Description" value={content.marketing.welcomePopup.description} onChange={e => onUpdateContent(c => ({ ...c, marketing: { ...c.marketing, welcomePopup: { ...c.marketing.welcomePopup, description: e.target.value } } }))} />
                            
                            <div className="mb-2 p-2 border border-gray-200 bg-white rounded">
                                <div className="flex items-center gap-2 mb-1">
                                    <input type="checkbox" checked={content.marketing.welcomePopup.targetNonPurchasersOnly} onChange={e => onUpdateContent(c => ({ ...c, marketing: { ...c.marketing, welcomePopup: { ...c.marketing.welcomePopup, targetNonPurchasersOnly: e.target.checked } } }))} />
                                    <label className="text-xs">Only show to non-purchasers (or stale customers)</label>
                                </div>
                                {content.marketing.welcomePopup.targetNonPurchasersOnly && (
                                    <div className="flex items-center gap-2 pl-5">
                                        <label className="text-xs text-gray-500">Days since last order:</label>
                                        <input type="number" className="border w-16 p-1 text-xs" value={content.marketing.welcomePopup.daysSinceLastOrder || 30} onChange={e => onUpdateContent(c => ({ ...c, marketing: { ...c.marketing, welcomePopup: { ...c.marketing.welcomePopup, daysSinceLastOrder: parseInt(e.target.value) } } }))} />
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between items-center">
                                <label className="flex items-center gap-2 text-xs"><input type="number" className="border w-12 p-1" value={content.marketing.welcomePopup.delay} onChange={e => onUpdateContent(c => ({ ...c, marketing: { ...c.marketing, welcomePopup: { ...c.marketing.welcomePopup, delay: parseInt(e.target.value) } } }))} /> sec delay</label>
                                <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={content.marketing.welcomePopup.enabled} onChange={e => onUpdateContent(c => ({ ...c, marketing: { ...c.marketing, welcomePopup: { ...c.marketing.welcomePopup, enabled: e.target.checked } } }))} /> Enable</label>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border rounded">
                            <h4 className="font-bold text-sm mb-2 flex justify-between">Exit Intent Popup <AITextGenerator className="p-1" context="Exit intent popup text to keep user on site" onGenerate={t => onUpdateContent(c => ({ ...c, marketing: { ...c.marketing, exitPopup: { ...c.marketing.exitPopup, description: t } } }))} /></h4>
                            <div className="grid grid-cols-2 gap-4 mb-2">
                                <input className="border p-1 text-sm" placeholder="Title" value={content.marketing.exitPopup.title} onChange={e => onUpdateContent(c => ({ ...c, marketing: { ...c.marketing, exitPopup: { ...c.marketing.exitPopup, title: e.target.value } } }))} />
                                <input className="border p-1 text-sm" placeholder="Promo Code" value={content.marketing.exitPopup.promoCode || ''} onChange={e => onUpdateContent(c => ({ ...c, marketing: { ...c.marketing, exitPopup: { ...c.marketing.exitPopup, promoCode: e.target.value } } }))} />
                            </div>
                            <textarea className="border p-1 text-sm w-full mb-2 h-16" placeholder="Description" value={content.marketing.exitPopup.description} onChange={e => onUpdateContent(c => ({ ...c, marketing: { ...c.marketing, exitPopup: { ...c.marketing.exitPopup, description: e.target.value } } }))} />
                            <label className="flex items-center gap-2 text-sm font-bold justify-end"><input type="checkbox" checked={content.marketing.exitPopup.enabled} onChange={e => onUpdateContent(c => ({ ...c, marketing: { ...c.marketing, exitPopup: { ...c.marketing.exitPopup, enabled: e.target.checked } } }))} /> Enable</label>
                        </div>
                    </div>
                </div>

                <button onClick={onSaveContent} className="w-full bg-black text-white py-4 font-bold uppercase tracking-widest hover:bg-gray-800 flex items-center justify-center gap-2 transition-colors">
                    <Save className="h-4 w-4" /> Save Marketing Settings
                </button>
            </div>

            <div className="flex flex-col gap-8">
                {/* Ad Configuration */}
                <div className="bg-white p-6 border shadow-sm">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Monitor className="h-5 w-5" /> Ad Display</h3>
                    <p className="text-xs text-gray-500 mb-4">Paste your ad script (e.g., Google AdSense, Affiliate Banners) below.</p>
                    
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="adsEnabled" checked={content.marketing.ads?.enabled} onChange={e => updateAds('enabled', e.target.checked)} />
                            <label htmlFor="adsEnabled" className="text-sm font-bold">Enable Ads</label>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-gray-500">Ad Script / HTML</label>
                            <textarea 
                                className="w-full border p-3 rounded font-mono text-xs h-32" 
                                placeholder="<script>...</script> or <a href='...'><img src='...'/></a>"
                                value={content.marketing.ads?.script || ''}
                                onChange={e => updateAds('script', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* List Management */}
                <div className="bg-white p-6 border shadow-sm flex flex-col flex-1">
                    <div className="flex flex-col gap-4 mb-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-lg flex items-center gap-2"><Mail className="h-5 w-5" /> Lists</h3>
                            {activeListTab === 'subscribers' && (
                                <div className="flex gap-2">
                                    <button onClick={handleCleanup} className="text-xs flex items-center gap-1 border border-red-200 text-red-600 px-3 py-1 rounded hover:bg-red-50" disabled={isCleaning}>{isCleaning ? 'Cleaning...' : 'Purge Unverified'}</button>
                                    <button onClick={handleExportSubscribers} className="text-xs flex items-center gap-1 border px-3 py-1 rounded hover:bg-gray-50"><Download className="h-3 w-3" /> CSV</button>
                                </div>
                            )}
                        </div>
                        
                        {/* List Switcher */}
                        <div className="flex bg-gray-100 rounded p-1 w-full gap-1">
                            <button 
                                onClick={() => setActiveListTab('subscribers')} 
                                className={`flex-1 py-1 text-[10px] sm:text-xs font-bold rounded ${activeListTab === 'subscribers' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}
                            >
                                Active Subs ({subscribers.length})
                            </button>
                            <button 
                                onClick={() => setActiveListTab('unsubscribes')} 
                                className={`flex-1 py-1 text-[10px] sm:text-xs font-bold rounded ${activeListTab === 'unsubscribes' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}
                            >
                                Unsubs (Mktg)
                            </button>
                            <button 
                                onClick={() => setActiveListTab('account_optouts')} 
                                className={`flex-1 py-1 text-[10px] sm:text-xs font-bold rounded ${activeListTab === 'account_optouts' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}
                            >
                                Acct Opt-outs
                            </button>
                        </div>

                        {/* Search & Add */}
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input 
                                    className="w-full border p-2 pl-8 rounded text-sm" 
                                    placeholder="Search emails..." 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                                <Search className="h-4 w-4 text-gray-400 absolute left-2.5 top-2.5"/>
                            </div>
                            {activeListTab !== 'account_optouts' && (
                                <div className="flex gap-2 w-1/3">
                                    <input 
                                        className="border p-2 rounded text-sm w-full" 
                                        placeholder="Add email..." 
                                        value={manualEmail}
                                        onChange={e => setManualEmail(e.target.value)}
                                    />
                                    <button onClick={handleManualAdd} className="bg-black text-white px-3 rounded hover:bg-gray-800"><Plus className="h-4 w-4"/></button>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {activeListTab === 'subscribers' && (
                        <div className="flex gap-4 border-b mb-4">
                            <button onClick={() => setSubTab('verified')} className={`pb-2 text-sm font-bold ${subTab === 'verified' ? 'border-b-2 border-black text-black' : 'text-gray-500'}`}>Verified</button>
                            <button onClick={() => setSubTab('pending')} className={`pb-2 text-sm font-bold ${subTab === 'pending' ? 'border-b-2 border-black text-black' : 'text-gray-500'}`}>Pending</button>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto border rounded bg-gray-50 max-h-[300px]">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-500 uppercase font-bold text-xs sticky top-0"><tr><th className="p-3">Email</th><th className="p-3 text-right">Date/Status</th><th className="p-3 text-right">Action</th></tr></thead>
                            <tbody className="divide-y divide-gray-200">
                                {displayList.map((item, i) => (
                                    <tr key={i} className="hover:bg-white group">
                                        <td className="p-3 font-mono text-xs flex items-center gap-2">
                                            {item.email}
                                            {activeListTab === 'subscribers' && (item.isVerified ? <CheckCircle className="h-3 w-3 text-green-500"/> : <Clock className="h-3 w-3 text-yellow-500"/>)}
                                            {activeListTab === 'unsubscribes' && <Ban className="h-3 w-3 text-red-500"/>}
                                            {activeListTab === 'account_optouts' && <UserX className="h-3 w-3 text-orange-500"/>}
                                        </td>
                                        <td className="p-3 text-right text-xs text-gray-500">
                                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="p-3 text-right">
                                            {activeListTab === 'subscribers' ? (
                                                <button onClick={() => handleDeleteSubscriber(item.email)} className="text-red-400 hover:text-red-600" title="Move to Unsubscribes">
                                                    <Trash2 className="h-3 w-3"/>
                                                </button>
                                            ) : activeListTab === 'unsubscribes' ? (
                                                <button onClick={() => handleRemoveFromBlocklist(item.email)} className="text-gray-400 hover:text-black" title="Remove from Blocklist (Re-allow)">
                                                    <Trash2 className="h-3 w-3"/>
                                                </button>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">User Managed</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {displayList.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-gray-400">No entries found.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
