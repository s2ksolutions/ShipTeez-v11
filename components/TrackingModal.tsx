
import React, { useState, useEffect } from 'react';
import { X, Truck, ExternalLink, CheckCircle, Clock, Package } from 'lucide-react';
import { Order } from '../types';

interface TrackingModalProps {
    order: Order;
    onClose: () => void;
}

export const TrackingModal: React.FC<TrackingModalProps> = ({ order, onClose }) => {
    const [carrier, setCarrier] = useState('Unknown');
    const trackingNumber = order.trackingNumber || '';
    
    useEffect(() => {
        if (order.trackingCarrier && order.trackingCarrier !== 'Other') {
            setCarrier(order.trackingCarrier);
        } else {
            // Fallback detection
            if (trackingNumber.startsWith('1Z')) setCarrier('UPS');
            else if (trackingNumber.length > 20) setCarrier('USPS');
            else if (trackingNumber.length === 12) setCarrier('FedEx');
            else if (trackingNumber) setCarrier('DHL');
            else setCarrier('Carrier');
        }
    }, [order]);

    // Helper to find the timestamp of specific status changes from logs
    const getStatusDate = (statusCheck: string) => {
        // Look for log entry matching the status change
        const log = order.logs?.find(l => 
            l.message.toLowerCase().includes(statusCheck.toLowerCase()) || 
            (statusCheck === 'Shipped' && l.type === 'tracking') // Tracking updates count as shipping
        );
        return log ? new Date(log.timestamp) : null;
    };

    const steps = [
        { 
            id: 'delivered', 
            label: 'Delivered', 
            date: getStatusDate('Delivered'), 
            completed: order.status === 'Delivered',
            icon: CheckCircle 
        },
        { 
            id: 'shipped', 
            label: 'Shipped', 
            date: getStatusDate('Shipped'), 
            completed: ['Shipped', 'Delivered'].includes(order.status),
            icon: Truck 
        },
        { 
            id: 'processed', 
            label: 'Order Placed', 
            date: new Date(order.date), 
            completed: true,
            icon: Package 
        }
    ];

    // Determine current status color
    const getStatusColor = () => {
        if (order.status === 'Delivered') return 'text-green-600 bg-green-50';
        if (order.status === 'Cancelled') return 'text-red-600 bg-red-50';
        if (order.status === 'Shipped') return 'text-blue-600 bg-blue-50';
        return 'text-gray-600 bg-gray-100';
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/25 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
             
             <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-xl font-bold font-display text-gray-900">Tracking Information</h2>
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                            {trackingNumber ? (
                                <>{carrier} <span className="font-mono text-black bg-gray-200 px-2 py-0.5 rounded text-xs">{trackingNumber}</span></>
                            ) : (
                                <span>Order #{order.id}</span>
                            )}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 bg-white">
                    <div className="p-6 border border-gray-200 shadow-sm rounded-xl space-y-8">
                        {/* Current Status Header */}
                        <div className={`flex items-center gap-4 mb-6 rounded-lg p-3 ${getStatusColor()}`}>
                            <div className="p-2 bg-white/50 rounded-full">
                                {order.status === 'Delivered' ? <CheckCircle className="h-6 w-6" /> : 
                                 order.status === 'Shipped' ? <Truck className="h-6 w-6" /> : 
                                 <Clock className="h-6 w-6" />}
                            </div>
                            <div>
                                <span className="font-bold uppercase tracking-wide block">{order.status}</span>
                                <span className="text-xs opacity-80">
                                    {order.status === 'Processing' ? 'We are preparing your order' : 
                                     order.status === 'Shipped' ? 'Package is on the way' : 
                                     order.status === 'Delivered' ? 'Package arrived' : 'Status updated'}
                                </span>
                            </div>
                        </div>

                        {/* Dynamic History Timeline */}
                        <div className="relative border-l-2 border-gray-100 ml-3 space-y-8 pb-2">
                            {steps.map((step, idx) => (
                                <div key={step.id} className="relative pl-8">
                                    <div className={`absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-white transition-colors duration-500 ${step.completed ? 'bg-black' : 'bg-gray-200'}`}></div>
                                    <div className={`transition-opacity duration-500 ${step.completed ? 'opacity-100' : 'opacity-40'}`}>
                                        <h4 className="text-sm font-bold text-gray-900">{step.label}</h4>
                                        <p className="text-xs text-gray-500">
                                            {step.completed && step.date 
                                                ? step.date.toLocaleDateString() + ' at ' + step.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                                                : step.id === 'processed' ? 'Pending' : 'Pending'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {order.trackingLink && (
                    <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                        <a 
                            href={order.trackingLink} 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-bold uppercase text-white bg-black px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
                        >
                            Track on {carrier} Website <ExternalLink className="h-4 w-4"/>
                        </a>
                    </div>
                )}
             </div>
        </div>
    );
};
