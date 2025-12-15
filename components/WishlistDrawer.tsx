
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useStore } from '../context/StoreProvider';
import { X, Heart, ShoppingBag, Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Product } from '../types';

export const WishlistDrawer: React.FC = () => {
    const { isWishlistOpen, closeWishlist, wishlist, toggleWishlist, clearWishlist, addToCart } = useStore();
    const navigate = useNavigate();
    
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [isInitialLoad, setIsInitialLoad] = useState(false);
    
    const drawerRef = useRef<HTMLDivElement>(null);
    // Track previous size to allow opening empty, but closing on removal
    const prevSizeRef = useRef(wishlist.size);

    useEffect(() => {
        const loadData = async () => {
            if (isWishlistOpen && allProducts.length === 0) {
                setIsInitialLoad(true);
                try {
                    const all = await db.getAllProducts();
                    setAllProducts(all);
                } catch(e) {
                    console.error(e);
                } finally {
                    setIsInitialLoad(false);
                }
            }
        };
        loadData();
    }, [isWishlistOpen]);

    // Focus Trap
    useEffect(() => {
        if (!isWishlistOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeWishlist();
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
    }, [isWishlistOpen, closeWishlist]);

    // Auto-close if user removes the last item (transition from >0 to 0)
    useEffect(() => {
        if (isWishlistOpen && prevSizeRef.current > 0 && wishlist.size === 0) {
            closeWishlist();
        }
        prevSizeRef.current = wishlist.size;
    }, [wishlist.size, isWishlistOpen, closeWishlist]);

    // Derive visible items synchronously
    const visibleItems = useMemo(() => {
        return allProducts.filter(p => wishlist.has(p.id));
    }, [allProducts, wishlist]);

    if (!isWishlistOpen) return null;

    const handleAddToCart = (product: Product) => {
        const defaultSize = product.sizes?.[0];
        const defaultColor = product.colors?.[0];
        // Pass true to ensure drawer opens
        addToCart(product, 1, defaultSize, defaultColor, true);
    };

    return (
        <div className="fixed inset-0 z-[60] flex justify-end">
            {/* Lighter backdrop: bg-black/25 */}
            <div className="fixed inset-0 bg-black/25 backdrop-blur-sm transition-opacity" onClick={closeWishlist} />
            
            <div ref={drawerRef} className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
                <div className="p-4 flex items-center justify-between border-b border-gray-100 bg-white z-10">
                    <h2 className="text-lg font-display font-bold uppercase tracking-wider flex items-center gap-2">
                        <Heart className="h-5 w-5 fill-black" /> Your Wishlist <span className="bg-gray-100 text-gray-900 text-xs px-2 py-0.5 rounded-full ml-1">{wishlist.size}</span>
                    </h2>
                    <div className="flex items-center gap-2">
                        {wishlist.size > 0 && (
                            <button onClick={clearWishlist} className="text-xs text-gray-500 hover:text-red-500 underline mr-2">
                                Clear
                            </button>
                        )}
                        <button onClick={closeWishlist} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {isInitialLoad ? (
                        <div className="flex h-full items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
                        </div>
                    ) : visibleItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-gray-500 animate-in fade-in zoom-in-95">
                            <div className="h-20 w-20 bg-gray-50 rounded-full flex items-center justify-center">
                                <Heart className="h-10 w-10 opacity-20" />
                            </div>
                            <p className="text-lg font-medium">Your wishlist is empty.</p>
                            <button onClick={() => { closeWishlist(); navigate('/'); }} className="text-black underline font-bold hover:text-gray-700 transition-colors">
                                Start Shopping
                            </button>
                        </div>
                    ) : (
                        visibleItems.map((item) => (
                            <div key={item.id} className="flex gap-4 group animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="h-28 w-24 flex-shrink-0 overflow-hidden bg-gray-100 border border-gray-200 rounded-md relative cursor-pointer" onClick={() => { closeWishlist(); navigate(`/product/${item.slug || item.id}`); }}>
                                    <img src={item.images[0]} alt={item.title} className="h-full w-full object-cover object-center" />
                                </div>
                                <div className="flex flex-1 flex-col justify-between py-1">
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug hover:underline cursor-pointer" onClick={() => { closeWishlist(); navigate(`/product/${item.slug || item.id}`); }}>
                                            {item.title}
                                        </h3>
                                        <p className="text-sm font-mono text-gray-500 mt-1">${item.price.toFixed(2)}</p>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 mt-2">
                                        <button 
                                            onClick={() => handleAddToCart(item)}
                                            className="flex-1 bg-black text-white px-3 py-2 text-xs font-bold uppercase rounded hover:bg-gray-800 flex items-center justify-center gap-2 transition-transform active:scale-95"
                                        >
                                            <ShoppingBag className="h-3 w-3" /> Add to Cart
                                        </button>
                                        <button 
                                            onClick={() => toggleWishlist(item.id)} 
                                            className="text-gray-400 hover:text-red-500 p-2 rounded border border-gray-200 hover:border-red-200 hover:bg-red-50 transition-all"
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
            </div>
        </div>
    );
};
