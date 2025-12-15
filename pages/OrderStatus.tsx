
import React, { useState } from 'react';
import { SEO } from '../components/SEO';
import { Package, Truck, CheckCircle, Search, Clock, AlertCircle } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { db } from '../services/db';
import { Order } from '../types';

export const OrderStatus: React.FC = () => {
    const [orderId, setOrderId] = useState('');
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'error'>('idle');
    const [order, setOrder] = useState<Order | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('searching');
        setOrder(null);

        try {
            // In a real scenario, this would be a specific API endpoint like api.trackOrder(id, email)
            // For this architecture, we fetch all and find (simulated backend filter)
            const allOrders = await db.getAllOrders();
            const found = allOrders.find(o => 
                o.id.toLowerCase() === orderId.trim().toLowerCase() && 
                (o.customerEmail?.toLowerCase() === email.trim().toLowerCase())
            );

            if (found) {
                setOrder(found);
                setStatus('found');
            } else {
                setStatus('error');
            }
        } catch (e) {
            console.error(e);
            setStatus('error');
        }
    };

    // Helper to extract dates from logs
    const getStatusDate = (currentOrder: Order, statusCheck: string) => {
        const log = currentOrder.logs?.find(l => 
            l.message.toLowerCase().includes(statusCheck.toLowerCase()) || 
            (statusCheck === 'Shipped' && l.type === 'tracking')
        );
        return log ? new Date(log.timestamp) : null;
    };

    return (
        <div className="min-h-screen bg-white">
            <SEO title="Track Your Order" description="Check the status of your ShipTeez order." />
            
            <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <Breadcrumbs />
                </div>
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-display font-bold text-gray-900">Track Your Order</h1>
                    <p className="mt-2 text-gray-500">Enter your order ID and email to see the current status.</p>
                </div>

                <div className="bg-gray-50 p-8 border border-gray-200 shadow-sm rounded-xl mb-12">
                    <form onSubmit={handleSearch} className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Order ID</label>
                            <input 
                                type="text" 
                                required
                                placeholder="e.g. ORD-8821"
                                value={orderId}
                                onChange={(e) => setOrderId(e.target.value)}
                                className="mt-1 block w-full border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm p-3 rounded-lg border"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email Address</label>
                            <input 
                                type="email" 
                                required
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 block w-full border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm p-3 rounded-lg border"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <button 
                                type="submit" 
                                disabled={status === 'searching'}
                                className="w-full bg-black text-white font-bold uppercase tracking-widest py-3 rounded-lg hover:bg-gray-800 transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                {status === 'searching' ? 'Searching...' : <><Search className="h-4 w-4"/> Track Order</>}
                            </button>
                        </div>
                    </form>
                </div>

                {status === 'error' && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                        <AlertCircle className="h-5 w-5"/>
                        <div>
                            <p className="font-bold text-sm">Order not found</p>
                            <p className="text-xs">Please check your Order ID and Email and try again.</p>
                        </div>
                    </div>
                )}

                {status === 'found' && order && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="border border-gray-200 rounded-xl p-6 mb-8 shadow-sm">
                            <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-4">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Order Number</p>
                                    <p className="font-bold text-lg">{order.id}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Current Status</p>
                                    <p className={`font-bold text-lg uppercase ${
                                        order.status === 'Delivered' ? 'text-green-600' : 
                                        order.status === 'Cancelled' ? 'text-red-600' : 'text-blue-600'
                                    }`}>{order.status}</p>
                                </div>
                            </div>

                            {/* Timeline */}
                            <div className="relative mt-8 px-4">
                                {/* Connector Line */}
                                <div className="absolute left-4 sm:left-[10%] top-1/2 w-[90%] sm:w-[80%] h-1 bg-gray-100 -translate-y-1/2 z-0 hidden sm:block"></div>
                                {/* Mobile vertical line */}
                                <div className="absolute left-8 top-4 bottom-4 w-1 bg-gray-100 sm:hidden"></div>
                                
                                <div className="relative z-10 flex flex-col sm:flex-row justify-between w-full gap-8 sm:gap-0">
                                    {[
                                        { label: 'Placed', date: new Date(order.date), active: true, icon: Clock },
                                        { label: 'Shipped', date: getStatusDate(order, 'Shipped'), active: ['Shipped', 'Delivered'].includes(order.status), icon: Truck },
                                        { label: 'Delivered', date: getStatusDate(order, 'Delivered'), active: order.status === 'Delivered', icon: CheckCircle },
                                    ].map((step, idx) => (
                                        <div key={idx} className="flex sm:flex-col items-center gap-4 sm:gap-3 group">
                                            <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center ring-4 ring-white shadow-sm transition-colors duration-300 ${step.active ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                <step.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                                            </div>
                                            <div className="sm:text-center">
                                                <span className={`text-sm font-bold uppercase block ${step.active ? 'text-black' : 'text-gray-400'}`}>{step.label}</span>
                                                <span className="text-xs text-gray-500">
                                                    {step.active && step.date ? step.date.toLocaleDateString() : step.active && idx===0 ? 'Confirmed' : 'Pending'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {order.trackingNumber && (
                                <div className="mt-10 bg-gray-50 p-4 border border-gray-200 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <div className="flex items-center gap-3">
                                        <Package className="h-5 w-5 text-gray-500" />
                                        <div className="text-sm">
                                            <span className="font-bold text-gray-900 block">Tracking Number</span>
                                            <span className="font-mono text-gray-600">{order.trackingNumber}</span>
                                        </div>
                                    </div>
                                    {order.trackingLink && (
                                        <a href={order.trackingLink} target="_blank" rel="noreferrer" className="text-xs font-bold uppercase bg-white border border-gray-300 px-4 py-2 rounded hover:bg-gray-100 transition-colors">
                                            Track with Carrier
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
