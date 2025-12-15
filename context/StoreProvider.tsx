import React, { useState, useEffect, createContext, useContext } from 'react';
import { Product, CartItem, User, Order, AppSettings, StoreContent, CaptchaChallenge, ToastMessage, Address } from '../types';
import { securityService } from '../services/security';
import { settingsService } from '../services/settings';
import { db } from '../services/db';
import { api } from '../services/api';
import { generateUUID } from '../utils';

// --- Context Definition ---

export interface StoreContextType {
    cart: CartItem[];
    isCartOpen: boolean;
    openCart: () => void;
    closeCart: () => void;
    addToCart: (product: Product, quantity: number, size?: string, color?: string, openDrawer?: boolean) => void;
    removeFromCart: (cartItemId: string) => void;
    updateQuantity: (cartItemId: string, delta: number) => void;
    clearCart: () => void;
    cartTotal: number;
    wishlist: Set<string>;
    isWishlistOpen: boolean;
    openWishlist: () => void;
    closeWishlist: () => void;
    toggleWishlist: (productId: string) => void;
    clearWishlist: () => void;
    isInWishlist: (productId: string) => boolean;
    user: User | null;
    login: (email: string, password?: string, captchaToken?: string, captchaAnswer?: string, rememberMe?: boolean, oauthToken?: string) => Promise<User | null>;
    loginWithGoogle: (code: string) => Promise<void>;
    register: (name: string, email: string, password?: string, captchaToken?: string) => Promise<User>; // Updated Signature
    checkEmail: (email: string) => Promise<boolean>;
    forgotPassword: (email: string) => Promise<void>;
    getCaptcha: () => Promise<CaptchaChallenge>;
    logout: () => void;
    placeOrder: (details: any, appliedPromoCode?: string, userIdOverride?: string, paymentMetadata?: any) => Promise<string>;
    updateUserAddresses: (addresses: Address[]) => Promise<void>;
    settings: AppSettings | null;
    content: StoreContent | null;
    activeCategories: string[];
    applyPromo: (code: string) => Promise<number>;
    refreshContent: () => Promise<void>;
    refreshSettings: () => Promise<void>;
    toast: ToastMessage | null;
    showToast: (message: string, type?: 'success' | 'error') => void;
    hideToast: () => void;
    isLoginModalOpen: boolean;
    setLoginModalOpen: (isOpen: boolean) => void;
    authView: 'login' | 'register' | 'forgot';
    openAuthModal: (view?: 'login' | 'register' | 'forgot') => void;
    isLoading: boolean; // Global loading state
    unreadMessageCount: number;
    refreshUnreadMessages: () => Promise<void>;
    savedPromoCode: string | null;
    savePromoCode: (code: string | null) => void;
}

export const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const useStore = () => {
    const context = useContext(StoreContext);
    if (!context) throw new Error("useStore must be used within StoreProvider");
    return context;
};

// --- Provider Implementation ---

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isWishlistOpen, setIsWishlistOpen] = useState(false);
    const [isLoginModalOpen, setLoginModalOpen] = useState(false);
    const [authView, setAuthView] = useState<'login' | 'register' | 'forgot'>('login');
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [content, setContent] = useState<StoreContent | null>(null);
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);
    const [savedPromoCode, setSavedPromoCodeState] = useState<string | null>(null);
    
    // Initialize activeCategories from localStorage for instant load
    const [activeCategories, setActiveCategories] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('artisan_categories');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    const [user, setUser] = useState<User | null>(null);
    const [toast, setToast] = useState<ToastMessage | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Initial Load & Analytics Init
    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            try {
                await refreshSettings();
                await refreshContent();
                
                // Load Encrypted User Session (Check Local then Session)
                let saved = localStorage.getItem('artisan_user_enc');
                if (!saved) saved = sessionStorage.getItem('artisan_user_enc');

                if (saved) {
                    const decryptedUser = await securityService.decrypt(saved);
                    if (decryptedUser) {
                        // Ensure orders/addresses array exists
                        setUser({ ...decryptedUser, orders: decryptedUser.orders || [], addresses: decryptedUser.addresses || [] });
                        // Fetch unread messages
                        refreshUnreadMessages();
                    }
                }

                // Load saved promo
                const promo = sessionStorage.getItem('artisan_saved_promo');
                if (promo) setSavedPromoCodeState(promo);

                // Capture UTMs
                const params = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search);
                const utmSource = params.get('utm_source');
                const utmCampaign = params.get('utm_campaign');
                const utmMedium = params.get('utm_medium');
                
                if (utmSource || utmCampaign) {
                    const analyticsData = { utmSource, utmCampaign, utmMedium, timestamp: Date.now() };
                    sessionStorage.setItem('artisan_utm', JSON.stringify(analyticsData));
                }

                // Track Visit
                const hasVisited = sessionStorage.getItem('artisan_visit_logged');
                if (!hasVisited) {
                    const storedUtm = sessionStorage.getItem('artisan_utm');
                    const utmData = storedUtm ? JSON.parse(storedUtm) : {};
                    try {
                        await db.logEvent({
                            id: generateUUID(),
                            type: 'visit',
                            timestamp: Date.now(),
                            source: utmData.utmSource || 'direct',
                            campaign: utmData.utmCampaign,
                            medium: utmData.utmMedium
                        });
                        sessionStorage.setItem('artisan_visit_logged', 'true');
                    } catch (e) {
                        console.warn("Analytics failed to init", e);
                    }
                }
            } catch (e) {
                console.error("Initialization failed", e);
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, []);

    // Polling for unread messages if logged in
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (user) {
            refreshUnreadMessages();
            interval = setInterval(refreshUnreadMessages, 30000); // Check every 30s
        }
        return () => clearInterval(interval);
    }, [user?.id]);

    const refreshUnreadMessages = async () => {
        try {
            const tickets = await db.getUserTickets();
            const count = tickets.filter(t => t.isRead === false).length;
            setUnreadMessageCount(count);
        } catch(e) {
            // silent fail
        }
    };

    // Cache categories whenever they change
    useEffect(() => {
        if (activeCategories.length > 0) {
            localStorage.setItem('artisan_categories', JSON.stringify(activeCategories));
        }
    }, [activeCategories]);

    const refreshSettings = async () => {
        try {
            const s = await settingsService.load();
            setSettings(s);
        } catch(e) {
            console.warn("Settings load failed", e);
        }
    };

    const refreshContent = async () => {
        try {
            // Parallel fetch for speed
            const [c, cats] = await Promise.all([
                db.getStoreContent(),
                db.getCategories()
            ]);
            setContent(c);
            setActiveCategories(cats);
        } catch (e) {
            console.warn("Content load failed", e);
        }
    };

    useEffect(() => {
        const saved = localStorage.getItem('artisan_cart');
        if (saved) setCart(JSON.parse(saved));
    }, []);

    useEffect(() => {
        try {
            // Helper to strip heavy assets from cart persistence
            const cleanCart = cart.map(item => {
                const { designAsset, ...rest } = item;
                return rest;
            });
            localStorage.setItem('artisan_cart', JSON.stringify(cleanCart));
        } catch (e) {
            console.warn("Failed to persist cart to localStorage (Quota Exceeded)", e);
        }
    }, [cart]);

    // Toast Helpers
    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
    };
    const hideToast = () => setToast(null);

    // Cart Logic
    const addToCart = (product: Product, quantity: number, size?: string, color?: string, openDrawer: boolean = true) => {
        setCart(prev => {
            const existingIndex = prev.findIndex(item => 
                item.id === product.id && item.selectedSize === size && item.selectedColor === color
            );
            if (existingIndex > -1) {
                const newCart = [...prev];
                newCart[existingIndex].quantity += quantity;
                return newCart;
            } else {
                return [...prev, { ...product, quantity, selectedSize: size, selectedColor: color, cartItemId: `${product.id}-${Date.now()}` }];
            }
        });
        showToast(`Added ${product.title} to cart`);
        if (openDrawer) {
            setIsWishlistOpen(false); // Close wishlist if open
            setIsCartOpen(true);
        }
    };

    const removeFromCart = (cartItemId: string) => {
        setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
    };

    const updateQuantity = (cartItemId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.cartItemId === cartItemId) {
                const newQty = item.quantity + delta;
                return newQty > 0 ? { ...item, quantity: newQty } : item;
            }
            return item;
        }));
    };

    const clearCart = () => setCart([]);
    const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    // Wishlist Logic
    const [wishlist, setWishlist] = useState<Set<string>>(new Set());
    
    useEffect(() => {
        const saved = localStorage.getItem('artisan_wishlist');
        if (saved) setWishlist(new Set(JSON.parse(saved)));
    }, []);
    
    useEffect(() => {
        localStorage.setItem('artisan_wishlist', JSON.stringify(Array.from(wishlist)));
    }, [wishlist]);
    
    const toggleWishlist = (productId: string) => {
        setWishlist(prev => {
            const next = new Set(prev);
            if (next.has(productId)) {
                next.delete(productId);
                showToast("Removed from Wishlist");
            } else {
                next.add(productId);
                showToast("Added to Wishlist");
            }
            return next;
        });
    };

    const clearWishlist = () => {
        setWishlist(new Set());
        showToast("Wishlist cleared");
    };
    
    const isInWishlist = (productId: string) => wishlist.has(productId);

    // --- AUTH LOGIC ---
    
    const openAuthModal = (view: 'login' | 'register' | 'forgot' = 'login') => {
        setAuthView(view);
        setLoginModalOpen(true);
    };

    const persistUser = async (u: User | null, remember: boolean = true) => {
        if (u) {
            // Ensure array fields exist before saving
            const userState = { 
                ...u, 
                orders: u.orders || [],
                addresses: u.addresses || [] 
            };
            
            // Set State Immediately with full data
            setUser(userState);
            refreshUnreadMessages();

            // Prepare for Storage
            const storageUser = {
                ...userState,
                orders: userState.orders.map(order => ({
                    ...order,
                    items: order.items.map(item => {
                        const { images, designAsset, ...rest } = item;
                        const keepImages = (images && images[0] && images[0].length < 500) ? [images[0]] : []; 
                        return { ...rest, images: keepImages };
                    })
                }))
            };

            try {
                const encrypted = await securityService.encrypt(storageUser);
                if (remember) {
                    localStorage.setItem('artisan_user_enc', encrypted);
                    sessionStorage.removeItem('artisan_user_enc'); // Clean up opposite
                } else {
                    sessionStorage.setItem('artisan_user_enc', encrypted);
                    localStorage.removeItem('artisan_user_enc'); // Clean up opposite
                }
            } catch (e) {
                console.error("Failed to save user session", e);
            }
        } else {
            localStorage.removeItem('artisan_user_enc');
            sessionStorage.removeItem('artisan_user_enc');
            setUser(null);
            setUnreadMessageCount(0);
        }
    };

    const login = async (email: string, password?: string, captchaToken?: string, captchaAnswer?: string, rememberMe: boolean = true, oauthToken?: string): Promise<User | null> => {
        if (!settings) return null;
        try {
            // ✅ Pass oauthToken to api.login
            const data = await api.login(settings, email, password, captchaToken, captchaAnswer, oauthToken);
            if (data.token && data.user) {
                await persistUser({ ...data.user, token: data.token, orders: data.user.orders || [], addresses: data.user.addresses || [] }, rememberMe);
                return data.user;
            }
            return null;
        } catch (e: any) {
            throw e;
        }
    };

    const loginWithGoogle = async (code: string) => {
        if (!settings) return;
        try {
            const redirectUri = window.location.origin + '/auth/callback';
            const data = await api.googleLogin(settings, code, redirectUri);
            if(data.token && data.user) {
                await persistUser({ ...data.user, token: data.token, orders: data.user.orders || [], addresses: data.user.addresses || [] }, true);
            }
        } catch (e) {
            throw e;
        }
    };

    const register = async (name: string, email: string, password?: string, captchaToken?: string): Promise<User> => {
        if (!settings) throw new Error("System not ready");
        try {
            const data = await api.register(settings, name, email, password, captchaToken);
            if(data.token && data.user) {
                const newUser = { ...data.user, token: data.token, orders: [], addresses: [] };
                await persistUser(newUser); // Registers typically default to persistent, or modify API to accept flag
                return newUser;
            }
            throw new Error("Registration failed");
        } catch (e: any) {
            console.warn("Register failed", e);
            throw e;
        }
    };

    const updateUserAddresses = async (addresses: Address[]) => {
        if(!user) return;
        // Optimistic update
        const updatedUser = { ...user, addresses };
        // Check where current user session is stored to update correct storage
        const remember = !!localStorage.getItem('artisan_user_enc');
        await persistUser(updatedUser, remember);
        
        // Background sync
        try {
            await db.updateUser(user.id, { addresses: addresses as any }); 
        } catch(e: any) {
            // Log readable error if API returns object
            const msg = e.error || e.message || (typeof e === 'string' ? e : JSON.stringify(e));
            console.error("Failed to sync addresses", msg);
        }
    };

    const checkEmail = async (email: string): Promise<boolean> => {
        if (!settings) return true;
        try {
            const res = await api.checkEmail(settings, email);
            return res.available;
        } catch (e) {
            return true; 
        }
    };

    const forgotPassword = async (email: string) => {
        if (!settings) return;
        try {
            await api.forgotPassword(settings, email);
        } catch (e) {
            console.warn("ForgotPassword failed", e);
        }
    };

    const getCaptcha = async (): Promise<CaptchaChallenge> => {
        if(!settings) return { token: '', challenge: '' };
        try {
            return await api.getCaptcha(settings);
        } catch (e) {
            return { token: '', challenge: '' };
        }
    };

    const logout = () => persistUser(null);

    // SECURE PROMO VALIDATION
    const applyPromo = async (code: string): Promise<number> => {
        if (!settings || !code) return 0;
        
        // Use cart state directly within provider scope to ensure freshness
        const currentTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

        try {
            const res = await api.validatePromo(settings, code);
            
            if (res.valid && res.value !== undefined) {
                if (res.type === 'fixed') {
                    // Cap discount at total amount (can't go below zero)
                    return Math.min(res.value, currentTotal);
                } else {
                    // Percentage
                    return (currentTotal * res.value) / 100;
                }
            } else {
                if (res.error) console.warn("Promo Error:", res.error);
                return 0; // Invalid
            }
        } catch (e) {
            console.error("Promo validation failed", e);
            return 0;
        }
    };

    const savePromoCode = (code: string | null) => {
        setSavedPromoCodeState(code);
        if (code) {
            sessionStorage.setItem('artisan_saved_promo', code);
        } else {
            sessionStorage.removeItem('artisan_saved_promo');
        }
    };

    const placeOrder = async (details: any, appliedPromoCode?: string, userIdOverride?: string, paymentMetadata?: any): Promise<string> => {
        const orderId = `ORD-${Date.now().toString().slice(-6)}`;
        
        // Re-calculate discount securely before finalising order object state
        let discount = 0;
        if(appliedPromoCode) {
            // Note: In production, backend does final recalc. This is for optimistic UI update.
            discount = await applyPromo(appliedPromoCode);
            await db.trackPromoUsage(appliedPromoCode);
        }

        const storedUtm = sessionStorage.getItem('artisan_utm');
        const utmData = storedUtm ? JSON.parse(storedUtm) : {};
        const finalTotal = Math.max(0, cartTotal - discount);

        // Use override if provided (e.g. newly registered), otherwise current user state
        const targetUserId = userIdOverride || user?.id;

        const newOrder: Order = {
            id: orderId,
            date: Date.now(),
            total: finalTotal,
            status: paymentMetadata?.isFraudSuspect ? 'On Hold' : 'Processing', // Flag fraud
            items: [...cart],
            shippingAddress: details.address ? `${details.address}, ${details.city}, ${details.zip}` : undefined,
            billingAddress: details.billingAddress ? `${details.billingAddress}, ${details.billingCity}, ${details.billingZip}` : undefined,
            discountApplied: discount,
            promoCode: appliedPromoCode,
            customerName: details.name,
            customerEmail: details.email,
            userId: targetUserId, // Link to user if known
            utmSource: utmData.utmSource,
            utmCampaign: utmData.utmCampaign,
            utmMedium: utmData.utmMedium,
            stripeChargeId: paymentMetadata?.chargeId,
            stripePaymentIntentId: paymentMetadata?.paymentIntentId,
            isFraudSuspect: paymentMetadata?.isFraudSuspect,
            fraudScore: paymentMetadata?.fraudScore
        };
        
        // --- Save to Backend DB ---
        try {
            await db.createOrder(newOrder);
        } catch(e) {
            console.error("Critical: Failed to persist order to DB", e);
            // We continue so the user sees success, but log error. 
            // In real app, this should queue for retry.
        }

        // If logged in (or just registered), save order history to local state
        if (targetUserId && user) {
            const currentOrders = user.orders || [];
            // Respect storage persistence preference
            const remember = !!localStorage.getItem('artisan_user_enc');
            await persistUser({ ...user, orders: [newOrder, ...currentOrders] }, remember);
        } 
        
        // For guest, save to local storage for "remember me" functionality on next visit
        if (!targetUserId) {
            localStorage.setItem('guest_shipping_info', JSON.stringify({
                name: details.name,
                email: details.email,
                address: details.address,
                city: details.city,
                zip: details.zip
            }));
        }

        if (settings) {
            try {
                await api.sendOrderConfirmation(settings, details.email, orderId, details.name, finalTotal);
            } catch (e) {
                console.error("Failed to trigger order confirmation email", e);
            }
        }

        try {
            await db.logEvent({
                id: generateUUID(),
                type: 'conversion',
                timestamp: Date.now(),
                orderId: orderId,
                revenue: newOrder.total,
                source: utmData.utmSource || 'direct',
                campaign: utmData.utmCampaign,
                medium: utmData.utmMedium
            });
        } catch(e) { console.warn("Analytics error", e); }

        clearCart();
        // Clear saved promo logic after successful order
        savePromoCode(null);
        return orderId;
    };

    return (
        <StoreContext.Provider value={{
            cart, isCartOpen, openCart: () => { setIsWishlistOpen(false); setIsCartOpen(true); }, closeCart: () => setIsCartOpen(false),
            addToCart, removeFromCart, updateQuantity, clearCart, cartTotal,
            wishlist, isWishlistOpen, openWishlist: () => { setIsCartOpen(false); setIsWishlistOpen(true); }, closeWishlist: () => setIsWishlistOpen(false), toggleWishlist, clearWishlist, isInWishlist,
            user, login, loginWithGoogle, register, checkEmail, forgotPassword, getCaptcha, logout, 
            placeOrder, updateUserAddresses, settings, content, activeCategories, 
            applyPromo, refreshContent, refreshSettings,
            toast, showToast, hideToast,
            isLoginModalOpen, setLoginModalOpen,
            authView, openAuthModal,
            isLoading,
            unreadMessageCount, refreshUnreadMessages,
            savedPromoCode, savePromoCode
        }}>
            {children}
        </StoreContext.Provider>
    );
};