import React, { useState, useEffect } from 'react';
import { ShieldCheck, Key, Lock, Globe, AlertTriangle, Fingerprint, Activity, CreditCard, Mail, Eye, EyeOff, Bot } from 'lucide-react';
import { SecurityEvent, StoreContent, AppSettings } from '../../types';
import { useStore } from '../../context/StoreContext';
import { db } from '../../services/db';

const MOCK_LOGS: SecurityEvent[] = [
    { id: '1', timestamp: Date.now() - 100000, type: 'login_fail', ip: '192.168.1.45', details: 'Invalid Password', severity: 'medium' },
    { id: '2', timestamp: Date.now() - 500000, type: 'blocked_ip', ip: '10.0.0.99', details: 'Geo-blocked (Russia)', severity: 'low' },
    { id: '3', timestamp: Date.now() - 800000, type: 'admin_login', ip: '127.0.0.1', details: 'Successful Auth', severity: 'low' },
    { id: '4', timestamp: Date.now() - 1200000, type: 'suspicious_activity', ip: '45.33.22.11', details: 'Rapid request rate', severity: 'high' },
];

const FeatureToggle = ({ label, desc, icon: Icon, checked, onChange }: any) => (
    <div className="flex items-start gap-4 p-4 border rounded hover:bg-gray-50">
        <div className="p-2 bg-gray-100 rounded text-gray-600"><Icon className="h-5 w-5"/></div>
        <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
                <h4 className="font-bold text-sm">{label}</h4>
                <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 text-black focus:ring-black rounded" />
            </div>
            <p className="text-xs text-gray-500">{desc}</p>
        </div>
    </div>
);

interface SecuritySectionProps {
    content: StoreContent;
    onUpdateContent: (fn: (c: StoreContent) => StoreContent) => void;
    onSaveContent: () => Promise<void>;
}

export const SecuritySection: React.FC<SecuritySectionProps> = ({ content, onUpdateContent, onSaveContent }) => {
    const { user, showToast, settings, refreshSettings } = useStore();
    const [logs] = useState<SecurityEvent[]>(MOCK_LOGS);
    const [blockedIps, setBlockedIps] = useState(content?.security?.blockedIPs || '192.168.1.50\n10.2.2.1');
    
    // Credentials State
    const [adminName, setAdminName] = useState(user?.name || '');
    const [adminEmail, setAdminEmail] = useState(user?.email || '');
    const [newPassword, setNewPassword] = useState('');
    const [isUpdatingCreds, setIsUpdatingCreds] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    // Captcha Keys State (From AppSettings)
    const [siteKey, setSiteKey] = useState(settings?.recaptchaSiteKey || '');
    const [secretKey, setSecretKey] = useState(settings?.recaptchaSecretKey || '');
    const [showSecretKey, setShowSecretKey] = useState(false);

    useEffect(() => {
        if(user) {
            setAdminName(user.name);
            setAdminEmail(user.email);
        }
    }, [user]);

    const updateSecurity = (key: string, value: any) => {
        if(onUpdateContent) {
            onUpdateContent(c => ({...c, security: {...c.security!, [key]: value}}));
        }
    };

    const handleUpdateCredentials = async () => {
        if(!user?.id) return;
        setIsUpdatingCreds(true);
        try {
            const data: any = { name: adminName, email: adminEmail };
            if(newPassword) data.password = newPassword;
            
            await db.updateUser(user.id, data);
            showToast("Admin credentials updated successfully");
            setNewPassword('');
        } catch(e) {
            showToast("Failed to update credentials", "error");
        } finally {
            setIsUpdatingCreds(false);
        }
    };

    const handleSaveCaptchaKeys = async () => {
        // We need to save these to AppSettings via adminMiddleware/api because they are backend secrets
        try {
            const updatedSettings: AppSettings = {
                ...settings!,
                recaptchaSiteKey: siteKey,
                recaptchaSecretKey: secretKey
            };
            // Use existing admin middleware for settings save
            const { adminMiddleware } = await import('../../services/adminMiddleware');
            await adminMiddleware.settings.save(updatedSettings);
            await refreshSettings();
            showToast("reCAPTCHA keys saved.");
        } catch (e) {
            showToast("Failed to save keys", "error");
        }
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in fade-in">
            {/* Main Config */}
            <div className="xl:col-span-2 space-y-8">
                {content?.security && (
                    <div className="bg-white p-6 border shadow-sm rounded-lg">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="font-bold text-lg flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-blue-600" /> Active Defenses</h2>
                            {onSaveContent && <button onClick={onSaveContent} className="text-xs font-bold uppercase bg-black text-white px-3 py-1 rounded">Save Toggles</button>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FeatureToggle 
                                label="Google reCAPTCHA v3" 
                                desc="Invisible score-based protection." 
                                icon={Bot} 
                                checked={content.security.enableRecaptcha}
                                onChange={(v: boolean) => updateSecurity('enableRecaptcha', v)}
                            />
                            <FeatureToggle 
                                label="Bot Challenge (Simple)" 
                                desc="Custom challenge for login attempts." 
                                icon={Fingerprint} 
                                checked={content.security.enableCaptcha}
                                onChange={(v: boolean) => updateSecurity('enableCaptcha', v)}
                            />
                            <FeatureToggle 
                                label="Block Disposable Emails" 
                                desc="Prevent checkout/signup with temp mails." 
                                icon={Mail} 
                                checked={content.security.blockDisposableEmails}
                                onChange={(v: boolean) => updateSecurity('blockDisposableEmails', v)}
                            />
                            <FeatureToggle 
                                label="Block Tor Exit Nodes" 
                                desc="Prevent anonymous traffic from known Tor IPs." 
                                icon={Globe} 
                                checked={content.security.blockTorExitNodes}
                                onChange={(v: boolean) => updateSecurity('blockTorExitNodes', v)}
                            />
                        </div>
                        
                        {content.security.enableRecaptcha && (
                            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded">
                                <h4 className="text-xs font-bold uppercase text-gray-500 mb-3">Google reCAPTCHA v3 Keys</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Site Key</label>
                                        <input className="w-full border p-2 rounded text-sm" value={siteKey} onChange={e => setSiteKey(e.target.value)} placeholder="6Lc..." />
                                    </div>
                                    <div className="relative">
                                        <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Secret Key</label>
                                        <input type={showSecretKey ? "text" : "password"} className="w-full border p-2 rounded text-sm pr-8" value={secretKey} onChange={e => setSecretKey(e.target.value)} placeholder="6Lc..." />
                                        <button type="button" onClick={() => setShowSecretKey(!showSecretKey)} className="absolute right-2 top-7 text-gray-400 hover:text-black">
                                            {showSecretKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <button onClick={handleSaveCaptchaKeys} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded font-bold uppercase hover:bg-blue-700">Update Keys</button>
                                </div>
                            </div>
                        )}

                        <div className="mt-6 pt-6 border-t">
                            <h3 className="font-bold text-sm mb-4">Thresholds</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Max Card Attempts</label>
                                    <input type="number" className="border p-2 w-full rounded" value={content.security.maxCardAttempts} onChange={e => updateSecurity('maxCardAttempts', parseInt(e.target.value))} />
                                    <p className="text-[10px] text-gray-400 mt-1">Block session after X failures.</p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Max Login Attempts</label>
                                    <input type="number" className="border p-2 w-full rounded" value={content.security.maxLoginAttempts} onChange={e => updateSecurity('maxLoginAttempts', parseInt(e.target.value))} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white p-6 border shadow-sm rounded-lg">
                    <h2 className="font-bold text-lg mb-6 flex items-center gap-2"><Lock className="h-6 w-6 text-gray-700" /> Access Control</h2>
                    <div className="space-y-6">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Admin IP Whitelist (Optional)</label>
                            <input className="w-full border p-2 text-sm rounded" placeholder="127.0.0.1, 192.168.1.5" />
                            <p className="text-[10px] text-gray-400 mt-1">Leave empty to allow from anywhere.</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Blocked IP List</label>
                            <textarea 
                                className="w-full border p-2 text-sm rounded h-24 font-mono" 
                                value={blockedIps} 
                                onChange={e => { setBlockedIps(e.target.value); updateSecurity('blockedIPs', e.target.value); }} 
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Audit Log */}
            <div className="bg-white p-6 border shadow-sm rounded-lg flex flex-col h-[600px]">
                <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Activity className="h-5 w-5" /> Audit Log</h2>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                    {logs.map(log => (
                        <div key={log.id} className="p-3 border rounded bg-gray-50 text-sm">
                            <div className="flex justify-between items-center mb-1">
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${log.severity === 'high' ? 'bg-red-100 text-red-700' : log.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-200 text-gray-700'}`}>{log.type.replace('_', ' ')}</span>
                                <span className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-gray-800 font-medium">{log.details}</p>
                            <p className="text-xs text-gray-500 font-mono mt-1">IP: {log.ip}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Credentials Change */}
            <div className="xl:col-span-3 bg-white p-6 border shadow-sm rounded-lg border-t-4 border-t-red-500">
                <h2 className="font-bold text-lg mb-6 flex items-center gap-2"><Key className="h-6 w-6 text-red-600" /> Admin Credentials</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Username / Name</label>
                        <input className="w-full border p-3 rounded" value={adminName} onChange={e => setAdminName(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Email (Login)</label>
                        <input type="email" className="w-full border p-3 rounded" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} />
                    </div>
                    <div className="relative">
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">New Password</label>
                        <input type={showNewPassword ? "text" : "password"} className="w-full border p-3 pr-10 rounded" placeholder="Leave blank to keep current" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                        <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-8 text-gray-400 hover:text-black">
                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
                <div className="mt-4 flex justify-end">
                    <button onClick={handleUpdateCredentials} disabled={isUpdatingCreds} className="bg-red-600 text-white px-6 py-3 font-bold uppercase rounded hover:bg-red-700 disabled:opacity-50">
                        {isUpdatingCreds ? 'Updating...' : 'Update Credentials'}
                    </button>
                </div>
            </div>
        </div>
    );
};