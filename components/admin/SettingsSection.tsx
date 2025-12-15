
// ... existing imports ...
import React, { useState, useRef, useEffect } from 'react';
import { AppSettings, StoreContent } from '../../types';
import { adminMiddleware } from '../../services/adminMiddleware';
import { Globe, Server, Mail, Database, Zap, Activity, CheckCircle, AlertCircle, Loader2, Image as ImageIcon, Crop, Upload, Save, Terminal, RefreshCw, Network, Eye, EyeOff, Sparkles } from 'lucide-react';
import { toBase64 } from '../../utils';
import { api } from '../../services/api';
import { useStore } from '../../context/StoreContext';

interface SettingsSectionProps {
    settings: AppSettings;
    onUpdateSettings: (s: AppSettings) => void;
    onSaveSettings: () => Promise<void>;
    onRefreshContent?: () => Promise<void>;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ settings, onUpdateSettings, onSaveSettings, onRefreshContent }) => {
    const { user } = useStore();
    const [activeTab, setActiveTab] = useState<'general' | 'db' | 'mail'>('general');
    const [testingDb, setTestingDb] = useState(false);
    const [dbStatus, setDbStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [dbLatency, setDbLatency] = useState<number>(0);
    
    // DB Logs
    const [logs, setLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);
    
    // Auto Scroll Persistence
    const autoScroll = settings.adminPreferences?.autoScrollLog ?? true;

    // MySQL Config State
    const [mysqlFields, setMysqlFields] = useState({
        host: 'localhost',
        port: '3306',
        user: 'root',
        password: '',
        database: 'shipteez'
    });

    // Logo Editor State
    const [isEditingLogo, setIsEditingLogo] = useState(false);
    const [tempLogo, setTempLogo] = useState<string | null>(null);
    const [logoScale, setLogoScale] = useState(1);
    const [logoX, setLogoX] = useState(0);
    const [logoY, setLogoY] = useState(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });

    const [brandingState, setBrandingState] = useState<any>({
        siteName: 'ShipTeez',
        logoUrl: '',
        logoMode: 'icon_text',
        logoScale: 100
    });

    // Secret Visibility State
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const toggleSecret = (key: string) => setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));

    useEffect(() => {
        // Load content branding on mount
        const load = async () => {
            try {
                const content = await import('../../services/db').then(m => m.db.getStoreContent());
                setBrandingState(content.branding);
            } catch(e) {}
        };
        load();
    }, []);

    // Sync from settings.databaseUrl to fields when tab is mounted or type changes to mysql
    useEffect(() => {
        if (settings.dbType === 'mysql' && settings.databaseUrl) {
            try {
                const u = new URL(settings.databaseUrl);
                setMysqlFields({
                    host: u.hostname,
                    port: u.port || '3306',
                    user: decodeURIComponent(u.username),
                    password: decodeURIComponent(u.password),
                    database: u.pathname.replace('/', '')
                });
            } catch (e) {
                // Invalid URL, leave defaults
            }
        }
    }, [settings.dbType]);

    // Update MySQL URL helper
    const updateMysql = (key: string, val: string) => {
        const next = { ...mysqlFields, [key]: val };
        setMysqlFields(next);
        
        const user = encodeURIComponent(next.user);
        const pass = encodeURIComponent(next.password);
        const host = next.host || 'localhost';
        const port = next.port || '3306';
        const dbName = next.database;
        
        const url = `mysql://${user}:${pass}@${host}:${port}/${dbName}`;
        onUpdateSettings({ ...settings, databaseUrl: url });
    };

    // Fetch Logs Periodically when DB tab is active
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (activeTab === 'db') {
            fetchLogs(); // Initial
            interval = setInterval(fetchLogs, 3000); // Poll every 3s
        }
        return () => clearInterval(interval);
    }, [activeTab]);

    // Auto-scroll logs
    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);

    const fetchLogs = async () => {
        if(!user?.token) return;
        try {
            const data = await api.getSystemLogs(settings, user.token);
            setLogs(data);
        } catch(e) {
            // fail silently on polling
        }
    };

    const handleTestDb = async () => {
        setTestingDb(true);
        setDbStatus('idle');
        try {
            // Trigger actual backend test
            const res = await api.testDatabaseConnection(settings, user?.token);
            setDbStatus('success');
            setDbLatency(res.latency);
            fetchLogs(); // refresh logs immediately to show the test query
        } catch (e) {
            setDbStatus('error');
        } finally {
            setTestingDb(false);
        }
    };

    const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const base64 = await toBase64(e.target.files[0]);
            setTempLogo(base64);
            setIsEditingLogo(true);
            setLogoScale(1);
            setLogoX(0);
            setLogoY(0);
        }
    };

    // Draw canvas for cropping
    useEffect(() => {
        if (isEditingLogo && tempLogo && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.src = tempLogo;
            img.onload = () => {
                if(!ctx) return;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw background check
                ctx.fillStyle = '#f0f0f0';
                ctx.fillRect(0,0, canvas.width, canvas.height);

                const w = img.width * logoScale;
                const h = img.height * logoScale;
                const x = (canvas.width - w) / 2 + logoX;
                const y = (canvas.height - h) / 2 + logoY;

                ctx.drawImage(img, x, y, w, h);
            };
        }
    }, [isEditingLogo, tempLogo, logoScale, logoX, logoY]);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setStartPos({ x: e.clientX - logoX, y: e.clientY - logoY });
    };
    
    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setLogoX(e.clientX - startPos.x);
            setLogoY(e.clientY - startPos.y);
        }
    };

    const handleSaveLogo = async () => {
        if (canvasRef.current) {
            const finalLogo = canvasRef.current.toDataURL('image/png');
            const newState = { ...brandingState, logoUrl: finalLogo };
            setBrandingState(newState);
            
            // Save immediately to content
            const db = await import('../../services/db').then(m => m.db);
            const content = await db.getStoreContent();
            await db.saveStoreContent({
                ...content,
                branding: newState
            });
            
            if (onRefreshContent) await onRefreshContent();
            
            setIsEditingLogo(false);
            setTempLogo(null);
        }
    };

    const updateBranding = async (key: string, val: any) => {
        const newState = { ...brandingState, [key]: val };
        setBrandingState(newState);
        
        const db = await import('../../services/db').then(m => m.db);
        const content = await db.getStoreContent();
        await db.saveStoreContent({ ...content, branding: newState });
        
        if (onRefreshContent) await onRefreshContent();
    };

    const TabButton = ({ id, label, icon: Icon }: any) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors ${activeTab === id ? 'border-black text-black font-bold' : 'border-transparent text-gray-500 hover:text-black'}`}
        >
            <Icon className="h-4 w-4" /> {label}
        </button>
    );

    return (
        <div className="bg-white border shadow-sm rounded-lg overflow-hidden animate-in fade-in">
            <div className="flex border-b bg-gray-50 overflow-x-auto">
                <TabButton id="general" label="Global Settings" icon={Globe} />
                <TabButton id="db" label="Database & Integrations" icon={Database} />
                <TabButton id="mail" label="Email (SMTP)" icon={Mail} />
            </div>

            <div className="p-8">
                {activeTab === 'general' && (
                    <div className="space-y-12">
                        {/* API Connection Info (Read Only) */}
                        <div className="bg-blue-50 p-6 rounded border border-blue-100">
                            <h3 className="font-bold text-lg flex items-center gap-2 pb-2 border-b border-blue-200 mb-4 text-blue-900">
                                <Network className="h-5 w-5 text-blue-600"/> Connection Status
                            </h3>
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-sm font-bold text-blue-800">Remote API Connected</p>
                                    <p className="text-xs text-blue-600 mt-1 font-mono">{settings.apiUrl}</p>
                                </div>
                                <div className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold uppercase flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" /> Online
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                            
                            {/* 1. Branding & Logo */}
                            <div className="space-y-6">
                                <h3 className="font-bold text-lg flex items-center gap-2 pb-2 border-b"><ImageIcon className="h-5 w-5"/> Branding & Logo</h3>
                                
                                {/* Logo Preview */}
                                <div className="flex items-center gap-6">
                                    <div className="h-24 w-24 bg-gray-100 border border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden relative group">
                                        {brandingState.logoUrl ? (
                                            <img src={brandingState.logoUrl} className="max-w-full max-h-full object-contain" />
                                        ) : (
                                            <span className="text-xs text-gray-400 font-bold uppercase">No Logo</span>
                                        )}
                                        <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-white text-xs font-bold">
                                            Change
                                            <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                                        </label>
                                    </div>
                                    <div className="space-y-2 flex-1">
                                        <label className="text-xs font-bold uppercase text-gray-500 block">Site Name</label>
                                        <input 
                                            className="border p-2 w-full rounded text-sm" 
                                            value={brandingState.siteName} 
                                            onChange={e => updateBranding('siteName', e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Logo Options */}
                                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded border">
                                    <div>
                                        <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Display Mode</label>
                                        <select 
                                            className="w-full border p-2 rounded text-sm bg-white"
                                            value={brandingState.logoMode}
                                            onChange={e => updateBranding('logoMode', e.target.value)}
                                        >
                                            <option value="icon_text">Icon + Text</option>
                                            <option value="image_only">Full Logo (Image Only)</option>
                                            <option value="text_only">Text Only</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Display Size ({brandingState.logoScale}%)</label>
                                        <input 
                                            type="range" min="50" max="200" 
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                            value={brandingState.logoScale}
                                            onChange={e => updateBranding('logoScale', parseInt(e.target.value))}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 2. Global Profile */}
                            <div className="space-y-6">
                                <h3 className="font-bold text-lg flex items-center gap-2 pb-2 border-b"><Globe className="h-5 w-5"/> Store Profile (Global)</h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Store Name</label><input className="border p-2 w-full rounded text-sm" value={settings.storeProfile?.name || ''} onChange={e => onUpdateSettings({ ...settings, storeProfile: { ...settings.storeProfile!, name: e.target.value } })} /></div>
                                        <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Support Email</label><input className="border p-2 w-full rounded text-sm" value={settings.storeProfile?.email || ''} onChange={e => onUpdateSettings({ ...settings, storeProfile: { ...settings.storeProfile!, email: e.target.value } })} /></div>
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Address Line 1</label>
                                        <input className="border p-2 w-full rounded text-sm" value={settings.storeProfile?.address || ''} onChange={e => onUpdateSettings({ ...settings, storeProfile: { ...settings.storeProfile!, address: e.target.value } })} />
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-4">
                                        <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">City</label><input className="border p-2 w-full rounded text-sm" value={settings.storeProfile?.city || ''} onChange={e => onUpdateSettings({ ...settings, storeProfile: { ...settings.storeProfile!, city: e.target.value } })} /></div>
                                        <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">State</label><input className="border p-2 w-full rounded text-sm" value={settings.storeProfile?.state || ''} onChange={e => onUpdateSettings({ ...settings, storeProfile: { ...settings.storeProfile!, state: e.target.value } })} /></div>
                                        <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Zip</label><input className="border p-2 w-full rounded text-sm" value={settings.storeProfile?.zip || ''} onChange={e => onUpdateSettings({ ...settings, storeProfile: { ...settings.storeProfile!, zip: e.target.value } })} /></div>
                                    </div>
                                    
                                    <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Support Phone</label><input className="border p-2 w-full rounded text-sm" value={settings.storeProfile?.phone || ''} onChange={e => onUpdateSettings({ ...settings, storeProfile: { ...settings.storeProfile!, phone: e.target.value } })} /></div>
                                </div>
                            </div>
                        </div>

                        {/* AI Configuration */}
                        <div className="border-t pt-6">
                             <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-purple-600" /> AI Configuration
                            </h3>
                            <div className="max-w-md">
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Gemini API Key</label>
                                <div className="relative">
                                    <input 
                                        type={showSecrets['gemini'] ? "text" : "password"} 
                                        className="border p-2 w-full rounded pr-8 text-sm" 
                                        value={settings.apiKey || ''} 
                                        onChange={e => onUpdateSettings({ ...settings, apiKey: e.target.value })} 
                                        placeholder="AIza..."
                                    />
                                    <button type="button" onClick={() => toggleSecret('gemini')} className="absolute right-2 top-2 text-gray-400 hover:text-black">
                                        {showSecrets['gemini'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-2">
                                    Required for product generation, descriptions, and chatbot.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'db' && (
                    <div className="space-y-8 animate-in fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="font-bold text-lg flex items-center gap-2"><Server className="h-5 w-5"/> Primary Database</h3>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Type</label>
                                    <select className="border p-2 w-full rounded bg-white" value={settings.dbType} onChange={e => onUpdateSettings({ ...settings, dbType: e.target.value as any })}>
                                        <option value="sqlite">SQLite (Embedded)</option>
                                        <option value="postgres">PostgreSQL</option>
                                        <option value="mysql">MySQL / MariaDB</option>
                                        <option value="mongodb">MongoDB</option>
                                    </select>
                                </div>
                                
                                {settings.dbType === 'mysql' ? (
                                    <div className="space-y-4 bg-gray-50 p-4 rounded border border-gray-200">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Host</label>
                                                <input className="border p-2 w-full rounded text-sm" placeholder="localhost" value={mysqlFields.host} onChange={e => updateMysql('host', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Port</label>
                                                <input className="border p-2 w-full rounded text-sm" placeholder="3306" value={mysqlFields.port} onChange={e => updateMysql('port', e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">User</label>
                                                <input className="border p-2 w-full rounded text-sm" placeholder="root" value={mysqlFields.user} onChange={e => updateMysql('user', e.target.value)} />
                                            </div>
                                            <div className="relative">
                                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Password</label>
                                                <input type={showSecrets['mysql'] ? "text" : "password"} className="border p-2 w-full rounded text-sm pr-8" placeholder="Password" value={mysqlFields.password} onChange={e => updateMysql('password', e.target.value)} />
                                                <button type="button" onClick={() => toggleSecret('mysql')} className="absolute right-2 top-8 text-gray-400 hover:text-black">
                                                    {showSecrets['mysql'] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Database Name</label>
                                            <input className="border p-2 w-full rounded text-sm" placeholder="shipteez_db" value={mysqlFields.database} onChange={e => updateMysql('database', e.target.value)} />
                                        </div>
                                        <div className="text-[10px] text-gray-400 break-all font-mono">
                                            Generated URL: {settings.databaseUrl}
                                        </div>
                                    </div>
                                ) : settings.dbType !== 'sqlite' && (
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Connection String</label>
                                        <textarea className="border p-2 w-full rounded font-mono text-xs h-20" value={settings.databaseUrl} onChange={e => onUpdateSettings({ ...settings, databaseUrl: e.target.value })} placeholder="postgresql://user:pass@localhost:5432/mydb" />
                                    </div>
                                )}

                                <div className="flex items-center gap-4">
                                    <button onClick={handleTestDb} disabled={testingDb} className="bg-black text-white px-4 py-2 text-xs font-bold uppercase rounded hover:bg-gray-800 flex items-center gap-2">
                                        {testingDb ? <Loader2 className="h-3 w-3 animate-spin"/> : <Zap className="h-3 w-3"/>} Test Connection
                                    </button>
                                    {dbStatus === 'success' && <p className="text-xs text-green-600 font-bold flex items-center gap-1"><CheckCircle className="h-3 w-3"/> OK ({dbLatency}ms)</p>}
                                    {dbStatus === 'error' && <p className="text-xs text-red-600 font-bold flex items-center gap-1"><AlertCircle className="h-3 w-3"/> Connection Failed</p>}
                                </div>
                            </div>

                            <div className="space-y-4 p-4 bg-gray-50 rounded border">
                                <h3 className="font-bold text-lg flex items-center gap-2"><Zap className="h-5 w-5 text-orange-500"/> Redis (Cache)</h3>
                                <div className="flex items-center gap-2 mb-2">
                                    <input type="checkbox" id="redis" checked={settings.redisEnabled} onChange={e => onUpdateSettings({ ...settings, redisEnabled: e.target.checked })} />
                                    <label htmlFor="redis" className="text-sm font-medium">Enable Redis Caching</label>
                                </div>
                                {settings.redisEnabled && (
                                    <div className="animate-in slide-in-from-top-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Redis URL</label>
                                        <input className="border p-2 w-full rounded" value={settings.redisUrl || ''} onChange={e => onUpdateSettings({ ...settings, redisUrl: e.target.value })} placeholder="redis://localhost:6379" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Database Log Console */}
                        <div className="border rounded-lg overflow-hidden bg-[#1e1e1e] text-green-400 font-mono text-xs shadow-md">
                            <div className="p-2 border-b border-gray-700 bg-[#2d2d2d] flex justify-between items-center text-gray-300">
                                <span className="flex items-center gap-2 font-bold"><Terminal className="h-4 w-4"/> Live Connection Log</span>
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={autoScroll} 
                                            onChange={e => onUpdateSettings({
                                                ...settings,
                                                adminPreferences: { ...settings.adminPreferences, autoScrollLog: e.target.checked }
                                            })} 
                                            className="h-3 w-3"
                                        /> 
                                        Auto-scroll
                                    </label>
                                    <button onClick={fetchLogs}><RefreshCw className="h-3 w-3 hover:text-white"/></button>
                                </div>
                            </div>
                            <div className="h-64 overflow-y-auto p-4 space-y-1">
                                {logs.length === 0 && <div className="text-gray-500 italic text-center mt-20">Waiting for database activity...</div>}
                                {logs.map((log, i) => (
                                    <div key={i} className="flex gap-2 animate-in fade-in slide-in-from-left-1 duration-200">
                                        <span className="text-gray-500 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                        <span className={`font-bold shrink-0 w-16 ${
                                            log.type === 'ERROR' ? 'text-red-500' : 
                                            log.type === 'QUERY' ? 'text-blue-400' : 'text-yellow-400'
                                        }`}>{log.type}</span>
                                        <span className="text-gray-300 break-all">{log.message}</span>
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                        </div>

                        <div className="border-t pt-6">
                            <h3 className="font-bold text-lg mb-4">Payment Gateways</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="relative">
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Stripe Publishable Key</label>
                                    <input type={showSecrets['stripePub'] ? "text" : "password"} className={`border p-2 w-full rounded pr-8 ${settings.stripePublishableKey?.startsWith('sk_') ? 'border-red-500 bg-red-50' : ''}`} value={settings.stripePublishableKey || ''} onChange={e => onUpdateSettings({ ...settings, stripePublishableKey: e.target.value })} />
                                    <button type="button" onClick={() => toggleSecret('stripePub')} className="absolute right-2 top-8 text-gray-400 hover:text-black">
                                        {showSecrets['stripePub'] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                    </button>
                                    {settings.stripePublishableKey?.startsWith('sk_') && (
                                        <div className="text-red-600 text-xs font-bold mt-1 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3"/>
                                            Warning: You pasted a Secret Key (starts with sk_) into the Publishable field!
                                        </div>
                                    )}
                                </div>
                                <div className="relative">
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Stripe Secret Key</label>
                                    <input type={showSecrets['stripeSec'] ? "text" : "password"} className="border p-2 w-full rounded pr-8" value={settings.stripeSecretKey || ''} onChange={e => onUpdateSettings({ ...settings, stripeSecretKey: e.target.value })} />
                                    <button type="button" onClick={() => toggleSecret('stripeSec')} className="absolute right-2 top-8 text-gray-400 hover:text-black">
                                        {showSecrets['stripeSec'] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="border-t pt-6">
                            <h3 className="font-bold text-lg mb-4">Social Login (Google OAuth)</h3>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Client ID</label><input className="border p-2 w-full rounded" value={settings.googleClientId || ''} onChange={e => onUpdateSettings({ ...settings, googleClientId: e.target.value })} /></div>
                                <div className="relative">
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Client Secret</label>
                                    <input type={showSecrets['google'] ? "text" : "password"} className="border p-2 w-full rounded pr-8" value={settings.googleClientSecret || ''} onChange={e => onUpdateSettings({ ...settings, googleClientSecret: e.target.value })} />
                                    <button type="button" onClick={() => toggleSecret('google')} className="absolute right-2 top-8 text-gray-400 hover:text-black">
                                        {showSecrets['google'] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                    </button>
                                </div>
                            </div>
                            <div className="mb-2">
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Callback URL Redirect</label>
                                <input className="border p-2 w-full rounded text-sm font-mono" placeholder="https://yourdomain.com/auth/callback" value={settings.googleRedirectUri || ''} onChange={e => onUpdateSettings({ ...settings, googleRedirectUri: e.target.value })} />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2">
                                Used for "Sign in with Google". Configure authorized origins in Google Cloud Console. Leave Callback URL empty to use auto-detected origin.
                            </p>
                        </div>
                    </div>
                )}

                {activeTab === 'mail' && (
                    <div className="max-w-2xl space-y-6">
                        <div className="bg-blue-50 p-4 border border-blue-100 rounded text-sm text-blue-800 mb-6 flex items-start gap-2">
                            <Activity className="h-5 w-5 flex-shrink-0" />
                            <p>Use standard SMTP credentials. For Gmail, use an App Password.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="col-span-2"><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">SMTP Host</label><input className="border p-2 w-full rounded" value={settings.smtpHost || ''} onChange={e => onUpdateSettings({ ...settings, smtpHost: e.target.value })} placeholder="smtp.gmail.com" /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Port</label><input type="number" className="border p-2 w-full rounded" value={settings.smtpPort} onChange={e => onUpdateSettings({ ...settings, smtpPort: parseInt(e.target.value) })} /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Security</label><select className="border p-2 w-full rounded bg-white"><option>TLS (StartTLS)</option><option>SSL</option><option>None</option></select></div>
                            <div className="col-span-2"><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Username</label><input className="border p-2 w-full rounded" value={settings.smtpUser || ''} onChange={e => onUpdateSettings({ ...settings, smtpUser: e.target.value })} /></div>
                            <div className="col-span-2 relative">
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Password</label>
                                <input type={showSecrets['smtp'] ? "text" : "password"} className="border p-2 w-full rounded pr-8" value={settings.smtpPass || ''} onChange={e => onUpdateSettings({ ...settings, smtpPass: e.target.value })} />
                                <button type="button" onClick={() => toggleSecret('smtp')} className="absolute right-2 top-8 text-gray-400 hover:text-black">
                                    {showSecrets['smtp'] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-gray-50 p-4 border-t flex justify-end">
                <button onClick={onSaveSettings} className="bg-black text-white px-8 py-3 font-bold uppercase rounded hover:bg-gray-800 shadow-md">
                    Save Configuration
                </button>
            </div>

            {/* Logo Crop Modal */}
            {isEditingLogo && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><Crop className="h-4 w-4"/> Adjust Logo</h3>
                            <button onClick={() => setIsEditingLogo(false)} className="text-gray-500 hover:text-black"><Upload className="h-4 w-4 rotate-45"/></button>
                        </div>
                        <div className="relative h-80 bg-gray-100 cursor-move overflow-hidden">
                            <canvas 
                                ref={canvasRef} 
                                width={400} 
                                height={200} 
                                className="w-full h-full object-contain pointer-events-auto"
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={() => setIsDragging(false)}
                                onMouseLeave={() => setIsDragging(false)}
                            />
                            <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-blue-400 opacity-50 flex items-center justify-center">
                                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded">Visible Area</span>
                            </div>
                        </div>
                        <div className="p-4 bg-white space-y-4">
                            <div>
                                <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Zoom / Scale</label>
                                <input 
                                    type="range" min="0.1" max="3" step="0.1" 
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    value={logoScale}
                                    onChange={(e) => setLogoScale(parseFloat(e.target.value))}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setIsEditingLogo(false)} className="flex-1 py-2 border rounded font-bold text-sm uppercase hover:bg-gray-50">Cancel</button>
                                <button onClick={handleSaveLogo} className="flex-1 py-2 bg-black text-white rounded font-bold text-sm uppercase hover:bg-gray-800 flex items-center justify-center gap-2"><Save className="h-4 w-4"/> Apply</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
