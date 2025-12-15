
import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreProvider';
import { SEO } from '../components/SEO';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Loader2, AlertCircle, Check, User, Lock, Eye, EyeOff } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { checkPasswordStrength, isDisposableEmail, isValidEmail, sanitizeInput, sanitizeEmail } from '../utils';

const EMAIL_CACHE_KEY = 'artisan_reg_email_cache';

export const Register: React.FC = () => {
    const { register, user, checkEmail } = useStore();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    
    // Email Check State
    const [emailChecking, setEmailChecking] = useState(false);
    const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
    
    const navigate = useNavigate();

    // Redirect if already logged in
    useEffect(() => {
        if (user) navigate('/account');
    }, [user, navigate]);

    // Clear email cache on mount (page reload equivalent for SPA context)
    useEffect(() => {
        localStorage.removeItem(EMAIL_CACHE_KEY);
    }, []);

    // Live Password Validation
    useEffect(() => {
        if (!password) {
            setPasswordError(null);
            return;
        }
        const strength = checkPasswordStrength(password);
        if (!strength.strong) {
            setPasswordError(strength.message || "Weak password");
        } else {
            setPasswordError(null);
        }
    }, [password]);

    const handleEmailBlur = async () => {
        const cleanEmail = sanitizeEmail(email);
        setEmail(cleanEmail);
        
        if (!cleanEmail || !isValidEmail(cleanEmail)) {
            setEmailAvailable(null);
            return;
        }

        // 1. Check Local Cache first
        try {
            const cachedData = localStorage.getItem(EMAIL_CACHE_KEY);
            if (cachedData) {
                const cache = JSON.parse(cachedData);
                if (cache[cleanEmail] !== undefined) {
                    const isAvailable = cache[cleanEmail];
                    setEmailAvailable(isAvailable);
                    if (isAvailable && error === "Email already exists") {
                        setError(null);
                    }
                    return; // Return early, do not hit API
                }
            }
        } catch (e) {
            console.warn("Email cache read error", e);
        }

        // 2. Hit API if not in cache
        setEmailChecking(true);
        try {
            const isAvailable = await checkEmail(cleanEmail);
            setEmailAvailable(isAvailable);
            
            // 3. Save to Cache
            const currentCache = JSON.parse(localStorage.getItem(EMAIL_CACHE_KEY) || '{}');
            currentCache[cleanEmail] = isAvailable;
            localStorage.setItem(EMAIL_CACHE_KEY, JSON.stringify(currentCache));

            if (!isAvailable) {
                // Visual indicator handles the X, logic handles submit button disabling
            } else {
                if (error === "Email already exists") setError(null);
            }
        } catch(e) {
            // Ignore network errors on blur check so we don't block user flow unnecessarily
        } finally {
            setEmailChecking(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        
        // 1. Sanitize
        const cleanName = sanitizeInput(name);
        const cleanEmail = sanitizeEmail(email);

        // 2. Validate Name
        if (cleanName.length < 2) {
            setError("Name is too short. Please enter your full name.");
            setLoading(false);
            return;
        }

        // 3. Validate Email Format
        if (!isValidEmail(cleanEmail)) {
            setError("Invalid email format. Please check your input.");
            setLoading(false);
            return;
        }

        // 4. Check for Disposable Email
        if (isDisposableEmail(cleanEmail)) {
            setError("We do not accept disposable or temporary email addresses. Please use a valid email provider.");
            setLoading(false);
            return;
        }

        // 5. Final Password Check
        const strength = checkPasswordStrength(password);
        if (!strength.strong) {
            setError(strength.message || "Password does not meet security requirements.");
            setLoading(false);
            return;
        }

        // 6. Pre-check availability state if set
        if (emailAvailable === false) {
            setError("Email address is already registered.");
            setLoading(false);
            return;
        }

        try {
            await register(cleanName, cleanEmail, password);
        } catch (e: any) {
            setError(e.error || "Registration failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[85vh] bg-gray-50 flex flex-col items-center pt-12 pb-12 px-4 sm:px-6 lg:px-8 font-sans">
            <SEO title="Create Account" description="Register a new account" />
            
            <div className="w-full max-w-md mb-8">
                <Breadcrumbs />
            </div>

            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-display font-bold tracking-tight text-gray-900">Join ShipTeez</h2>
                    <p className="mt-2 text-sm text-gray-600">Create an account to track orders and save your favorites.</p>
                </div>

                <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-gray-100 sm:px-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <form className="space-y-6" onSubmit={handleRegister}>
                        {error && (
                             <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-500"/> 
                                <span className="leading-snug font-medium">{error}</span>
                            </div>
                        )}
                        
                        {/* Name Field */}
                        <div className="space-y-1">
                            <label htmlFor="name" className="block text-sm font-semibold text-gray-700">Full Name</label>
                            <div className="relative rounded-md shadow-sm">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <User className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                </div>
                                <input 
                                    id="name" 
                                    name="name" 
                                    type="text" 
                                    autoComplete="name"
                                    required 
                                    className="block w-full rounded-lg border-gray-300 pl-10 focus:border-black focus:ring-black sm:text-sm py-3 transition-all duration-200" 
                                    placeholder="Jane Doe" 
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    onBlur={() => setName(sanitizeInput(name))}
                                />
                            </div>
                        </div>

                        {/* Email Field */}
                        <div className="space-y-1">
                            <label htmlFor="email-address" className="block text-sm font-semibold text-gray-700">Email Address</label>
                            <div className="relative rounded-md shadow-sm">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <Mail className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                </div>
                                <input 
                                    id="email-address" 
                                    name="email" 
                                    type="email" 
                                    autoComplete="email"
                                    required 
                                    className={`block w-full rounded-lg border-gray-300 pl-10 pr-10 focus:border-black focus:ring-black sm:text-sm py-3 transition-all duration-200 ${emailAvailable === false ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''} ${emailAvailable === true ? 'border-green-300 focus:border-green-500 focus:ring-green-200' : ''}`}
                                    placeholder="you@example.com" 
                                    value={email}
                                    onChange={e => {
                                        setEmail(e.target.value);
                                        setEmailAvailable(null); // Reset checking status on type
                                    }}
                                    onBlur={handleEmailBlur}
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                    {emailChecking ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                    ) : emailAvailable === true ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                    ) : emailAvailable === false ? (
                                        <AlertCircle className="h-4 w-4 text-red-500" />
                                    ) : null}
                                </div>
                            </div>
                            {emailAvailable === false && (
                                <p className="text-xs text-red-500 mt-1 ml-1 font-medium">
                                    Email is already taken. <Link to="/login?view=forgot" className="underline font-bold hover:text-red-700">Forgot Password?</Link>
                                </p>
                            )}
                        </div>

                        {/* Password Field */}
                        <div className="space-y-1">
                            <label htmlFor="password" className="block text-sm font-semibold text-gray-700">Password</label>
                            <div className="relative rounded-md shadow-sm">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <Lock className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                </div>
                                <input 
                                    id="password" 
                                    name="password" 
                                    type={showPassword ? "text" : "password"}
                                    required 
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

                        {/* Password Strength Indicator */}
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-100">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Security Requirements</p>
                            <div className="space-y-1">
                                <div className={`flex items-center gap-2 text-xs transition-colors duration-300 ${password.length >= 8 ? 'text-green-700 font-medium' : 'text-gray-400'}`}>
                                    {password.length >= 8 ? <Check className="h-3 w-3 bg-green-100 rounded-full p-0.5"/> : <div className="h-3 w-3 rounded-full border border-gray-300"/>}
                                    Min. 8 characters
                                </div>
                                <div className={`flex items-center gap-2 text-xs transition-colors duration-300 ${/[A-Z]/.test(password) ? 'text-green-700 font-medium' : 'text-gray-400'}`}>
                                    {/[A-Z]/.test(password) ? <Check className="h-3 w-3 bg-green-100 rounded-full p-0.5"/> : <div className="h-3 w-3 rounded-full border border-gray-300"/>}
                                    One uppercase letter
                                </div>
                                <div className={`flex items-center gap-2 text-xs transition-colors duration-300 ${/[0-9]/.test(password) ? 'text-green-700 font-medium' : 'text-gray-400'}`}>
                                    {/[0-9]/.test(password) ? <Check className="h-3 w-3 bg-green-100 rounded-full p-0.5"/> : <div className="h-3 w-3 rounded-full border border-gray-300"/>}
                                    One number
                                </div>
                            </div>
                        </div>

                        <div>
                            <button 
                                type="submit" 
                                disabled={loading || !!passwordError || emailAvailable === false} 
                                className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-sm font-bold text-white bg-black hover:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg transform active:scale-[0.99]"
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create Account'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 pt-6 border-t border-gray-100">
                        <p className="text-center text-sm text-gray-600">
                            Already have an account?{' '}
                            <Link to="/login" className="font-bold text-black hover:underline transition-colors">
                                Login here
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
