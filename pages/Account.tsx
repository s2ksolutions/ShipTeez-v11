import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreProvider';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { SEO } from '../components/SEO';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { User, Package, MapPin, MessageSquare, LogOut, ChevronRight, ExternalLink, Plus, Edit2, Trash2, Search, FileText } from 'lucide-react';
import { Order, Address } from '../types';
import { InvoiceModal } from '../components/InvoiceModal';
import { TrackingModal } from '../components/TrackingModal';
import { SuspensionAppeal } from '../components/SuspensionAppeal';
import { db } from '../services/db';

export const Account: React.FC = () => {
    const { user, logout, updateUserAddresses } = useStore();
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('profile');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showInvoice, setShowInvoice] = useState(false);
    const [showTracking, setShowTracking] = useState(false);
    
    // Address Edit State
    const [editingAddress, setEditingAddress] = useState<Partial<Address> | null>(null);
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab') || (location.state as any)?.tab;
        if (tab) setActiveTab(tab);
    }, [user, navigate, location]);

    if (!user) return null;

    if (user.isSuspended) {
        return (
            <div className="min-h-screen bg-gray-50 p-4">
                <SEO title="Account Suspended" description="Action Required" />
                <Breadcrumbs items={[{ label: 'Account', path: '/account' }]} />
                <SuspensionAppeal userId={user.id} />
            </div>
        );
    }

    const handleAddressSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAddress) return;
        
        const newAddress = {
            id: editingAddress.id || crypto.randomUUID(),
            name: editingAddress.name || '',
            street: editingAddress.street || '',
            line2: editingAddress.line2 || '',
            city: editingAddress.city || '',
            state: editingAddress.state || '',
            zip: editingAddress.zip || '',
            isDefaultShipping: editingAddress.isDefaultShipping || false,
            isDefaultBilling: editingAddress.isDefaultBilling || false
        };

        let updatedAddresses = [...(user.addresses || [])];
        if (editingAddress.id) {
            updatedAddresses = updatedAddresses.map(a => a.id === editingAddress.id ? newAddress : a);
        } else {
            updatedAddresses.push(newAddress);
        }

        // Handle Default Logic
        if (newAddress.isDefaultShipping) {
            updatedAddresses = updatedAddresses.map(a => a.id === newAddress.id ? a : { ...a, isDefaultShipping: false });
        }
        if (newAddress.isDefaultBilling) {
            updatedAddresses = updatedAddresses.map(a => a.id === newAddress.id ? a : { ...a, isDefaultBilling: false });
        }

        await updateUserAddresses(updatedAddresses);
        setIsAddressModalOpen(false);
        setEditingAddress(null);
    };

    const handleDeleteAddress = async (id: string) => {
        if (confirm('Delete this address?')) {
            const updatedAddresses = (user.addresses || []).filter(a => a.id !== id);
            await updateUserAddresses(updatedAddresses);
        }
    };

    // Render Order Item helper
    const renderOrderItems = (order: Order) => (
        <div className="flex gap-4 overflow-x-auto pb-2">
            {(order.items || []).map((item, i) => (
                <div key={i} className="flex-shrink-0 flex items-center gap-3 w-64 bg-gray-50 p-2 rounded border border-gray-100">
                    <div className="h-12 w-12 bg-white rounded border overflow-hidden">
                        <img src={item.images?.[0] || ''} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{item.title}</p>
                        <p className="text-[10px] text-gray-500">Qty: {item.quantity}</p>
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            <SEO title="My Account" description="Manage your account" />
            
            {showInvoice && selectedOrder && (
                <InvoiceModal 
                    order={selectedOrder} 
                    userEmail={user.email} 
                    userName={user.name} 
                    onClose={() => setShowInvoice(false)} 
                />
            )}

            {showTracking && selectedOrder && (
                <TrackingModal 
                    order={selectedOrder} 
                    onClose={() => setShowTracking(false)} 
                />
            )}

            <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <Breadcrumbs />
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row min-h-[600px]">
                    {/* Sidebar */}
                    <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200 p-6 flex flex-col">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="h-12 w-12 bg-black text-white rounded-full flex items-center justify-center font-bold text-xl">
                                {user.name.charAt(0)}
                            </div>
                            <div className="overflow-hidden">
                                <h2 className="font-bold text-gray-900 truncate">{user.name}</h2>
                                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>
                        </div>

                        <nav className="space-y-1 flex-1">
                            <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'profile' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}>
                                <User className="h-4 w-4" /> Profile
                            </button>
                            <button onClick={() => setActiveTab('orders')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'orders' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}>
                                <Package className="h-4 w-4" /> Orders
                            </button>
                            <button onClick={() => setActiveTab('addresses')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'addresses' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}>
                                <MapPin className="h-4 w-4" /> Addresses
                            </button>
                            <button onClick={() => setActiveTab('support')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'support' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}>
                                <MessageSquare className="h-4 w-4" /> Support Tickets
                            </button>
                        </nav>

                        <div className="pt-6 border-t border-gray-200 mt-6">
                            <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                                <LogOut className="h-4 w-4" /> Sign Out
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-8 overflow-y-auto">
                        {activeTab === 'profile' && (
                            <div className="max-w-xl">
                                <h2 className="text-2xl font-display font-bold mb-6">Profile Settings</h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Full Name</label>
                                        <input type="text" value={user.name} disabled className="w-full border rounded-lg p-3 bg-gray-50 text-gray-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
                                        <input type="email" value={user.email} disabled className="w-full border rounded-lg p-3 bg-gray-50 text-gray-500" />
                                    </div>
                                    <div className="pt-4">
                                        <p className="text-xs text-gray-500">To change your email or password, please contact support.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'orders' && (
                            <div>
                                <h2 className="text-2xl font-display font-bold mb-6">Order History</h2>
                                <div className="space-y-4">
                                    {(!user.orders || user.orders.length === 0) && (
                                        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                            <Package className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                                            <p className="text-gray-500">No orders yet.</p>
                                            <Link to="/" className="text-sm font-bold text-black hover:underline mt-2 inline-block">Start Shopping</Link>
                                        </div>
                                    )}
                                    {user.orders?.map(order => (
                                        <div key={order.id} className="border rounded-xl p-6 hover:shadow-sm transition-shadow">
                                            <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4">
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-mono font-bold text-lg">#{order.id}</span>
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                                            order.status === 'Delivered' ? 'bg-green-100 text-green-700' : 
                                                            order.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                                        }`}>{order.status}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-500 mt-1">{new Date(order.date).toLocaleDateString()}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={() => { setSelectedOrder(order); setShowInvoice(true); }}
                                                        className="px-4 py-2 border rounded-lg text-xs font-bold uppercase hover:bg-gray-50 flex items-center gap-2"
                                                    >
                                                        <FileText className="h-3 w-3"/> Invoice
                                                    </button>
                                                    <button 
                                                        onClick={() => { setSelectedOrder(order); setShowTracking(true); }}
                                                        className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold uppercase hover:bg-gray-800 flex items-center gap-2"
                                                    >
                                                        <Package className="h-3 w-3"/> Track
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            {/* Render Items */}
                                            {renderOrderItems(order)}

                                            <div className="mt-4 pt-4 border-t flex justify-between items-center text-sm">
                                                <span className="text-gray-500">{order.items?.length || 0} Items</span>
                                                <span className="font-bold text-lg">${order.total.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'addresses' && (
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-display font-bold">Saved Addresses</h2>
                                    <button onClick={() => { setEditingAddress({}); setIsAddressModalOpen(true); }} className="bg-black text-white px-4 py-2 rounded-lg text-xs font-bold uppercase hover:bg-gray-800 flex items-center gap-2">
                                        <Plus className="h-4 w-4"/> Add New
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(user.addresses || []).map(addr => (
                                        <div key={addr.id} className="border rounded-xl p-6 relative group hover:border-black transition-colors">
                                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => { setEditingAddress(addr); setIsAddressModalOpen(true); }} className="p-1 hover:bg-gray-100 rounded"><Edit2 className="h-4 w-4 text-gray-500"/></button>
                                                <button onClick={() => handleDeleteAddress(addr.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4 text-red-500"/></button>
                                            </div>
                                            {addr.isDefaultShipping && <span className="bg-gray-100 text-gray-600 text-[10px] font-bold uppercase px-2 py-1 rounded mb-2 inline-block">Default Shipping</span>}
                                            {addr.isDefaultBilling && <span className="bg-gray-100 text-gray-600 text-[10px] font-bold uppercase px-2 py-1 rounded mb-2 inline-block ml-2">Default Billing</span>}
                                            <p className="font-bold">{addr.name}</p>
                                            <p className="text-sm text-gray-600 mt-1">{addr.street}</p>
                                            {addr.line2 && <p className="text-sm text-gray-600">{addr.line2}</p>}
                                            <p className="text-sm text-gray-600">{addr.city}, {addr.state} {addr.zip}</p>
                                        </div>
                                    ))}
                                    {(!user.addresses || user.addresses.length === 0) && (
                                        <div className="col-span-2 text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                            <MapPin className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                                            <p className="text-gray-500">No addresses saved.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'support' && (
                            <div>
                                <h2 className="text-2xl font-display font-bold mb-6">Support Tickets</h2>
                                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                    <MessageSquare className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                                    <p className="text-gray-500">Need help?</p>
                                    <p className="text-sm text-gray-400 mb-4">You can contact us via email at support@shipteez.com</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Address Modal */}
            {isAddressModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
                        <h3 className="font-bold text-lg mb-4">{editingAddress?.id ? 'Edit Address' : 'Add New Address'}</h3>
                        <form onSubmit={handleAddressSave} className="space-y-4">
                            <input className="w-full border p-2 rounded text-sm" placeholder="Full Name" value={editingAddress?.name || ''} onChange={e => setEditingAddress({...editingAddress, name: e.target.value})} required />
                            <input className="w-full border p-2 rounded text-sm" placeholder="Street Address" value={editingAddress?.street || ''} onChange={e => setEditingAddress({...editingAddress, street: e.target.value})} required />
                            <input className="w-full border p-2 rounded text-sm" placeholder="Apt, Suite, etc (Optional)" value={editingAddress?.line2 || ''} onChange={e => setEditingAddress({...editingAddress, line2: e.target.value})} />
                            <div className="grid grid-cols-3 gap-3">
                                <input className="w-full border p-2 rounded text-sm" placeholder="City" value={editingAddress?.city || ''} onChange={e => setEditingAddress({...editingAddress, city: e.target.value})} required />
                                <input className="w-full border p-2 rounded text-sm" placeholder="State" value={editingAddress?.state || ''} onChange={e => setEditingAddress({...editingAddress, state: e.target.value})} required />
                                <input className="w-full border p-2 rounded text-sm" placeholder="ZIP" value={editingAddress?.zip || ''} onChange={e => setEditingAddress({...editingAddress, zip: e.target.value})} required />
                            </div>
                            <div className="space-y-2 pt-2">
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={editingAddress?.isDefaultShipping || false} onChange={e => setEditingAddress({...editingAddress, isDefaultShipping: e.target.checked})} />
                                    Set as default shipping address
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={editingAddress?.isDefaultBilling || false} onChange={e => setEditingAddress({...editingAddress, isDefaultBilling: e.target.checked})} />
                                    Set as default billing address
                                </label>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsAddressModalOpen(false)} className="px-4 py-2 border rounded text-sm font-bold">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-black text-white rounded text-sm font-bold">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};