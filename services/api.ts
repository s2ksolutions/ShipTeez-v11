
import { AppSettings, User, CaptchaChallenge, SupportTicket, Subscriber, SEOSubmission, Unsubscriber, SuspensionCase, AppealDocument, Order, Attachment, CartItem } from '../types';
import { securityService } from './security';

// Centralized Endpoint Configuration
export const API_ENDPOINTS = {
    auth: {
        login: '/auth/login',
        register: '/auth/register',
        checkEmail: '/auth/check-email',
        google: '/auth/google/callback',
        captcha: '/auth/captcha',
        forgotPassword: '/auth/forgot-password',
        verify: '/auth/verify'
    },
    products: {
        list: '/products',
        categories: '/products/categories',
        detail: (id: string) => `/products/${id}`,
        deleteBatch: '/products/batch-delete',
        clear: '/products/clear',
    },
    tickets: {
        create: '/tickets',
        listUser: '/tickets/user',
        listAdmin: '/tickets/admin',
        reply: (id: string) => `/tickets/${id}/message`,
        status: (id: string) => `/tickets/${id}/status`,
    },
    promos: {
        list: '/promos',
        track: '/promos/track',
        validate: '/promos/validate', // New
        detail: (code: string) => `/promos/${code}`,
    },
    users: {
        list: '/users',
        update: (id: string) => `/users/${id}`,
        suspend: (id: string) => `/users/${id}/suspend`,
        detail: (id: string) => `/users/${id}`,
        wallet: '/users/wallet', // GET list, DELETE /:id
    },
    content: {
        main: '/content'
    },
    settings: {
        main: '/settings',
        public: '/settings/public'
    },
    newsletter: {
        subscribe: '/newsletter/subscribe',
        unsubscribe: '/newsletter/unsubscribe',
        list: '/newsletter',
        unsubscribesList: '/newsletter/unsubscribes'
    },
    orders: {
        create: '/orders',
        list: '/orders', // Admin list or user list
        confirmation: '/orders/confirmation',
        refund: '/orders/refund'
    },
    checkout: {
        process: '/checkout/process',
        intent: '/checkout/intent'
    },
    seo: {
        notify: '/seo/notify'
    },
    system: {
        logs: '/system/logs',
        testDb: '/system/test-db'
    },
    suspension: {
        getCase: (id: string) => `/suspension/case/${id}`,
        appeal: '/suspension/appeal',
        upload: '/suspension/upload',
        resolve: '/suspension/resolve'
    }
};

// Generic Fetch Wrapper
const request = async <T>(
    settings: AppSettings, 
    endpoint: string, 
    options: RequestInit = {}, 
    token?: string
): Promise<T> => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}) 
    };

    const config = {
        cache: 'no-store' as RequestCache, // Ensure no caching
        ...options,
        headers: {
            ...headers,
            ...options.headers,
        },
    };

    // Cache Busting for GET requests
    let finalEndpoint = `${settings.apiUrl}${endpoint}`;
    if (!options.method || options.method === 'GET') {
        const separator = finalEndpoint.includes('?') ? '&' : '?';
        finalEndpoint = `${finalEndpoint}${separator}_t=${Date.now()}`;
    }

    const response = await fetch(finalEndpoint, config);
    
    // Handle non-OK responses
    if (!response.ok) {
        let errorBody;
        try {
            errorBody = await response.json();
        } catch {
            errorBody = { status: response.status, statusText: response.statusText };
        }
        throw { status: response.status, ...errorBody };
    }

    if (response.status === 204) {
        return {} as T;
    }

    return await response.json();
};

export const api = {
    endpoints: API_ENDPOINTS,

    // --- Dynamic Categories ---
    getCategories: (settings: AppSettings) => 
        request<string[]>(settings, API_ENDPOINTS.products.categories),

    // --- Auth ---
    login: async (settings: AppSettings, email: string, password?: string, captchaToken?: string, captchaAnswer?: string, oauthToken?: string) => {
        // Encrypt password client-side before transmission
        const encryptedPassword = password ? await securityService.encrypt(password) : undefined;
        
        return request<{token: string, user: User}>(settings, API_ENDPOINTS.auth.login, {
            method: 'POST',
            body: JSON.stringify({ 
                email, 
                password: encryptedPassword, 
                captchaToken, 
                captchaAnswer,
                oauth_token: oauthToken || ''
            })
        });
    },

    register: async (settings: AppSettings, name: string, email: string, password?: string, captchaToken?: string) => {
        // Encrypt password client-side
        const encryptedPassword = password ? await securityService.encrypt(password) : undefined;

        return request<{token: string, user: User}>(settings, API_ENDPOINTS.auth.register, {
            method: 'POST',
            body: JSON.stringify({ name, email, password: encryptedPassword, captchaToken })
        });
    },

    checkEmail: (settings: AppSettings, email: string) => 
        request<{available: boolean}>(settings, API_ENDPOINTS.auth.checkEmail, {
            method: 'POST',
            body: JSON.stringify({ email })
        }),

    googleLogin: (settings: AppSettings, code: string, redirectUri: string) => 
        request<{token: string, user: User}>(settings, API_ENDPOINTS.auth.google, {
            method: 'POST',
            body: JSON.stringify({ code, redirectUri })
        }),

    getCaptcha: (settings: AppSettings) => 
        request<CaptchaChallenge>(settings, API_ENDPOINTS.auth.captcha, { method: 'POST' }),

    forgotPassword: (settings: AppSettings, email: string) => 
        request<void>(settings, API_ENDPOINTS.auth.forgotPassword, {
            method: 'POST',
            body: JSON.stringify({ email })
        }),

    verifyEmail: (settings: AppSettings, token: string) =>
        request<void>(settings, API_ENDPOINTS.auth.verify, {
            method: 'POST',
            body: JSON.stringify({ token })
        }),

    // --- User Management ---
    getUsers: (settings: AppSettings, token?: string) =>
        request<User[]>(settings, API_ENDPOINTS.users.list, {}, token),

    updateUser: async (settings: AppSettings, id: string, data: Partial<User> & { password?: string }, token?: string) => {
        // Clone to avoid mutating original
        const payload = { ...data };
        if (payload.password) {
            payload.password = await securityService.encrypt(payload.password);
        }

        return request<void>(settings, API_ENDPOINTS.users.update(id), {
            method: 'PUT',
            body: JSON.stringify(payload)
        }, token);
    },

    suspendUser: (settings: AppSettings, id: string, isSuspended: boolean, reason: string, token?: string) => 
        request<void>(settings, API_ENDPOINTS.users.suspend(id), {
            method: 'POST',
            body: JSON.stringify({ isSuspended, reason })
        }, token),

    getWallet: (settings: AppSettings, token?: string) =>
        request<any[]>(settings, API_ENDPOINTS.users.wallet, {}, token),

    deletePaymentMethod: (settings: AppSettings, paymentMethodId: string, token?: string) =>
        request<void>(settings, API_ENDPOINTS.users.wallet + `/${paymentMethodId}`, { method: 'DELETE' }, token),

    // --- Support Tickets ---
    createTicket: (settings: AppSettings, subject: string, message: string, orderId?: string, token?: string) => 
        request<{id: string}>(settings, API_ENDPOINTS.tickets.create, {
            method: 'POST',
            body: JSON.stringify({ subject, message, orderId })
        }, token),

    getUserTickets: (settings: AppSettings, token?: string) => 
        request<SupportTicket[]>(settings, API_ENDPOINTS.tickets.listUser, {}, token),

    getAdminTickets: (settings: AppSettings, token?: string) => 
        request<SupportTicket[]>(settings, API_ENDPOINTS.tickets.listAdmin, {}, token),

    replyTicket: (settings: AppSettings, ticketId: string, text: string, role: 'user' | 'admin', attachments?: Attachment[], token?: string) => 
        request<void>(settings, API_ENDPOINTS.tickets.reply(ticketId), {
            method: 'POST',
            body: JSON.stringify({ text, role, attachments })
        }, token),

    updateTicketStatus: (settings: AppSettings, ticketId: string, status: 'Open' | 'Closed', token?: string) => 
        request<void>(settings, API_ENDPOINTS.tickets.status(ticketId), {
            method: 'POST',
            body: JSON.stringify({ status })
        }, token),
        
    // --- Settings & Content ---
    saveSettings: (settings: AppSettings, data: AppSettings, token?: string) =>
        request<void>(settings, API_ENDPOINTS.settings.main, {
            method: 'POST',
            body: JSON.stringify(data)
        }, token),

    getSettings: (settings: AppSettings, token?: string) =>
        request<Partial<AppSettings>>(settings, API_ENDPOINTS.settings.main, {}, token),

    getPublicSettings: (settings: AppSettings) =>
        request<Partial<AppSettings>>(settings, API_ENDPOINTS.settings.public),

    // --- Newsletter ---
    subscribeNewsletter: (settings: AppSettings, email: string) =>
        request<void>(settings, API_ENDPOINTS.newsletter.subscribe, {
            method: 'POST',
            body: JSON.stringify({ email })
        }),

    unsubscribeNewsletter: (settings: AppSettings, email: string) =>
        request<void>(settings, API_ENDPOINTS.newsletter.unsubscribe, {
            method: 'POST',
            body: JSON.stringify({ email })
        }),

    getNewsletterSubscribers: (settings: AppSettings, token?: string) =>
        request<Subscriber[]>(settings, API_ENDPOINTS.newsletter.list, {}, token),

    getUnsubscribers: (settings: AppSettings, token?: string) =>
        request<Unsubscriber[]>(settings, API_ENDPOINTS.newsletter.unsubscribesList, {}, token),

    addUnsubscriber: (settings: AppSettings, email: string, token?: string) =>
        request<void>(settings, API_ENDPOINTS.newsletter.unsubscribesList, {
            method: 'POST',
            body: JSON.stringify({ email })
        }, token),

    removeUnsubscriber: (settings: AppSettings, email: string, token?: string) =>
        request<void>(settings, API_ENDPOINTS.newsletter.unsubscribesList, {
            method: 'DELETE',
            body: JSON.stringify({ email })
        }, token),

    // --- Promos ---
    validatePromo: (settings: AppSettings, code: string) =>
        request<{valid: boolean, type?: 'percentage' | 'fixed', value?: number, error?: string}>(settings, API_ENDPOINTS.promos.validate, {
            method: 'POST',
            body: JSON.stringify({ code })
        }),

    // --- Payments & Orders ---
    createOrder: (settings: AppSettings, order: Order, token?: string) =>
        request<void>(settings, API_ENDPOINTS.orders.create, {
            method: 'POST',
            body: JSON.stringify(order)
        }, token),

    getAllOrders: (settings: AppSettings, token?: string) =>
        request<Order[]>(settings, API_ENDPOINTS.orders.list, {}, token),

    createPaymentIntent: (settings: AppSettings, items: CartItem[], promoCode?: string, paymentIntentId?: string, customerEmail?: string) =>
        request<{clientSecret: string, id: string}>(settings, API_ENDPOINTS.checkout.intent, {
            method: 'POST',
            body: JSON.stringify({ items, promoCode, paymentIntentId, customerEmail })
        }),

    processPayment: (
        settings: AppSettings, 
        paymentMethodId: string | undefined, 
        items: CartItem[], // Send full items, not just total
        promoCode: string | undefined,
        customerEmail: string, 
        saveCard: boolean, 
        token?: string,
        paymentIntentId?: string
    ) =>
        request<{success: boolean, chargeId: string, paymentIntentId: string, isFraudSuspect: boolean, fraudScore: number, verifiedTotal: number}>(settings, API_ENDPOINTS.checkout.process, {
            method: 'POST',
            body: JSON.stringify({ paymentMethodId, items, promoCode, customerEmail, saveCard, paymentIntentId })
        }, token),

    refundOrder: (settings: AppSettings, orderId: string, amount: number, token?: string) =>
        request<void>(settings, API_ENDPOINTS.orders.refund, {
            method: 'POST',
            body: JSON.stringify({ orderId, amount })
        }, token),

    sendOrderConfirmation: (settings: AppSettings, email: string, orderId: string, name: string, total: number, trackingNumber?: string) =>
        request<void>(settings, API_ENDPOINTS.orders.confirmation, {
            method: 'POST',
            body: JSON.stringify({ email, orderId, name, total, trackingNumber })
        }),

    // --- SEO ---
    notifySEO: async (settings: AppSettings, targets: string[], token?: string): Promise<SEOSubmission[]> => {
        try {
            return await request<SEOSubmission[]>(settings, API_ENDPOINTS.seo.notify, {
                method: 'POST',
                body: JSON.stringify({ targets })
            }, token);
        } catch (e) {
            console.warn("SEO Endpoint unavailable or failed, returning mock success for demo.", e);
            // Fallback Simulation for demo environments where backend might be offline
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve(targets.map(t => ({
                        target: t as any,
                        status: 'success',
                        lastSubmitted: Date.now(),
                        details: 'Simulated submission (Backend unavailable)'
                    })));
                }, 800);
            });
        }
    },

    // --- System Debugging ---
    getSystemLogs: (settings: AppSettings, token?: string) => 
        request<{id: number, timestamp: string, type: string, message: string}[]>(settings, API_ENDPOINTS.system.logs, {}, token),

    testDatabaseConnection: (settings: AppSettings, token?: string) => 
        request<any>(settings, API_ENDPOINTS.system.testDb, { method: 'POST' }, token),

    // --- Suspension System ---
    getSuspensionCase: (settings: AppSettings, userId: string, token?: string) =>
        request<SuspensionCase>(settings, API_ENDPOINTS.suspension.getCase(userId), {}, token),

    appealSuspension: (settings: AppSettings, statement: string, token?: string) =>
        request<void>(settings, API_ENDPOINTS.suspension.appeal, {
            method: 'POST',
            body: JSON.stringify({ statement })
        }, token),

    uploadAppealDoc: (settings: AppSettings, type: string, fileBase64: string, token?: string) =>
        request<{success: true, document: AppealDocument}>(settings, API_ENDPOINTS.suspension.upload, {
            method: 'POST',
            body: JSON.stringify({ type, fileBase64 })
        }, token),

    resolveAppeal: (settings: AppSettings, userId: string, action: 'unsuspend' | 'reject', notes: string, token?: string) =>
        request<void>(settings, API_ENDPOINTS.suspension.resolve, {
            method: 'POST',
            body: JSON.stringify({ userId, action, notes })
        }, token),
};
