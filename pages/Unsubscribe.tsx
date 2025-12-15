
import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { db } from '../services/db';
import { SEO } from '../components/SEO';
import { MailX, Check, AlertCircle, Loader2 } from 'lucide-react';

export const Unsubscribe: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [email, setEmail] = useState(searchParams.get('email') || '');
    const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

    const handleUnsubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setStatus('processing');
        try {
            await db.unsubscribeNewsletter(email);
            setStatus('success');
        } catch (e) {
            setStatus('error');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <SEO title="Unsubscribe" description="Unsubscribe from newsletter" />
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                <div className="mx-auto h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                    <MailX className="h-8 w-8 text-gray-500"/>
                </div>
                
                <h2 className="text-2xl font-bold mb-2">Unsubscribe</h2>
                <p className="text-gray-500 mb-8 text-sm">We're sorry to see you go. Enter your email below to unsubscribe from our newsletter.</p>

                {status === 'success' ? (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100 flex flex-col items-center">
                        <Check className="h-8 w-8 text-green-600 mb-2"/>
                        <p className="text-green-800 font-bold">Unsubscribed Successfully</p>
                        <p className="text-green-600 text-xs mt-1">You will no longer receive marketing emails.</p>
                        <Link to="/" className="mt-4 text-sm font-bold underline hover:text-green-900">Return to Store</Link>
                    </div>
                ) : (
                    <form onSubmit={handleUnsubscribe} className="space-y-4">
                        <input 
                            type="email" 
                            required
                            placeholder="Email Address" 
                            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-black focus:border-black"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                        <button 
                            type="submit" 
                            disabled={status === 'processing'}
                            className="w-full bg-black text-white py-3 rounded-lg font-bold uppercase hover:bg-gray-800 disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {status === 'processing' ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Unsubscribe'}
                        </button>
                        {status === 'error' && (
                            <p className="text-red-500 text-xs flex items-center justify-center gap-1"><AlertCircle className="h-3 w-3"/> Error processing request.</p>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
};
