
import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreProvider';
import { SEO } from '../components/SEO';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowLeft, Loader2, AlertTriangle, AlertCircle, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { isValidEmail, sanitizeInput, sanitizeEmail } from '../utils';

export const Login: React.FC = () => {
    const { login, loginWithGoogle, forgotPassword, getCaptcha, user, settings } = useStore();
    const [searchParams] = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [view, setView] = useState<'login' | 'forgot'>(searchParams.get('view') === 'forgot' ? 'forgot' : 'login');
    const [resetSent, setResetSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Captcha State
    const [captchaRequired, setCaptchaRequired] = useState(false);
    const [captchaToken, setCaptchaToken] = useState('');
    const [captchaChallenge, setCaptchaChallenge] = useState('');
    const [captchaAnswer, setCaptchaAnswer] = useState('');

    const navigate = useNavigate();

    useEffect(() => {
        if (user) navigate('/account');
    }, [user, navigate]);

    const handleGoogleLogin = () => {
        const hostname = window.location.hostname;
        
        // Whitelist: Only allow Google Login on domains where we know the Redirect URI is authorized.
        const allowedDomains = ['localhost', '127.0.0.1', 'shipteez.com'];
        const isAllowed = allowedDomains.some(d => hostname === d || hostname.endsWith('.' + d));

        if (!isAllowed) {
            setError(`Google Sign-In is disabled on this preview domain (${hostname}). Please use the Email Login below (Admin: admin@shipteez.com / admin).`);
            return;
        }

        if (!settings?.googleClientId) {
            setError("Google Sign-In not configured by admin.");
            return;
        }

        const redirectUri = settings.googleRedirectUri || `${window.location.origin}/auth/callback`;
        const scope = 'email profile openid';
        const responseType = 'code';
        
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${settings.googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&scope=${scope}&access_type=offline&prompt=consent`;
        
        window.location.href = authUrl;
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

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Sanitation & Validation
        const cleanEmail = sanitizeEmail(email);
        
        if (!cleanEmail) {
            setError("Email address is required.");
            return;
        }

        if (!isValidEmail(cleanEmail)) {
            setError("Please enter a valid email address.");
            return;
        }

        if (!password) {
            setError("Password is required.");
            return;
        }

        setLoading(true);

        try {
            await login(cleanEmail, password, captchaToken, captchaAnswer);
        } catch (e: any) {
            let errorMessage = e.error || "Login failed";
            if (typeof e.remainingAttempts === 'number') {
                 if (e.remainingAttempts === 0) {
                     errorMessage = "Too many attempts. Account locked temporarily.";
                 } else if (e.remainingAttempts <= 3) {
                     errorMessage = `${errorMessage} (${e.remainingAttempts} attempt${e.remainingAttempts === 1 ? '' : 's'} remaining)`;
                 }
            }
            setError(errorMessage);
            if(e.captchaRequired) {
                await loadCaptcha();
            } else if (captchaRequired) {
                await loadCaptcha();
            }
        } finally {
            setLoading(false);
        }
    };

    const handleForgot = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const cleanEmail = sanitizeEmail(email);
        if (!isValidEmail(cleanEmail)) {
            setError("Please enter a valid email address.");
            return;
        }

        setLoading(true);
        try {
            await forgotPassword(cleanEmail);
            setResetSent(true);
            setError(null);
        } catch (e) {
            setError("Failed to send reset email");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[85vh] bg-gray-50 flex flex-col items-center pt-12 pb-12 px-4 sm:px-6 lg:px-8 font-sans">
            <SEO title={view === 'login' ? "Login" : "Reset Password"} description="Access your account" />
            
            <div className="w-full max-w-md mb-8">
                <Breadcrumbs />
            </div>
            
            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-display font-bold tracking-tight text-gray-900">
                        {view === 'login' ? 'Welcome Back' : 'Reset Password'}
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        {view === 'login' ? 'Sign in to access your orders and wishlist.' : 'Enter your email to receive recovery instructions.'}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-start gap-3 mb-6 animate-in fade-in slide-in-from-top-2 shadow-sm">
                        <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-500"/> 
                        <span className="font-medium leading-snug">{error}</span>
                    </div>
                )}

                <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-gray-100 sm:px-10 animate-in fade-in zoom-in-95 duration-300">
                    {view === 'login' ? (
                        <>
                            <button 
                                onClick={handleGoogleLogin}
                                type="button"
                                className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-bold text-sm py-3 px-4 rounded-lg hover:bg-gray-50 transition-all duration-200 shadow-sm"
                            >
                                <svg className="h-5 w-5" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26+-.19-.58z" fill="#FBBC05"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                                Sign in with Google
                            </button>

                            <div className="relative my-8">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-4 bg-white text-gray-500 font-medium">Or continue with email</span>
                                </div>
                            </div>

                            <form className="space-y-6" onSubmit={handleLogin}>
                                <div className="space-y-1">
                                    <label htmlFor="email-address" className="block text-sm font-semibold text-gray-700">Email Address</label>
                                    <div className="relative rounded-md shadow-sm">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <Mail className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <input 
                                            id="email-address" 
                                            name="email" 
                                            type="email" 
                                            required 
                                            tabIndex={1}
                                            className="block w-full rounded-lg border-gray-300 pl-10 focus:border-black focus:ring-black sm:text-sm py-3 transition-all duration-200" 
                                            placeholder="you@example.com" 
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            onBlur={() => setEmail(sanitizeEmail(email))}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <label htmlFor="password" className="block text-sm font-semibold text-gray-700">Password</label>
                                        <button 
                                            type="button" 
                                            tabIndex={4}
                                            onClick={() => setView('forgot')}
                                            className="text-xs font-semibold text-gray-500 hover:text-black transition-colors"
                                        >
                                            Forgot password?
                                        </button>
                                    </div>
                                    <div className="relative rounded-md shadow-sm">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <Lock className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <input 
                                            id="password" 
                                            name="password" 
                                            type={showPassword ? "text" : "password"}
                                            required 
                                            tabIndex={2}
                                            className="block w-full rounded-lg border-gray-300 pl-10 pr-10 focus:border-black focus:ring-black sm:text-sm py-3 transition-all duration-200" 
                                            placeholder="••••••••" 
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
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
                                </div>

                                {captchaRequired && (
                                    <div className="bg-gray-50 p-4 border border-gray-200 rounded-lg animate-in fade-in">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Security Check: {captchaChallenge}</label>
                                        <input 
                                            type="text"
                                            required
                                            tabIndex={3}
                                            className="block w-full rounded border-gray-300 p-2 shadow-sm focus:border-black focus:ring-black sm:text-sm"
                                            placeholder="Type answer here..."
                                            value={captchaAnswer}
                                            onChange={e => setCaptchaAnswer(e.target.value)}
                                        />
                                    </div>
                                )}

                                <button 
                                    type="submit" 
                                    disabled={loading}
                                    tabIndex={3}
                                    className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-sm font-bold text-white bg-black hover:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black uppercase tracking-widest disabled:opacity-50 transition-all duration-200 shadow-md hover:shadow-lg transform active:scale-[0.99]"
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin"/> : 'Sign In'}
                                </button>
                            </form>
                            
                            <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                                <p className="text-sm text-gray-600">
                                    Don't have an account?{' '}
                                    <Link to="/register" tabIndex={5} className="font-bold text-black hover:underline transition-colors">
                                        Register here
                                    </Link>
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Forgot Password View */}
                            {resetSent ? (
                                <div className="text-center py-4">
                                    <div className="bg-green-50 p-6 rounded-full inline-block mb-4">
                                        <CheckCircle className="h-12 w-12 text-green-500" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900">Check Your Inbox</h3>
                                    <p className="text-sm text-gray-600 mt-2 mb-8">We've sent password reset instructions to your email address.</p>
                                    <button 
                                        onClick={() => { setView('login'); setResetSent(false); setError(null); }}
                                        className="w-full bg-black text-white py-3 rounded-lg font-bold uppercase hover:bg-gray-800"
                                    >
                                        Back to Login
                                    </button>
                                </div>
                            ) : (
                                <form className="space-y-6" onSubmit={handleForgot}>
                                    <div className="space-y-1">
                                        <label htmlFor="reset-email" className="block text-sm font-semibold text-gray-700">Email address</label>
                                        <div className="relative rounded-md shadow-sm">
                                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                <Mail className="h-5 w-5 text-gray-400" />
                                            </div>
                                            <input 
                                                id="reset-email" 
                                                name="email" 
                                                type="email" 
                                                required 
                                                className="block w-full rounded-lg border-gray-300 pl-10 focus:border-black focus:ring-black sm:text-sm py-3 transition-all duration-200" 
                                                placeholder="you@example.com" 
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                onBlur={() => setEmail(sanitizeEmail(email))}
                                            />
                                        </div>
                                    </div>
                                    <button type="submit" disabled={loading} className="w-full flex justify-center py-4 px-4 border border-transparent text-sm font-bold text-white bg-black hover:bg-gray-800 rounded-lg uppercase tracking-widest disabled:opacity-50 transition-all duration-200 shadow-md">
                                        {loading ? <Loader2 className="h-5 w-5 animate-spin"/> : 'Send Reset Link'}
                                    </button>
                                    <div className="text-center pt-2">
                                        <button 
                                            type="button" 
                                            onClick={() => { setView('login'); setError(null); }}
                                            className="text-sm font-semibold text-gray-500 hover:text-black flex items-center justify-center gap-2 mx-auto transition-colors"
                                        >
                                            <ArrowLeft className="h-4 w-4" /> Back to Login
                                        </button>
                                    </div>
                                </form>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
