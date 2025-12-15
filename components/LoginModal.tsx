import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreProvider';
import { Link } from 'react-router-dom';
import { CheckCircle, Loader2, AlertTriangle, Mail, Lock, Eye, EyeOff, X, User, Check, Circle } from 'lucide-react';
import { isValidEmail, sanitizeEmail, sanitizeInput, checkPasswordStrength, isDisposableEmail } from '../utils';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

declare global {
    interface Window {
        grecaptcha: any;
    }
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
    const { login, register, forgotPassword, getCaptcha, settings, content, checkEmail, authView, openAuthModal } = useStore();
    
    // Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [resetSent, setResetSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Register-specific
    const [passwordStrength, setPasswordStrength] = useState<{ strong: boolean, message?: string } | null>(null);
    const [emailChecking, setEmailChecking] = useState(false);
    const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);

    // Refs for Focus Management
    const modalRef = useRef<HTMLDivElement>(null);
    const emailInputRef = useRef<HTMLInputElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    // Success State
    const [successUser, setSuccessUser] = useState<string | null>(null);
    
    // Captcha State (Simple Internal)
    const [captchaRequired, setCaptchaRequired] = useState(false);
    const [captchaToken, setCaptchaToken] = useState('');
    const [captchaChallenge, setCaptchaChallenge] = useState('');
    const [captchaAnswer, setCaptchaAnswer] = useState('');

    // Load Recaptcha V3 Script
    useEffect(() => {
        if (isOpen && authView === 'register' && content?.security?.enableRecaptcha && settings?.recaptchaSiteKey) {
            const scriptId = 'recaptcha-v3-script';
            if (!document.getElementById(scriptId)) {
                const script = document.createElement('script');
                script.id = scriptId;
                script.src = `https://www.google.com/recaptcha/api.js?render=${settings.recaptchaSiteKey}`;
                script.async = true;
                document.body.appendChild(script);
            }
        }
    }, [isOpen, authView, content?.security?.enableRecaptcha, settings?.recaptchaSiteKey]);

    // Sync context view state & Focus Logic
    useEffect(() => {
        if (isOpen) {
            setError(null);
            setResetSent(false);
            setPassword('');
            setSuccessUser(null);
            setLoading(false);
            
            // Auto-focus Logic
            const timer = setTimeout(() => {
                if (authView === 'register') {
                    nameInputRef.current?.focus();
                } else {
                    emailInputRef.current?.focus();
                }
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [isOpen, authView]);

    // Live Password Validation for Registration
    useEffect(() => {
        if (authView === 'register' && password) {
            setPasswordStrength(checkPasswordStrength(password));
        } else {
            setPasswordStrength(null);
        }
    }, [password, authView]);

    // Focus Trap Effect
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }

            if (e.key !== 'Tab') return;

            const element = modalRef.current;
            if (!element) return;

            const nodeList = element.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            const focusableElements = Array.from(nodeList) as HTMLElement[];

            focusableElements.sort((a, b) => {
                const tiA = a.tabIndex || 0;
                const tiB = b.tabIndex || 0;
                if (tiA > 0 && tiB > 0) return tiA - tiB;
                if (tiA > 0) return -1;
                if (tiB > 0) return 1;
                return 0;
            });
            
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

const handleGoogleLogin = () => {
    const hostname = window.location.hostname;
    const allowedDomains = ['localhost', '127.0.0.1', 'shipteez.com'];
    const isAllowed = allowedDomains.some(d => hostname === d || hostname.endsWith('.' + d));

    if (!settings?.googleClientId) {
        setError("Google Sign-In not configured by admin.");
        return;
    }

    const redirectUri = settings.googleRedirectUri || 'https://shipteez.com/api/auth/callback';
    const scope = 'email profile openid';
    const responseType = 'code';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${settings.googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&scope=${scope}&access_type=offline&prompt=consent`;
    
    const popup = window.open(authUrl, 'google-auth', 'width=500,height=600,scrollbars=yes,resizable=yes');
    
    if (!popup) {
        setError('Popup blocked. Please allow popups for Google Sign-In.');
        return;
    }

    // ✅ FIXED handleMessage - calls your existing login()
    const handleMessage = async (event: any) => {
        if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
            //console.log('✅ Token received:', event.data.token);
            
            localStorage.setItem('token', event.data.token);
            //console.log('✅ Token stored');
            
            setLoading(true);
            try {
                // ✅ YOUR EXISTING login() function - same params as password login
                // Pass empty strings instead of null for required string parameters to satisfy TS
                const user = await login('', undefined, undefined, undefined, true, event.data.token);
                
                if (user) {
                    setSuccessUser(user.name || event.data.user?.name || 'Google User');
                    setTimeout(() => onClose(), 1500); // Your exact success flow
                } else {
                    onClose();
                }
            } catch (e) {
                console.error('OAuth login failed:', e);
                setError("Google login failed");
            } finally {
                setLoading(false);
            }
            
            window.removeEventListener('message', handleMessage);
        }
    };

    window.addEventListener('message', handleMessage);

    // Cleanup
    const checkClosed = setInterval(() => {
        if (popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            onClose();
        }
    }, 1000);
};



    const loadCaptcha = async () => {
        const c = await getCaptcha();
        if(c.token) {
            setCaptchaRequired(true);
            setCaptchaToken(c.token);
            setCaptchaChallenge(c.challenge);
            setCaptchaAnswer('');
        }
    };

    const handleEmailBlur = async () => {
        if (authView !== 'register') return;
        
        const cleanEmail = sanitizeEmail(email);
        if (!cleanEmail || !isValidEmail(cleanEmail)) {
            setEmailAvailable(null);
            return;
        }

        setEmailChecking(true);
        try {
            const isAvailable = await checkEmail(cleanEmail);
            setEmailAvailable(isAvailable);
            if (!isAvailable) {
                setError("Email is already registered. Please login.");
            } else {
                setError(null);
            }
        } catch(e) {
            // Ignore error
        } finally {
            setEmailChecking(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const cleanEmail = sanitizeEmail(email);
        if (!cleanEmail) return setError("Email address is required.");
        if (!isValidEmail(cleanEmail)) return setError("Please enter a valid email address.");
        
        if (authView === 'login') {
            if (!password) return setError("Password is required.");
            setLoading(true);
            try {
                const user = await login(cleanEmail, password, captchaToken, captchaAnswer, rememberMe);
                if (user) {
                    setSuccessUser(user.name);
                    setTimeout(() => onClose(), 1500);
                } else {
                    onClose();
                }
            } catch (e: any) {
                let errorMessage = e.error || "Login failed";
                if (typeof e.remainingAttempts === 'number') {
                     if (e.remainingAttempts === 0) errorMessage = "Too many attempts. Account locked temporarily.";
                     else if (e.remainingAttempts <= 3) errorMessage = `${errorMessage} (${e.remainingAttempts} attempt${e.remainingAttempts === 1 ? '' : 's'} remaining)`;
                }
                setError(errorMessage);
                if(e.captchaRequired || captchaRequired) await loadCaptcha();
            } finally {
                setLoading(false);
            }
        } else if (authView === 'register') {
            const cleanName = sanitizeInput(name);
            if (cleanName.length < 2) return setError("Name is too short.");
            if (isDisposableEmail(cleanEmail)) return setError("Disposable emails not allowed.");
            if (!passwordStrength?.strong) return setError(passwordStrength?.message || "Weak password.");
            
            setLoading(true);
            try {
                let v3Token = undefined;
                
                // Execute v3 Check with Localhost Fallback
                if (content?.security?.enableRecaptcha && settings?.recaptchaSiteKey) {
                    try {
                        if (window.grecaptcha) {
                            v3Token = await window.grecaptcha.execute(settings.recaptchaSiteKey, {action: 'register'});
                        }
                    } catch (gErr) {
                        console.warn("Recaptcha execution failed or blocked", gErr);
                    }

                    // DEV BYPASS: If on localhost and token generation failed (likely domain mismatch), send bypass
                    if (!v3Token && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                        console.info("Using Dev Bypass Token for Localhost");
                        v3Token = 'dev-bypass-token';
                    }
                }

                await register(cleanName, cleanEmail, password, v3Token);
                setSuccessUser(name); // Use input name
                setTimeout(() => onClose(), 1500);
            } catch (e: any) {
                // Auto-retry with bypass if localhost and error is related to captcha/security
                if (
                    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
                    e.error && (e.error.includes('Captcha') || e.status === 400)
                ) {
                    try {
                        console.warn("Captcha failed, retrying with Dev Bypass...");
                        await register(cleanName, cleanEmail, password, 'dev-bypass-token');
                        setSuccessUser(name);
                        setTimeout(() => onClose(), 1500);
                        return;
                    } catch (retryErr) {
                        // Fall through to error
                    }
                }
                setError(e.error || "Registration failed.");
            } finally {
                setLoading(false);
            }
        } else if (authView === 'forgot') {
            setLoading(true);
            try {
                await forgotPassword(cleanEmail);
                setResetSent(true);
            } catch (e) {
                setError("Failed to send reset email");
            } finally {
                setLoading(false);
            }
        }
    };

    // Password Validation Helpers
    const isMinLength = password.length >= 8;
    const hasNumber = /[0-9]/.test(password);
    const hasUpper = /[A-Z]/.test(password);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/25 backdrop-blur-sm transition-opacity" onClick={loading ? undefined : onClose}></div>
            
            <div ref={modalRef} className="relative bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden select-none max-h-[90vh] overflow-y-auto">
                {/* Loading Overlay */}
                {loading && (
                    <div className="absolute inset-0 bg-white/80 z-50 flex flex-col items-center justify-center backdrop-blur-[1px]">
                        <Loader2 className="h-10 w-10 animate-spin text-black mb-4" />
                        <div className="w-3/4 space-y-3">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto animate-pulse"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto animate-pulse"></div>
                        </div>
                    </div>
                )}

                {!successUser && (
                    <button onClick={onClose} disabled={loading} className="absolute top-4 right-4 text-gray-400 hover:text-black transition-colors disabled:opacity-50" aria-label="Close Modal" tabIndex={0}>
                        <X className="h-6 w-6" />
                    </button>
                )}

                {successUser ? (
                    <div className="py-12 text-center animate-in fade-in zoom-in">
                        <div className="mx-auto mb-6">
                            <span className="text-6xl select-none" role="img" aria-label="Winking Face">😉</span>
                        </div>
                        <h2 className="text-3xl font-display font-bold text-gray-900 mb-2">Welcome!</h2>
                        <p className="text-lg text-gray-600 font-medium">{successUser}</p>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-display font-bold tracking-tight text-gray-900">
                                {authView === 'login' ? 'Welcome Back' : authView === 'register' ? 'Create Account' : 'Reset Password'}
                            </h2>
                            <p className="mt-2 text-sm text-gray-600">
                                {authView === 'login' && 'Sign in to access your orders.'}
                                {authView === 'register' && 'Join ShipTeez for exclusive offers.'}
                                {authView === 'forgot' && 'Enter your email to receive recovery instructions.'}
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-start gap-3 mb-6 animate-in slide-in-from-top-2">
                                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-500"/> 
                                <span className="font-medium leading-snug">{error}</span>
                            </div>
                        )}

                        {(authView === 'login' || authView === 'register') && (
                            <button 
                                onClick={handleGoogleLogin}
                                type="button"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-bold text-sm py-3 px-4 rounded-lg hover:bg-gray-50 transition-all duration-200 shadow-sm mb-6"
                                tabIndex={0}
                            >
                                <svg className="h-5 w-5" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26+-.19-.58z" fill="#FBBC05"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                                {authView === 'register' ? 'Sign up with Google' : 'Sign in with Google'}
                            </button>
                        )}

                        {resetSent ? (
                            <div className="text-center py-4">
                                <div className="bg-green-50 p-6 rounded-full inline-block mb-4">
                                    <CheckCircle className="h-12 w-12 text-green-500" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">Check Your Inbox</h3>
                                <p className="text-sm text-gray-600 mt-2 mb-8">We've sent instructions to {email}.</p>
                                <button 
                                    onClick={() => { openAuthModal('login'); setResetSent(false); setError(null); }}
                                    className="w-full bg-black text-white py-3 rounded-lg font-bold uppercase hover:bg-gray-800"
                                >
                                    Back to Login
                                </button>
                            </div>
                        ) : (
                            <form className="space-y-5" onSubmit={handleSubmit}>
                                {authView === 'register' && (
                                    <div className="space-y-1">
                                        <label className="block text-sm font-semibold text-gray-700">Full Name</label>
                                        <div className="relative rounded-md shadow-sm">
                                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                <User className="h-5 w-5 text-gray-400" />
                                            </div>
                                            <input 
                                                ref={nameInputRef}
                                                type="text" 
                                                required 
                                                className="block w-full rounded-lg border-gray-300 pl-10 focus:border-gray-400 focus:ring-0 sm:text-sm py-3 transition-all select-text" 
                                                placeholder="Jane Doe" 
                                                value={name}
                                                onChange={e => setName(e.target.value)}
                                                tabIndex={1}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <label className="block text-sm font-semibold text-gray-700">Email Address</label>
                                    <div className="relative rounded-md shadow-sm">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <Mail className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <input 
                                            ref={emailInputRef}
                                            type="email" 
                                            required 
                                            className="block w-full rounded-lg border-gray-300 pl-10 focus:border-gray-400 focus:ring-0 sm:text-sm py-3 transition-all select-text" 
                                            placeholder="you@example.com" 
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            onBlur={handleEmailBlur}
                                            tabIndex={authView === 'register' ? 2 : 1}
                                        />
                                        {authView === 'register' && emailChecking && (
                                            <div className="absolute right-3 top-3"><Loader2 className="h-4 w-4 animate-spin text-gray-400"/></div>
                                        )}
                                    </div>
                                </div>

                                {authView !== 'forgot' && (
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <label className="block text-sm font-semibold text-gray-700">Password</label>
                                            {authView === 'login' && (
                                                <button type="button" onClick={() => openAuthModal('forgot')} className="text-xs font-semibold text-gray-500 hover:text-black" tabIndex={4}>
                                                    Forgot password?
                                                </button>
                                            )}
                                        </div>
                                        <div className="relative rounded-md shadow-sm">
                                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                <Lock className="h-5 w-5 text-gray-400" />
                                            </div>
                                            <input 
                                                type={showPassword ? "text" : "password"}
                                                required 
                                                className="block w-full rounded-lg border-gray-300 pl-10 pr-10 focus:border-gray-400 focus:ring-0 sm:text-sm py-3 transition-all select-text" 
                                                placeholder="••••••••" 
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                tabIndex={authView === 'register' ? 3 : 2}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                                                tabIndex={-1}
                                            >
                                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                            </button>
                                        </div>
                                        {authView === 'register' && (
                                            <div className="mt-3 bg-gray-50 border border-gray-100 rounded-lg p-3 space-y-2 animate-in fade-in">
                                                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2">Password Requirements</p>
                                                <div className="space-y-1.5">
                                                    <div className={`flex items-center gap-2 text-xs transition-all duration-300 ${isMinLength ? 'text-green-700 font-medium' : 'text-gray-400'}`}>
                                                        {isMinLength ? <Check className="h-3.5 w-3.5 bg-green-100 rounded-full p-0.5 text-green-600"/> : <Circle className="h-3.5 w-3.5 text-gray-300 fill-transparent"/>}
                                                        At least 8 characters
                                                    </div>
                                                    <div className={`flex items-center gap-2 text-xs transition-all duration-300 ${hasNumber ? 'text-green-700 font-medium' : 'text-gray-400'}`}>
                                                        {hasNumber ? <Check className="h-3.5 w-3.5 bg-green-100 rounded-full p-0.5 text-green-600"/> : <Circle className="h-3.5 w-3.5 text-gray-300 fill-transparent"/>}
                                                        One number
                                                    </div>
                                                    <div className={`flex items-center gap-2 text-xs transition-all duration-300 ${hasUpper ? 'text-green-700 font-medium' : 'text-gray-400'}`}>
                                                        {hasUpper ? <Check className="h-3.5 w-3.5 bg-green-100 rounded-full p-0.5 text-green-600"/> : <Circle className="h-3.5 w-3.5 text-gray-300 fill-transparent"/>}
                                                        One uppercase letter
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {authView === 'login' && (
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            id="rememberMe" 
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            className="h-4 w-4 text-black focus:ring-0 border-gray-300 rounded"
                                            tabIndex={4}
                                        />
                                        <label htmlFor="rememberMe" className="text-sm text-gray-600 select-none">Remember me</label>
                                    </div>
                                )}

                                {(captchaRequired || (authView === 'register' && content?.security?.enableCaptcha && !content?.security?.enableRecaptcha)) && (
                                    <div className="bg-gray-50 p-4 border border-gray-200 rounded-lg animate-in fade-in">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Security Check: {captchaChallenge}</label>
                                        <input 
                                            type="text"
                                            required
                                            className="block w-full rounded border-gray-300 p-2 shadow-sm focus:border-gray-400 focus:ring-0 sm:text-sm select-text"
                                            placeholder="Type answer here..."
                                            value={captchaAnswer}
                                            onChange={e => setCaptchaAnswer(e.target.value)}
                                            tabIndex={authView === 'register' ? 4 : 5}
                                        />
                                    </div>
                                )}

                                <button 
                                    type="submit" 
                                    disabled={loading || (authView === 'register' && emailAvailable === false)}
                                    className="w-full flex justify-center py-4 px-4 border border-transparent text-sm font-bold text-white bg-black hover:bg-gray-800 rounded-lg uppercase tracking-widest disabled:opacity-50 transition-all duration-200 shadow-md transform active:scale-[0.99]"
                                    tabIndex={authView === 'register' ? 5 : 3}
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin"/> : authView === 'login' ? 'Sign In' : authView === 'register' ? 'Create Account' : 'Send Reset Link'}
                                </button>
                            </form>
                        )}
                        
                        <div className="mt-8 pt-6 border-t border-gray-100 text-center flex flex-col gap-4">
                            {authView === 'login' ? (
                                <p className="text-sm text-gray-600">
                                    Don't have an account?{' '}
                                    <button onClick={() => openAuthModal('register')} className="font-bold text-black hover:underline transition-colors" tabIndex={5}>
                                        Register here
                                    </button>
                                </p>
                            ) : (
                                <p className="text-sm text-gray-600">
                                    Already have an account?{' '}
                                    <button onClick={() => openAuthModal('login')} className="font-bold text-black hover:underline transition-colors" tabIndex={6}>
                                        Sign In
                                    </button>
                                </p>
                            )}

                            {authView === 'register' && content?.security?.enableRecaptcha && (
                                <p className="text-[10px] text-gray-400 px-4">
                                    This site is protected by reCAPTCHA and the Google 
                                    <a href="https://policies.google.com/privacy" className="underline hover:text-gray-600 mx-1">Privacy Policy</a> and 
                                    <a href="https://policies.google.com/terms" className="underline hover:text-gray-600 mx-1">Terms of Service</a> apply.
                                </p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};