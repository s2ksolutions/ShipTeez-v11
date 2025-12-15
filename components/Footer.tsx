
import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Mail, ArrowRight, Check, Linkedin, Loader2 } from 'lucide-react';
import { useStore } from '../context/StoreProvider';
import { db } from '../services/db';

export const Footer: React.FC = () => {
    const { content, settings, activeCategories, showToast, user, setLoginModalOpen } = useStore();
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const navigate = useNavigate();

    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        if(email) {
            setStatus('loading');
            try {
                await db.subscribeNewsletter(email);
                setStatus('success');
                showToast("Please check your email to verify your subscription.", "success");
                setEmail('');
                setTimeout(() => setStatus('idle'), 3000);
            } catch (e) {
                setStatus('error');
                showToast("Failed to subscribe. Try again.", "error");
            }
        }
    };

    const handleTrackOrder = (e: React.MouseEvent) => {
        e.preventDefault();
        if (user) {
            navigate('/account', { state: { tab: 'orders' } });
        } else {
            setLoginModalOpen(true);
        }
    };

    const socials = content?.socials || {};
    const footerConfig = content?.footer || {
        brandDescription: 'Curated, AI-designed merchandise.',
        shopHeader: 'Shop',
        supportHeader: 'Support',
        newsletterHeader: 'Stay in the loop',
        newsletterText: 'Get the latest AI drops and exclusive offers.',
        copyrightText: 'ShipTeez Store. All rights reserved.'
    };
    
    // Fallback brand name
    const brandName = settings?.storeProfile?.name || content?.branding?.siteName || 'ShipTeez';
    const brandParts = brandName.split(' ');
    const brandPrefix = brandParts.length > 1 ? brandParts.slice(0, -1).join(' ') : brandParts[0];
    const brandSuffix = brandParts.length > 1 ? brandParts[brandParts.length - 1] : '';

    // Extract Root Categories for simplified footer display
    const rootCategories = useMemo(() => {
        const roots = new Set<string>();
        activeCategories.forEach(cat => {
            const root = cat.split(' > ')[0];
            if (root) roots.add(root);
        });
        return Array.from(roots).sort();
    }, [activeCategories]);

    return (
        <footer className="bg-black text-white pt-16 pb-8 border-t border-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                    {/* Brand */}
                    <div className="space-y-4">
                        <h3 className="text-2xl font-display font-bold tracking-tight">
                            {brandPrefix}<span className="font-light">{brandSuffix ? ' ' + brandSuffix : ''}</span>
                        </h3>
                        <div 
                            className="text-gray-400 text-sm leading-relaxed prose prose-invert prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: footerConfig.brandDescription }}
                        />
                        {settings?.storeProfile && (
                            <div className="text-xs text-gray-500 space-y-1">
                                {settings.storeProfile.address && <p>{settings.storeProfile.address}</p>}
                                {(settings.storeProfile.city || settings.storeProfile.state) && (
                                    <p>{settings.storeProfile.city}, {settings.storeProfile.state} {settings.storeProfile.zip}</p>
                                )}
                                {settings.storeProfile.email && <p>{settings.storeProfile.email}</p>}
                            </div>
                        )}
                        <div className="flex gap-4 pt-2">
                            {socials.facebook && <a href={socials.facebook} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white"><Facebook className="h-5 w-5"/></a>}
                            {socials.twitter && <a href={socials.twitter} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white"><Twitter className="h-5 w-5"/></a>}
                            {socials.instagram && <a href={socials.instagram} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white"><Instagram className="h-5 w-5"/></a>}
                            {socials.tiktok && <a href={socials.tiktok} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white"><Linkedin className="h-5 w-5"/></a>}
                        </div>
                    </div>

                    {/* Shop Links */}
                    <div>
                        <h4 className="text-sm font-bold uppercase tracking-widest mb-6">{footerConfig.shopHeader}</h4>
                        <ul className="space-y-3 text-sm text-gray-400">
                            <li><Link to="/" className="hover:text-white transition-colors">All Products</Link></li>
                            {rootCategories.map(cat => (
                                <li key={cat}>
                                    <Link to={`/?category=${encodeURIComponent(cat)}`} className="hover:text-white transition-colors">
                                        {cat}
                                    </Link>
                                </li>
                            ))}
                            <li><Link to="/wishlist" className="hover:text-white transition-colors">Wishlist</Link></li>
                        </ul>
                    </div>

                    {/* Support Links */}
                    <div>
                        <h4 className="text-sm font-bold uppercase tracking-widest mb-6">{footerConfig.supportHeader}</h4>
                        <ul className="space-y-3 text-sm text-gray-400">
                            <li>
                                <button onClick={handleTrackOrder} className="hover:text-white transition-colors text-left">
                                    Track Order
                                </button>
                            </li>
                            <li><Link to="/account" className="hover:text-white transition-colors">My Account</Link></li>
                            {content?.policies.map(policy => (
                                <li key={policy.id}><Link to={`/pages/${policy.slug}`} className="hover:text-white transition-colors">{policy.title}</Link></li>
                            ))}
                        </ul>
                    </div>

                    {/* Newsletter */}
                    <div>
                        <h4 className="text-sm font-bold uppercase tracking-widest mb-6">{footerConfig.newsletterHeader}</h4>
                        <p className="text-gray-400 text-sm mb-4">{footerConfig.newsletterText}</p>
                        
                        <form onSubmit={handleSubscribe} className="relative">
                            <input 
                                type="email" 
                                placeholder="Enter your email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-transparent border-b border-gray-700 py-3 pr-10 text-sm focus:border-white focus:outline-none placeholder-gray-500"
                                required
                            />
                            <button type="submit" className="absolute right-0 top-3 text-gray-400 hover:text-white" disabled={status === 'loading'}>
                                {status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin"/> : status === 'success' ? <Check className="h-4 w-4 text-green-500" /> : <ArrowRight className="h-4 w-4" />}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} {footerConfig.copyrightText}</p>
                    <Link to="/admin" className="text-xs text-gray-800 hover:text-gray-600 transition-colors">
                        Admin Login
                    </Link>
                </div>
            </div>
        </footer>
    );
};
