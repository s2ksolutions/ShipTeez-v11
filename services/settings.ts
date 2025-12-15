
import { AppSettings } from '../types';
import { securityService } from './security';
import { api } from './api';

const STORAGE_KEY = 'artisan_app_settings_enc'; 

// Load defaults primarily from environment variables
const DEFAULT_SETTINGS: AppSettings = {
    mode: 'remote',
    apiUrl: process.env.API_URL || 'https://shipteez.com/api', 
    apiKey: process.env.API_KEY || '',
    dbType: (process.env.DB_TYPE as any) || 'sqlite', 
    databaseUrl: process.env.DATABASE_URL || '',
    redisUrl: process.env.REDIS_URL || '',
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: parseInt(process.env.SMTP_PORT || '587'),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    adminPreferences: {
        autoScrollLog: true
    }
};

// Helper to get token for internal calls
const getUserToken = async (): Promise<string | undefined> => {
    const saved = localStorage.getItem('artisan_user_enc');
    if (!saved) return undefined;
    try {
        const user = await securityService.decrypt(saved);
        return user?.token;
    } catch {
        return undefined;
    }
};

export const settingsService = {
    load: async (): Promise<AppSettings> => {
        let localSettings = DEFAULT_SETTINGS;
        const saved = localStorage.getItem(STORAGE_KEY);
        
        // Load any user-overridden settings from local storage, merging with defaults
        if (saved) {
            try {
                const decrypted = await securityService.decrypt(saved);
                localSettings = decrypted ? { ...DEFAULT_SETTINGS, ...decrypted } : DEFAULT_SETTINGS;
            } catch {
                // Keep default
            }
        }

        try {
            // 1. Fetch Public Settings (Google Client ID, etc) - No Auth Required
            try {
                const publicSettings = await api.getPublicSettings(localSettings);
                localSettings = { ...localSettings, ...publicSettings };
            } catch (publicErr) {
                console.warn("Could not fetch public settings (API might be down or unreachable)", publicErr);
            }

            // 2. Fetch Admin Settings (Secrets) - Only if logged in as admin
            const token = await getUserToken();
            const isMockToken = token && (token.includes('mock') || token.split('.').length !== 3);

            if (token && !isMockToken) {
                try {
                    const remoteSettings = await api.getSettings(localSettings, token);
                    return { 
                        ...localSettings, 
                        ...remoteSettings,
                        apiUrl: localSettings.apiUrl 
                    };
                } catch (authErr: any) {
                    if (authErr.status === 401 || authErr.status === 403) {
                        console.warn("Remote auth failed during settings load (token invalid or expired). Ignoring admin settings.");
                    } else {
                        throw authErr;
                    }
                }
            }
        } catch (e) {
            console.warn("Failed to load remote settings, using local cache", e);
        }

        return localSettings;
    },

    getSyncFallback: (): AppSettings => {
        return DEFAULT_SETTINGS;
    },

    save: async (settings: AppSettings) => {
        // 1. Save to Local Storage (Pointer for next reload)
        const encrypted = await securityService.encrypt(settings);
        localStorage.setItem(STORAGE_KEY, encrypted);

        // 2. Push to Remote API
        try {
            const token = await getUserToken();
            const isMockToken = token && (token.includes('mock') || token.split('.').length !== 3);

            if (token && !isMockToken) {
                await api.saveSettings(settings, settings, token);
            } else {
                console.warn("Cannot save settings remotely: No valid admin token found");
            }
        } catch (e) {
            console.warn("Failed to save settings remotely (Local config updated)", e);
        }
    }
};