
// ... existing imports ...
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../context/StoreProvider';
import { db } from '../services/db';
import { User, Order, SupportTicket, OrderLog, SuspensionCase, Attachment, TicketMessage } from '../types';
import { 
    Search, User as UserIcon, Ban, CheckCircle, Mail, MapPin, 
    ShoppingBag, CreditCard, MessageSquare, RefreshCw, 
    DollarSign, ArrowUpRight, Send, X, Edit3, ShieldAlert, Clock, FileText, Check, Globe, Monitor, Lock, Trash2, Paperclip, Image as ImageIcon, File as FileIcon, Link as LinkIcon, AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { generateUUID, decodeHtml, toBase64 } from '../utils';
import { api } from '../services/api';

// --- Chat Message Renderer ---
const ChatMessageRenderer: React.FC<{ text: string; variant?: 'user' | 'admin' }> = ({ text, variant = 'user' }) => {
    const navigate = useNavigate();

    const adminLinkClasses = 'text-indigo-100 underline font-bold hover:text-white';
    const userLinkClasses = 'text-blue-600 underline font-bold hover:text-blue-800';

    const nodes: React.ReactNode[] = useMemo(() => {
        const result: React.ReactNode[] = [];
        if (!text) return result;

        let lastIndex = 0;
        const regex = /(\[([^\]]+)\]\((#[^)]+)\)|https?:\/\/[^\s]+)/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Add preceding plain text
            if (match.index > lastIndex) {
                result.push(<span key={`text-${lastIndex}`}>{decodeHtml(text.substring(lastIndex, match.index))}</span>);
            }

            const fullMatch = match[0];
            const internalText = match[2];
            const internalPath = match[3];
            
            if (variant === 'user') {
                // Customer-sent link. Render as non-clickable, warned text.
                const linkText = internalText || fullMatch;
                result.push(
                    <span key={`link-${match.index}`} className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-900 px-2 py-1 rounded-md text-xs font-mono select-all" title="CAUTION: Link from customer. Copy and paste into a secure browser if you trust the source. Do not click.">
                        <AlertTriangle className="h-3 w-3 text-yellow-700 flex-shrink-0" />
                        <code className="bg-transparent p-0 break-all">{linkText}</code>
                    </span>
                );
            } else {
                // Admin-sent link. Render as clickable.
                const linkClasses = variant === 'admin' ? adminLinkClasses : userLinkClasses;

                if (internalText && internalPath) {
                    // Internal link: [Text](#/path)
                    const path = internalPath.substring(1); // remove '#' prefix
                    result.push(
                        <button
                            key={`link-${match.index}`}
                            className={linkClasses}
                            onClick={() => navigate(path)}
                        >
                            {internalText}
                        </button>
                    );
                } else {
                    // External link
                    result.push(
                        <a key={`link-${match.index}`} href={fullMatch} target="_blank" rel="noopener noreferrer" className={`${linkClasses} break-all`}>
                            {fullMatch}
                        </a>
                    );
                }
            }


            lastIndex = regex.lastIndex;
        }

        // Add any remaining plain text
        if (lastIndex < text.length) {
            result.push(<span key={`text-${lastIndex}`}>{decodeHtml(text.substring(lastIndex))}</span>);
        }

        return result;
    }, [text, navigate, variant]);

    return <>{nodes}</>;
};

// --- Helper for Ticket Preview ---
const generatePreviewText = (message: TicketMessage | undefined): string => {
    if (!message) return 'No message';
    if (message.attachments?.length) return '[Attachment]';
    if (!message.text) return 'No message';

    const linkRegex = /(\[([^\]]+)\]\((#[^)]+)\)|https?:\/\/[^\s]+)/g;
    const textWithoutLinks = message.text.replace(linkRegex, '').trim();
    
    if (textWithoutLinks === '') {
        return '[Link Provided]';
    }

    return decodeHtml(message.text);
};

// --- Mock Stripe Transaction Type ---
interface StripeTransaction {
    id: string;
    date: number;
    amount: number;
    status: 'succeeded' | 'refunded' | 'failed' | 'pending';
    cardLast4: string;
    orderId: string;
}

// --- Sub-Components ---
const StatusBadge = ({ status, type }: { status: string, type: 'order' | 'sub' | 'risk' }) => {
    let color = 'bg-gray-100 text-gray-600';
    
    if (type === 'risk') {
        const risk = parseInt(status) || 0;
        if (risk < 30) color = 'bg-green-100 text-green-700';
        else if (risk < 70) color = 'bg-yellow-100 text-yellow-700';
        else color = 'bg-red-100 text-red-700';
        return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${color}`}>Risk: {risk}/100</span>;
    }

    if (type === 'order') {
        if (['Delivered', 'Shipped'].includes(status)) color = 'bg-green-100 text-green-700';
        if (['Processing', 'On Hold'].includes(status)) color = 'bg-blue-100 text-blue-700';
        if (['Refunded', 'Cancelled'].includes(status)) color = 'bg-red-100 text-red-700';
    }
    
    return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${color}`}>{status}</span>;
};

export const CustomerServicePanel: React.FC = () => {
    const { user: currentUser, showToast, settings } = useStore();
    const navigate = useNavigate();
    
    // Data State
    const [users, setUsers] = useState<User[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [suspensionCase, setSuspensionCase] = useState<SuspensionCase | null>(null);
    
    // UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'financials' | 'communication'>('profile');
    const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<string | null>(null);
    const [isLinkMenuOpen, setIsLinkMenuOpen] = useState(false);
    const linkMenuRef = useRef<HTMLDivElement>(null);

    // Modal State
    const [actionModal, setActionModal] = useState<{
        isOpen: boolean;
        type: 'confirm' | 'prompt';
        title: string;
        message: string;
        defaultValue?: string;
        isDestructive?: boolean;
        onConfirm: (val: string) => void;
    } | null>(null);

    // Action State
    const [replyText, setReplyText] = useState('');
    const [adjustingOrderId, setAdjustingOrderId] = useState<string | null>(null);
    const [adjustedPrice, setAdjustedPrice] = useState<string>('');
    const [adminNotes, setAdminNotes] = useState('');

    // Attachments State
    const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // --- Internal Link Shortcuts ---
    const internalLinks = [
        { label: 'View Order History', path: '/account?tab=orders' },
        { label: 'Manage Addresses', path: '/account?tab=addresses' },
        { label: 'Open Support Tickets', path: '/account?tab=support' },
        { label: 'Track an Order Page', path: '/track-order' },
    ];

    const insertInternalLink = (label: string, path: string) => {
        const linkMarkdown = `[${label}](#${path})`;
        setReplyText(prev => `${prev} ${linkMarkdown} `.trimStart());
        setIsLinkMenuOpen(false);
    }

    // --- Initialization & Effects ---
    useEffect(() => {
        if (currentUser && currentUser.role !== 'admin') {
            navigate('/login');
            return;
        }
        if (currentUser?.role === 'admin') {
            loadData();
        }
    }, [currentUser, navigate]);

    useEffect(() => {
        if (selectedUserId) {
            loadCase(selectedUserId);
            setActiveTicketId(null);
        } else {
            setSuspensionCase(null);
        }
    }, [selectedUserId]);

    // Click outside for link menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (linkMenuRef.current && !linkMenuRef.current.contains(event.target as Node)) {
                setIsLinkMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [linkMenuRef]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [u, o, t] = await Promise.all([
                db.getAllUsers(),
                db.getAllOrders(),
                db.getAdminTickets()
            ]);
            setUsers(u);
            setOrders(o);
            setTickets(t);
        } catch (e) {
            console.error("Failed to load CS data", e);
        } finally {
            setIsLoading(false);
        }
    };

    const loadCase = async (uid: string) => {
        try {
            const kase = await db.getSuspensionCase(uid);
            setSuspensionCase(kase);
        } catch (e) {
            setSuspensionCase(null);
        }
    };

    // --- Derived Data ---
    const filteredUsers = useMemo(() => {
        if (!searchQuery) return users;
        const q = searchQuery.toLowerCase();
        return users.filter(u => 
            u.name.toLowerCase().includes(q) || 
            u.email.toLowerCase().includes(q) || 
            u.id.toLowerCase().includes(q)
        );
    }, [users, searchQuery]);

    const selectedUser = useMemo(() => 
        users.find(u => u.id === selectedUserId), 
    [users, selectedUserId]);

    const userOrders = useMemo(() => 
        orders.filter(o => {
            return (selectedUser && o.userId === selectedUser.id) || (selectedUser && o.customerEmail === selectedUser.email);
        }).sort((a, b) => b.date - a.date),
    [orders, selectedUser]);

    const userTickets = useMemo(() => 
        tickets.filter(t => selectedUser && (t.userId === selectedUser.id || t.userEmail === selectedUser.email))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [tickets, selectedUser]);

    const currentTicket = useMemo(() => {
        if (activeTicketId) {
            return userTickets.find(t => t.id === activeTicketId) || userTickets[0];
        }
        return userTickets[0];
    }, [userTickets, activeTicketId]);

    // Auto-scroll chat
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [currentTicket?.id, currentTicket?.messages?.length, activeTab]);

    // Mock Financials based on Orders
    const transactions: StripeTransaction[] = useMemo(() => {
        return userOrders.map(o => ({
            id: o.stripeChargeId || `ch_${o.id.split('-')[1] || 'mock'}`,
            date: o.date,
            amount: o.total,
            status: o.status === 'Refunded' ? 'refunded' : 'succeeded',
            cardLast4: '4242', // Mock
            orderId: o.id
        }));
    }, [userOrders]);

    // --- Actions (Suspend, Refund, etc. remain same) ---
    const handleSuspendToggle = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!selectedUser) return;
        const isSuspended = !!selectedUser.isSuspended;
        if (!isSuspended) {
            setActionModal({ isOpen: true, type: 'prompt', title: 'Suspend User', message: 'Enter a reason for suspension:', defaultValue: 'Violation of Terms', isDestructive: true, onConfirm: (reason) => performSuspend(true, reason) });
        } else {
            setActionModal({ isOpen: true, type: 'confirm', title: 'Unsuspend User', message: 'Restore access?', isDestructive: false, onConfirm: () => performSuspend(false) });
        }
    };
    const performSuspend = async (shouldSuspend: boolean, reason: string = '') => {
        if (!selectedUser) return;
        setActionModal(null);
        setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, isSuspended: shouldSuspend } : u));
        try {
            await db.toggleUserSuspension(selectedUser.id, shouldSuspend, reason);
            const [freshUsers] = await Promise.all([db.getAllUsers(), loadCase(selectedUser.id)]);
            setUsers(freshUsers);
            showToast(shouldSuspend ? "User suspended." : "User restored.", "success");
        } catch(e: any) {
            setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, isSuspended: !shouldSuspend } : u));
        }
    };
    const handleResolveAppeal = async (action: 'unsuspend' | 'reject') => {
        if (!selectedUser) return;
        try {
            await db.resolveAppeal(selectedUser.id, action, adminNotes);
            if(action === 'unsuspend') setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, isSuspended: false } : u));
            const [u] = await Promise.all([db.getAllUsers(), loadCase(selectedUser.id)]);
            setUsers(u);
            setAdminNotes('');
            showToast(`Case ${action === 'unsuspend' ? 'resolved' : 'rejected'}.`, "success");
        } catch(e) { showToast("Action failed.", "error"); }
    };
    const handleMarketingToggle = async () => {
        if (!selectedUser) return;
        const newPrefs = { ...selectedUser.preferences!, marketing: !selectedUser.preferences?.marketing };
        setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, preferences: newPrefs } : u));
        await db.updateUser(selectedUser.id, { preferences: newPrefs });
    };
    const handleRefundClick = (order: Order) => {
        setActionModal({ isOpen: true, type: 'confirm', title: 'Refund Order', message: `Refund Order #${order.id} ($${order.total.toFixed(2)})?`, isDestructive: true, onConfirm: () => performRefund(order) });
    };
    const performRefund = async (order: Order) => {
        setActionModal(null);
        if (!settings || !currentUser) return;
        try {
            await api.refundOrder(settings, order.id, order.total, currentUser.token);
            const updatedOrder = { ...order, status: 'Refunded' as const, refundAmount: order.total };
            await db.updateOrder(updatedOrder);
            showToast(`Order #${order.id} refunded.`, "success");
            loadData();
        } catch(e: any) { showToast(`Refund Failed: ${e.message}`, "error"); }
    };
    const handleAdjustPrice = async () => { /* ... existing ... */ };

    // --- Ticket Handlers ---

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files) as File[];
            const validFiles: Attachment[] = [];
            for (const file of files) {
                if (file.size > 5 * 1024 * 1024) { showToast(`File ${file.name} too large (Max 5MB)`, 'error'); continue; }
                try {
                    const base64 = await toBase64(file);
                    validFiles.push({ name: file.name, type: file.type.startsWith('image/') ? 'image' : 'file', url: base64, size: file.size });
                } catch (err) { showToast(`Error processing ${file.name}`, 'error'); }
            }
            setPendingAttachments(prev => [...prev, ...validFiles]);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeAttachment = (index: number) => setPendingAttachments(prev => prev.filter((_, i) => i !== index));

    const handleSendMessage = async (ticketId: string) => {
        if (!replyText.trim() && pendingAttachments.length === 0) return;
        const ticket = tickets.find(t => t.id === ticketId);
        if (ticket?.isLocked) return;
        
        if (ticket?.status === 'Closed') {
            await db.updateTicketStatus(ticketId, 'Open');
        }
        await db.replyTicket(ticketId, replyText, 'admin', pendingAttachments);
        setReplyText('');
        setPendingAttachments([]);
        loadData();
    };

    const handleCloseTicket = (ticketId: string) => {
        setActionModal({
            isOpen: true,
            type: 'confirm',
            title: 'Close Ticket',
            message: 'Are you sure you want to close this ticket? You can reopen it by replying.',
            onConfirm: async () => {
                setActionModal(null);
                await db.replyTicket(ticketId, "Ticket closed by support.", 'admin');
                await db.updateTicketStatus(ticketId, 'Closed');
                loadData();
                showToast("Ticket closed.");
            }
        });
    };

    const handleLockTicket = (ticketId: string, currentLockStatus: boolean) => {
        const action = currentLockStatus ? "Unlock" : "Lock";
        setActionModal({
            isOpen: true,
            type: 'confirm',
            title: `${action} Ticket`,
            message: `${action} this ticket? ${!currentLockStatus ? "User will not be able to reply." : ""}`,
            onConfirm: async () => {
                setActionModal(null);
                if(!currentLockStatus) await db.replyTicket(ticketId, "Ticket locked by support.", 'admin');
                
                const s = await import('../services/settings').then(m => m.settingsService.load());
                const token = currentUser?.token;
                await fetch(`${s.apiUrl}/tickets/${ticketId}/status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ isLocked: !currentLockStatus })
                });
                
                loadData();
                showToast(`Ticket ${action}ed.`, "success");
            }
        });
    };

    const handleDeleteTicket = (ticketId: string) => {
        setActionModal({
            isOpen: true,
            type: 'confirm',
            title: 'Delete Ticket',
            message: 'Permanently delete this ticket? This cannot be undone.',
            isDestructive: true,
            onConfirm: async () => {
                setActionModal(null);
                const s = await import('../services/settings').then(m => m.settingsService.load());
                const token = currentUser?.token;
                await fetch(`${s.apiUrl}/tickets/${ticketId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                // If active ticket is deleted, reset active ID so UI updates to next available
                if (activeTicketId === ticketId) setActiveTicketId(null);
                loadData();
                showToast("Ticket deleted.", "success");
            }
        });
    };

    // ... (Render logic) ...
    return (
        <div className="flex h-screen bg-gray-50 font-sans overflow-hidden relative">
            {/* ... (Modals and Sidebar - same as before) ... */}
            {previewDoc && (<div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setPreviewDoc(null)}><div className="relative max-w-4xl max-h-[90vh] w-full"><button onClick={() => setPreviewDoc(null)} className="absolute -top-12 right-0 text-white hover:text-gray-300"><X className="h-8 w-8"/></button><img src={previewDoc} className="w-full h-full object-contain rounded shadow-2xl" onClick={e => e.stopPropagation()} /></div></div>)}
            {actionModal && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"><div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200"><h3 className="text-lg font-bold text-gray-900">{actionModal.title}</h3><p className="text-sm text-gray-600 leading-relaxed">{actionModal.message}</p>{actionModal.type === 'prompt' && (<input autoFocus className="w-full border border-gray-300 p-3 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-black outline-none" defaultValue={actionModal.defaultValue} id="modal-input" placeholder="Enter reason..." />)}<div className="flex gap-3 justify-end pt-4"><button onClick={() => setActionModal(null)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button><button onClick={() => { const input = document.getElementById('modal-input') as HTMLInputElement; const val = input ? input.value : ''; if (actionModal.type === 'prompt' && !val.trim()) return; actionModal.onConfirm(val); }} className={`px-6 py-2 text-sm font-bold text-white rounded-lg transition-colors ${actionModal.isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-black hover:bg-gray-800'}`}>Confirm</button></div></div></div>)}

            <div className="w-96 bg-white border-r border-gray-200 flex flex-col z-10 shadow-sm"><div className="p-4 border-b border-gray-200 bg-gray-50"><h2 className="text-lg font-bold font-display flex items-center gap-2 mb-4"><ShieldAlert className="h-5 w-5 text-indigo-600"/> Agent Console</h2><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Search Name, Email, ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div></div><div className="flex-1 overflow-y-auto">{isLoading ? <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2"><RefreshCw className="h-5 w-5 animate-spin" /> Loading Data...</div> : filteredUsers.map(u => (<div key={u.id} onClick={() => setSelectedUserId(u.id)} className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${selectedUserId === u.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'border-l-4 border-transparent'}`}><div className="flex justify-between items-start mb-1"><h4 className="font-bold text-sm text-gray-900 truncate w-40">{u.name}</h4></div><div className="flex justify-between items-center"><span className="text-xs text-gray-500 truncate w-48">{u.email}</span>{!!u.isSuspended && <Ban className="h-3 w-3 text-red-500" />}</div></div>))}</div></div>

            {/* Main Panel */}
            <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
                {selectedUser ? (
                    <>
                        <div className="bg-white border-b border-gray-200 px-8 py-6 flex justify-between items-center shadow-sm"><div className="flex items-center gap-6"><div className="h-16 w-16 bg-gradient-to-br from-indigo-100 to-white border border-indigo-200 rounded-full flex items-center justify-center text-2xl font-bold text-indigo-700 shadow-sm">{(selectedUser.name || ' ')[0]}</div><div><div className="flex items-center gap-3"><h1 className="text-2xl font-bold text-gray-900">{selectedUser.name}</h1>{!!selectedUser.isSuspended && <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded uppercase flex items-center gap-1"><Ban className="h-3 w-3"/> Suspended</span>}<StatusBadge status={selectedUser.riskScore?.toString() || '0'} type="risk" /></div><div className="flex items-center gap-4 text-sm text-gray-500 mt-1"><span className="flex items-center gap-1"><Mail className="h-3 w-3"/> {selectedUser.email}</span><span className="flex items-center gap-1"><UserIcon className="h-3 w-3"/> {selectedUser.role}</span><span className="text-gray-300">|</span><span className="font-mono select-all">ID: {selectedUser.id}</span></div></div></div><div className="flex gap-2"><button type="button" onClick={handleMarketingToggle} className={`px-4 py-2 rounded border text-xs font-bold uppercase flex items-center gap-2 ${selectedUser.preferences?.marketing ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500'}`}><Mail className="h-3 w-3" /> {selectedUser.preferences?.marketing ? 'Subscribed' : 'Unsubscribed'}</button><button type="button" onClick={handleSuspendToggle} className={`px-4 py-2 rounded border text-xs font-bold uppercase flex items-center gap-2 ${!!selectedUser.isSuspended ? 'bg-green-600 text-white border-green-600 hover:bg-green-700' : 'bg-red-600 text-white border-red-600 hover:bg-red-700'}`}>{!!selectedUser.isSuspended ? <CheckCircle className="h-3 w-3"/> : <Ban className="h-3 w-3"/>}{!!selectedUser.isSuspended ? 'Unsuspend' : 'Suspend'}</button></div></div>
                        <div className="bg-white border-b border-gray-200 px-8 flex gap-8">{[{ id: 'profile', label: 'Profile', icon: UserIcon }, { id: 'orders', label: 'Orders', icon: ShoppingBag }, { id: 'financials', label: 'Financials', icon: CreditCard }, { id: 'communication', label: 'Communication', icon: MessageSquare }].map(t => (<button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`py-4 text-sm font-bold uppercase flex items-center gap-2 border-b-2 transition-colors ${activeTab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-black'}`}><t.icon className="h-4 w-4" /> {t.label}</button>))}</div>

                        <div className="flex-1 overflow-y-auto p-8">
                            {/* Profile Tab */}
                            {activeTab === 'profile' && (<div className="grid grid-cols-2 gap-8 max-w-4xl"><div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm"><h3 className="font-bold text-lg mb-4 text-gray-800">Contact Information</h3><div className="space-y-4"><div><label className="text-xs font-bold uppercase text-gray-500">Email</label><div className="flex items-center gap-2 mt-1"><Mail className="h-4 w-4 text-gray-400"/><input className="flex-1 border-none bg-gray-50 rounded p-2 text-sm text-gray-700" value={selectedUser.email} readOnly /></div></div><div><label className="text-xs font-bold uppercase text-gray-500">Full Name</label><div className="flex items-center gap-2 mt-1"><UserIcon className="h-4 w-4 text-gray-400"/><input className="flex-1 border-none bg-gray-50 rounded p-2 text-sm text-gray-700" value={selectedUser.name} readOnly /></div></div></div></div></div>)}
                            
                            {/* Orders Tab */}
                            {activeTab === 'orders' && (<div className="space-y-4 max-w-5xl">{userOrders.map(order => (<div key={order.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"><div className="bg-gray-50/50 p-4 flex justify-between items-center border-b border-gray-100"><div className="flex items-center gap-4"><span className="font-mono font-bold text-gray-900 select-all">#{order.id}</span><span className="text-xs text-gray-500">{new Date(order.date).toLocaleString()}</span><StatusBadge status={order.status} type="order" /></div><div className="flex items-center gap-3"><p className="text-sm font-bold text-gray-900 mr-4">${order.total.toFixed(2)}</p>{order.status !== 'Refunded' && (<button onClick={() => handleRefundClick(order)} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-xs font-bold uppercase hover:bg-red-50 hover:text-red-600 transition-colors">Refund</button>)}</div></div></div>))}{userOrders.length === 0 && <div className="text-center p-12 text-gray-400">No orders found.</div>}</div>)}

                            {/* Communication Tab */}
                            {activeTab === 'communication' && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-280px)] min-h-[400px] bg-white border border-gray-200 rounded-xl shadow-sm">
                                    <div className="lg:col-span-1 border-r border-gray-100 flex flex-col bg-gray-50/30">
                                        <div className="p-4 border-b font-bold text-xs uppercase text-gray-500">Ticket History</div>
                                        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                                            {userTickets.map(t => {
                                                const lastMsg = t.messages?.[t.messages.length - 1];
                                                const previewText = generatePreviewText(lastMsg);
                                                return (
                                                    <div 
                                                        key={t.id} 
                                                        className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer group ${currentTicket?.id === t.id ? 'bg-white border-l-4 border-l-indigo-600 shadow-sm' : ''}`}
                                                        onClick={() => setActiveTicketId(t.id)}
                                                    >
                                                        <div className="flex justify-between mb-1">
                                                            <div className="flex gap-1 items-center">
                                                                {t.isLocked && <Lock className="h-3 w-3 text-gray-400"/>}
                                                                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${t.status === 'Open' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>{t.status}</span>
                                                            </div>
                                                            <span className="text-xs text-gray-400">{new Date(t.updatedAt).toLocaleDateString()}</span>
                                                        </div>
                                                        <p className={`font-bold text-sm truncate transition-colors ${currentTicket?.id === t.id ? 'text-indigo-900' : 'text-gray-900 group-hover:text-indigo-600'}`}>{t.subject}</p>
                                                        <p className="text-xs text-gray-500 mt-1 truncate">{previewText}</p>
                                                    </div>
                                                );
                                            })}
                                            {userTickets.length === 0 && <div className="p-8 text-center text-xs text-gray-400">No history</div>}
                                        </div>
                                    </div>

                                    <div className="lg:col-span-2 flex flex-col bg-white">
                                        {userTickets.length > 0 && currentTicket ? (
                                            <>
                                                <div className="p-4 border-b flex justify-between items-center bg-white shadow-sm z-10 shrink-0">
                                                    <div>
                                                        <h3 className="font-bold text-gray-900">{currentTicket.subject}</h3>
                                                        <span className="text-xs text-gray-500 flex items-center gap-2 select-all">
                                                            #{currentTicket.id}
                                                            {currentTicket.status === 'Open' && <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"/>}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {/* Ticket Actions */}
                                                        <button 
                                                            onClick={() => handleLockTicket(currentTicket.id, !!currentTicket.isLocked)}
                                                            className={`p-2 rounded hover:bg-gray-100 ${currentTicket.isLocked ? 'text-indigo-600' : 'text-gray-400'}`}
                                                            title={currentTicket.isLocked ? "Unlock Ticket" : "Lock Ticket"}
                                                        >
                                                            <Lock className="h-4 w-4"/>
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteTicket(currentTicket.id)}
                                                            className="p-2 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                                                            title="Delete Ticket"
                                                        >
                                                            <Trash2 className="h-4 w-4"/>
                                                        </button>
                                                        {currentTicket.status === 'Open' && (
                                                            <button 
                                                                onClick={() => handleCloseTicket(currentTicket.id)} 
                                                                className="text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 px-3 py-1.5 rounded uppercase transition-colors"
                                                            >
                                                                Close
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50 scroll-smooth" ref={chatContainerRef}>
                                                    {(currentTicket.messages || []).map((msg, i) => {
                                                        const isSystem = msg.text.includes('Ticket closed by') || msg.text.includes('Ticket locked by') || msg.text.includes('Ticket deleted');
                                                        if (isSystem) return <div key={i} className="flex justify-center"><span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-200 px-3 py-1 rounded-full">{decodeHtml(msg.text)}</span></div>;

                                                        return (
                                                            <div key={i} className={`flex ${msg.role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                                                <div className={`max-w-[80%] p-4 rounded-xl text-sm shadow-sm ${msg.role === 'admin' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border text-gray-800 rounded-bl-none'}`}>
                                                                    <div className={`text-[10px] mb-1 font-bold opacity-80 ${msg.role === 'admin' ? 'text-indigo-100' : 'text-gray-500'}`}>{msg.role === 'admin' ? 'Agent' : 'Customer'} • {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                                                    <div className="whitespace-pre-wrap leading-relaxed select-text"><ChatMessageRenderer text={msg.text} variant={msg.role} /></div>
                                                                    {msg.attachments && msg.attachments.length > 0 && (
                                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                                            {msg.attachments.map((att, idx) => (
                                                                                <div key={idx} className="relative group" title={msg.role === 'user' ? "Image is displayed in a secure sandbox" : ""}>
                                                                                    {att.type === 'image' ? (
                                                                                        msg.role === 'admin' ? (
                                                                                            <div className="h-20 w-20 rounded bg-gray-100 border overflow-hidden cursor-zoom-in" onClick={() => setPreviewDoc(att.url)}>
                                                                                                <img src={att.url} className="h-full w-full object-cover" />
                                                                                            </div>
                                                                                        ) : (
                                                                                            <div className="h-20 w-20 rounded bg-white border overflow-hidden relative">
                                                                                                <iframe
                                                                                                    sandbox=""
                                                                                                    src={att.url}
                                                                                                    title={`Sandboxed preview of ${att.name}`}
                                                                                                    className="w-full h-full"
                                                                                                    style={{ border: 'none' }}
                                                                                                    loading="lazy"
                                                                                                />
                                                                                                <div 
                                                                                                    className="absolute inset-0 cursor-zoom-in"
                                                                                                    onClick={() => setPreviewDoc(att.url)}
                                                                                                ></div>
                                                                                            </div>
                                                                                        )
                                                                                    ) : (
                                                                                        <a href={att.url} download={att.name} className="flex items-center gap-2 p-2 rounded border text-xs font-bold bg-white/10 border-white/20 text-white hover:bg-white/20">
                                                                                            <FileIcon className="h-4 w-4"/>
                                                                                            <span className="truncate max-w-[100px]">{att.name}</span>
                                                                                        </a>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                                
                                                <div className="p-4 bg-white border-t shrink-0">
                                                    {currentTicket.isLocked ? (
                                                        <div className="bg-gray-100 p-3 rounded text-center text-xs text-gray-500 font-bold uppercase flex items-center justify-center gap-2">
                                                            <Lock className="h-4 w-4"/> This conversation is locked
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-2">
                                                            {pendingAttachments.length > 0 && (
                                                                <div className="flex flex-wrap gap-2 mb-1 p-2 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                                                    {pendingAttachments.map((att, idx) => (
                                                                        <div key={idx} className="relative group bg-white border rounded p-1">
                                                                            {att.type === 'image' ? (
                                                                                <img src={att.url} className="h-10 w-10 object-cover rounded" />
                                                                            ) : (
                                                                                <div className="h-10 w-10 flex items-center justify-center bg-gray-100 rounded">
                                                                                    <FileIcon className="h-4 w-4 text-gray-500"/>
                                                                                </div>
                                                                            )}
                                                                            <button type="button" onClick={() => removeAttachment(idx)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-sm hover:bg-red-600">
                                                                                <X className="h-2 w-2"/>
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            <div className="flex gap-2">
                                                                <button 
                                                                    type="button" 
                                                                    className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors border"
                                                                    onClick={() => fileInputRef.current?.click()}
                                                                    title="Attach files"
                                                                >
                                                                    <Paperclip className="h-5 w-5" />
                                                                    <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} accept="image/png, image/jpeg, image/gif, application/pdf, text/plain"/>
                                                                </button>
                                                                <div className="relative">
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => setIsLinkMenuOpen(p => !p)}
                                                                        className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors border h-full"
                                                                        title="Insert Link"
                                                                    >
                                                                        <LinkIcon className="h-5 w-5" />
                                                                    </button>
                                                                    {isLinkMenuOpen && (
                                                                        <div ref={linkMenuRef} className="absolute bottom-full right-0 mb-2 w-56 bg-white border rounded-lg shadow-xl z-30 animate-in fade-in zoom-in-95">
                                                                            <div className="p-2">
                                                                                <p className="text-xs font-bold text-gray-500 px-2 pb-1 border-b">Insert Internal Link</p>
                                                                                <div className="mt-1">
                                                                                    {internalLinks.map(link => (
                                                                                        <button key={link.path} onClick={() => insertInternalLink(link.label, link.path)} className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-gray-100 transition-colors">
                                                                                            {link.label}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <input 
                                                                    className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                                                                    placeholder="Type reply or paste external link..."
                                                                    value={replyText}
                                                                    onChange={e => setReplyText(e.target.value)}
                                                                    onKeyDown={e => e.key === 'Enter' && handleSendMessage(currentTicket.id)}
                                                                />
                                                                <button 
                                                                    onClick={() => handleSendMessage(currentTicket.id)}
                                                                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-bold uppercase text-sm disabled:opacity-50"
                                                                    disabled={!replyText.trim() && pendingAttachments.length === 0}
                                                                >
                                                                    Send
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex-1 flex items-center justify-center text-gray-400 flex-col">
                                                <MessageSquare className="h-12 w-12 mb-4 opacity-20"/>
                                                <p>Select a ticket or customer has no tickets.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <div className="h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center mb-6"><UserIcon className="h-10 w-10 text-gray-300"/></div>
                        <h2 className="text-xl font-bold text-gray-600">Select a Customer</h2>
                    </div>
                )}
            </div>
        </div>
    );
};
