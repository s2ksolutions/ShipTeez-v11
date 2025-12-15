import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { SEO } from '../components/SEO';
import { CheckCircle, Package, Mail, ArrowRight } from 'lucide-react';
import { useStore } from '../context/StoreProvider';

export const OrderConfirmation: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useStore();

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
            <SEO title="Order Confirmed" description="Thank you for your order" />
            
            <div className="max-w-lg w-full text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
                <div className="mx-auto h-24 w-24 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-12 w-12 text-green-600" />
                </div>

                <div>
                    <h1 className="text-4xl font-display font-bold text-gray-900">Order Confirmed!</h1>
                    <p className="mt-4 text-gray-600 text-lg">Thank you for shopping with ShipTeez.</p>
                </div>

                <div className="bg-gray-50 p-6 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-500 uppercase tracking-widest font-bold mb-2">Order Number</p>
                    <p className="text-3xl font-mono font-medium text-black">{id}</p>
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                        <Mail className="h-4 w-4" />
                        <span>A confirmation email has been sent to you.</span>
                    </div>
                </div>

                <div className="space-y-3">
                    {user && (
                        <Link 
                            to="/account"
                            state={{ tab: 'orders' }}
                            className="block w-full bg-black text-white py-3 font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
                        >
                            Track Order Status
                        </Link>
                    )}
                    <Link 
                        to="/" 
                        className="block w-full text-gray-500 hover:text-black py-3 font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        Continue Shopping <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </div>
        </div>
    );
};