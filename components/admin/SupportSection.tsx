
import React, { useState, useRef, useEffect } from 'react';
import { SupportTicket, StoreContent } from '../../types';
import { db } from '../../services/db';
import { MessageSquare, Settings, Save } from 'lucide-react';
import { decodeHtml } from '../../utils';

interface SupportSectionProps {
    tickets: SupportTicket[];
    content: StoreContent;
    onUpdateContent: (fn: (c: StoreContent) => StoreContent) => void;
    onSaveContent: () => Promise<void>;
    onRefresh: () => Promise<void>;
}

export const SupportSection: React.FC<SupportSectionProps> = ({ tickets, content, onUpdateContent, onSaveContent, onRefresh }) => {
    const [activeTab, setActiveTab] = useState<'tickets' | 'config'>('tickets');
    const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
    const [replyText, setReplyText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeTicket && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [activeTicket?.messages]);

    const handleReplyTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeTicket || !replyText.trim()) return;
        await db.replyTicket(activeTicket.id, replyText, 'admin');
        setReplyText('');
        await onRefresh();
        alert("Reply sent.");
    };
    
    // Sync active ticket with new props
    useEffect(() => {
        if(activeTicket) {
            const found = tickets.find(t => t.id === activeTicket.id);
            if(found) setActiveTicket(found);
        }
    }, [tickets]);

    return (
        <div className="flex h-[70vh] bg-white border shadow-sm animate-in fade-in overflow-hidden">
            <div className="w-48 border-r bg-gray-50 pt-4 flex flex-col">
                <button onClick={() => setActiveTab('tickets')} className={`flex items-center gap-2 px-4 py-3 text-sm font-bold w-full text-left transition-colors border-l-4 ${activeTab === 'tickets' ? 'bg-white border-black text-black' : 'border-transparent text-gray-500 hover:bg-gray-100 hover:text-black'}`}>
                    <MessageSquare className="h-4 w-4" /> Tickets
                </button>
                <button onClick={() => setActiveTab('config')} className={`flex items-center gap-2 px-4 py-3 text-sm font-bold w-full text-left transition-colors border-l-4 ${activeTab === 'config' ? 'bg-white border-black text-black' : 'border-transparent text-gray-500 hover:bg-gray-100 hover:text-black'}`}>
                    <Settings className="h-4 w-4" /> Chatbot
                </button>
            </div>

            {activeTab === 'tickets' && (
                <>
                    <div className="w-1/3 border-r flex flex-col">
                        <div className="p-4 border-b bg-gray-50">
                            <h2 className="font-bold">Inbox</h2>
                            <div className="flex gap-2 mt-2">
                                <button className="text-xs px-2 py-1 bg-black text-white rounded">All</button>
                                <button className="text-xs px-2 py-1 bg-white border text-gray-600 rounded">Open</button>
                                <button className="text-xs px-2 py-1 bg-white border text-gray-600 rounded">Closed</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto divide-y">
                            {tickets.map(t => (
                                <div key={t.id} onClick={() => setActiveTicket(t)} className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${activeTicket?.id === t.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                                    <div className="flex justify-between mb-1"><span className="font-bold text-sm truncate w-32">{t.userEmail}</span><span className="text-xs text-gray-400">{new Date(t.updatedAt).toLocaleDateString()}</span></div>
                                    <div className="font-medium text-sm text-gray-800 truncate">{t.subject}</div>
                                    <div className="flex justify-between items-center mt-2"><span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${t.status === 'Open' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{t.status}</span><span className="text-xs text-gray-400">#{t.id}</span></div>
                                </div>
                            ))}
                            {tickets.length === 0 && <div className="p-8 text-center text-gray-400">No tickets found.</div>}
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col bg-gray-50/50 select-none">
                        {activeTicket ? (
                            <>
                                <div className="p-4 border-b bg-white flex justify-between items-center shadow-sm">
                                    <div><h3 className="font-bold">{activeTicket.subject}</h3><p className="text-xs text-gray-500">From: {activeTicket.userEmail} • Order: {activeTicket.orderId || 'N/A'}</p></div>
                                    <div className="flex gap-2">
                                        <button onClick={async () => { await db.replyTicket(activeTicket.id, "Ticket closed by support.", 'admin'); await db.updateTicketStatus(activeTicket.id, activeTicket.status === 'Open' ? 'Closed' : 'Open'); await onRefresh(); alert(`Ticket ${activeTicket.status === 'Open' ? 'Closed' : 'Reopened'}.`); }} className={`px-3 py-1 text-xs font-bold uppercase border rounded ${activeTicket.status === 'Open' ? 'hover:bg-red-50 text-red-600' : 'hover:bg-green-50 text-green-600'}`}>{activeTicket.status === 'Open' ? 'Close Ticket' : 'Reopen'}</button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {activeTicket.messages.map((m, i) => (
                                        <div key={i} className={`flex ${m.role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] p-3 rounded-lg text-sm shadow-sm ${m.role === 'admin' ? 'bg-black text-white rounded-br-none' : 'bg-white border text-gray-800 rounded-bl-none'}`}>
                                                <div className="text-xs opacity-70 mb-1 flex justify-between gap-4"><span>{m.role === 'admin' ? 'You' : m.senderName}</span><span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                                                {decodeHtml(m.text)}
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                                <form onSubmit={handleReplyTicket} className="p-4 bg-white border-t flex gap-2">
                                    <input className="flex-1 border p-2 rounded text-sm focus:ring-black focus:border-black" placeholder="Type a reply..." value={replyText} onChange={e => setReplyText(e.target.value)} />
                                    <button type="submit" disabled={!replyText.trim()} className="bg-black text-white px-4 py-2 rounded text-sm font-bold uppercase disabled:opacity-50">Send</button>
                                </form>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400">Select a ticket to view details</div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'config' && (
                <div className="flex-1 p-8 overflow-y-auto">
                    <h2 className="font-bold text-xl mb-6">AI Chatbot Settings</h2>
                    <div className="bg-white p-6 border rounded-lg shadow-sm">
                        <label className="block text-sm font-bold text-gray-700 mb-2">System Instruction / Persona</label>
                        <p className="text-xs text-gray-500 mb-4">Define how the chatbot should behave, what tone it should use, and key policies to mention.</p>
                        <textarea 
                            className="w-full h-64 border rounded p-4 text-sm font-mono leading-relaxed"
                            value={content.pageText.chatbotSystemPrompt || ''}
                            onChange={(e) => onUpdateContent(c => ({...c, pageText: {...c.pageText, chatbotSystemPrompt: e.target.value}}))}
                        />
                        <div className="mt-6">
                            <button onClick={onSaveContent} className="bg-black text-white px-6 py-2 font-bold uppercase flex items-center gap-2 hover:bg-gray-800"><Save className="h-4 w-4" /> Save Configuration</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
