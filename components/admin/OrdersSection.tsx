
import React, { useState, useEffect } from 'react';
import { Order, OrderLog } from '../../types';
import { db } from '../../services/db';
import { X, ShoppingBag, Truck, CheckCircle, Clock, AlertCircle, FileText, Send, Link as LinkIcon, CreditCard, Calendar } from 'lucide-react';

interface OrdersSectionProps {
    orders: Order[];
    onRefresh: () => Promise<void>;
}

export const OrdersSection: React.FC<OrdersSectionProps> = ({ orders, onRefresh }) => {
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [orderSearch, setOrderSearch] = useState('');
    const [orderStatusFilter, setOrderStatusFilter] = useState<string>('All');
    const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
    const [newNote, setNewNote] = useState('');
    const [customUpdateDate, setCustomUpdateDate] = useState('');

    // Fulfillment State
    const [trackingCarrier, setTrackingCarrier] = useState('');
    const [trackingNumber, setTrackingNumber] = useState('');
    const [trackingLink, setTrackingLink] = useState('');

    useEffect(() => {
        let res = [...orders];
        if (orderSearch) {
            const s = orderSearch.toLowerCase();
            res = res.filter(o => 
                o.id.toLowerCase().includes(s) || 
                (o.customerName && o.customerName.toLowerCase().includes(s)) ||
                (o.customerEmail && o.customerEmail.toLowerCase().includes(s)) ||
                (o.paymentLast4 && o.paymentLast4.includes(s))
            );
        }
        if (orderStatusFilter !== 'All') {
            if (orderStatusFilter === 'Overdue') {
                res = res.filter(o => o.isOverdue);
            } else {
                res = res.filter(o => o.status === orderStatusFilter);
            }
        }
        setFilteredOrders(res.sort((a,b) => b.date - a.date));
    }, [orders, orderSearch, orderStatusFilter]);

    // Reset fulfillment inputs when selection changes
    useEffect(() => {
        if (selectedOrder) {
            setTrackingCarrier(selectedOrder.trackingCarrier || 'USPS');
            setTrackingNumber(selectedOrder.trackingNumber || '');
            setTrackingLink(selectedOrder.trackingLink || '');
            setCustomUpdateDate(''); // Reset date picker
        }
    }, [selectedOrder]);

    const generateTrackingLink = (carrier: string, number: string) => {
        if (!number) return '';
        switch(carrier) {
            case 'USPS': return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${number}`;
            case 'UPS': return `https://www.ups.com/track?tracknum=${number}`;
            case 'FedEx': return `https://www.fedex.com/fedextrack/?trknbr=${number}`;
            case 'DHL': return `https://www.dhl.com/en/express/tracking.html?AWB=${number}`;
            default: return '';
        }
    };

    // Auto-update link when carrier/number changes if link is empty or matches auto-gen format
    useEffect(() => {
        const auto = generateTrackingLink(trackingCarrier, trackingNumber);
        if (trackingNumber && (!trackingLink || trackingLink.includes('ups.com') || trackingLink.includes('usps.com') || trackingLink.includes('fedex.com') || trackingLink.includes('dhl.com'))) {
            setTrackingLink(auto);
        }
    }, [trackingCarrier, trackingNumber]);

    const getEffectiveDate = () => {
        return customUpdateDate ? new Date(customUpdateDate).getTime() : Date.now();
    };

    const handleUpdateStatus = async (newStatus: Order['status']) => {
        if (!selectedOrder) return;
        
        const logEntry: OrderLog = {
            id: crypto.randomUUID(),
            timestamp: getEffectiveDate(),
            type: 'status_change',
            message: `Status changed from ${selectedOrder.status} to ${newStatus}`,
            author: 'Admin'
        };

        const u = { 
            ...selectedOrder, 
            status: newStatus,
            logs: [logEntry, ...(selectedOrder.logs || [])]
        };
        
        await db.updateOrder(u);
        setSelectedOrder(u);
        setCustomUpdateDate(''); // Reset
        await onRefresh();
    };

    const handleSaveTracking = async () => {
        if (!selectedOrder) return;
        
        const logEntry: OrderLog = {
            id: crypto.randomUUID(),
            timestamp: getEffectiveDate(),
            type: 'tracking',
            message: `Tracking updated: ${trackingCarrier} ${trackingNumber}`,
            author: 'Admin'
        };

        const u = { 
            ...selectedOrder, 
            trackingNumber,
            trackingCarrier,
            trackingLink,
            status: trackingNumber ? 'Shipped' : selectedOrder.status, // Auto-switch to shipped if tracking added
            logs: [logEntry, ...(selectedOrder.logs || [])]
        };
        
        await db.updateOrder(u);
        setSelectedOrder(u);
        setCustomUpdateDate(''); // Reset
        await onRefresh();
        alert("Tracking information saved & status updated.");
    };

    const handleAddNote = async () => {
        if (!selectedOrder || !newNote.trim()) return;
        const logEntry: OrderLog = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            type: 'note',
            message: newNote,
            author: 'Admin'
        };
        const u = { 
            ...selectedOrder, 
            logs: [logEntry, ...(selectedOrder.logs || [])]
        };
        await db.updateOrder(u);
        setSelectedOrder(u);
        setNewNote('');
        await onRefresh();
    };

    const StatusBadge = ({ status }: { status: string }) => {
        let color = 'bg-gray-100 text-gray-800';
        if (status === 'Processing') color = 'bg-yellow-100 text-yellow-800';
        if (status === 'Shipped') color = 'bg-blue-100 text-blue-800';
        if (status === 'Delivered') color = 'bg-green-100 text-green-800';
        if (status === 'Cancelled') color = 'bg-red-100 text-red-800';
        return <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${color}`}>{status}</span>;
    };

    return (
        <div className="flex gap-6 h-[75vh] animate-in fade-in">
            {/* List Sidebar */}
            <div className={`flex-1 bg-white border shadow-sm flex flex-col ${selectedOrder ? 'hidden md:flex md:w-1/3 md:flex-none' : ''}`}>
                <div className="p-4 border-b space-y-3 bg-gray-50">
                    <div className="flex justify-between items-center">
                        <h2 className="font-bold flex items-center gap-2 text-gray-800"><ShoppingBag className="h-5 w-5"/> Orders</h2>
                        <span className="text-xs font-medium bg-white px-2 py-1 rounded border">{filteredOrders.length} records</span>
                    </div>
                    <input 
                        placeholder="Search order #, email, name, last 4..." 
                        className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-black focus:border-black" 
                        value={orderSearch} 
                        onChange={e => setOrderSearch(e.target.value)} 
                    />
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {['All', 'Processing', 'Shipped', 'Delivered', 'Overdue'].map(f => (
                            <button 
                                key={f}
                                onClick={() => setOrderStatusFilter(f)} 
                                className={`px-3 py-1 text-xs font-bold rounded-full whitespace-nowrap transition-colors ${orderStatusFilter === f ? 'bg-black text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                    {filteredOrders.length === 0 && <div className="p-8 text-center text-gray-500 text-sm">No orders found.</div>}
                    {filteredOrders.map(o => (
                        <div key={o.id} onClick={() => setSelectedOrder(o)} className={`p-4 cursor-pointer hover:bg-gray-50 transition-all ${selectedOrder?.id === o.id ? 'bg-blue-50 border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-sm text-gray-900">#{o.id}</span>
                                <span className="text-sm font-mono">${(o.total ?? 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500 truncate max-w-[120px]">{o.customerName || 'Guest'}</span>
                                <StatusBadge status={o.status} />
                            </div>
                            {o.paymentLast4 && <div className="mt-1 text-[10px] text-gray-400 flex items-center gap-1"><CreditCard className="h-3 w-3"/> •••• {o.paymentLast4}</div>}
                            {o.isOverdue && <div className="mt-2 text-[10px] font-bold text-red-600 flex items-center gap-1"><Clock className="h-3 w-3"/> ACTION NEEDED</div>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Detail View */}
            {selectedOrder ? (
                <div className="flex-1 bg-white border shadow-sm flex flex-col h-full overflow-hidden">
                    {/* Header */}
                    <div className="p-6 border-b flex justify-between items-start bg-gray-50">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-2xl font-bold font-display">Order #{selectedOrder.id}</h2>
                                <StatusBadge status={selectedOrder.status} />
                            </div>
                            <p className="text-sm text-gray-500 flex items-center gap-2">
                                <Clock className="h-3 w-3"/> {new Date(selectedOrder.date).toLocaleString()} 
                                <span className="text-gray-300">|</span> 
                                {selectedOrder.items.length} Items
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                             <div className="flex items-center gap-2">
                                 <label className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1 bg-white border px-2 py-1 rounded cursor-pointer hover:border-gray-400" title="Optional: Set specific date for update">
                                     <Calendar className="h-3 w-3" />
                                     <input 
                                        type="datetime-local" 
                                        value={customUpdateDate} 
                                        onChange={e => setCustomUpdateDate(e.target.value)}
                                        className="bg-transparent border-none outline-none text-xs ml-1 w-28 p-0"
                                     />
                                 </label>
                                 <button onClick={() => setSelectedOrder(null)} className="md:hidden p-2"><X className="h-5 w-5" /></button>
                             </div>
                             
                             <div className="flex items-center gap-2">
                                 {/* Quick Actions */}
                                 {selectedOrder.status === 'Processing' && (
                                     <button onClick={() => handleUpdateStatus('Shipped')} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold uppercase rounded hover:bg-blue-700 flex items-center gap-2 shadow-sm">
                                         <Truck className="h-3 w-3" /> Mark Shipped
                                     </button>
                                 )}
                                 {selectedOrder.status === 'Shipped' && (
                                     <button onClick={() => handleUpdateStatus('Delivered')} className="px-4 py-2 bg-green-600 text-white text-xs font-bold uppercase rounded hover:bg-green-700 flex items-center gap-2 shadow-sm">
                                         <CheckCircle className="h-3 w-3" /> Mark Delivered
                                     </button>
                                 )}
                             </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            
                            {/* Main Info */}
                            <div className="lg:col-span-2 space-y-8">
                                {/* Order Items */}
                                <section>
                                    <h3 className="font-bold text-sm uppercase text-gray-500 mb-4 border-b pb-2">Items Ordered</h3>
                                    <div className="space-y-4">
                                        {selectedOrder.items.map((item, idx) => (
                                            <div key={idx} className="flex gap-4 items-start bg-white p-3 border rounded-lg hover:shadow-sm transition-shadow">
                                                <div className="h-16 w-16 bg-gray-100 rounded border overflow-hidden flex-shrink-0">
                                                    <img src={item.images[0]} className="h-full w-full object-cover" alt="" />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-gray-900 text-sm">{item.title}</h4>
                                                    <p className="text-xs text-gray-500 mt-1">Size: {item.selectedSize} • Color: {item.selectedColor}</p>
                                                    <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-sm">${(item.price ?? 0).toFixed(2)}</p>
                                                    <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                                                    <p className="font-bold text-sm mt-1">Total: ${((item.price ?? 0) * (item.quantity ?? 0)).toFixed(2)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <div className="w-64 space-y-2 text-sm">
                                            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>${((selectedOrder.total ?? 0) + (selectedOrder.discountApplied || 0)).toFixed(2)}</span></div>
                                            <div className="flex justify-between text-red-500"><span>Discount {selectedOrder.promoCode ? `(${selectedOrder.promoCode})` : ''}</span><span>-${(selectedOrder.discountApplied || 0).toFixed(2)}</span></div>
                                            <div className="flex justify-between text-gray-600"><span>Shipping</span><span>${(selectedOrder.shippingCost || 0).toFixed(2)}</span></div>
                                            <div className="flex justify-between font-bold text-lg pt-2 border-t text-gray-900"><span>Total</span><span>${(selectedOrder.total ?? 0).toFixed(2)}</span></div>
                                        </div>
                                    </div>
                                </section>

                                {/* Activity Timeline / Notes */}
                                <section>
                                    <h3 className="font-bold text-sm uppercase text-gray-500 mb-4 border-b pb-2">Order Activity</h3>
                                    <div className="bg-gray-50 rounded-lg p-4 border mb-4">
                                        <div className="flex gap-2">
                                            <input 
                                                className="flex-1 border rounded p-2 text-sm" 
                                                placeholder="Add an internal note..." 
                                                value={newNote}
                                                onChange={e => setNewNote(e.target.value)}
                                            />
                                            <button onClick={handleAddNote} className="px-3 py-2 bg-black text-white rounded text-xs font-bold uppercase"><Send className="h-4 w-4"/></button>
                                        </div>
                                    </div>
                                    <div className="relative border-l-2 border-gray-200 ml-3 space-y-6 pb-2">
                                        {(selectedOrder.logs || []).map((log, idx) => (
                                            <div key={log.id} className="relative pl-6">
                                                <div className={`absolute -left-[5px] top-1 h-3 w-3 rounded-full border-2 border-white ${log.type === 'status_change' ? 'bg-blue-500' : log.type === 'tracking' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                                <p className="text-xs text-gray-400 mb-1">{new Date(log.timestamp).toLocaleString()} • {log.author || 'System'}</p>
                                                <div className={`text-sm p-3 rounded-lg border ${log.type === 'note' ? 'bg-yellow-50 border-yellow-100' : 'bg-white border-gray-200'}`}>
                                                    {log.type === 'note' && <span className="font-bold text-xs uppercase text-yellow-600 block mb-1">Note</span>}
                                                    {log.type === 'tracking' && <span className="font-bold text-xs uppercase text-green-600 block mb-1 flex items-center gap-1"><Truck className="h-3 w-3"/> Fulfillment Update</span>}
                                                    {log.message}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>

                            {/* Sidebar Info */}
                            <div className="space-y-6">
                                <div className="bg-white p-4 rounded-lg border shadow-sm">
                                    <h3 className="font-bold text-xs uppercase text-gray-500 mb-3">Customer</h3>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600">{selectedOrder.customerName?.[0] || 'G'}</div>
                                        <div>
                                            <p className="font-bold text-sm">{selectedOrder.customerName || 'Guest User'}</p>
                                            <p className="text-xs text-blue-600 hover:underline cursor-pointer">{selectedOrder.customerEmail}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-lg border shadow-sm">
                                    <h3 className="font-bold text-xs uppercase text-gray-500 mb-3">Shipping & Fulfillment</h3>
                                    <p className="text-sm text-gray-700 leading-relaxed mb-4">{selectedOrder.shippingAddress || 'No Address Provided'}</p>
                                    
                                    <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase">Carrier</label>
                                                <select 
                                                    className="w-full border rounded p-1.5 text-xs bg-white"
                                                    value={trackingCarrier}
                                                    onChange={e => setTrackingCarrier(e.target.value)}
                                                >
                                                    <option value="USPS">USPS</option>
                                                    <option value="UPS">UPS</option>
                                                    <option value="FedEx">FedEx</option>
                                                    <option value="DHL">DHL</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase">Tracking #</label>
                                                <input 
                                                    className="w-full border rounded p-1.5 text-xs" 
                                                    placeholder="1Z..." 
                                                    value={trackingNumber}
                                                    onChange={e => setTrackingNumber(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">Tracking Link</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    className="flex-1 border rounded p-1.5 text-xs" 
                                                    placeholder="https://..." 
                                                    value={trackingLink}
                                                    onChange={e => setTrackingLink(e.target.value)}
                                                />
                                                {trackingLink && (
                                                    <a href={trackingLink} target="_blank" className="p-1.5 bg-gray-200 rounded text-gray-600 hover:bg-gray-300">
                                                        <LinkIcon className="h-3 w-3"/>
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handleSaveTracking}
                                            className="w-full bg-black text-white py-2 rounded text-xs font-bold uppercase hover:bg-gray-800"
                                        >
                                            Save Tracking
                                        </button>
                                        <p className="text-[10px] text-gray-400 text-center">Using date: {customUpdateDate ? new Date(customUpdateDate).toLocaleString() : 'Now'}</p>
                                    </div>
                                </div>
                                
                                <div className="bg-white p-4 rounded-lg border shadow-sm">
                                     <h3 className="font-bold text-xs uppercase text-gray-500 mb-3">Billing Address</h3>
                                     <p className="text-sm text-gray-700 leading-relaxed">{selectedOrder.billingAddress || 'Same as shipping'}</p>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center flex-col text-gray-400">
                    <ShoppingBag className="h-12 w-12 mb-4 opacity-20"/>
                    <p>Select an order to view details</p>
                </div>
            )}
        </div>
    );
};
