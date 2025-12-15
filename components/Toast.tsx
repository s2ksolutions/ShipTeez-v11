import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { useStore } from '../context/StoreProvider';

export const Toast: React.FC = () => {
  const { toast, hideToast, isCartOpen, isWishlistOpen } = useStore();
  const [offsetStyle, setOffsetStyle] = useState({});

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        hideToast();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast, hideToast]);

  // Smart Positioning: If a side drawer is open on desktop, shift the "center" 
  useEffect(() => {
      const isDesktop = window.innerWidth >= 768; // md breakpoint
      if ((isCartOpen || isWishlistOpen) && isDesktop) {
          // Drawer width is 28rem (w-md), so shift by half of that
          setOffsetStyle({ transform: 'translateX(calc(-50% - 14rem))' });
      } else {
          setOffsetStyle({});
      }
  }, [isCartOpen, isWishlistOpen]);

  if (!toast) return null;

  return (
    <div 
        className="fixed z-[100] left-1/2 -translate-x-1/2 top-24 md:top-auto md:bottom-10 animate-in fade-in duration-300 pointer-events-none"
        style={offsetStyle}
    >
      <div className={`pointer-events-auto flex items-center gap-2 md:gap-3 px-4 py-3 md:px-6 md:py-4 rounded-full shadow-2xl border backdrop-blur-md ${
        toast.type === 'success' 
            ? 'bg-black/90 text-white border-gray-800' 
            : 'bg-red-600/90 text-white border-red-700'
      }`}>
        {toast.type === 'success' ? <CheckCircle className="h-4 w-4 md:h-5 md:w-5" /> : <AlertCircle className="h-4 w-4 md:h-5 md:w-5" />}
        <span className="text-xs md:text-sm font-bold uppercase tracking-wide whitespace-nowrap">{toast.message}</span>
        <button onClick={hideToast} className="ml-1 md:ml-2 hover:opacity-70">
          <X className="h-3 w-3 md:h-4 md:w-4" />
        </button>
      </div>
    </div>
  );
};