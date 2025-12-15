
// ... imports ...
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../context/StoreProvider';
import { SEO } from '../components/SEO';
import { Package, LogOut, Settings, FileText, Truck, Trash2, Key, MessageSquare, Plus, Send, RefreshCw, X, ChevronLeft, User as UserIcon, Shield, CreditCard, ChevronRight, Eye, EyeOff, Bell, Image as ImageIcon, MapPin, Check, Loader2, Wallet, Search, Filter, Lock, Maximize2, Minimize2, Paperclip, File as FileIcon, GripVertical, AlertTriangle, Edit, CheckCircle } from 'lucide-react';
import { Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { InvoiceModal } from '../components/InvoiceModal';
import { TrackingModal } from '../components/TrackingModal';
import { Order, SupportTicket, Address, Attachment, TicketMessage } from '../types';
import { db } from '../services/db';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { SuspensionAppeal } from '../components/SuspensionAppeal';
import { toBase64, decodeHtml } from '../utils';

// --- Chat Message Renderer ---
const ChatMessageRenderer: React.FC<{ text: string; variant?: 'user' | 'admin' }> = ({ text, variant = 'user' }) => {
    const navigate = useNavigate();

    const linkClasses = variant === 'admin'
        ? "text-gray-200 underline font-bold hover:text-white"
        : "text-blue-600 underline font-bold hover:text-blue-800";

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

            if (internalText && internalPath) {
                // It's an internal link: [Text](#/path)
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
                // It's an external link
                result.push(
                    <a key={`link-${match.index}`} href={fullMatch} target="_blank" rel="noopener noreferrer" className={`${linkClasses} break-all`}>
                        {fullMatch}
                    </a>
                );
            }
            lastIndex = regex.lastIndex;
        }

        // Add any remaining plain text
        if (lastIndex < text.length) {
            result.push(<span key={`text-${lastIndex}`}>{decodeHtml(text.substring(lastIndex))}</span>);
        }

        return result;
    }, [text, navigate, linkClasses]);

    return <>{nodes}</>;
};

// --- Helper for Ticket Preview ---
const generatePreviewText = (message: TicketMessage | undefined): string => {
    if (!message) return 'No messages';
    if (message.attachments?.length) return '[Attachment]';
    if (!message.text) return 'No message';

    const linkRegex = /(\[([^\]]+)\]\((#[^)]+)\)|https?:\/\/[^\s]+)/g;
    const textWithoutLinks = message.text.replace(linkRegex, '').trim();
    
    if (textWithoutLinks === '') {
        return '[Link Provided]';
    }

    return decodeHtml(message.text);
};


// --- Skeleton Component ---
const TabSkeleton = () => (
    <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
        {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-gray-200 p-6 rounded-xl space-y-3">
                <div className="flex justify-between">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-10 bg-gray-100 rounded w-full mt-4"></div>
            </div>
        ))}
    </div>
);

// --- Sub-Components (Moved outside main component to prevent re-creation on render) ---

type NavButtonId = 'orders' | 'support' | 'settings' | 'addresses' | 'wallet';

const NavButton = ({ id, label, icon: Icon, active, onClick }: { id: NavButtonId, label: string, icon: any, active: boolean, onClick: (id: NavButtonId) => void }) => (
    <button 
        onClick={() => onClick(id)}
        className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between group transition-all duration-200 ${
            active ? 'bg-black text-white shadow-lg shadow-gray-200 ring-1 ring-black' : 'text-gray-500 hover:bg-white hover:text-black hover:shadow-sm'
        }`}
    >
        <div className="flex items-center gap-3"><Icon className={`h-5 w-5 ${active ? 'text-white' : 'text-gray-400 group-hover:text-black'}`} /><span className="font-medium text-sm">{label}</span></div>
        {active && <ChevronRight className="h-4 w-4 opacity-50" />}
    </button>
);

const PasswordField: React.FC<{ name: string; label: string; value: string; show: boolean; onToggle: () => void; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; error?: string; icon: any }> = ({ name, label, value, show, onToggle, onChange, error, icon: Icon }) => (
    <div className="space-y-1.5">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">{label}</label>
        <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Icon className="h-5 w-5 text-gray-400" />
            </div>
            <input 
                type={show ? "text" : "password"} 
                required 
                autoComplete="new-password"
                className={`block w-full rounded-lg border pl-12 pr-12 focus:ring-1 sm:text-sm py-3 transition-all duration-200 ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-200 text-red-800' : 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/50'}`}
                value={value} 
                onChange={onChange} 
            />
            <button 
                type="button" 
                onClick={onToggle} 
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
            >
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
    </div>
);


export const Account: React.FC = () => {
    const { user, logout, content, updateUserAddresses, refreshUnreadMessages, showToast } = useStore();
    const location = useLocation();
    const navigate = useNavigate();
    
    const initialTab = location.state?.tab as NavButtonId | undefined;
    const [activeTab, setActiveTab] = useState<NavButtonId>(initialTab || 'orders');
    
    const [selectedInvoice, setSelectedInvoice] = useState<Order | null>(null);
    const [selectedTracking, setSelectedTracking] = useState<Order | null>(null);

    // Orders State
    const [orders, setOrders] = useState<Order[]>([]);
    const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);
    const [orderSearch, setOrderSearch] = useState('');
    const [orderFilter, setOrderFilter] = useState('All');
    const [hoveredImage, setHoveredImage] = useState<{ src: string; x: number; y: number } | null>(null);

    // Support State
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [isLoadingTickets, setIsLoadingTickets] = useState(false);
    const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
    const [isCreatingTicket, setIsCreatingTicket] = useState(false);
    const [newTicketSubject, setNewTicketSubject] = useState('');
    const [newTicketMessage, setNewTicketMessage] = useState('');
    const [newTicketOrder, setNewTicketOrder] = useState('');
    const [replyText, setReplyText] = useState('');
    const [ticketSearch, setTicketSearch] = useState('');
    const [isInboxFullWidth, setIsInboxFullWidth] = useState(true);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    
    // Resizable Layout
    const [sidebarWidth, setSidebarWidth] = useState(0); 
    const [isResizing, setIsResizing] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const supportContainerRef = useRef<HTMLDivElement>(null); 
    
    // Attachments
    const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Wallet
    const [savedCards, setSavedCards] = useState<any[]>([]);
    const [isLoadingWallet, setIsLoadingWallet] = useState(false);

    // Settings
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
    const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
    const [prefs, setPrefs] = useState({ marketing: true, account: true });
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [passwordUpdateError, setPasswordUpdateError] = useState('');
    const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState(false);

    // Address
    const [isAddingAddress, setIsAddingAddress] = useState(false);
    const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
    const [newAddress, setNewAddress] = useState<Omit<Address, 'id'>>({ 
        name: '', street: '', line2: '', city: '', state: '', zip: '', isDefaultShipping: false, isDefaultBilling: false 
    });

    // --- Effects ---
    useEffect(() => {
        if (activeTab === 'support' && supportContainerRef.current) {
            if (sidebarWidth === 0) setSidebarWidth(supportContainerRef.current.offsetWidth * 0.5);
        }
    }, [activeTab]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !supportContainerRef.current) return;
            const containerRect = supportContainerRef.current.getBoundingClientRect();
            const relativeX = e.clientX - containerRect.left;
            const minWidth = 250;
            const maxWidth = containerRect.width - 250;
            setSidebarWidth(Math.max(minWidth, Math.min(relativeX, maxWidth)));
        };
        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        };
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none'; 
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    useEffect(() => {
        if (activeTab === 'support' && activeTicket && chatContainerRef.current) {
            setTimeout(() => {
                if(chatContainerRef.current) {
                    chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
                }
            }, 100);
        }
    }, [activeTicket?.messages, activeTicket, activeTab]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if(tab) setActiveTab(tab as any);
        else if (location.state?.tab) setActiveTab(location.state.tab);
    }, [location.search, location.state]);

    useEffect(() => {
        if (!user) return;
        if (activeTab === 'orders') loadOrders();
        if (activeTab === 'support' && !user.isSuspended) loadTickets();
        if (activeTab === 'wallet') loadWallet();
        if (user.preferences) setPrefs(user.preferences);
    }, [activeTab, user]);

    useEffect(() => {
        let res = orders;
        if (orderFilter !== 'All') res = res.filter(o => o.status === orderFilter);
        if (orderSearch.trim()) {
            const q = orderSearch.toLowerCase();
            res = res.filter(o => o.id.toLowerCase().includes(q) || o.items.some(i => i.title.toLowerCase().includes(q)));
        }
        setFilteredOrders(res);
    }, [orders, orderSearch, orderFilter]);

    // --- Loaders ---
    const loadOrders = async () => {
        setIsLoadingOrders(true);
        try {
            const fetched = await db.getAllOrders();
            setOrders(fetched.sort((a, b) => b.date - a.date));
        } catch(e) {
            if (user?.orders) setOrders(user.orders);
        } finally {
            setIsLoadingOrders(false);
        }
    };

    const loadTickets = async () => {
        setIsLoadingTickets(true);
        try {
            const t = await db.getUserTickets();
            setTickets(t);
            refreshUnreadMessages();
            if(activeTicket) {
                const found = t.find(ticket => ticket.id === activeTicket.id);
                if(found) setActiveTicket(found);
            }
        } catch(e) {
            console.error("Error loading tickets", e);
        } finally {
            setIsLoadingTickets(false);
        }
    };

    const loadWallet = async () => {
        setIsLoadingWallet(true);
        try {
            const cards = await db.getWallet();
            setSavedCards(cards);
        } catch(e) {
            console.error("Failed to load wallet", e);
        } finally {
            setIsLoadingWallet(false);
        }
    };

    // --- Actions ---
    const handleDeleteCard = async (id: string) => {
        if(!confirm("Remove this card from your wallet?")) return;
        try {
            await db.deletePaymentMethod(id);
            setSavedCards(prev => prev.filter(c => c.id !== id));
        } catch(e) { alert("Failed to remove card"); }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordUpdateError('');
        setPasswordUpdateSuccess(false);
    
        if (passwords.new !== passwords.confirm) {
            setPasswordUpdateError("New passwords do not match.");
            return;
        }
        if (passwords.new.length < 8) {
            setPasswordUpdateError("New password must be at least 8 characters long.");
            return;
        }
    
        setIsUpdatingPassword(true);
        try {
            await db.updateUser(user!.id, { password: passwords.new });
            showToast("Password updated successfully", "success");
            setPasswordUpdateSuccess(true);
            setPasswords({ current: '', new: '', confirm: '' });
            setTimeout(() => setPasswordUpdateSuccess(false), 4000);
        } catch (e) {
            setPasswordUpdateError("Failed to update password. Please try again.");
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const handlePrefChange = async (key: 'marketing' | 'account', value: boolean) => {
        setPrefs(prev => ({ ...prev, [key]: value }));
        try {
            await db.updateUser(user!.id, { preferences: { ...prefs, [key]: value } });
        } catch(e) {
            showToast("Failed to save preference.", "error");
            setPrefs(prev => ({ ...prev, [key]: !value })); 
        }
    };

    const handleDeleteAccount = () => {
        if(window.confirm("Are you sure? This action is permanent and cannot be undone.")) {
            showToast("Account scheduled for deletion.", "success");
            logout();
        }
    };

    const handleCreateTicketSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await db.createTicket(newTicketSubject, newTicketMessage, newTicketOrder);
            await loadTickets();
            setIsCreatingTicket(false);
            setNewTicketSubject(''); setNewTicketMessage(''); setNewTicketOrder('');
            setIsInboxFullWidth(true);
            showToast("Ticket created successfully.");
        } catch (e) { showToast("Failed to create ticket.", "error"); }
    };

    const handleStartCreateTicket = () => {
        setActiveTicket(null);
        setIsCreatingTicket(true);
        setIsInboxFullWidth(false);
        if (supportContainerRef.current && sidebarWidth === 0) {
            setSidebarWidth(supportContainerRef.current.offsetWidth * 0.5);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files) as File[];
            const validFiles: Attachment[] = [];
            for (const file of files) {
                if (file.size > 2 * 1024 * 1024) { showToast(`File ${file.name} too large`, 'error'); continue; }
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

    const handleReplyTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!activeTicket || (!replyText.trim() && pendingAttachments.length === 0)) return;
        try {
            if (activeTicket.status === 'Closed') await db.updateTicketStatus(activeTicket.id, 'Open');
            const newMessage = { role: 'user' as const, text: replyText, timestamp: Date.now(), senderName: user?.name || 'You', attachments: pendingAttachments };
            
            setActiveTicket(prev => prev ? { ...prev, messages: [...prev.messages, newMessage], status: 'Open' } : null);
            await db.replyTicket(activeTicket.id, replyText, 'user', pendingAttachments);
            setReplyText(''); setPendingAttachments([]);
            loadTickets(); 
        } catch (e) { showToast("Failed to send reply", "error"); }
    };

    const handleCloseTicketConfirm = async () => {
        if(!activeTicket) return;
        setShowCloseConfirm(false); // Close modal instantly
        try {
            const now = Date.now();
            await db.replyTicket(activeTicket.id, "Ticket closed by customer.", 'user');
            await db.updateTicketStatus(activeTicket.id, 'Closed');
            
            // Optimistic Update with Timestamp
            setActiveTicket(prev => prev ? { ...prev, status: 'Closed', closedAt: now } : null);
            setTickets(prev => prev.map(t => t.id === activeTicket.id ? { ...t, status: 'Closed', closedAt: now } : t));
            
            showToast("Ticket closed.");
        } catch(e) { showToast("Failed to close ticket.", "error"); }
    };

    const handleTicketSelect = (ticket: SupportTicket) => {
        if (!ticket.isRead) {
            setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, isRead: true } : t));
            refreshUnreadMessages(); 
        }
        setActiveTicket({ ...ticket, isRead: true });
        setIsCreatingTicket(false);
        setIsInboxFullWidth(false);
        if (supportContainerRef.current && sidebarWidth === 0) {
            setSidebarWidth(supportContainerRef.current.offsetWidth * 0.5);
        }
    };

    const togglePassword = (field: 'current' | 'new' | 'confirm') => setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));

    const handleAddAddress = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        
        let currentList = user.addresses || [];
        let updatedList = [...currentList];

        if (editingAddressId) {
            // Update Existing
            updatedList = updatedList.map(a => a.id === editingAddressId ? { ...newAddress, id: editingAddressId } : a);
        } else {
            // Add New
            const addressToAdd: Address = { ...newAddress, id: crypto.randomUUID() };
            updatedList.push(addressToAdd);
        }

        // Handle Defaults logic
        if (newAddress.isDefaultShipping) {
            updatedList = updatedList.map(a => ({ ...a, isDefaultShipping: a.id === (editingAddressId || updatedList[updatedList.length-1].id), isDefault: a.id === (editingAddressId || updatedList[updatedList.length-1].id) }));
        }
        if (newAddress.isDefaultBilling) {
            updatedList = updatedList.map(a => ({ ...a, isDefaultBilling: a.id === (editingAddressId || updatedList[updatedList.length-1].id) }));
        }
        
        if (updatedList.length === 1) { 
            updatedList[0].isDefaultShipping = true; 
            updatedList[0].isDefaultBilling = true; 
        }

        await updateUserAddresses(updatedList);
        setIsAddingAddress(false);
        setEditingAddressId(null);
        setNewAddress({ name: '', street: '', line2: '', city: '', state: '', zip: '', isDefaultShipping: false, isDefaultBilling: false });
        showToast(editingAddressId ? "Address updated." : "Address added.");
    };

    const handleEditAddress = (addr: Address) => {
        setNewAddress({
            name: addr.name,
            street: addr.street,
            line2: addr.line2 || '',
            city: addr.city,
            state: addr.state,
            zip: addr.zip,
            isDefaultShipping: addr.isDefaultShipping || addr.isDefault,
            isDefaultBilling: addr.isDefaultBilling
        });
        setEditingAddressId(addr.id);
        setIsAddingAddress(true);
        // Scroll to top of section
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleRemoveAddress = async (id: string) => {
        if (!user || !user.addresses) return;
        if (confirm('Delete this address?')) await updateUserAddresses(user.addresses.filter(a => a.id !== id));
    };

    const handleSetDefaultAddress = async (id: string, type: 'shipping' | 'billing') => {
        if (!user || !user.addresses) return;
        const updatedList = user.addresses.map(a => {
            if (a.id === id) return type === 'shipping' ? { ...a, isDefaultShipping: true, isDefault: true } : { ...a, isDefaultBilling: true };
            return type === 'shipping' ? { ...a, isDefaultShipping: false, isDefault: false } : { ...a, isDefaultBilling: false };
        });
        await updateUserAddresses(updatedList);
    };

    const filteredTickets = useMemo(() => {
        if (!ticketSearch) return tickets;
        const q = ticketSearch.toLowerCase();
        return tickets.filter(t => t.subject.toLowerCase().includes(q) || t.messages.some(m => decodeHtml(m.text).toLowerCase().includes(q)));
    }, [tickets, ticketSearch]);

    const welcomeText = content?.pageText?.accountWelcome?.replace('{name}', user?.name || 'User') || `Hello, ${user?.name}`;

    const handleNavClick = (id: NavButtonId) => {
        setActiveTab(id);
        navigate(`/account?tab=${id}`, { replace: true, state: { tab: id } });
    };

    if (!user) return <Navigate to="/" replace />; 
    if (user.isSuspended) return (<div className="min-h-screen bg-gray-50/50 pb-20 font-sans"><SEO title="Account Suspended" description="Action Required" /><div className="bg-white border-b border-gray-100 shadow-sm sticky top-20 z-30"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center"><span className="font-bold text-xl">My Account</span><button onClick={logout} className="text-sm font-bold uppercase text-gray-500 hover:text-black">Sign Out</button></div></div><SuspensionAppeal userId={user.id} /></div>);

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20 font-sans">
             <SEO title="My Account" description="Manage your account" />
             {selectedInvoice && <InvoiceModal order={selectedInvoice} userEmail={user.email} userName={user.name} onClose={() => setSelectedInvoice(null)} />}
             {selectedTracking && <TrackingModal order={selectedTracking} onClose={() => setSelectedTracking(null)} />}
             {previewImage && (<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setPreviewImage(null)}><button className="absolute top-4 right-4 text-white hover:text-gray-300"><X className="h-8 w-8"/></button><img src={previewImage} className="max-w-full max-h-full object-contain rounded" onClick={e => e.stopPropagation()} /></div>)}
             {showCloseConfirm && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/25 backdrop-blur-sm animate-in fade-in"><div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95"><h3 className="font-bold text-lg mb-2">Close Ticket?</h3><p className="text-gray-600 text-sm mb-6">This will move the ticket to the archive. You can reopen it anytime by sending a new reply.</p><div className="flex justify-end gap-3"><button onClick={() => setShowCloseConfirm(false)} className="px-4 py-2 border rounded-lg text-sm font-bold hover:bg-gray-50">Cancel</button><button onClick={handleCloseTicketConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700">Close Ticket</button></div></div></div>)}
             {hoveredImage && (
                <div 
                    className="fixed z-[110] bg-white p-2 shadow-2xl border border-gray-200 rounded-lg pointer-events-none animate-in fade-in zoom-in-95 duration-150"
                    style={{ 
                        left: hoveredImage.x + 20, 
                        top: hoveredImage.y - 125,
                        width: '250px', 
                        height: '250px' 
                    }}
                >
                    <img src={hoveredImage.src} className="w-full h-full object-contain rounded bg-white" alt="Product Preview" />
                </div>
             )}

             <div className="bg-white border-b border-gray-100 shadow-sm sticky top-20 z-30">
                 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4"><Breadcrumbs /></div>
                 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 pt-2">
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-6"><div className="flex items-center gap-4"><span className="text-3xl select-none" role="img" aria-label="Winking Face">😉</span><div><h1 className="text-2xl font-display font-bold text-gray-900 tracking-tight">{welcomeText}</h1><p className="text-xs text-gray-500 mt-0.5">{user.email}</p></div></div></div>
                 </div>
             </div>

             <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                     <div className="lg:col-span-3 space-y-6">
                         <div className="bg-gray-50/50 rounded-2xl p-2 space-y-1 sticky top-32">
                            <NavButton id="orders" label="Order History" icon={Package} active={activeTab === 'orders'} onClick={handleNavClick} />
                            <NavButton id="settings" label="Account Settings" icon={Settings} active={activeTab === 'settings'} onClick={handleNavClick} />
                            <NavButton id="addresses" label="Addresses" icon={MapPin} active={activeTab === 'addresses'} onClick={handleNavClick} />
                            <NavButton id="support" label="Customer Support" icon={MessageSquare} active={activeTab === 'support'} onClick={handleNavClick} />
                            <NavButton id="wallet" label="Wallet" icon={Wallet} active={activeTab === 'wallet'} onClick={handleNavClick} />
                         </div>
                     </div>

                     <div className="lg:col-span-9">
                         <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                             
                             {activeTab === 'orders' && (
                                 <div className="space-y-6">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><h2 className="text-xl font-bold font-display text-gray-900">Order History</h2></div>
                                    {isLoadingOrders ? <TabSkeleton /> : (
                                        <div className="space-y-4">
                                            {filteredOrders.length > 0 ? filteredOrders.map(order => (
                                                <div key={order.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow group">
                                                    <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                                                        <div className="flex gap-6 text-sm"><div><p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Order Placed</p><p className="font-medium text-gray-900 mt-0.5">{new Date(order.date).toLocaleDateString()}</p></div><div><p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total</p><p className="font-medium text-gray-900 mt-0.5">${(order.total ?? 0).toFixed(2)}</p></div><div><p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Order #</p><p className="font-medium text-gray-900 mt-0.5">{order.id}</p></div></div>
                                                        <div className="flex items-center gap-3"><button onClick={() => setSelectedInvoice(order)} className="text-xs font-medium text-gray-600 hover:text-black flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-all"><FileText className="h-3.5 w-3.5" /> Invoice</button><button onClick={() => { handleStartCreateTicket(); setNewTicketOrder(order.id); setNewTicketSubject(`Help with Order ${order.id}`); handleNavClick('support'); }} className="text-xs font-medium text-gray-600 hover:text-black flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-all">Get Help</button></div>
                                                    </div>
                                                    <div className="p-6"><div className="flex flex-col md:flex-row gap-6 items-start"><div className="w-full md:w-48 flex-shrink-0"><div className="flex items-center gap-2 mb-2"><div className={`h-2.5 w-2.5 rounded-full ${order.status === 'Delivered' ? 'bg-green-500' : 'bg-blue-500 animate-pulse'}`}></div><h4 className="font-bold text-sm text-gray-900">{order.status}</h4></div><p className="text-xs text-gray-500 mb-4">{order.status === 'Delivered' ? 'Package delivered successfully' : 'Your order is being processed'}</p>{order.trackingNumber ? ( <button onClick={() => setSelectedTracking(order)} className="w-full text-center text-xs font-bold uppercase tracking-wide bg-gray-900 text-white py-2 rounded hover:bg-black transition-colors flex items-center justify-center gap-2"><Truck className="h-3 w-3" /> Track Package</button> ) : ( <div className="w-full text-center text-xs font-bold uppercase tracking-wide bg-gray-100 text-gray-400 py-2 rounded flex items-center justify-center gap-2 cursor-default border border-gray-200 select-none"><Package className="h-3 w-3" /> Order being prepared</div> )}</div><div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">{order.items.map((item, idx) => (<div key={idx} className="group/item flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-300 transition-colors" onMouseEnter={(e) => setHoveredImage({ src: item.images?.[0] || '', x: e.clientX, y: e.clientY })} onMouseLeave={() => setHoveredImage(null)}><div className="h-16 w-16 bg-white rounded border border-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center"><img src={item.images?.[0] || ''} alt={item.title} className="w-full h-full object-contain p-1" /></div><div className="min-w-0 flex-1"><p className="text-sm font-bold text-gray-900 line-clamp-1" title={item.title}>{item.title}</p><div className="text-xs text-gray-500 mt-1 space-y-0.5"><p className="font-medium text-gray-700">Qty: {item.quantity}</p><p className="text-[10px] uppercase tracking-wide">{item.selectedSize} / {item.selectedColor}</p></div></div></div>))}</div></div></div>
                                                </div>
                                            )) : <div className="p-8 text-center text-gray-400">No orders found.</div>}
                                        </div>
                                    )}
                                 </div>
                             )}

                             {activeTab === 'support' && (
                                 <div className="bg-white border border-gray-200 rounded-2xl shadow-sm h-[600px] flex flex-col md:flex-row overflow-hidden relative select-none" ref={supportContainerRef}>
                                     {/* Inbox */}
                                     <div className={`flex flex-col border-r border-gray-100 transition-none relative shrink-0 ${isInboxFullWidth ? 'w-full' : ((activeTicket || isCreatingTicket) ? 'hidden md:flex' : 'w-full')}`} style={{ width: (!isInboxFullWidth && (activeTicket || isCreatingTicket)) ? sidebarWidth : '100%' }}>
                                         <div className="p-4 border-b border-gray-100 bg-gray-50/50 space-y-3"><div className="flex justify-between items-center"><h2 className="font-bold text-gray-900 text-sm uppercase tracking-wide">Inbox</h2><div className="flex gap-1"><button onClick={loadTickets} className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"><RefreshCw className="h-4 w-4"/></button><button onClick={handleStartCreateTicket} className="p-2 bg-black text-white hover:bg-gray-800 rounded-lg shadow-sm"><Plus className="h-4 w-4"/></button></div></div><div className="relative"><input className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-xs focus:ring-black focus:border-black" placeholder="Search tickets..." value={ticketSearch} onChange={(e) => setTicketSearch(e.target.value)} /><Search className="h-3 w-3 text-gray-400 absolute left-3 top-2.5"/></div></div>
                                         <div className="flex-1 overflow-y-auto">
                                             {isLoadingTickets ? <div className="h-full flex items-center justify-center p-6 text-gray-500 text-sm"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...</div> : filteredTickets.length === 0 ? <div className="h-full flex flex-col items-center justify-center p-6 text-center text-gray-400"><MessageSquare className="h-8 w-8 mb-2 opacity-20"/><p className="text-sm">{ticketSearch ? 'No matches found' : 'No tickets yet'}</p></div> : (
                                                 <div className="divide-y divide-gray-50">
                                                     {filteredTickets.map(ticket => {
                                                         const isUnread = !ticket.isRead;
                                                         const lastMsg = ticket.messages[ticket.messages.length - 1];
                                                         const previewText = generatePreviewText(lastMsg);
                                                         
                                                         return (
                                                             <div key={ticket.id} onClick={() => handleTicketSelect(ticket)} className={`p-4 cursor-pointer hover:bg-gray-50 transition-all border-l-4 group relative ${activeTicket?.id === ticket.id ? 'bg-blue-50/30 border-blue-600' : 'border-transparent'}`}>
                                                                 {isUnread && <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white"></div>}
                                                                 <div className="flex justify-between items-start mb-1 pr-4"><h4 className={`text-sm truncate pr-2 ${isUnread ? 'font-extrabold text-black' : 'font-medium text-gray-900'} ${activeTicket?.id === ticket.id ? 'text-blue-700' : ''}`}>{ticket.subject}</h4><span className={`text-[10px] whitespace-nowrap ${isUnread ? 'font-bold text-black' : 'text-gray-400'}`}>{new Date(ticket.updatedAt).toLocaleDateString()}</span></div>
                                                                 <div className="flex items-center justify-between"><p className={`text-xs line-clamp-1 flex-1 mr-2 ${isUnread ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{previewText}</p><div className="flex items-center gap-1">{ticket.isLocked && <Lock className="h-3 w-3 text-gray-400"/>}<span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                                                                     ticket.isLocked ? 'bg-gray-200 text-gray-600' : ticket.status === 'Open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                                                 }`}>{ticket.isLocked ? 'Locked' : ticket.status}</span></div></div>
                                                             </div>
                                                         );
                                                     })}
                                                 </div>
                                             )}
                                         </div>
                                     </div>
                                     {(!isInboxFullWidth && (activeTicket || isCreatingTicket)) && (<div className="w-1 bg-gray-100 hover:bg-blue-400 cursor-col-resize hidden md:flex items-center justify-center z-20 flex-shrink-0 transition-colors border-x border-gray-200 hover:border-blue-400" onMouseDown={() => setIsResizing(true)}><GripVertical className="h-4 w-4 text-gray-400 pointer-events-none"/></div>)}
                                     {!isInboxFullWidth && (
                                         <div className={`flex-1 flex flex-col h-full bg-white md:bg-gray-50/30 min-w-0 ${!activeTicket && !isCreatingTicket ? 'hidden md:flex' : ''}`}>
                                             {isCreatingTicket ? (
                                                 <div className="flex flex-col h-full animate-in fade-in">
                                                     <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white"><h3 className="font-bold text-gray-900">New Support Request</h3><button onClick={() => { setIsCreatingTicket(false); setIsInboxFullWidth(true); }} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X className="h-5 w-5"/></button></div>
                                                     <form onSubmit={handleCreateTicketSubmit} className="flex-1 p-6 space-y-6 overflow-y-auto"><div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Subject</label><input required className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-black focus:border-black" placeholder="Briefly describe the issue" value={newTicketSubject} onChange={e => setNewTicketSubject(e.target.value)} /></div><div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Order Number (Optional)</label><input className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-black focus:border-black" placeholder="e.g. ORD-12345" value={newTicketOrder} onChange={e => setNewTicketOrder(e.target.value)} /></div><div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Message</label><textarea required className="w-full h-40 border border-gray-300 rounded-lg p-3 text-sm focus:ring-black focus:border-black resize-none" placeholder="How can we help you?" value={newTicketMessage} onChange={e => setNewTicketMessage(e.target.value)} /></div></form>
                                                     <div className="p-4 border-t border-gray-100 bg-white"><button onClick={handleCreateTicketSubmit} className="w-full bg-black text-white py-3 rounded-lg font-bold uppercase text-sm tracking-wide hover:bg-gray-800 transition-colors">Submit Request</button></div>
                                                 </div>
                                             ) : activeTicket ? (
                                                 <div className="flex flex-col h-full animate-in fade-in">
                                                     <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white shadow-sm z-10">
                                                         <div className="flex items-center gap-3 min-w-0 flex-1"><button onClick={() => { setActiveTicket(null); setIsInboxFullWidth(true); }} className="md:hidden p-1 hover:bg-gray-100 rounded-full"><ChevronLeft className="h-5 w-5 text-gray-600"/></button><button onClick={() => setIsInboxFullWidth(true)} className="hidden md:block p-1 hover:bg-gray-100 rounded-full text-gray-500" title="Maximize Inbox List"><Maximize2 className="h-4 w-4"/></button><div className="min-w-0 flex-1 max-w-[50%]"><h3 className="font-bold text-sm text-gray-900 truncate" title={activeTicket.subject}>{activeTicket.subject}</h3><p className="text-[10px] text-gray-500 flex items-center gap-1 uppercase tracking-wide truncate">{activeTicket.orderId && <span className="bg-gray-100 px-1.5 rounded flex-shrink-0">#{activeTicket.orderId}</span>}<span>ID: {activeTicket.id}</span></p></div></div>
                                                         <div className="flex items-center gap-2 flex-shrink-0">
                                                             {activeTicket.status === 'Open' && !activeTicket.isLocked && (<button onClick={() => setShowCloseConfirm(true)} className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded border border-transparent hover:border-red-100 transition-colors whitespace-nowrap">Close Ticket</button>)}
                                                             <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wide ${
                                                                 activeTicket.isLocked ? 'bg-gray-200 text-gray-600' : activeTicket.status === 'Open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                                             }`}>
                                                                 {activeTicket.isLocked ? 'Locked' : activeTicket.status}
                                                             </span>
                                                         </div>
                                                     </div>
                                                     
                                                     <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50 scroll-smooth select-none">
                                                         {activeTicket.closedAt && (
                                                             <div className="flex justify-center my-2"><span className="text-[10px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full uppercase font-bold">Closed on {new Date(activeTicket.closedAt).toLocaleDateString()}</span></div>
                                                         )}
                                                         {activeTicket.messages.map((msg, i) => {
                                                             const isCustomer = msg.role === 'user';
                                                             const isSystem = msg.text.includes('Ticket closed by') || msg.text.includes('Ticket locked by') || msg.text.includes('Ticket deleted');
                                                             if (isSystem) return (<div key={i} className="flex justify-center my-4"><span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{decodeHtml(msg.text)}</span></div>);
                                                             return (
                                                                 <div key={i} className={`flex ${isCustomer ? 'justify-start' : 'justify-end'} mb-2`}><div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-4 text-sm shadow-sm relative ${isCustomer ? 'bg-white border border-gray-200 text-gray-900 rounded-bl-none' : 'bg-black text-white rounded-br-none'}`}><div className={`flex justify-between items-baseline gap-4 mb-2 text-xs border-b pb-2 ${isCustomer ? 'border-gray-100' : 'border-gray-800'}`}><span className={`font-bold uppercase tracking-wider ${isCustomer ? 'text-gray-700' : 'text-gray-200'}`}>{isCustomer ? 'You' : (msg.senderName || 'Agent')}</span><span className={`${isCustomer ? 'text-gray-400' : 'text-gray-400'}`}>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div><div className="whitespace-pre-wrap leading-relaxed"><ChatMessageRenderer text={msg.text} variant={msg.role} /></div>{msg.attachments && msg.attachments.length > 0 && (<div className="mt-3 flex flex-wrap gap-2">{msg.attachments.map((att, idx) => (<div key={idx} className="relative group">{att.type === 'image' ? (<div className="h-20 w-20 rounded bg-gray-100 border overflow-hidden cursor-zoom-in" onClick={() => setPreviewImage(att.url)}><img src={att.url} className="h-full w-full object-cover" /></div>) : (<a href={att.url} download={att.name} className={`flex items-center gap-2 p-2 rounded border text-xs font-bold ${isCustomer ? 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100' : 'bg-gray-800 border-gray-700 text-white hover:bg-gray-700'}`}><FileIcon className="h-4 w-4"/><span className="truncate max-w-[100px]">{att.name}</span></a>)}</div>))}</div>)}</div></div>
                                                             );
                                                         })}
                                                     </div>

                                                     {activeTicket.isLocked ? (
                                                         <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-center gap-2 text-sm text-gray-500 font-bold uppercase tracking-wide">
                                                             <Lock className="h-4 w-4"/> This conversation is locked.
                                                         </div>
                                                     ) : (
                                                         <form onSubmit={handleReplyTicket} className="p-4 bg-white border-t border-gray-100 mt-auto md:mt-0">
                                                             {pendingAttachments.length > 0 && (<div className="flex flex-wrap gap-2 mb-3 p-2 bg-gray-50 rounded-lg border border-dashed border-gray-300">{pendingAttachments.map((att, idx) => (<div key={idx} className="relative group bg-white border rounded p-1">{att.type === 'image' ? (<img src={att.url} className="h-12 w-12 object-cover rounded" />) : (<div className="h-12 w-12 flex items-center justify-center bg-gray-100 rounded"><FileIcon className="h-5 w-5 text-gray-500"/></div>)}<button type="button" onClick={() => removeAttachment(idx)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><X className="h-3 w-3"/></button></div>))}</div>)}
                                                             <div className="flex gap-3 relative">{activeTicket.status === 'Closed' && (<div className="absolute -top-10 left-0 right-0 text-center"><span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full shadow-sm">Replying will reopen this ticket</span></div>)}<button type="button" className="p-3 text-gray-400 hover:text-black hover:bg-gray-100 rounded-xl transition-colors" onClick={() => fileInputRef.current?.click()} title="Attach files"><Paperclip className="h-5 w-5" /><input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} accept="image/png, image/jpeg, image/gif, application/pdf, text/plain"/></button><input className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-black focus:ring-0 transition-colors outline-none" placeholder="Type your reply..." value={replyText} onChange={e => setReplyText(e.target.value)} /><button type="submit" disabled={(!replyText.trim() && pendingAttachments.length === 0)} className="bg-black text-white p-3 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><Send className="h-5 w-5" /></button></div>
                                                         </form>
                                                     )}
                                                 </div>
                                             ) : (
                                                 <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/30 h-full"><div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 shadow-inner"><MessageSquare className="h-8 w-8 text-gray-300"/></div><h3 className="text-lg font-bold text-gray-600">Select a Ticket</h3><p className="text-sm mt-1">View conversation details or create a new request.</p></div>
                                             )}
                                         </div>
                                     )}
                                 </div>
                             )}

                             {activeTab === 'wallet' && (
                                <div className="space-y-6">
                                    <h2 className="text-xl font-bold font-display text-gray-900">Wallet & Payment Methods</h2>
                                    {isLoadingWallet ? <TabSkeleton /> : savedCards.length === 0 ? (
                                        <div className="text-center py-16 bg-white border border-dashed border-gray-300 rounded-2xl"><div className="h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4"><CreditCard className="h-8 w-8 text-gray-300" /></div><h3 className="text-lg font-medium text-gray-900">No saved cards</h3><p className="text-gray-500 mt-1 mb-6">Save a card during checkout for faster payments next time.</p></div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{savedCards.map(card => (<div key={card.id} className="p-6 border border-gray-200 bg-white rounded-xl shadow-sm relative group"><div className="flex justify-between items-start"><div><p className="text-sm font-bold uppercase tracking-wider text-gray-500">{card.card.brand}</p><p className="text-xl font-mono text-gray-900 mt-1">•••• •••• •••• {card.card.last4}</p><p className="text-xs text-gray-400 mt-2">Expires {card.card.exp_month}/{card.card.exp_year}</p></div><CreditCard className="h-8 w-8 text-gray-300" /></div><button onClick={() => handleDeleteCard(card.id)} className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button></div>))}</div>
                                    )}
                                </div>
                             )}

                             {activeTab === 'addresses' && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between"><h2 className="text-xl font-bold font-display text-gray-900">Saved Addresses</h2><button onClick={() => { setIsAddingAddress(!isAddingAddress); setEditingAddressId(null); setNewAddress({ name: '', street: '', line2: '', city: '', state: '', zip: '', isDefaultShipping: false, isDefaultBilling: false }); }} className="text-sm font-bold uppercase flex items-center gap-2 bg-black text-white px-4 py-2 rounded hover:bg-gray-800">{isAddingAddress ? <X className="h-4 w-4"/> : <Plus className="h-4 w-4"/>} {isAddingAddress ? 'Cancel' : 'Add New'}</button></div>
                                    {isAddingAddress && (
                                        <form onSubmit={handleAddAddress} className="bg-gray-50 p-6 rounded-xl border border-gray-200 animate-in slide-in-from-top-2">
                                            <h3 className="font-bold mb-4 text-sm uppercase text-gray-500">{editingAddressId ? 'Edit Address' : 'New Address'}</h3>
                                            <div className="space-y-4 mb-4">
                                                <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Full Name</label><input required className="border p-2 rounded text-sm w-full" placeholder="Full Name" value={newAddress.name} onChange={e => setNewAddress({...newAddress, name: e.target.value})} /></div>
                                                <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Street Address</label><input required className="border p-2 rounded text-sm w-full" placeholder="Street Address" value={newAddress.street} onChange={e => setNewAddress({...newAddress, street: e.target.value})} /></div>
                                                <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Apt / Suite</label><input className="border p-2 rounded text-sm w-full" placeholder="Apt, Suite, Unit (Optional)" value={newAddress.line2} onChange={e => setNewAddress({...newAddress, line2: e.target.value})} /></div>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">City</label><input required className="border p-2 rounded text-sm w-full" placeholder="City" value={newAddress.city} onChange={e => setNewAddress({...newAddress, city: e.target.value})} /></div>
                                                    <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">State</label><input required className="border p-2 rounded text-sm w-full" placeholder="State" value={newAddress.state} onChange={e => setNewAddress({...newAddress, state: e.target.value})} /></div>
                                                    <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Zip Code</label><input required className="border p-2 rounded text-sm w-full" placeholder="ZIP" value={newAddress.zip} onChange={e => setNewAddress({...newAddress, zip: e.target.value})} /></div>
                                                </div>
                                            </div>
                                            <div className="flex gap-4 mb-6"><label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"><input type="checkbox" checked={newAddress.isDefaultShipping} onChange={e => setNewAddress({...newAddress, isDefaultShipping: e.target.checked})} className="h-4 w-4 text-black focus:ring-black rounded"/> Set as Default Shipping</label><label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"><input type="checkbox" checked={newAddress.isDefaultBilling} onChange={e => setNewAddress({...newAddress, isDefaultBilling: e.target.checked})} className="h-4 w-4 text-black focus:ring-black rounded"/> Set as Default Billing</label></div>
                                            <button type="submit" className="bg-black text-white px-6 py-2 rounded text-sm font-bold uppercase hover:bg-gray-800">{editingAddressId ? 'Update Address' : 'Save Address'}</button>
                                        </form>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {user.addresses?.map(addr => {
                                            const isShip = addr.isDefaultShipping || addr.isDefault;
                                            const isBill = addr.isDefaultBilling;
                                            return (
                                                <div key={addr.id} className={`p-6 border rounded-xl relative group ${isShip || isBill ? 'bg-gray-100 border-gray-400' : 'border-gray-200 bg-white'}`}><div className="absolute top-4 right-4 flex gap-1">{isShip && <span className="bg-black text-white text-[10px] uppercase font-bold px-2 py-1 rounded">Default Shipping</span>}{isBill && <span className="bg-gray-200 text-gray-800 text-[10px] uppercase font-bold px-2 py-1 rounded">Default Billing</span>}</div><h4 className="font-bold text-gray-900">{addr.name}</h4><p className="text-sm text-gray-600 mt-1">{addr.street}</p>{addr.line2 && <p className="text-sm text-gray-600">{addr.line2}</p>}<p className="text-sm text-gray-600">{addr.city}, {addr.state} {addr.zip}</p><div className="mt-4 flex flex-wrap gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditAddress(addr)} className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1"><Edit className="h-3 w-3"/> Edit</button>
                                                    {!isShip && <button onClick={() => handleSetDefaultAddress(addr.id, 'shipping')} className="text-xs font-medium text-gray-600 hover:underline">Set Default Shipping</button>}{!isBill && <button onClick={() => handleSetDefaultAddress(addr.id, 'billing')} className="text-xs font-medium text-gray-600 hover:underline">Set Default Billing</button>}<button onClick={() => handleRemoveAddress(addr.id)} className="text-xs font-medium text-red-600 hover:underline">Delete</button></div></div>
                                            )
                                        })}
                                        {!user.addresses?.length && !isAddingAddress && <div className="col-span-2 text-center py-12 text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-xl">No saved addresses.</div>}
                                    </div>
                                </div>
                             )}

                             {activeTab === 'settings' && (
                                <div className="space-y-8 max-w-2xl">
                                    <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
                                        <h3 className="text-xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                            <Key className="h-5 w-5 text-gray-400"/> Change Password
                                        </h3>
                                        <form onSubmit={handleChangePassword} className="space-y-6">
                                            <PasswordField
                                                name="current"
                                                label="Current Password"
                                                icon={Key}
                                                value={passwords.current}
                                                show={showPasswords.current}
                                                onToggle={() => togglePassword('current')}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setPasswords({...passwords, current: e.target.value}); setPasswordUpdateError(''); }}
                                            />
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100">
                                                <PasswordField
                                                    name="new"
                                                    label="New Password"
                                                    icon={Lock}
                                                    value={passwords.new}
                                                    show={showPasswords.new}
                                                    onToggle={() => togglePassword('new')}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setPasswords({...passwords, new: e.target.value}); setPasswordUpdateError(''); }}
                                                    error={passwordUpdateError.includes('New') && passwordUpdateError}
                                                />
                                                <PasswordField
                                                    name="confirm"
                                                    label="Confirm New Password"
                                                    icon={Lock}
                                                    value={passwords.confirm}
                                                    show={showPasswords.confirm}
                                                    onToggle={() => togglePassword('confirm')}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setPasswords({...passwords, confirm: e.target.value}); setPasswordUpdateError(''); }}
                                                    error={passwordUpdateError.includes('match') && passwordUpdateError}
                                                />
                                            </div>
                                            
                                            {passwordUpdateError && (
                                                <div className="bg-red-50/50 text-red-700 text-sm font-medium p-3 rounded-lg flex items-center gap-2 border border-red-100 animate-in fade-in">
                                                    <AlertTriangle className="h-4 w-4"/> {passwordUpdateError}
                                                </div>
                                            )}

                                            <div className="pt-4 flex items-center justify-between">
                                                {passwordUpdateSuccess ? (
                                                    <div className="flex items-center gap-2 text-green-600 font-bold animate-in fade-in">
                                                        <CheckCircle className="h-5 w-5" />
                                                        <span>Password Updated!</span>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        type="submit" 
                                                        disabled={isUpdatingPassword}
                                                        className="bg-black text-white px-8 py-3 text-sm font-bold rounded-lg hover:bg-gray-800 transition-all shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-2 transform active:scale-[0.98]"
                                                    >
                                                        {isUpdatingPassword ? <Loader2 className="h-4 w-4 animate-spin"/> : null}
                                                        Update Password
                                                    </button>
                                                )}
                                            </div>
                                        </form>
                                    </div>

                                    <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm"><h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2"><Bell className="h-5 w-5 text-gray-400"/> Notification Preferences</h3><div className="space-y-6"><div className="flex items-center justify-between"><div><h4 className="font-bold text-sm text-gray-900">Marketing & Offers</h4><p className="text-xs text-gray-500 mt-1">Receive updates about new products and promotions.</p></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={prefs.marketing} onChange={(e) => handlePrefChange('marketing', e.target.checked)} /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div></label></div><div className="flex items-center justify-between"><div><h4 className="font-bold text-sm text-gray-900">Account Notifications</h4><p className="text-xs text-gray-500 mt-1">Receive transactional emails (Orders, Security).</p></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={prefs.account} onChange={(e) => handlePrefChange('account', e.target.checked)} /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div></label></div></div></div>
                                    <div className="bg-red-50/50 border border-red-100 rounded-2xl p-8"><h3 className="text-lg font-bold text-red-700 mb-2 flex items-center gap-2"><Trash2 className="h-5 w-5"/> Danger Zone</h3><p className="text-sm text-red-600 mb-6">Permanently delete your account and all associated data. This action cannot be undone.</p><button onClick={handleDeleteAccount} className="border border-red-200 bg-white text-red-600 px-6 py-2.5 text-sm font-bold rounded-lg hover:bg-red-50 transition-colors">Delete Account</button></div>
                                 </div>
                             )}
                         </div>
                     </div>
                 </div>
             </div>
        </div>
    );
};