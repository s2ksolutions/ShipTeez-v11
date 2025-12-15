
import React, { useEffect, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Shop } from './pages/Shop';
import { ProductDetails } from './pages/ProductDetails';
import { OrderStatus } from './pages/OrderStatus';
import { Account } from './pages/Account';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Wishlist } from './pages/Wishlist';
import { Checkout } from './pages/Checkout';
import { OrderConfirmation } from './pages/OrderConfirmation';
import { PolicyPage } from './pages/PolicyPage';
import { AuthCallback } from './pages/AuthCallback';
import { VerifyEmail } from './pages/VerifyEmail';
import { Unsubscribe } from './pages/Unsubscribe';
import { StoreProvider, useStore } from './context/StoreProvider';
import { CartDrawer } from './components/CartDrawer';
import { WishlistDrawer } from './components/WishlistDrawer';
import { ChatBot } from './components/ChatBot';
import { Footer } from './components/Footer';
import { MarketingPopup } from './components/MarketingPopup';
import { Toast } from './components/Toast';
import { ScrollToTop } from './components/ScrollToTop';
import { Loader2 } from 'lucide-react';

// Lazy Load Admin Modules to create separate bundles
const Admin = React.lazy(() => import('./pages/Admin').then(module => ({ default: module.Admin })));
const CustomerServicePanel = React.lazy(() => import('./pages/CustomerServicePanel').then(module => ({ default: module.CustomerServicePanel })));

const ThemeInjector: React.FC = () => {
    const { content } = useStore();
    
    useEffect(() => {
        if (!content?.theme) return;
        const root = document.documentElement;
        
        // Colors
        root.style.setProperty('--color-primary', content.theme.primary);
        root.style.setProperty('--color-secondary', content.theme.secondary);
        root.style.setProperty('--color-accent', content.theme.accent);
        root.style.setProperty('--color-background', content.theme.background);
        root.style.setProperty('--color-text', content.theme.text);
        
        // Button Text Colors (Fallbacks to ensure readability if not set)
        root.style.setProperty('--color-btn-text-primary', content.theme.primaryButtonText || '#ffffff');
        root.style.setProperty('--color-btn-text-secondary', content.theme.secondaryButtonText || content.theme.text);

        // Fonts Logic
        const dynamicGoogleId = 'dynamic-google-font';
        const dynamicCustomId = 'dynamic-custom-font';
        
        // Remove previous dynamic fonts to prevent conflicts
        const prevGoogle = document.getElementById(dynamicGoogleId);
        if (prevGoogle) prevGoogle.remove();
        
        const prevCustom = document.getElementById(dynamicCustomId);
        if (prevCustom) prevCustom.remove();

        if (content.theme.googleFontName) {
             const link = document.createElement('link');
             link.href = `https://fonts.googleapis.com/css2?family=${content.theme.googleFontName.replace(/ /g, '+')}:wght@300;400;500;700&display=swap`;
             link.rel = 'stylesheet';
             link.id = dynamicGoogleId;
             document.head.appendChild(link);
             
             // Apply the font family
             root.style.setProperty('--font-family', `'${content.theme.googleFontName}', sans-serif`);
        } else if (content.theme.customFontUrl) {
             const style = document.createElement('style');
             style.id = dynamicCustomId;
             style.textContent = `
                @font-face {
                    font-family: 'CustomFont';
                    src: url('${content.theme.customFontUrl}');
                    font-weight: normal;
                    font-style: normal;
                }
             `;
             document.head.appendChild(style);
             root.style.setProperty('--font-family', `'CustomFont', sans-serif`);
        } else {
             // Fallback to the standard select option
             root.style.setProperty('--font-family', content.theme.fontFamily);
        }

        root.style.setProperty('--border-radius', content.theme.borderRadius);
    }, [content?.theme]);

    return (
        <style>{`
            :root {
                --color-primary: #000000;
                --color-secondary: #f4f4f4;
                --color-accent: #3b82f6;
                --color-background: #ffffff;
                --color-text: #111827;
                --color-btn-text-primary: #ffffff;
                --color-btn-text-secondary: #000000;
                --font-family: 'Inter', sans-serif;
                --border-radius: 0px;
            }
            body {
                background-color: var(--color-background);
                color: var(--color-text);
                font-family: var(--font-family);
            }
            
            /* Primary Button Overrides */
            .bg-primary, .bg-black, .bg-gray-900 { 
                background-color: var(--color-primary) !important; 
                color: var(--color-btn-text-primary) !important;
            }
            /* Ensure inner text inherits or is forced */
            .bg-primary .text-white, .bg-black .text-white, .bg-gray-900 .text-white {
                color: var(--color-btn-text-primary) !important;
            }

            .text-primary { color: var(--color-primary) !important; }
            .border-primary { border-color: var(--color-primary) !important; }
            .ring-black { --tw-ring-color: var(--color-primary) !important; }
            .border-black { border-color: var(--color-primary) !important; }

            /* Global Radius */
            button, input, select, textarea, .rounded, .rounded-lg, .rounded-md {
                border-radius: var(--border-radius) !important;
            }
            
            /* Checkbox override */
            input[type="checkbox"] {
                border-radius: max(0px, calc(var(--border-radius) / 2)) !important;
            }

            /* Hide reCAPTCHA badge */
            .grecaptcha-badge { 
                visibility: hidden !important; 
            }
            .rc-anchor-normal-footer { 
                display: none !important; 
            }
        `}</style>
    );
};

const LoadingFallback = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <p className="text-sm font-medium text-gray-500">Loading module...</p>
        </div>
    </div>
);

const AppContent: React.FC = () => {
  return (
      <HashRouter>
        <ScrollToTop />
        <div className="min-h-screen flex flex-col transition-colors duration-300">
          <Navbar />
          <CartDrawer />
          <WishlistDrawer />
          <MarketingPopup />
          <Toast />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Shop />} />
              <Route path="/product/:id" element={<ProductDetails />} />
              <Route path="/admin" element={
                  <Suspense fallback={<LoadingFallback />}>
                      <Admin />
                  </Suspense>
              } />
              <Route path="/cs-panel" element={
                  <Suspense fallback={<LoadingFallback />}>
                      <CustomerServicePanel />
                  </Suspense>
              } />
              <Route path="/track-order" element={<OrderStatus />} />
              <Route path="/account" element={<Account />} />
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order-confirmation/:id" element={<OrderConfirmation />} />
              <Route path="/pages/:slug" element={<PolicyPage />} />
            </Routes>
          </main>
          <Footer />
          <ChatBot />
        </div>
      </HashRouter>
  );
};

const App: React.FC = () => {
    return (
        <StoreProvider>
            <ThemeInjector />
            <AppContent />
        </StoreProvider>
    );
};

export default App;
