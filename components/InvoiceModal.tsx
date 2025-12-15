
import React, { useRef } from 'react';
import { Order } from '../types';
import { X, Printer, CheckCircle } from 'lucide-react';
import { useStore } from '../context/StoreProvider';

interface InvoiceModalProps {
    order: Order;
    userEmail: string;
    userName: string;
    onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ order, userEmail, userName, onClose }) => {
    const componentRef = useRef<HTMLDivElement>(null);
    const { settings, content } = useStore(); 

    const handlePrint = () => {
        window.print();
    };

    const storeName = settings?.storeProfile?.name || content?.branding?.siteName || 'ShipTeez Store';
    const storeAddress = settings?.storeProfile?.address || '123 Creative Blvd';
    const storeCityState = (settings?.storeProfile?.city && settings?.storeProfile?.state) 
        ? `${settings.storeProfile.city}, ${settings.storeProfile.state} ${settings.storeProfile.zip || ''}` 
        : 'NY 10012';
    const storeEmail = settings?.storeProfile?.email || 'support@shipteez.com';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:p-0">
            <style>{`
                @media print {
                    body > * { visibility: hidden; }
                    #invoice-modal-content, #invoice-modal-content * { visibility: visible; }
                    #invoice-modal-content {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: 20px;
                        background: white;
                        box-shadow: none;
                    }
                    .no-print { display: none !important; }
                }
            `}</style>
            
            <div className="absolute inset-0 bg-black bg-opacity-75 backdrop-blur-sm transition-opacity no-print" onClick={onClose}></div>
            
            <div id="invoice-modal-content" ref={componentRef} className="relative w-full max-w-3xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:h-auto">
                {/* Header Actions */}
                <div className="bg-gray-900 text-white p-4 flex justify-between items-center no-print">
                    <h2 className="font-bold uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-400" /> Invoice #{order.id}
                    </h2>
                    <div className="flex items-center gap-4">
                        <button onClick={handlePrint} className="flex items-center gap-2 text-sm hover:text-gray-300">
                            <Printer className="h-4 w-4" /> Print / Save PDF
                        </button>
                        <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-full">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Scrollable Invoice Content */}
                <div className="overflow-y-auto bg-gray-50 p-8 print:p-0 print:overflow-visible">
                    <div className="bg-white p-8 shadow-sm border border-gray-200 min-h-[800px] text-gray-900 font-sans print:border-none print:shadow-none">
                        
                        {/* Invoice Header */}
                        <div className="flex justify-between items-start border-b-2 border-black pb-8 mb-8">
                            <div>
                                <h1 className="text-4xl font-display font-bold text-black tracking-tighter uppercase">{storeName}</h1>
                                <p className="mt-2 text-sm text-gray-500">
                                    {storeAddress}<br/>
                                    {storeCityState}<br/>
                                    {storeEmail}
                                </p>
                            </div>
                            <div className="text-right">
                                <h2 className="text-2xl font-bold uppercase text-gray-400">Invoice</h2>
                                <p className="mt-2 text-sm font-medium">Date: {new Date(order.date).toLocaleDateString()}</p>
                                <p className="text-sm font-medium">Order #: {order.id}</p>
                            </div>
                        </div>

                        {/* Bill To */}
                        <div className="mb-12">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Bill To</h3>
                            <p className="font-bold text-lg">{userName}</p>
                            <p className="text-gray-600">{userEmail}</p>
                            {order.billingAddress && (
                                <p className="text-gray-500 text-sm mt-1">
                                    {order.billingAddress}
                                    {order.billingAddressLine2 && <><br/>{order.billingAddressLine2}</>}
                                </p>
                            )}
                        </div>

                        {/* Items Table */}
                        <table className="w-full mb-12">
                            <thead>
                                <tr className="border-b border-gray-300 text-left">
                                    <th className="py-2 text-xs font-bold uppercase tracking-widest text-gray-500">Item</th>
                                    <th className="py-2 text-xs font-bold uppercase tracking-widest text-gray-500 text-center">Qty</th>
                                    <th className="py-2 text-xs font-bold uppercase tracking-widest text-gray-500 text-right">Price</th>
                                    <th className="py-2 text-xs font-bold uppercase tracking-widest text-gray-500 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {order.items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="py-4">
                                            <p className="font-bold text-sm">{item.title}</p>
                                            <p className="text-xs text-gray-500">{item.selectedSize} / {item.selectedColor}</p>
                                        </td>
                                        <td className="py-4 text-center text-sm">{item.quantity}</td>
                                        <td className="py-4 text-right text-sm">${(item.price ?? 0).toFixed(2)}</td>
                                        <td className="py-4 text-right text-sm font-medium">${((item.price ?? 0) * (item.quantity ?? 0)).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Totals */}
                        <div className="flex justify-end">
                            <div className="w-64 space-y-3">
                                <div className="flex justify-between text-sm text-gray-500">
                                    <span>Subtotal</span>
                                    <span>${(order.total ?? 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-500">
                                    <span>Shipping</span>
                                    <span>${(order.shippingCost || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xl font-bold border-t-2 border-black pt-3">
                                    <span>Total</span>
                                    <span>${(order.total ?? 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-24 pt-8 border-t border-gray-100 text-center text-xs text-gray-400">
                            <p>Thank you for your business.</p>
                            <p className="mt-1">Questions? Contact {storeEmail}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
