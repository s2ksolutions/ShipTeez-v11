
import { 
    Product, Order, StoreContent, User, SupportTicket, 
    PromoCode, Subscriber, Unsubscriber, AnalyticsEvent, 
    SuspensionCase, AppealDocument, Attachment 
} from '../types';
import { settingsService } from './settings';
import { api, API_ENDPOINTS } from './api';
import { securityService } from './security';

let allProductsCache: Product[] | null = null;
let allProductsTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;
const productCache = new Map<string, Product>();

const getToken = async () => {
    const saved = localStorage.getItem('artisan_user_enc');
    if (!saved) return undefined;
    try {
        const user = await securityService.decrypt(saved);
        return user?.token;
    } catch {
        return undefined;
    }
};

const DEFAULT_CONTENT: StoreContent = {
    policies: [],
    marketing: {
        banner: { enabled: false, text: '', bgColor: '#000000', textColor: '#ffffff' },
        welcomePopup: { enabled: false, title: '', description: '', delay: 5 },
        exitPopup: { enabled: false, title: '', description: '' },
        ads: { enabled: false, provider: 'custom', placementLocations: [] }
    },
    socials: {},
    navCategories: [],
    branding: { siteName: 'ShipTeez', logoMode: 'text_only', logoScale: 100 },
    theme: {
        primary: '#000000', secondary: '#f4f4f4', accent: '#3b82f6',
        background: '#ffffff', text: '#111827', fontFamily: 'Inter, sans-serif',
        borderRadius: '0.5rem'
    },
    layout: [],
    shipping: { baseRate: 0, additionalItemRate: 0, freeShippingThreshold: 0, enabled: false },
    footer: {
        brandDescription: '', shopHeader: 'Shop', supportHeader: 'Support',
        newsletterHeader: 'Stay in the loop', newsletterText: '', copyrightText: 'All rights reserved.'
    },
    pageText: {
        accountWelcome: 'Hello, {name}', accountSupportIntro: '',
        loginTitle: 'Welcome Back', loginSubtitle: '',
        registerTitle: 'Create Account', registerSubtitle: ''
    },
    emailTemplates: [],
    emailSettings: { senderName: 'ShipTeez', replyToEmail: '' },
    sizeGuides: []
};

export const db = {
    // Products
    getAllProducts: async () => {
        const now = Date.now();
        if (allProductsCache && (now - allProductsTimestamp < CACHE_TTL)) {
            return allProductsCache;
        }

        const s = await settingsService.load();
        try {
            const res = await fetch(`${s.apiUrl}${API_ENDPOINTS.products.list}`);
            if (res.ok) {
                const data = await res.json();
                allProductsCache = data;
                allProductsTimestamp = now;
                // Hydrate individual cache
                data.forEach((p: Product) => productCache.set(p.id, p));
                return data;
            }
        } catch(e) { console.warn('Fetch products failed', e); }
        return [];
    },
    
    // New: Fetch Only IDs for Progressive Loading
    getProductIds: async (): Promise<string[]> => {
        const s = await settingsService.load();
        try {
            const res = await fetch(`${s.apiUrl}${API_ENDPOINTS.products.list}?mode=ids`);
            if (res.ok) {
                return await res.json();
            }
        } catch(e) { console.warn('Fetch product IDs failed', e); }
        return [];
    },

    getProduct: async (id: string) => {
        if (productCache.has(id)) {
            return productCache.get(id);
        }
        
        // Fetch individual product if missing
        const s = await settingsService.load();
        try {
            const res = await fetch(`${s.apiUrl}${API_ENDPOINTS.products.list}/${id}`);
            if (res.ok) {
                const p = await res.json();
                productCache.set(p.id, p);
                return p;
            }
        } catch(e) { 
            // Fallback to searching all cache if individual fetch fails
            if (allProductsCache) {
                return allProductsCache.find((p: Product) => p.id === id || p.slug === id);
            }
        }
        return undefined;
    },

    prefetchProduct: async (id: string) => {
        if (!productCache.has(id)) {
             const s = await settingsService.load();
             fetch(`${s.apiUrl}${API_ENDPOINTS.products.list}/${id}`)
                .then(res => res.json())
                .then(p => productCache.set(p.id, p))
                .catch(() => {});
        }
    },

    saveProduct: async (product: Product) => {
        const s = await settingsService.load();
        const token = await getToken();
        await fetch(`${s.apiUrl}${API_ENDPOINTS.products.list}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify(product)
        });
        // Invalidate cache
        allProductsCache = null;
        productCache.set(product.id, product);
    },

    deleteProducts: async (ids: string[]) => {
        const s = await settingsService.load();
        const token = await getToken();
        await fetch(`${s.apiUrl}${API_ENDPOINTS.products.deleteBatch}`, {
            method: 'DELETE',
            headers: { 
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ ids })
        });
        allProductsCache = null;
        ids.forEach(id => productCache.delete(id));
    },

    getCategories: async () => {
        const s = await settingsService.load();
        return api.getCategories(s);
    },

    // Content
    getStoreContent: async (): Promise<StoreContent> => {
        const s = await settingsService.load();
        let data = {};
        try {
            // Use API service instead of raw fetch
            const json = await api.getStoreContent(s);
            if (json && Object.keys(json).length > 0) data = json;
        } catch (e) {
            console.warn('Fetch content failed', e);
        }
        
        // Deep merge with defaults to ensure UI never breaks on empty DB
        return {
            ...DEFAULT_CONTENT,
            ...data,
            marketing: { ...DEFAULT_CONTENT.marketing, ...(data as any).marketing },
            branding: { ...DEFAULT_CONTENT.branding, ...(data as any).branding },
            theme: { ...DEFAULT_CONTENT.theme, ...(data as any).theme },
            footer: { ...DEFAULT_CONTENT.footer, ...(data as any).footer },
            pageText: { ...DEFAULT_CONTENT.pageText, ...(data as any).pageText },
            shipping: { ...DEFAULT_CONTENT.shipping, ...(data as any).shipping },
            emailSettings: { ...DEFAULT_CONTENT.emailSettings, ...(data as any).emailSettings },
        } as StoreContent;
    },

    saveStoreContent: async (content: StoreContent) => {
        const s = await settingsService.load();
        const token = await getToken();
        // Use API service
        await api.saveStoreContent(s, content, token);
    },

    // Users
    getAllUsers: async () => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.getUsers(s, token);
    },

    updateUser: async (id: string, data: Partial<User> & { password?: string }) => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.updateUser(s, id, data, token);
    },

    toggleUserSuspension: async (id: string, isSuspended: boolean, reason?: string) => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.suspendUser(s, id, isSuspended, reason || '', token);
    },

    deleteUser: async (id: string) => {
        // Not implemented in API yet
    },

    getWallet: async () => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.getWallet(s, token);
    },

    deletePaymentMethod: async (id: string) => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.deletePaymentMethod(s, id, token);
    },

    // Promos
    getAllPromos: async (): Promise<PromoCode[]> => {
        const s = await settingsService.load();
        try {
            const res = await fetch(`${s.apiUrl}${API_ENDPOINTS.promos.list}`);
            if(res.ok) return await res.json();
        } catch {}
        return [];
    },

    savePromo: async (promo: PromoCode) => {
        const s = await settingsService.load();
        const token = await getToken();
        await fetch(`${s.apiUrl}${API_ENDPOINTS.promos.list}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify(promo)
        });
    },

    deletePromo: async (code: string) => {
        // Not implemented on server yet
    },

    trackPromoUsage: async (code: string) => {
        const s = await settingsService.load();
        await fetch(`${s.apiUrl}${API_ENDPOINTS.promos.track}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
    },

    // Newsletter
    subscribeNewsletter: async (email: string) => {
        const s = await settingsService.load();
        return api.subscribeNewsletter(s, email);
    },

    unsubscribeNewsletter: async (email: string) => {
        const s = await settingsService.load();
        return api.unsubscribeNewsletter(s, email);
    },

    getNewsletterSubscribers: async () => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.getNewsletterSubscribers(s, token);
    },

    getUnsubscribers: async () => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.getUnsubscribers(s, token);
    },

    addUnsubscriber: async (email: string) => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.addUnsubscriber(s, email, token);
    },

    removeUnsubscriber: async (email: string) => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.removeUnsubscriber(s, email, token);
    },

    cleanupSubscribers: async (hours: number) => {
        return 0; // Mock
    },

    verifyEmail: async (token: string) => {
        const s = await settingsService.load();
        return api.verifyEmail(s, token);
    },

    // Orders
    createOrder: async (order: Order) => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.createOrder(s, order, token);
    },

    getAllOrders: async () => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.getAllOrders(s, token);
    },

    updateOrder: async (order: Order) => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.createOrder(s, order, token);
    },

    // Tickets
    createTicket: async (subject: string, message: string, orderId?: string) => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.createTicket(s, subject, message, orderId, token);
    },

    getUserTickets: async () => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.getUserTickets(s, token);
    },

    getAdminTickets: async () => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.getAdminTickets(s, token);
    },

    replyTicket: async (id: string, text: string, role: 'user' | 'admin', attachments?: Attachment[]) => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.replyTicket(s, id, text, role, attachments, token);
    },

    updateTicketStatus: async (id: string, status: 'Open' | 'Closed') => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.updateTicketStatus(s, id, status, token);
    },

    // Suspension
    getSuspensionCase: async (userId: string) => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.getSuspensionCase(s, userId, token);
    },

    appealSuspension: async (statement: string) => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.appealSuspension(s, statement, token);
    },

    uploadAppealDoc: async (type: string, file: File) => {
        const s = await settingsService.load();
        const token = await getToken();
        const reader = new FileReader();
        const fileBase64 = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
        });
        return api.uploadAppealDoc(s, type, fileBase64, token);
    },

    resolveAppeal: async (userId: string, action: 'unsuspend' | 'reject', notes: string) => {
        const s = await settingsService.load();
        const token = await getToken();
        return api.resolveAppeal(s, userId, action, notes, token);
    },

    // Analytics (Local Storage)
    logEvent: async (event: AnalyticsEvent) => {
        const events = JSON.parse(localStorage.getItem('artisan_analytics') || '[]');
        events.push(event);
        localStorage.setItem('artisan_analytics', JSON.stringify(events));
    },

    getAnalyticsEvents: async (): Promise<AnalyticsEvent[]> => {
        return JSON.parse(localStorage.getItem('artisan_analytics') || '[]');
    }
};
