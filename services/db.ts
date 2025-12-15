import { Product, Order, User, StoreContent, SupportTicket, PromoCode, Subscriber, Unsubscriber, AnalyticsEvent, SuspensionCase, AppealDocument, Attachment } from '../types';
import { settingsService } from './settings';
import { API_ENDPOINTS, api } from './api';

let allProductsCache: Product[] | null = null;
let allProductsTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const productCache = new Map<string, Product>();

// Helper to get current user token from local storage
async function getUser() {
    const saved = localStorage.getItem('artisan_user_enc') || sessionStorage.getItem('artisan_user_enc');
    if (!saved) return null;
    try {
        const { securityService } = await import('./security');
        return await securityService.decrypt(saved);
    } catch {
        return null;
    }
}

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
        const user = await getUser();
        await fetch(`${s.apiUrl}${API_ENDPOINTS.products.list}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user?.token}` },
            body: JSON.stringify(product)
        });
        // Invalidate cache
        allProductsCache = null;
        productCache.set(product.id, product);
    },
    deleteProducts: async (ids: string[]) => {
        const s = await settingsService.load();
        const user = await getUser();
        await fetch(`${s.apiUrl}${API_ENDPOINTS.products.deleteBatch}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user?.token}` },
            body: JSON.stringify({ ids })
        });
        allProductsCache = null;
        ids.forEach(id => productCache.delete(id));
    },

    // Categories
    getCategories: async () => {
        const s = await settingsService.load();
        return api.getCategories(s);
    },

    // Content
    getStoreContent: async (): Promise<StoreContent> => {
        const s = await settingsService.load();
        const res = await fetch(`${s.apiUrl}${API_ENDPOINTS.content.main}`);
        if (!res.ok) return {} as any;
        return await res.json();
    },
    saveStoreContent: async (content: StoreContent) => {
        const s = await settingsService.load();
        const user = await getUser();
        await fetch(`${s.apiUrl}${API_ENDPOINTS.content.main}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user?.token}` },
            body: JSON.stringify(content)
        });
    },

    // Users
    getAllUsers: async () => {
        const s = await settingsService.load();
        const user = await getUser();
        return api.getUsers(s, user?.token);
    },
    updateUser: async (id: string, data: Partial<User> & { password?: string }) => {
        const s = await settingsService.load();
        const user = await getUser();
        await api.updateUser(s, id, data, user?.token);
    },
    deleteUser: async (id: string) => {
        const s = await settingsService.load();
        const user = await getUser();
        await fetch(`${s.apiUrl}/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${user?.token}` }
        });
    },
    toggleUserSuspension: async (id: string, isSuspended: boolean, reason: string = '') => {
        const s = await settingsService.load();
        const user = await getUser();
        await api.suspendUser(s, id, isSuspended, reason, user?.token);
    },
    verifyEmail: async (token: string) => {
        const s = await settingsService.load();
        await api.verifyEmail(s, token);
    },

    // Orders
    getAllOrders: async () => {
        const s = await settingsService.load();
        const user = await getUser();
        return api.getAllOrders(s, user?.token);
    },
    createOrder: async (order: Order) => {
        const s = await settingsService.load();
        const user = await getUser();
        await api.createOrder(s, order, user?.token);
    },
    updateOrder: async (order: Order) => {
        // Use createOrder as upsert
        const s = await settingsService.load();
        const user = await getUser();
        await api.createOrder(s, order, user?.token);
    },

    // Promos
    getAllPromos: async () => {
        const s = await settingsService.load();
        const res = await fetch(`${s.apiUrl}${API_ENDPOINTS.promos.list}`);
        return await res.json();
    },
    savePromo: async (promo: PromoCode) => {
        const s = await settingsService.load();
        const user = await getUser();
        await fetch(`${s.apiUrl}${API_ENDPOINTS.promos.list}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user?.token}` },
            body: JSON.stringify(promo)
        });
    },
    deletePromo: async (code: string) => {
        const s = await settingsService.load();
        const user = await getUser();
        await fetch(`${s.apiUrl}${API_ENDPOINTS.promos.list}/${code}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${user?.token}` }
        });
    },
    trackPromoUsage: async (code: string) => {
        const s = await settingsService.load();
        await fetch(`${s.apiUrl}${API_ENDPOINTS.promos.track}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
    },

    // Tickets
    getUserTickets: async () => {
        const s = await settingsService.load();
        const user = await getUser();
        if (!user) return [];
        return api.getUserTickets(s, user.token);
    },
    getAdminTickets: async () => {
        const s = await settingsService.load();
        const user = await getUser();
        return api.getAdminTickets(s, user?.token);
    },
    createTicket: async (subject: string, message: string, orderId?: string) => {
        const s = await settingsService.load();
        const user = await getUser();
        return api.createTicket(s, subject, message, orderId, user?.token);
    },
    replyTicket: async (id: string, text: string, role: 'user' | 'admin', attachments?: Attachment[]) => {
        const s = await settingsService.load();
        const user = await getUser();
        return api.replyTicket(s, id, text, role, attachments, user?.token);
    },
    updateTicketStatus: async (id: string, status: 'Open' | 'Closed') => {
        const s = await settingsService.load();
        const user = await getUser();
        return api.updateTicketStatus(s, id, status, user?.token);
    },

    // Marketing
    getNewsletterSubscribers: async () => {
        const s = await settingsService.load();
        const user = await getUser();
        return api.getNewsletterSubscribers(s, user?.token);
    },
    subscribeNewsletter: async (email: string) => {
        const s = await settingsService.load();
        return api.subscribeNewsletter(s, email);
    },
    unsubscribeNewsletter: async (email: string) => {
        const s = await settingsService.load();
        return api.unsubscribeNewsletter(s, email);
    },
    getUnsubscribers: async () => {
        const s = await settingsService.load();
        const user = await getUser();
        return api.getUnsubscribers(s, user?.token);
    },
    addUnsubscriber: async (email: string) => {
        const s = await settingsService.load();
        const user = await getUser();
        return api.addUnsubscriber(s, email, user?.token);
    },
    removeUnsubscriber: async (email: string) => {
        const s = await settingsService.load();
        const user = await getUser();
        return api.removeUnsubscriber(s, email, user?.token);
    },
    cleanupSubscribers: async (hours: number) => {
        // Not implemented in API yet, returning 0
        return 0;
    },

    // Analytics
    logEvent: async (event: AnalyticsEvent) => {
        // Implement local logging or send to endpoint
        // For now, no-op or console log in dev
        if (process.env.NODE_ENV === 'development') {
            // console.log('Analytics Event:', event);
        }
    },
    getAnalyticsEvents: async (): Promise<AnalyticsEvent[]> => {
        return [];
    },

    // Wallet
    getWallet: async () => {
        const s = await settingsService.load();
        const user = await getUser();
        return api.getWallet(s, user?.token);
    },
    deletePaymentMethod: async (id: string) => {
        const s = await settingsService.load();
        const user = await getUser();
        return api.deletePaymentMethod(s, id, user?.token);
    },

    // Suspension
    getSuspensionCase: async (userId: string) => {
        const s = await settingsService.load();
        const user = await getUser();
        return api.getSuspensionCase(s, userId, user?.token);
    },
    appealSuspension: async (statement: string) => {
        const s = await settingsService.load();
        const user = await getUser();
        return api.appealSuspension(s, statement, user?.token);
    },
    uploadAppealDoc: async (type: string, file: File) => {
        const s = await settingsService.load();
        const user = await getUser();
        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
        });
        return api.uploadAppealDoc(s, type, base64, user?.token);
    },
    resolveAppeal: async (userId: string, action: 'unsuspend' | 'reject', notes: string) => {
        const s = await settingsService.load();
        const user = await getUser();
        return api.resolveAppeal(s, userId, action, notes, user?.token);
    }
};