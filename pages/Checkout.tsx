
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../context/StoreProvider';
import { useNavigate, Link } from 'react-router-dom';
import { SEO } from '../components/SEO';
import { Lock, CreditCard, AlertCircle, Truck, AlertOctagon, Eye, EyeOff, HelpCircle, ChevronDown, Minus, Plus, Trash2, CheckCircle, Edit3, Loader2, Check, Landmark, Tag, X } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { isValidEmail, sanitizeEmail } from '../utils';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement, ExpressCheckoutElement } from '@stripe/react-stripe-js';
import { api } from '../services/api';
import { db } from '../services/db';

const US_STATES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

// Reusable Input Components
const InputField = ({ name, label, placeholder, value, onChange, error, half = false, maxLength, type = 'text', onFocus, onBlur, onKeyDown, className = '', icon, inputRef }: any) => (
    <div className={`${half ? '' : 'col-span-2'} ${className}`}>
        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">{label}</label>
        <div className="relative">
            <input 
                ref={inputRef}
                type={type}
                name={name}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                onFocus={onFocus}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                maxLength={maxLength}
                className={`w-full border rounded-lg p-3 text-sm transition-all outline-none focus:ring-2 ${icon ? 'pr-10' : ''} ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-black focus:ring-black'}`}
            />
            {icon && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    {icon}
                </div>
            )}
        </div>
        {error && <p className="text-red-500 text-xs mt-1 font-medium">{error}</p>}
    </div>
);

const StateSelect = ({ name, value, onChange, error, onKeyDown }: any) => (
    <div>
        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">State</label>
        <div className="relative">
            <select 
                name={name}
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                className={`w-full border rounded-lg p-3 text-sm appearance-none bg-white transition-all outline-none focus:ring-2 ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-black focus:ring-black'}`}
            >
                <option value="">Select</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
        {error && <p className="text-red-500 text-xs mt-1 font-medium">{error}</p>}
    </div>
);

// Inner Form Component that uses Stripe Hooks
const CheckoutForm: React.FC = () => {
    const stripe = useStripe();
    const elements = useElements();
    const { cart, cartTotal, placeOrder, user, applyPromo, updateQuantity, removeFromCart, updateUserAddresses, checkEmail, login, settings, content, savedPromoCode, savePromoCode } = useStore();
    const navigate = useNavigate();
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [isOrderComplete, setIsOrderComplete] = useState(false); // Ref to track completion
    const [activeStep, setActiveStep] = useState(1);
    
    // Saved Cards State
    const [savedCards, setSavedCards] = useState<any[]>([]);
    const [selectedCardId, setSelectedCardId] = useState<string>('new');
    const [saveCard, setSaveCard] = useState(false);

    // Refs
    const emailRef = useRef<HTMLInputElement>(null);
    const shippingNameRef = useRef<HTMLInputElement>(null);
    const shippingSelectRef = useRef<HTMLSelectElement>(null);
    const cardNameRef = useRef<HTMLInputElement>(null);

    // Form Data
    const [formData, setFormData] = useState({
        email: user?.email || '',
        password: '',
        createAccount: false,
        name: user?.name || '',
        address: '',
        addressLine2: '',
        city: '',
        state: '',
        zip: '',
        cardName: '',
        sameAsShipping: true,
        billingAddress: '',
        billingAddressLine2: '',
        billingCity: '',
        billingState: '',
        billingZip: '',
        promoCode: '',
        saveAddress: false, 
        saveBillingAddress: false
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [discount, setDiscount] = useState(0);
    const [activePromoCode, setActivePromoCode] = useState<string | null>(null);
    const [isCheckingPromo, setIsCheckingPromo] = useState(false);
    const [promoError, setPromoError] = useState<string | null>(null);
    const [cardType, setCardType] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    // Stripe Element States
    const [stripeStatus, setStripeStatus] = useState({ number: false, expiry: false, cvc: false });
    const [showCvcHelp, setShowCvcHelp] = useState(false);

    // Email Check State
    const [emailChecking, setEmailChecking] = useState(false);
    const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
    const [loginProcessing, setLoginProcessing] = useState(false);
    const [shouldAdvance, setShouldAdvance] = useState(false);

    const isRegisteredEmail = emailAvailable === false;
    const isLoginAction = isRegisteredEmail && formData.createAccount;

    const stripeElementStyle = {
        base: {
            fontSize: '14px',
            color: '#ffffff',
            fontFamily: '"Inter", sans-serif',
            fontSmoothing: 'antialiased',
            '::placeholder': { color: '#d1d5db' },
            backgroundColor: 'transparent',
        },
        invalid: { color: '#ef4444' },
    };
    
    const stripeCardNumberStyle = {
        ...stripeElementStyle,
        base: {
            ...stripeElementStyle.base,
            fontSize: '24px',
            fontFamily: 'monospace',
            letterSpacing: '2px',
        }
    };

    // Auto-apply Saved Promo on Mount
    useEffect(() => {
        if (savedPromoCode && !activePromoCode && !isCheckingPromo) {
            setFormData(prev => ({...prev, promoCode: savedPromoCode}));
            // Trigger automatic validation
            const autoApply = async () => {
                setIsCheckingPromo(true);
                setPromoError(null);
                try {
                    const saved = await applyPromo(savedPromoCode);
                    if (saved > 0) {
                        setDiscount(saved);
                        setActivePromoCode(savedPromoCode.toUpperCase());
                    } else {
                        setPromoError('Invalid or expired promo code');
                        setDiscount(0);
                        setActivePromoCode(null);
                        // Optionally clear invalid saved code
                        savePromoCode(null);
                    }
                } catch (e) {
                    setPromoError('Failed to validate promo code.');
                } finally {
                    setIsCheckingPromo(false);
                }
            };
            autoApply();
        }
    }, [savedPromoCode, activePromoCode]);

    // --- Advanced Shipping Calculation ---
    const shippingCalculation = useMemo(() => {
        if (!content || !content.shipping.enabled) return { cost: 0, isFree: false, savings: 0 };

        const threshold = content.shipping.freeShippingThreshold;
        
        let calculatedCost = 0;

        // Iterate through each item to calculate shipping independently
        cart.forEach(item => {
            const template = content.shippingTemplates?.find(t => t.id === item.shippingTemplateId);
            const base = template ? template.baseRate : content.shipping.baseRate;
            let addl = 0;
            if (item.quantity > 1){
                addl = template ? template.additionalItemRate : (content.shipping.additionalItemRate ?? 0);
            }

            let itemCost = 0;

            if (addl === 0) {
                // If additional rate is $0, simple multiplication
                itemCost = base * item.quantity;
            } else {
                // Special Rounding Logic for Additional Rate
                let adjustedAddl = addl;
                const cents = Math.round((addl % 1) * 100);
                
                // If cents are NOT 0.25, 0.50, 0.75, or 0.95
                if (![25, 50, 75, 95].includes(cents)) {
                    // Round to nearest quarter
                    adjustedAddl = Math.round(addl * 4) / 4;
                    // If rounded result ends in .00, bump to .25
                    if (Math.round((adjustedAddl % 1) * 100) === 0) {
                        adjustedAddl += 0.25;
                    }
                }

                // Cost = Base + (Adjusted Additional * Quantity)
                itemCost = base + (adjustedAddl * item.quantity);
            }

            calculatedCost += itemCost;
        });

        if (content.shipping.handlingFee) {
            calculatedCost += content.shipping.handlingFee;
        }

        // --- Check Threshold ---
        if (threshold > 0 && cartTotal >= threshold) {
            return { cost: 0, isFree: true, savings: calculatedCost };
        }

        return { cost: calculatedCost, isFree: false, savings: 0 };

    }, [cart, content, cartTotal]);

    const finalTotal = Math.max(0, cartTotal + shippingCalculation.cost - discount);

    // Auto-focus Logic
    useEffect(() => {
        const timer = setTimeout(() => {
            if (activeStep === 1) emailRef.current?.focus();
            else if (activeStep === 2) {
                if (shippingSelectRef.current) shippingSelectRef.current.focus();
                else shippingNameRef.current?.focus();
            }
            // Step 3 focus is handled by onReady prop of CardNumberElement
        }, 150);
        return () => clearTimeout(timer);
    }, [activeStep]);

    useEffect(() => {
        // Only redirect if empty and NOT currently processing/completing an order
        if (cart.length === 0 && !isOrderComplete && !isProcessing) {
            navigate('/');
        }
    }, [cart, navigate, isOrderComplete, isProcessing]);

    // Pre-fill user data & fetch cards
    useEffect(() => {
        if(user) {
            const defShip = user.addresses?.find(a => a.isDefaultShipping || a.isDefault) || user.addresses?.[0];
            const defBill = user.addresses?.find(a => a.isDefaultBilling);

            const newForm = { ...formData, email: user.email };

            if(defShip) {
                newForm.name = defShip.name || newForm.name;
                newForm.address = defShip.street || newForm.address;
                newForm.addressLine2 = defShip.line2 || newForm.addressLine2;
                newForm.city = defShip.city || newForm.city;
                newForm.state = defShip.state || newForm.state;
                newForm.zip = defShip.zip || newForm.zip;
            }

            if (defBill && defBill.id !== defShip?.id) {
                newForm.sameAsShipping = false;
                newForm.billingAddress = defBill.street;
                newForm.billingAddressLine2 = defBill.line2 || '';
                newForm.billingCity = defBill.city;
                newForm.billingState = defBill.state;
                newForm.billingZip = defBill.zip;
            }

            setFormData(newForm);
            if (user.email && newForm.address) setActiveStep(3);
            else if (user.email) setActiveStep(2);

            // Fetch Saved Cards
            db.getWallet().then(cards => {
                setSavedCards(cards);
                if(cards.length > 0) setSelectedCardId(cards[0].id);
            });
        }
    }, [user]);

    // Auto-advance Step 1
    useEffect(() => {
        if (shouldAdvance && !emailChecking) {
            if (emailAvailable === true) {
                setShouldAdvance(false);
                if (formData.createAccount && formData.password.length < 8) {
                    setErrors({ password: 'Password must be at least 8 chars' });
                } else {
                    setActiveStep(2);
                }
            } else if (emailAvailable === false) {
                setShouldAdvance(false);
                if (!formData.createAccount) {
                    setErrors(prev => ({...prev, email: 'Email is registered. Please login to continue or use another email.'}));
                }
            }
        }
    }, [shouldAdvance, emailAvailable, emailChecking, formData.createAccount, formData.password]);

    const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        
        if (name === 'createAccount' && !checked && isRegisteredEmail) {
            setFormData(prev => ({ ...prev, createAccount: false, email: '', password: '' }));
            setEmailAvailable(null);
            setErrors(prev => ({ ...prev, email: '', password: '' }));
            return;
        }

        if (name === 'promoCode') {
            setPromoError(null);
        }

        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        
        if (name === 'email') {
            setEmailAvailable(null);
            setShouldAdvance(false);
            if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
        }
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const handleEmailBlur = async () => {
        const cleanEmail = sanitizeEmail(formData.email);
        if (!cleanEmail || !isValidEmail(cleanEmail)) {
            setEmailAvailable(null);
            return;
        }
        if (user && user.email === cleanEmail) {
            setEmailAvailable(true);
            return;
        }
        setEmailChecking(true);
        setErrors(prev => ({ ...prev, email: '' }));
        try {
            const isAvailable = await checkEmail(cleanEmail);
            setEmailAvailable(isAvailable);
            if (!isAvailable && !user) {
                setErrors(prev => ({...prev, email: 'Email is registered. Please login below.'}));
            }
        } catch(e) { } finally {
            setEmailChecking(false);
        }
    };

    const handleAddressSelect = (e: React.ChangeEvent<HTMLSelectElement>, type: 'shipping' | 'billing') => {
        const addrId = e.target.value;
        if(!user || !user.addresses) return;
        const addr = user.addresses.find(a => a.id === addrId);
        
        if (type === 'shipping') {
            if(addr) {
                setFormData(prev => ({ ...prev, name: addr.name, address: addr.street, addressLine2: addr.line2 || '', city: addr.city, state: addr.state, zip: addr.zip }));
            } else {
                setFormData(prev => ({ ...prev, address: '', addressLine2: '', city: '', state: '', zip: '' }));
            }
        } else {
            if (addr) {
                setFormData(prev => ({ ...prev, billingAddress: addr.street, billingAddressLine2: addr.line2 || '', billingCity: addr.city, billingState: addr.state, billingZip: addr.zip }));
            } else {
                setFormData(prev => ({ ...prev, billingAddress: '', billingAddressLine2: '', billingCity: '', billingState: '', billingZip: '' }));
            }
        }
    };

    const handleStep1Continue = () => {
        setErrors(prev => ({...prev, email: '', password: ''}));
        const cleanEmail = sanitizeEmail(formData.email);
        if (!isValidEmail(cleanEmail)) {
            setErrors({ email: 'Valid email required' });
            return;
        }
        if (user && user.email === cleanEmail) {
            setActiveStep(2);
            return;
        }
        setShouldAdvance(true);
        if (emailAvailable === null && !emailChecking) handleEmailBlur();
    };

    const nextStep = (current: number) => {
        if (current === 2 && validateStep2()) setActiveStep(3);
    };

    const handleKeyDown = (e: React.KeyboardEvent, step: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (step === 1) {
                if (isLoginAction) handleQuickLogin();
                else handleStep1Continue();
            } else if (step === 2) {
                nextStep(2);
            }
        }
    };

    // --- AUTO ADVANCE HANDLERS ---
    
    const handleCardNumberChange = (e: any) => {
        setStripeStatus(prev => ({...prev, number: e.complete}));
        if (e.brand) setCardType(e.brand === 'unknown' ? '' : e.brand);
        
        // Auto-advance to Name
        if (e.complete && cardNameRef.current) {
            cardNameRef.current.focus();
        }
    };

    const handleCardNameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Programmatically focus the next Stripe Element (Expiry)
            const expiry = elements?.getElement(CardExpiryElement);
            if (expiry) expiry.focus();
        }
    };

    const handleExpiryChange = (e: any) => {
        setStripeStatus(prev => ({...prev, expiry: e.complete}));
        // Auto-advance to CVC
        if (e.complete) {
            const cvc = elements?.getElement(CardCvcElement);
            if (cvc) cvc.focus();
        }
    };

    const validateStep2 = () => {
        const newErrors: Record<string, string> = {};
        if (formData.name.length < 3) newErrors.name = 'Full name required';
        if (formData.address.length < 5) newErrors.address = 'Valid address required';
        if (formData.city.length < 2) newErrors.city = 'City required';
        if (!formData.state) newErrors.state = 'State required';
        if (formData.zip.length < 5) newErrors.zip = 'Valid ZIP required';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateFinal = () => {
        const newErrors: Record<string, string> = {};
        
        // If using new card, validate element status
        if (selectedCardId === 'new') {
            // Stripe handles card validation internally
            if (!stripeStatus.number) newErrors.cardNumber = 'Invalid card number';
            if (!stripeStatus.expiry) newErrors.expiry = 'Invalid expiry';
            if (!stripeStatus.cvc) newErrors.cvc = 'Invalid CVC';
        }

        if (!formData.sameAsShipping) {
            if (formData.billingAddress.length < 5) newErrors.billingAddress = 'Billing Address required';
            if (formData.billingCity.length < 2) newErrors.billingCity = 'City required';
            if (!formData.billingState) newErrors.billingState = 'State required';
            if (formData.billingZip.length < 5) newErrors.billingZip = 'Valid ZIP required';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleQuickLogin = async () => {
        setLoginProcessing(true);
        setErrors({});
        try {
            await login(formData.email, formData.password);
            setActiveStep(2);
            setEmailAvailable(true); 
        } catch (e: any) {
            let errorMessage = e.error || "Login failed.";
            if (typeof e.remainingAttempts === 'number') {
                 if (e.remainingAttempts === 0) {
                     errorMessage = "Too many attempts. Account locked temporarily.";
                 } else if (e.remainingAttempts <= 3) {
                     errorMessage = `${errorMessage} (${e.remainingAttempts} attempt${e.remainingAttempts === 1 ? '' : 's'} remaining)`;
                 }
            }
            setErrors({ password: errorMessage });
        } finally {
            setLoginProcessing(false);
        }
    };

    const handleApplyPromo = async () => {
        if (!formData.promoCode || isCheckingPromo) return;
        setIsCheckingPromo(true);
        setPromoError(null);
        
        try {
            // Apply Promo logic now uses server-side validation via context
            const saved = await applyPromo(formData.promoCode);
            
            if (saved > 0) {
                setDiscount(saved);
                setActivePromoCode(formData.promoCode.toUpperCase());
                savePromoCode(formData.promoCode.toUpperCase()); // Persist if manual entry
            } else {
                setPromoError('Invalid or expired promo code');
                setDiscount(0);
                setActivePromoCode(null);
            }
        } catch (e) {
            setPromoError('Failed to validate promo code.');
        } finally {
            setIsCheckingPromo(false);
        }
    };

    const handleRemovePromo = () => {
        setDiscount(0);
        setActivePromoCode(null);
        setFormData(prev => ({...prev, promoCode: ''}));
        setPromoError(null);
        savePromoCode(null); // Clear from storage
    };

    const handleManualQuantity = (cartItemId: string, value: string) => {
        const newQty = parseInt(value);
        if (!isNaN(newQty) && newQty >= 1) {
            const currentItem = cart.find(i => i.cartItemId === cartItemId);
            if (currentItem) {
                const delta = newQty - currentItem.quantity;
                if (delta !== 0) updateQuantity(cartItemId, delta);
            }
        }
    };

    // --- EXPRESS CHECKOUT HANDLER ---
    const handleExpressConfirm = async (event: any) => {
        if (!stripe || !elements) return;

        try {
            // 1. Create Payment Intent on the Backend
            const intentRes = await api.createPaymentIntent(settings, cart, activePromoCode || undefined, undefined, user?.email);

            // 2. Confirm the payment with Stripe using the clientSecret
            const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
                elements,
                clientSecret: intentRes.clientSecret,
                confirmParams: {
                    return_url: window.location.origin + '/checkout',
                },
                redirect: 'if_required'
            });

            if (confirmError) {
                alert(`Payment failed: ${confirmError.message}`);
                return;
            }

            // 3. If successful, finalize order in our DB
            if (paymentIntent.status === 'succeeded') {
                setIsProcessing(true);
                
                // ✅ Extract REAL wallet shipping/billing data
                const shipping = paymentIntent.shipping || {};
                const billing = (paymentIntent as any).billing_details || {};
                
                // Finalize on backend to record the order (verify amount again)
                const processRes = await api.processPayment(
                    settings, 
                    undefined,
                    cart, 
                    activePromoCode || undefined,
                    billing.email || user?.email || 'express@checkout.com', 
                    false,
                    user?.token,
                    paymentIntent.id
                );

                if (processRes.success) {
                    setIsOrderComplete(true);
                    savePromoCode(null);
                    
                    // ✅ Use actual wallet data instead of formData fallbacks
                    const orderId = await placeOrder({
                        email: billing.email || user?.email || 'express@checkout.com',
                        name: billing.name || 'Express User',
                        address: shipping.address?.line1 || billing.address?.line1 || 'Express Address',
                        city: shipping.address?.city || billing.address?.city,
                        state: shipping.address?.state || billing.address?.state,
                        zip: shipping.address?.postal_code || billing.address?.postal_code,
                        shippingAddressLine2: shipping.address?.line2 || '',
                        billingAddress: billing.address?.line1 || shipping.address?.line1 || 'Express Address',
                        billingCity: billing.address?.city || shipping.address?.city,
                        billingZip: billing.address?.postal_code || shipping.address?.postal_code
                    }, activePromoCode || undefined, undefined, processRes);
                    
                    navigate(`/order-confirmation/${orderId}`);
                }
            }
        } catch(e: any) {
            console.error(e);
            alert("Payment processing failed.");
            setIsProcessing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateStep2() || !validateFinal()) return;
        if (!stripe || !elements) return;
        
        setIsProcessing(true);
        
        // 1. Save Addresses Logic
        let addressesToSave = user?.addresses ? [...user.addresses] : [];
        let didUpdateAddresses = false;
        if (user && formData.saveAddress) {
             const exists = addressesToSave.some(a => a.street === formData.address && a.zip === formData.zip);
             if (!exists) {
                 addressesToSave.push({ id: crypto.randomUUID(), name: formData.name, street: formData.address, line2: formData.addressLine2, city: formData.city, state: formData.state, zip: formData.zip, isDefaultShipping: user.addresses?.length===0, isDefaultBilling: false });
                 didUpdateAddresses = true;
             }
        }
        if (didUpdateAddresses) await updateUserAddresses(addressesToSave);
        
        try {
            let paymentMethodId = '';

            if (selectedCardId === 'new') {
                const cardElement = elements.getElement(CardNumberElement);
                if (!cardElement) throw new Error("Card element not found");

                const { paymentMethod, error: stripeError } = await stripe.createPaymentMethod({
                    type: 'card',
                    card: cardElement,
                    billing_details: {
                        name: formData.cardName,
                        email: formData.email,
                        address: {
                            line1: formData.sameAsShipping ? formData.address : formData.billingAddress,
                            line2: formData.sameAsShipping ? formData.addressLine2 : formData.billingAddressLine2,
                            city: formData.sameAsShipping ? formData.city : formData.billingCity,
                            state: formData.sameAsShipping ? formData.state : formData.billingState,
                            postal_code: formData.sameAsShipping ? formData.zip : formData.billingZip,
                            country: 'US' 
                        }
                    }
                });

                if (stripeError) {
                    alert(`Payment Error: ${stripeError.message}`);
                    setIsProcessing(false);
                    return;
                }
                paymentMethodId = paymentMethod.id;
            } else {
                paymentMethodId = selectedCardId;
            }

            // Note: We send the cart structure, not the trusted total. The backend recalculates.
            const processRes = await api.processPayment(
                settings, 
                paymentMethodId, 
                cart, // Updated: Send Full Cart
                activePromoCode || undefined, // Use active state to ensure it's the one we displayed
                formData.email,
                saveCard && selectedCardId === 'new',
                user?.token
            );

            if (processRes.success) {
                // Set flag BEFORE placeOrder to prevent redirect race condition
                setIsOrderComplete(true);

                // Clear promo on successful order
                savePromoCode(null);

                const orderId = await placeOrder({
                    email: formData.email,
                    name: formData.name,
                    address: formData.address,
                    city: formData.city,
                    zip: formData.zip,
                    shippingAddressLine2: formData.addressLine2,
                    billingAddress: formData.sameAsShipping ? formData.address : formData.billingAddress,
                    billingAddressLine2: formData.sameAsShipping ? formData.addressLine2 : formData.billingAddressLine2,
                    billingCity: formData.sameAsShipping ? formData.city : formData.billingCity,
                    billingZip: formData.sameAsShipping ? formData.zip : formData.billingZip,
                }, activePromoCode || undefined, undefined, processRes); 
                
                navigate(`/order-confirmation/${orderId}`);
            } else {
                alert('Payment processing failed on server.');
                setIsProcessing(false);
            }

        } catch (e: any) {
            console.error("Checkout Error:", e);
            let msg = "An unexpected error occurred";
            if (e?.error && typeof e.error === 'string') msg = e.error;
            else if (e?.message) msg = e.message;
            
            alert(`Checkout failed: ${msg}`);
            setIsProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12">
            
            {/* Processing Overlay */}
            {isProcessing && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95">
                        <div className="h-20 w-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Landmark className="h-10 w-10 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Processing Securely</h3>
                        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                            Please wait while we connect to your financial institution. This may take a few moments...
                        </p>
                        <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden w-full">
                            <div className="absolute top-0 left-0 h-full bg-blue-600 w-1/3 animate-[slide_1.5s_infinite_ease-in-out]"></div>
                        </div>
                        <style>{`
                            @keyframes slide {
                                0% { left: -35%; width: 30%; }
                                50% { left: 35%; width: 60%; }
                                100% { left: 100%; width: 30%; }
                            }
                        `}</style>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                <h1 className="text-3xl font-display font-bold text-gray-900 mb-6">Checkout</h1>
                
                {/* Express Checkout moved to Top */}
                <div className="mb-8">
                    <div className="rounded-lg shadow-sm" style={{ overflow: 'visible !important' }}>
                        <ExpressCheckoutElement onConfirm={handleExpressConfirm} options={{ buttonType: { applePay: 'buy', googlePay: 'buy' } }} />
                    </div>
                    <div className="relative mt-6">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-gray-50 px-2 text-sm text-gray-500 font-medium">Or pay with card</span>
                        </div>
                    </div>
                </div>
                
                {/* 1. Contact Info */}
                <div className={`bg-white p-6 rounded-xl border transition-all ${activeStep === 1 ? 'border-black shadow-md' : 'border-gray-200 opacity-70'}`}>
                    <div className={`flex justify-between items-center ${activeStep === 1 ? 'mb-4' : 'cursor-pointer'}`} onClick={() => activeStep > 1 && setActiveStep(1)}>
                        <h2 className="text-lg font-bold font-display text-gray-900 flex items-center gap-2">
                            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs text-white ${activeStep > 1 ? 'bg-green-500' : 'bg-black'}`}>
                                {activeStep > 1 ? <CheckCircle className="w-4 h-4"/> : '1'}
                            </span>
                            Contact Information
                        </h2>
                        {activeStep > 1 && <button type="button" className="text-xs font-bold uppercase underline">Edit</button>}
                    </div>
                    
                    {activeStep === 1 && (
                        <div className="space-y-4 animate-in slide-in-from-top-2">
                            <InputField 
                                inputRef={emailRef}
                                name="email" 
                                label="Email Address" 
                                placeholder="you@example.com" 
                                value={formData.email} 
                                onChange={handleInput} 
                                onBlur={handleEmailBlur}
                                onKeyDown={(e: React.KeyboardEvent) => handleKeyDown(e, 1)}
                                error={errors.email} 
                                icon={
                                    emailChecking ? <Loader2 className="h-4 w-4 animate-spin text-gray-400"/> :
                                    emailAvailable === true ? <Check className="h-4 w-4 text-green-500"/> :
                                    emailAvailable === false ? <AlertCircle className="h-4 w-4 text-red-500"/> : null
                                }
                            />
                            
                            {(!user || isRegisteredEmail) && (
                                <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" id="createAccount" name="createAccount" checked={formData.createAccount} onChange={handleInput} className="h-4 w-4 text-black focus:ring-black border-gray-300 rounded" />
                                        <label htmlFor="createAccount" className="text-sm font-medium text-gray-700">
                                            {isRegisteredEmail 
                                                ? (user ? 'Switch to this account (Login required)' : 'Click to enter password and login') 
                                                : 'Create an account for faster checkout'}
                                        </label>
                                    </div>
                                    
                                    {formData.createAccount && (
                                        <div className="relative animate-in fade-in slide-in-from-top-2">
                                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">{isRegisteredEmail ? "Password" : "Create Password"}</label>
                                            <input 
                                                type={showPassword ? "text" : "password"}
                                                name="password"
                                                placeholder={isRegisteredEmail ? "Enter your password" : "Min 8 characters"}
                                                value={formData.password}
                                                onChange={handleInput}
                                                onKeyDown={(e) => handleKeyDown(e, 1)}
                                                className={`w-full border rounded-lg p-3 text-sm transition-all outline-none focus:ring-2 pr-10 ${errors.password ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-black focus:ring-black'}`}
                                            />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-8 text-gray-400 hover:text-black">
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                            {errors.password && <p className="text-red-500 text-xs mt-1 font-medium">{errors.password}</p>}
                                        </div>
                                    )}
                                </div>
                            )}
                            <button 
                                type="button" 
                                onClick={() => isLoginAction ? handleQuickLogin() : handleStep1Continue()} 
                                disabled={!isValidEmail(formData.email) || loginProcessing || shouldAdvance}
                                className="w-full bg-black text-white py-3 rounded-lg font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors mt-4 flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                {(loginProcessing || shouldAdvance || emailChecking) ? <Loader2 className="h-4 w-4 animate-spin"/> : (isLoginAction ? 'Login to proceed' : 'Continue to Shipping')}
                            </button>
                        </div>
                    )}
                    {activeStep > 1 && <p className="text-sm text-gray-600 pl-8">{formData.email}</p>}
                </div>

                {/* 2. Shipping Info */}
                <div className={`bg-white p-6 rounded-xl border transition-all ${activeStep === 2 ? 'border-black shadow-md' : 'border-gray-200 opacity-70'}`}>
                    <div className={`flex justify-between items-center ${activeStep === 2 ? 'mb-4' : 'cursor-pointer'}`} onClick={() => activeStep > 2 && setActiveStep(2)}>
                        <h2 className="text-lg font-bold font-display text-gray-900 flex items-center gap-2">
                            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs text-white ${activeStep > 2 ? 'bg-green-500' : (activeStep === 2 ? 'bg-black' : 'bg-gray-300')}`}>
                                {activeStep > 2 ? <CheckCircle className="w-4 h-4"/> : '2'}
                            </span>
                            Shipping Address
                        </h2>
                        {activeStep > 2 && <button type="button" className="text-xs font-bold uppercase underline">Edit</button>}
                    </div>

                    {activeStep === 2 && (
                        <div className="space-y-4 animate-in slide-in-from-top-2">
                            {user && user.addresses && user.addresses.length > 0 && (
                                <div className="mb-4">
                                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Saved Addresses</label>
                                    <div className="relative">
                                        <select 
                                            ref={shippingSelectRef}
                                            className="w-full border rounded-lg p-3 text-sm appearance-none bg-gray-50 hover:bg-white transition-colors cursor-pointer"
                                            onChange={(e) => handleAddressSelect(e, 'shipping')}
                                        >
                                            <option value="">-- Select Saved Address --</option>
                                            {user.addresses.map(addr => (
                                                <option key={addr.id} value={addr.id} selected={addr.isDefaultShipping || addr.isDefault}>
                                                    {addr.name} - {addr.street}, {addr.city}
                                                </option>
                                            ))}
                                            <option value="new">Use a new address...</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <InputField inputRef={shippingNameRef} name="name" label="Full Name" placeholder="Jane Doe" value={formData.name} onChange={handleInput} onKeyDown={(e: React.KeyboardEvent) => handleKeyDown(e, 2)} error={errors.name} />
                                <InputField name="address" label="Address" placeholder="123 Main St" value={formData.address} onChange={handleInput} onKeyDown={(e: React.KeyboardEvent) => handleKeyDown(e, 2)} error={errors.address} />
                                <InputField name="addressLine2" label="Apartment, Suite, etc." placeholder="Apt 4B" value={formData.addressLine2} onChange={handleInput} onKeyDown={(e: React.KeyboardEvent) => handleKeyDown(e, 2)} className="col-span-2" />
                                <div className="col-span-2 grid grid-cols-3 gap-4">
                                    <InputField name="city" label="City" placeholder="New York" value={formData.city} onChange={handleInput} onKeyDown={(e: React.KeyboardEvent) => handleKeyDown(e, 2)} error={errors.city} half={true} />
                                    <StateSelect name="state" value={formData.state} onChange={handleInput} onKeyDown={(e: React.KeyboardEvent) => handleKeyDown(e, 2)} error={errors.state} />
                                    <InputField name="zip" label="ZIP Code" placeholder="10001" maxLength={5} value={formData.zip} onChange={handleInput} onKeyDown={(e: React.KeyboardEvent) => handleKeyDown(e, 2)} error={errors.zip} half={true} />
                                </div>
                            </div>

                            {user && (user.addresses?.length === 0 || (!user.addresses?.find(a => a.street === formData.address))) && (
                                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded border border-gray-200">
                                    <input type="checkbox" id="saveAddress" name="saveAddress" checked={formData.saveAddress} onChange={handleInput} className="h-4 w-4 text-black focus:ring-black border-gray-300 rounded" />
                                    <label htmlFor="saveAddress" className="text-sm font-medium text-gray-700">Save this address for future orders</label>
                                </div>
                            )}

                            <button type="button" onClick={() => nextStep(2)} className="w-full bg-black text-white py-3 rounded-lg font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors mt-4">Continue to Payment</button>
                        </div>
                    )}
                    {activeStep > 2 && <p className="text-sm text-gray-600 pl-8">{formData.address} {formData.addressLine2}, {formData.city}, {formData.state} {formData.zip}</p>}
                </div>

                {/* 3. Payment - Stripe Elements */}
                <div className={`bg-white p-6 rounded-xl border transition-all ${activeStep === 3 ? 'border-black shadow-md' : 'border-gray-200 opacity-70'}`}>
                    <div className={`flex justify-between items-center ${activeStep === 3 ? 'mb-4' : ''}`}>
                        <h2 className="text-lg font-bold font-display text-gray-900 flex items-center gap-2">
                            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs text-white ${activeStep === 3 ? 'bg-black' : 'bg-gray-300'}`}>3</span>
                            Payment
                            <span className="flex gap-1 text-gray-400 ml-2 text-xs font-normal"><Lock className="h-3 w-3" /> Secure SSL</span>
                        </h2>
                    </div>
                    
                    {activeStep === 3 && (
                        <div className="animate-in slide-in-from-top-2">
                            {/* Saved Cards Selection */}
                            {savedCards.length > 0 && (
                                <div className="mb-6 space-y-3">
                                    <label className="block text-xs font-bold uppercase text-gray-500">Payment Method</label>
                                    <div className="space-y-2">
                                        {savedCards.map(card => (
                                            <label key={card.id} className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${selectedCardId === card.id ? 'border-black bg-gray-50 ring-1 ring-black' : 'border-gray-200 hover:bg-gray-50'}`}>
                                                <input 
                                                    type="radio" 
                                                    name="savedCard" 
                                                    value={card.id} 
                                                    checked={selectedCardId === card.id} 
                                                    onChange={() => setSelectedCardId(card.id)}
                                                    className="h-4 w-4 text-black focus:ring-black border-gray-300"
                                                />
                                                <div className="ml-3 flex items-center gap-2 flex-1">
                                                    <span className="font-bold uppercase text-sm">{card.card.brand}</span>
                                                    <span className="text-sm text-gray-600">•••• {card.card.last4}</span>
                                                    <span className="text-xs text-gray-400 ml-auto">Expires {card.card.exp_month}/{card.card.exp_year}</span>
                                                </div>
                                            </label>
                                        ))}
                                        <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${selectedCardId === 'new' ? 'border-black bg-gray-50 ring-1 ring-black' : 'border-gray-200 hover:bg-gray-50'}`}>
                                            <input 
                                                type="radio" 
                                                name="savedCard" 
                                                value="new"
                                                checked={selectedCardId === 'new'} 
                                                onChange={() => setSelectedCardId('new')}
                                                className="h-4 w-4 text-black focus:ring-black border-gray-300"
                                            />
                                            <span className="ml-3 text-sm font-bold">Use a new card</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {selectedCardId === 'new' && (
                                <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-xl shadow-xl text-white mb-6 relative overflow-hidden transition-all">
                                    <div className="absolute top-0 right-0 p-4 opacity-20"><CreditCard className="h-32 w-32" /></div>
                                    
                                    <div className="relative z-10 space-y-6">
                                        <div className="flex justify-between items-start">
                                            <div className="h-8 w-12 bg-yellow-500/80 rounded"></div>
                                            {cardType && <span className="font-bold uppercase tracking-wider text-sm bg-white/20 px-2 py-1 rounded">{cardType}</span>}
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-white tracking-widest">Card Number</label>
                                            <div className="border-b border-gray-600 hover:border-gray-500 transition-colors pb-1">
                                                <CardNumberElement 
                                                    options={{ style: stripeCardNumberStyle, showIcon: false }} 
                                                    onChange={handleCardNumberChange}
                                                    onReady={(el) => el.focus()}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex gap-6">
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[10px] uppercase font-bold text-white tracking-widest">Cardholder Name</label>
                                                <input 
                                                    ref={cardNameRef}
                                                    name="cardName"
                                                    value={formData.cardName}
                                                    onChange={handleInput}
                                                    onKeyDown={handleCardNameKeyDown}
                                                    placeholder="FULL NAME"
                                                    className="w-full bg-transparent border-0 border-b border-gray-600 hover:border-gray-600 text-sm font-medium text-white placeholder-gray-300 focus:ring-0 focus:border-white p-0 uppercase outline-none pb-1"
                                                />
                                            </div>
                                            <div className="w-20 space-y-1">
                                                <label className="text-[10px] uppercase font-bold text-white tracking-widest">Expires</label>
                                                <div className="border-b border-gray-600 hover:border-gray-500 transition-colors pb-1">
                                                    <CardExpiryElement 
                                                        options={{ style: stripeElementStyle }} 
                                                        onChange={handleExpiryChange}
                                                    />
                                                </div>
                                            </div>
                                            <div className="w-16 space-y-1 relative group">
                                                <label className="text-[10px] uppercase font-bold text-white tracking-widest flex items-center gap-1 cursor-help">
                                                    CVC 
                                                    <button type="button" onClick={() => setShowCvcHelp(!showCvcHelp)} className="focus:outline-none hover:text-gray-300">
                                                        <HelpCircle className="h-3 w-3"/>
                                                    </button>
                                                </label>
                                                <div className="border-b border-gray-600 hover:border-gray-500 transition-colors pb-1">
                                                    <CardCvcElement 
                                                        options={{ style: stripeElementStyle }} 
                                                        onChange={(e) => setStripeStatus(prev => ({...prev, cvc: e.complete}))}
                                                    />
                                                </div>
                                                {showCvcHelp && (
                                                    <div className="absolute bottom-full right-0 mb-3 bg-white text-black p-3 rounded-lg shadow-xl z-20 w-48 border border-gray-200 animate-in fade-in zoom-in-95">
                                                        <div className="text-xs font-bold mb-2">Security Code Location</div>
                                                        <div className="flex gap-2 mb-1">
                                                            <div className="bg-gray-100 border border-gray-300 rounded w-16 h-10 relative">
                                                                <div className="absolute top-1 right-1 w-8 h-1 bg-black/10"></div>
                                                                <div className="absolute bottom-2 right-2 w-4 h-4 border-2 border-red-500 rounded-full"></div>
                                                            </div>
                                                            <div className="text-[10px] text-gray-500 leading-tight">Back (Visa/MC)</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {selectedCardId === 'new' && Object.keys(errors).some(k => ['cardNumber','expiry','cvc'].includes(k)) && (
                                <p className="text-red-500 text-sm font-medium mb-4 flex items-center gap-2"><AlertOctagon className="h-4 w-4"/> Please complete payment details above.</p>
                            )}

                            {user && selectedCardId === 'new' && (
                                <div className="flex items-center gap-3 mb-6 bg-blue-50 p-3 rounded border border-blue-100">
                                    <input 
                                        type="checkbox" 
                                        id="saveCard" 
                                        checked={saveCard} 
                                        onChange={(e) => setSaveCard(e.target.checked)} 
                                        className="h-4 w-4 text-black focus:ring-black border-gray-300 rounded" 
                                    />
                                    <label htmlFor="saveCard" className="text-sm font-medium text-gray-700">Save this card securely for future purchases</label>
                                </div>
                            )}

                            <div className="flex items-center gap-3 mt-6">
                                <input type="checkbox" id="sameAsShipping" name="sameAsShipping" checked={formData.sameAsShipping} onChange={handleInput} className="h-4 w-4 text-black focus:ring-black border-gray-300 rounded" />
                                <label htmlFor="sameAsShipping" className="text-sm font-medium text-gray-700">Billing address same as shipping</label>
                            </div>

                            {!formData.sameAsShipping && (
                                <div className="mt-4 animate-in fade-in slide-in-from-top-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    {user && user.addresses && user.addresses.length > 0 && (
                                        <div className="mb-4">
                                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Saved Billing Addresses</label>
                                            <div className="relative">
                                                <select 
                                                    className="w-full border rounded-lg p-3 text-sm appearance-none bg-white transition-colors cursor-pointer"
                                                    onChange={(e) => handleAddressSelect(e, 'billing')}
                                                >
                                                    <option value="">-- Select Billing Address --</option>
                                                    {user.addresses.map(addr => (
                                                        <option key={addr.id} value={addr.id} selected={addr.isDefaultBilling}>
                                                            {addr.name} - {addr.street}
                                                        </option>
                                                    ))}
                                                    <option value="new">Use new billing address...</option>
                                                </select>
                                                <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-gray-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <InputField name="billingAddress" label="Billing Address" placeholder="123 Billing St" value={formData.billingAddress} onChange={handleInput} error={errors.billingAddress} />
                                        <InputField name="billingAddressLine2" label="Apt, Suite, etc." placeholder="Apt 2" value={formData.billingAddressLine2} onChange={handleInput} className="col-span-2" />
                                        <div className="col-span-2 grid grid-cols-3 gap-4">
                                            <InputField name="billingCity" label="City" placeholder="City" value={formData.billingCity} onChange={handleInput} error={errors.billingCity} half={true} />
                                            <StateSelect name="billingState" value={formData.billingState} onChange={handleInput} error={errors.billingState} />
                                            <InputField name="billingZip" label="ZIP" placeholder="ZIP" maxLength={5} value={formData.billingZip} onChange={handleInput} error={errors.billingZip} half={true} />
                                        </div>
                                    </div>

                                    {user && (
                                        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-200">
                                            <input type="checkbox" id="saveBillingAddress" name="saveBillingAddress" checked={formData.saveBillingAddress} onChange={handleInput} className="h-4 w-4 text-black focus:ring-black border-gray-300 rounded" />
                                            <label htmlFor="saveBillingAddress" className="text-sm font-medium text-gray-700">Save this billing address</label>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <button 
                                type="submit" 
                                disabled={isProcessing || !stripe || !elements}
                                className="w-full bg-black text-white py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg transform active:scale-[0.99] mt-8 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessing ? <Loader2 className="h-5 w-5 animate-spin"/> : `Pay $${finalTotal.toFixed(2)}`}
                            </button>

                            <div className="mt-4 flex justify-center gap-2 text-gray-400">
                                <CreditCard className="h-5 w-5"/>
                                <span className="text-xs">Secure Encrypted Payment</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Order Summary */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 h-fit sticky top-24">
                <h2 className="text-xl font-bold font-display text-gray-900 mb-6">Order Summary</h2>
                
                <div className="space-y-4 mb-6 max-h-60 overflow-y-auto pr-2">
                    {cart.map(item => (
                        <div key={item.cartItemId} className="flex gap-4 group items-start">
                            <div className="h-20 w-20 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 relative flex-shrink-0">
                                <img src={item.images[0]} className="h-full w-full object-cover" />
                            </div>
                            
                            <div className="flex-1 flex flex-col justify-between min-h-[5rem]">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight">{item.title}</h3>
                                        <p className="text-xs text-gray-500 mt-1">{item.selectedSize} / {item.selectedColor}</p>
                                    </div>
                                    <div className="text-right">
                                        {item.originalPrice && item.originalPrice > item.price ? (
                                            <>
                                                <p className="text-xs text-gray-400 line-through">${(item.originalPrice * item.quantity).toFixed(2)}</p>
                                                <p className="text-sm font-bold text-red-600">${(item.price * item.quantity).toFixed(2)}</p>
                                            </>
                                        ) : (
                                            <p className="text-sm font-bold text-gray-900 ml-2">${(item.price * item.quantity).toFixed(2)}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                        <div className="flex items-center border border-gray-200 rounded-lg h-7 bg-white shadow-sm">
                                            <button type="button" onClick={() => updateQuantity(item.cartItemId, -1)} disabled={item.quantity <= 1} className="px-2 h-full hover:bg-gray-50 text-gray-500 hover:text-black transition-colors disabled:opacity-50 border-r border-gray-100"><Minus className="h-3 w-3"/></button>
                                            <input 
                                                type="number" 
                                                min="1"
                                                value={item.quantity} 
                                                onChange={(e) => handleManualQuantity(item.cartItemId, e.target.value)}
                                                className="w-8 text-center text-xs font-bold focus:outline-none appearance-none bg-transparent"
                                            />
                                            <button type="button" onClick={() => updateQuantity(item.cartItemId, 1)} className="px-2 h-full hover:bg-gray-50 text-gray-500 hover:text-black transition-colors border-l border-gray-100"><Plus className="h-3 w-3"/></button>
                                        </div>
                                        <button type="button" onClick={() => removeFromCart(item.cartItemId)} className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded transition-colors" title="Remove">
                                            <Trash2 className="h-4 w-4"/>
                                        </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="border-t border-gray-100 pt-6 space-y-3">
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Subtotal</span>
                        <span>${cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Shipping</span>
                        {shippingCalculation.isFree ? (
                            <span className="text-green-600 font-bold flex items-center gap-2">
                                <span className="text-gray-400 line-through font-normal text-xs">${shippingCalculation.savings.toFixed(2)}</span>
                                Free
                            </span>
                        ) : (
                            <span className="font-bold">${shippingCalculation.cost.toFixed(2)}</span>
                        )}
                    </div>
                    {discount > 0 && (
                        <div className="flex justify-between text-sm text-green-600 font-medium">
                            <span>Discount</span>
                            <span>-${discount.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                        <span className="text-lg font-bold text-gray-900">Total</span>
                        <span className="text-xl font-bold text-gray-900">${finalTotal.toFixed(2)}</span>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100">
                    {discount > 0 && activePromoCode ? (
                        <div className="flex justify-between items-center bg-green-50 p-3 rounded-lg border border-green-200">
                            <div className="flex items-center gap-2">
                                <Tag className="h-4 w-4 text-green-600"/>
                                <span className="text-green-700 font-bold text-sm">Code: {activePromoCode}</span>
                            </div>
                            <button 
                                type="button" 
                                onClick={handleRemovePromo} 
                                className="text-red-500 hover:text-red-700 text-xs font-bold uppercase flex items-center gap-1"
                            >
                                <X className="h-3 w-3"/> Remove
                            </button>
                        </div>
                    ) : (
                        <div>
                            <div className="flex gap-2">
                                <input 
                                    name="promoCode"
                                    placeholder="Promo Code"
                                    value={formData.promoCode}
                                    onChange={handleInput}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyPromo(); } }}
                                    className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-black focus:border-black ${promoError ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-300'}`}
                                />
                                <button 
                                    type="button" 
                                    onClick={handleApplyPromo} 
                                    disabled={isCheckingPromo || !formData.promoCode}
                                    className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg text-sm font-bold uppercase hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isCheckingPromo ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Apply'}
                                </button>
                            </div>
                            {promoError && (
                                <p className="text-red-500 text-xs mt-2 font-medium flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                                    <AlertCircle className="h-3 w-3"/> {promoError}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </form>
    );
};

export const Checkout: React.FC = () => {
    const { settings, cartTotal, content } = useStore();
    const [stripePromise, setStripePromise] = useState<any>(null);

    useEffect(() => {
        if (settings?.stripePublishableKey) {
            setStripePromise(loadStripe(settings.stripePublishableKey));
        }
    }, [settings?.stripePublishableKey]);

    // Calculate estimated total for Elements initialization to enable Express Checkout buttons
    const estimatedTotal = useMemo(() => {
         const baseShipping = content?.shipping?.enabled ? (content.shipping.baseRate || 0) : 0;
         // Ensure integer cents and minimum of 50 cents (50) to prevent initialization errors
         return Math.max(50, Math.round((cartTotal + baseShipping) * 100));
    }, [cartTotal, content]);

    // Memoize options to prevent unnecessary re-renders of Elements wrapper which clears Express buttons
    // Removed explicit payment_method_types to allow Dashboard defaults (which usually include wallets)
    const options = useMemo(() => ({
        mode: 'payment' as const,
        amount: estimatedTotal,
        currency: 'usd',
        appearance: { theme: 'stripe' as const },
        loader: 'auto' as const,
        paymentMethodCreation: 'manual' as const,
        // Default to dashboard settings for payment methods to enable wallets properly
    }), [estimatedTotal]);

    // If we don't have settings yet or stripe key is missing, handle gracefully
    if (!settings) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    
    // If Stripe key is missing in settings (e.g. not configured), show error or fallback
    if (!settings.stripePublishableKey) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
                    <AlertOctagon className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold mb-2">Checkout Unavailable</h2>
                    <p className="text-gray-500">Payment gateway is not configured. Please contact the administrator.</p>
                    <Link to="/" className="block mt-6 text-blue-600 font-bold hover:underline">Return Home</Link>
                </div>
            </div>
        );
    }

    if (!stripePromise) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <div className="min-h-screen bg-gray-50 pb-12 font-sans">
            <SEO title="Checkout" description="Secure Checkout" />
            <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <Breadcrumbs />
                </div>
                {/* Adding key forces re-mount if currency/amount drastically changes, ensuring buttons refresh if needed */}
                <Elements key={estimatedTotal} stripe={stripePromise} options={options}>
                    <CheckoutForm />
                </Elements>
            </div>
        </div>
    );
};
