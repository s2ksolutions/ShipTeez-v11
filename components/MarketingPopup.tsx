import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreProvider';
import { X, Tag } from 'lucide-react';
import { PopupConfig } from '../types';

export const MarketingPopup: React.FC = () => {
    const { content, user } = useStore();
    const [activePopup, setActivePopup] = useState<'welcome' | 'exit' | null>(null);
    
    // Welcome Popup (Timer)
    useEffect(() => {
        if (!content?.marketing?.welcomePopup?.enabled) return;
        
        const hasSeen = sessionStorage.getItem('artisan_welcome_seen');
        if (hasSeen) return;

        // Validation Logic
        const config = content.marketing.welcomePopup;
        if (config.targetNonPurchasersOnly && user && user.orders && user.orders.length > 0) {
            // User has orders, check date if set
            const lastOrder = user.orders[0]; // Assumes sorted
            if (config.daysSinceLastOrder) {
                const diffTime = Math.abs(Date.now() - lastOrder.date);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                if (diffDays < config.daysSinceLastOrder) {
                    return; // Too recent
                }
            } else {
                return; // Has orders, so suppress
            }
        }

        const timer = setTimeout(() => {
            // Only show if no other popup is active
            setActivePopup(prev => prev ? prev : 'welcome');
        }, content.marketing.welcomePopup.delay * 1000);

        return () => clearTimeout(timer);
    }, [content, user]);

    // Exit Intent Popup
    useEffect(() => {
        if (!content?.marketing?.exitPopup?.enabled) return;
        const hasSeen = sessionStorage.getItem('artisan_exit_seen');
        if (hasSeen) return;

        const onMouseLeave = (e: MouseEvent) => {
            if (e.clientY <= 0) {
                // Show if nothing else is showing
                setActivePopup(prev => prev ? prev : 'exit');
            }
        };
        document.addEventListener('mouseleave', onMouseLeave);
        return () => document.removeEventListener('mouseleave', onMouseLeave);
    }, [content]);

    const handleClose = () => {
        if (activePopup === 'welcome') {
            sessionStorage.setItem('artisan_welcome_seen', 'true');
        } else if (activePopup === 'exit') {
            sessionStorage.setItem('artisan_exit_seen', 'true');
        }
        setActivePopup(null);
    };

    if (!activePopup || !content?.marketing) return null;

    let config: PopupConfig | undefined;
    if (activePopup === 'welcome') config = content.marketing.welcomePopup;
    else if (activePopup === 'exit') config = content.marketing.exitPopup;

    if (!config) return null;
    const { title, description, promoCode } = config;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm" onClick={handleClose}></div>
            <div className="relative bg-white w-full max-w-md p-8 text-center animate-in zoom-in-95 shadow-2xl">
                <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-black">
                    <X className="h-6 w-6" />
                </button>
                
                <div className="mb-6 mx-auto h-16 w-16 bg-black text-white rounded-full flex items-center justify-center">
                    <Tag className="h-8 w-8" />
                </div>

                <h2 className="text-3xl font-display font-bold text-gray-900 mb-2">{title}</h2>
                <p className="text-gray-600 mb-6">{description}</p>
                
                {promoCode && (
                    <div className="bg-gray-100 p-4 border border-dashed border-gray-400 rounded mb-6">
                        <p className="text-xs uppercase font-bold text-gray-500 mb-1">Use Code:</p>
                        <p className="text-xl font-mono font-bold tracking-widest select-all">{promoCode}</p>
                    </div>
                )}

                <button onClick={handleClose} className="w-full bg-black text-white py-3 font-bold uppercase tracking-widest hover:bg-gray-800">
                    {activePopup === 'exit' ? 'Stay & Shop' : 'Shop Now'}
                </button>
                <button onClick={handleClose} className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline">
                    No thanks, I hate saving money
                </button>
            </div>
        </div>
    );
};