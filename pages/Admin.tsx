
import React, { useState, useEffect } from 'react';
import { Product, AppSettings, User, PromoCode, StoreContent, SupportTicket, Subscriber, Order } from '../types';
import { db } from '../services/db';
import { settingsService } from '../services/settings';
import { adminMiddleware } from '../services/adminMiddleware';
import { ShieldAlert, Loader2, Package, Settings, FileText, Megaphone, Share2, Lock, Truck, Tag, Users, MessageSquare, Layout, Globe, BarChart3, PenTool, Headset } from 'lucide-react';
import { SEO } from '../components/SEO';
import { useStore } from '../context/StoreProvider';
import { Link } from 'react-router-dom';

// Admin Sections
import { InventorySection } from '../components/admin/InventorySection';
import { OrdersSection } from '../components/admin/OrdersSection';
import { SettingsSection } from '../components/admin/SettingsSection';
import { SecuritySection } from '../components/admin/SecuritySection';
import { CustomersSection } from '../components/admin/CustomersSection';
import { PromosSection } from '../components/admin/PromosSection';
import { MarketingSection } from '../components/admin/MarketingSection';
import { SocialSection } from '../components/admin/SocialSection';
import { SupportSection } from '../components/admin/SupportSection';
import { ShippingSection } from '../components/admin/ShippingSection';
import { LayoutSection } from '../components/admin/LayoutSection';
import { CMSSection } from '../components/admin/CMSSection';
import { SEOManager } from '../components/admin/SEOManager';
import { AnalyticsSection } from '../components/admin/AnalyticsSection';
import { CreativesGenerator } from '../components/admin/CreativesGenerator';

export const Admin: React.FC = () => {
    const { user, login, getCaptcha, refreshContent, refreshSettings, showToast } = useStore();

    // --- Auth State ---
    const [email, setEmail] = useState('admin@shipteez.com');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [captchaRequired, setCaptchaRequired] = useState(false);
    const [captchaToken, setCaptchaToken] = useState('');
    const [captchaChallenge, setCaptchaChallenge] = useState('');
    const [captchaAnswer, setCaptchaAnswer] = useState('');

    // --- Admin Data State ---
    const [activeTab, setActiveTab] = useState<'inventory' | 'orders' | 'settings' | 'security' | 'customers' | 'promos' | 'cms' | 'marketing' | 'social' | 'support' | 'layout' | 'shipping' | 'seo' | 'analytics' | 'creatives'>('inventory');
    const [settings, setSettings] = useState<AppSettings>(settingsService.getSyncFallback());
    const [content, setContent] = useState<StoreContent | null>(null);
    const [liveVisitors] = useState(0);
    const [isLoadingData, setIsLoadingData] = useState(false);

    // Lists
    const [products, setProducts] = useState<Product[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [promos, setPromos] = useState<PromoCode[]>([]);
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);

    // --- Initialization ---
    useEffect(() => {
        if (user?.role === 'admin') {
            const load = async () => {
                // Settings first as they determine API URL
                const s = await settingsService.load();
                setSettings(s);
                await refreshAll(s);
            };
            load();
        }
    }, [user]);

    const refreshAll = async (s = settings) => {
        setIsLoadingData(true);
        try {
            // Concurrent Loading for Performance
            const [
                fetchedProducts,
                fetchedUsers,
                fetchedPromos,
                fetchedOrders,
                fetchedTickets,
                fetchedSubscribers
            ] = await Promise.all([
                db.getAllProducts(),
                db.getAllUsers(),
                db.getAllPromos(),
                db.getAllOrders(),
                db.getAdminTickets().catch(() => []), // Optional
                db.getNewsletterSubscribers().catch(() => []) // Optional
            ]);

            setProducts(fetchedProducts.sort((a, b) => b.createdAt - a.createdAt));
            setUsers(fetchedUsers);
            setPromos(fetchedPromos);
            setOrders(fetchedOrders);
            setTickets(fetchedTickets);
            setSubscribers(fetchedSubscribers);

            // Fetch Content independently (usually cached or lightweight)
            const c = await db.getStoreContent();
            setContent(c);
            await refreshContent();
        } catch (e) {
            console.error("Admin data load failed", e);
            showToast("Failed to load some admin data", "error");
        } finally {
            setIsLoadingData(false);
        }
    };

    // --- Handlers ---
    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoggingIn(true);
        setAuthError('');
        try {
            await login(email, password, captchaToken, captchaAnswer);
        } catch (e: any) {
            setAuthError(e.error || "Login failed");
            if (e.captchaRequired) {
                const c = await getCaptcha();
                setCaptchaRequired(true);
                setCaptchaToken(c.token);
                setCaptchaChallenge(c.challenge);
            }
        } finally {
            setIsLoggingIn(false);
        }
    };

    const updateContent = (fn: (c: StoreContent) => StoreContent) => { if (content) setContent(fn({ ...content })); };
    
    const saveContent = async () => { 
        if (content) { 
            try {
                await adminMiddleware.content.save(content); 
                await refreshContent(); 
                showToast("Content Saved Successfully"); 
            } catch(e) {
                showToast("Failed to save content", "error");
            }
        } 
    };
    
    const updateSettings = (s: AppSettings) => setSettings(s);
    
    const saveSettings = async () => { 
        try {
            await adminMiddleware.settings.save(settings); 
            await refreshSettings(); 
            showToast("Configuration Saved"); 
        } catch(e) {
            showToast("Failed to save configuration", "error");
        }
    };

    // --- Render ---
    if (!user || user.role !== 'admin') {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <SEO title="Admin Login" description="Restricted Access" />
                <div className="max-w-md w-full bg-white shadow-xl p-8">
                    <form onSubmit={handleAdminLogin} className="space-y-6">
                        <h1 className="text-2xl font-bold text-center uppercase tracking-widest">Admin Access</h1>
                        {authError && <div className="bg-red-50 text-red-600 p-3 text-sm">{authError}</div>}
                        <input type="email" placeholder="Email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full border p-3" />
                        <input type="password" placeholder="Password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full border p-3" />
                        {captchaRequired && <div className="bg-gray-50 p-4 border"><label className="block text-xs font-bold mb-2">Security: {captchaChallenge}</label><input type="text" required value={captchaAnswer} onChange={e => setCaptchaAnswer(e.target.value)} className="w-full border p-2" /></div>}
                        <button type="submit" disabled={isLoggingIn} className="w-full bg-black text-white font-bold uppercase py-3 hover:bg-gray-800">{isLoggingIn ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Authenticate'}</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen font-sans">
            <SEO title="Admin Dashboard" description="Store management" />

            {/* Nav */}
            <div className="bg-white border-b sticky top-0 z-30 overflow-x-auto">
                <div className="max-w-7xl mx-auto px-4 py-2">
                    <div className="flex items-center justify-between mb-2">
                        <h1 className="text-lg font-bold flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Admin Panel</h1>
                        <div className="flex items-center gap-3">
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> {liveVisitors} Live</span>
                            {isLoadingData && <span className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin"/> Syncing...</span>}
                            <Link to="/cs-panel" className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-xs font-bold uppercase flex items-center gap-1 transition-colors">
                                <Headset className="h-4 w-4" /> Agent Console
                            </Link>
                        </div>
                    </div>
                    <div className="flex gap-4 pb-2">
                        {[
                            { id: 'inventory', icon: Package }, { id: 'orders', icon: Package }, { id: 'layout', icon: Layout },
                            { id: 'cms', icon: FileText }, { id: 'shipping', icon: Truck },
                            { id: 'promos', icon: Tag }, { id: 'customers', icon: Users }, { id: 'support', icon: MessageSquare },
                            { id: 'marketing', icon: Megaphone }, { id: 'creatives', icon: PenTool }, { id: 'seo', icon: Globe }, { id: 'analytics', icon: BarChart3 },
                            { id: 'social', icon: Share2 }, { id: 'settings', icon: Settings }, { id: 'security', icon: Lock }
                        ].map(t => (
                            <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex items-center gap-2 px-3 py-1 text-xs font-bold uppercase whitespace-nowrap border-b-2 transition-colors ${activeTab === t.id ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-black'}`}>
                                <t.icon className="h-3 w-3" /> {t.id}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6 space-y-8 pb-32">
                {activeTab === 'inventory' && content && <InventorySection products={products} content={content} onUpdateContent={updateContent} onSaveContent={saveContent} onRefresh={refreshAll} />}
                {activeTab === 'orders' && <OrdersSection orders={orders} onRefresh={refreshAll} />}
                {activeTab === 'promos' && <PromosSection promos={promos} onRefresh={refreshAll} />}
                {activeTab === 'customers' && <CustomersSection users={users} onRefresh={refreshAll} />}
                {activeTab === 'support' && content && <SupportSection tickets={tickets} content={content} onUpdateContent={updateContent} onSaveContent={saveContent} onRefresh={refreshAll} />}
                {activeTab === 'marketing' && content && <MarketingSection content={content} subscribers={subscribers} users={users} onUpdateContent={updateContent} onSaveContent={saveContent} />}
                {activeTab === 'creatives' && <CreativesGenerator />}
                {activeTab === 'social' && content && <SocialSection content={content} onUpdateContent={updateContent} onSaveContent={saveContent} />}
                {activeTab === 'settings' && <SettingsSection settings={settings} onUpdateSettings={updateSettings} onSaveSettings={saveSettings} onRefreshContent={refreshContent} />}
                {activeTab === 'security' && content && <SecuritySection content={content} onUpdateContent={updateContent} onSaveContent={saveContent} />}
                {activeTab === 'shipping' && content && <ShippingSection content={content} onUpdateContent={updateContent} onSaveContent={saveContent} />}
                {activeTab === 'layout' && content && <LayoutSection content={content} onUpdateContent={updateContent} onSaveContent={saveContent} />}
                {activeTab === 'cms' && content && <CMSSection content={content} onUpdateContent={updateContent} onSaveContent={saveContent} />}
                {activeTab === 'seo' && <SEOManager />}
                {activeTab === 'analytics' && <AnalyticsSection />}
            </div>
        </div>
    );
};
