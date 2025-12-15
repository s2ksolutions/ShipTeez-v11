
import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../context/StoreProvider';
import { X, Plus, Minus, Trash2, ShoppingBag, Lock, Tag, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const CartDrawer: React.FC = () => {
    const { isCartOpen, closeCart, cart, updateQuantity, removeFromCart, clearCart, cartTotal, content, savedPromoCode, savePromoCode, showToast } = useStore();
    const navigate = useNavigate();
    
    const drawerRef = useRef<HTMLDivElement>(null);
    // Track previous cart length to distinguish between "opened empty" vs "emptied by user"
    const prevCountRef = useRef(cart.length);

    const [promoInput, setPromoInput] = useState('');

    useEffect(() => {
        // Auto-redirect to shop ONLY if cart becomes empty while open (user removed last item)
        if (isCartOpen && prevCountRef.current > 0 && cart.length === 0) {
            const timer = setTimeout(() => {
                closeCart();
            }, 600); 
            return () => clearTimeout(timer);
        }
        // Update ref
        prevCountRef.current = cart.length;
    }, [cart.length, isCartOpen, closeCart]);

    // Focus Trap
    useEffect(() => {
        if (!isCartOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeCart();
            if (e.key !== 'Tab') return;

            const element = drawerRef.current;
            if (!element) return;

            const focusableElements = element.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            
            const firstElement = focusableElements[0] as HTMLElement;
            const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

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
    }, [isCartOpen, closeCart]);

    if (!isCartOpen) return null;

    const handleCheckout = () => {
        closeCart();
        navigate('/checkout');
    };

    const handleRemove = (item: any) => {
        removeFromCart(item.cartItemId);
    };

    const handleManualQuantity = (cartItemId: string, value: string) => {
        const newQty = parseInt(value);
        if (!isNaN(newQty) && newQty >= 1) {
            // Calculate delta since updateQuantity expects a difference
            const currentItem = cart.find(i => i.cartItemId === cartItemId);
            if (currentItem) {
                const delta = newQty - currentItem.quantity;
                if (delta !== 0) updateQuantity(cartItemId, delta);
            }
        }
    };

    const handleSavePromo = () => {
        if (promoInput.trim()) {
            savePromoCode(promoInput.trim());
            setPromoInput('');
            showToast("Promo code saved for checkout", "success");
        }
    };

    const handleRemovePromo = () => {
        savePromoCode(null);
    };

    const qualifiesForFreeShipping = content?.shipping?.freeShippingThreshold > 0 && cartTotal >= content.shipping.freeShippingThreshold;

    return (
        <div className="fixed inset-0 z-[60] flex justify-end">
            {/* Lighter backdrop: bg-black/25 */}
            <div className="fixed inset-0 bg-black/25 backdrop-blur-sm transition-opacity" onClick={closeCart} />
            
            <div ref={drawerRef} className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
                <div className="p-4 flex items-center justify-between border-b border-gray-100 bg-white z-10">
                    <h2 className="text-lg font-display font-bold uppercase tracking-wider flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5" /> Your Cart <span className="bg-gray-100 text-gray-900 text-xs px-2 py-0.5 rounded-full ml-1">{cart.reduce((a,c) => a + c.quantity, 0)}</span>
                    </h2>
                    <div className="flex items-center gap-2">
                        {cart.length > 0 && (
                            <button onClick={clearCart} className="text-xs text-gray-500 hover:text-red-500 underline mr-2">
                                Clear
                            </button>
                        )}
                        <button onClick={closeCart} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-gray-500 animate-in fade-in zoom-in-95">
                            <div className="h-20 w-20 bg-gray-50 rounded-full flex items-center justify-center">
                                <ShoppingBag className="h-10 w-10 opacity-20" />
                            </div>
                            <p className="text-lg font-medium">Your cart is empty.</p>
                            <button onClick={() => { closeCart(); navigate('/'); }} className="text-black underline font-bold hover:text-gray-700 transition-colors">
                                Start Shopping
                            </button>
                        </div>
                    ) : (
                        cart.map((item) => (
                            <div key={item.cartItemId} className="flex gap-4 group">
                                <div className="h-28 w-24 flex-shrink-0 overflow-hidden bg-gray-100 border border-gray-200 rounded-md relative">
                                    <img src={item.images[0]} alt={item.title} className="h-full w-full object-cover object-center" />
                                </div>
                                <div className="flex flex-1 flex-col justify-between py-1">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug pr-4">
                                                <Link to={`/product/${item.id}`} onClick={closeCart} className="hover:underline">
                                                    {item.title}
                                                </Link>
                                            </h3>
                                            <p className="text-sm font-bold font-mono">${(item.price * item.quantity).toFixed(2)}</p>
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500 uppercase tracking-wide">{item.selectedSize} / {item.selectedColor}</p>
                                    </div>
                                    
                                    <div className="flex items-center justify-between">
                                        {/* Quantity Controls */}
                                        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden h-8">
                                            <button 
                                                onClick={() => updateQuantity(item.cartItemId, -1)} 
                                                className="px-2 h-full hover:bg-gray-100 border-r border-gray-200 transition-colors flex items-center justify-center text-gray-600 hover:text-black"
                                                disabled={item.quantity <= 1}
                                            >
                                                <Minus className="h-3 w-3" />
                                            </button>
                                            <input 
                                                type="number" 
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => handleManualQuantity(item.cartItemId, e.target.value)}
                                                className="w-10 text-center text-xs font-bold focus:outline-none h-full appearance-none m-0"
                                            />
                                            <button 
                                                onClick={() => updateQuantity(item.cartItemId, 1)} 
                                                className="px-2 h-full hover:bg-gray-100 border-l border-gray-200 transition-colors flex items-center justify-center text-gray-600 hover:text-black"
                                            >
                                                <Plus className="h-3 w-3" />
                                            </button>
                                        </div>

                                        <button 
                                            onClick={() => handleRemove(item)} 
                                            className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-all"
                                            title="Remove Item"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {cart.length > 0 && (
                    <div className="border-t border-gray-100 p-6 bg-gray-50">
                        {/* Promo Code Logic */}
                        <div className="mb-6">
                            {savedPromoCode ? (
                                <div className="bg-green-50 border border-green-100 rounded-lg p-3 flex justify-between items-center animate-in fade-in slide-in-from-top-2">
                                    <div>
                                        <p className="text-xs font-bold text-green-700 flex items-center gap-1">
                                            <Check className="h-3 w-3" /> Code saved for checkout
                                        </p>
                                        <p className="text-sm font-mono font-medium text-green-800 mt-0.5">{savedPromoCode}</p>
                                    </div>
                                    <button 
                                        onClick={handleRemovePromo}
                                        className="text-gray-400 hover:text-red-500 p-1"
                                        title="Remove saved code"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500 flex items-center gap-1">
                                        <Tag className="h-3 w-3" /> Have a promo code?
                                    </label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={promoInput}
                                            onChange={e => setPromoInput(e.target.value)}
                                            className="text-sm border-gray-300 rounded focus:ring-black focus:border-black px-3 py-2 w-full"
                                            placeholder="Enter code"
                                        />
                                        <button 
                                            onClick={handleSavePromo} 
                                            className="bg-gray-200 hover:bg-black hover:text-white text-gray-900 px-4 text-xs uppercase font-bold rounded transition-colors"
                                            disabled={!promoInput.trim()}
                                        >
                                            Save
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-400">Code will be automatically applied at checkout.</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2 mb-6 border-t border-gray-200 pt-4">
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Subtotal</span>
                                <span>${cartTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Shipping</span>
                                {qualifiesForFreeShipping ? (
                                    <span className="text-green-600 font-bold">You qualify for Free Shipping! 😉</span>
                                ) : (
                                    <span>Calculated at checkout</span>
                                )}
                            </div>
                            <div className="flex justify-between text-lg font-bold text-gray-900 pt-4 border-t border-gray-200">
                                <span>Total</span>
                                <span>${cartTotal.toFixed(2)}</span>
                            </div>
                        </div>
                        <button onClick={handleCheckout} className="w-full bg-black text-white py-4 rounded-xl uppercase font-bold tracking-widest hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl transform active:scale-[0.99]">
                            Checkout Now
                        </button>
                        <div className="mt-4 flex items-center justify-center gap-2 text-gray-400">
                            <Lock className="h-3 w-3" />
                            <span className="text-[10px] font-medium uppercase tracking-wide">Secure Encrypted Checkout</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
