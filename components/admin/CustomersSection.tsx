
import React, { useState, useMemo } from 'react';
import { User } from '../../types';
import { db } from '../../services/db';
import { Search, Ban, Trash2, Users, UserMinus, AlertTriangle, TrendingUp, Mail } from 'lucide-react';

interface CustomersSectionProps {
    users: User[];
    onRefresh: () => Promise<void>;
}

export const CustomersSection: React.FC<CustomersSectionProps> = ({ users, onRefresh }) => {
    const [userSearch, setUserSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'suspicious' | 'churn' | 'suspended'>('all');

    // Advanced Stats Calculation
    const stats = useMemo(() => {
        const total = users.length;
        const active = users.filter(u => !u.isSuspended).length;
        const totalRevenue = users.reduce((acc, u) => acc + (u.orders?.reduce((oa, o) => oa + o.total, 0) || 0), 0);
        
        // Churn Risk: No login/order in 90 days
        const ninetyDays = 90 * 24 * 60 * 60 * 1000;
        const atRisk = users.filter(u => {
            const lastActive = u.lastLogin || (u.orders?.[0]?.date) || u.orders?.length === 0;
            if (typeof lastActive === 'boolean') return true; // New user with no orders
            return Date.now() - lastActive > ninetyDays;
        }).length;

        // Suspicious: Example logic (e.g., > 50% returns or high risk score)
        const suspicious = users.filter(u => (u.riskScore && u.riskScore > 70)).length; // Mocked

        return { total, active, totalRevenue, atRisk, suspicious };
    }, [users]);

    // Enhanced Filtering
    const filteredUsers = users.filter(u => {
        const matchesSearch = u.email.toLowerCase().includes(userSearch.toLowerCase()) || u.name.toLowerCase().includes(userSearch.toLowerCase());
        if (!matchesSearch) return false;

        if (filter === 'suspicious') return (u.riskScore && u.riskScore > 50) || false;
        if (filter === 'suspended') return u.isSuspended;
        if (filter === 'churn') {
             const lastActive = u.lastLogin || (u.orders?.[0]?.date) || 0;
             return Date.now() - lastActive > (90 * 24 * 60 * 60 * 1000);
        }
        return true;
    });

    const StatCard = ({ label, value, icon: Icon, color }: any) => (
        <div className="bg-white p-6 border shadow-sm rounded-lg flex items-center justify-between">
            <div>
                <p className="text-xs font-bold uppercase text-gray-500 mb-1">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
            <div className={`p-3 rounded-full ${color}`}>
                <Icon className="h-6 w-6 text-white opacity-80" />
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in">
            {/* Dashboard Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard label="Total Users" value={stats.total} icon={Users} color="bg-blue-500" />
                <StatCard label="Total Revenue" value={`$${stats.totalRevenue.toFixed(0)}`} icon={TrendingUp} color="bg-green-500" />
                <StatCard label="Churn Risk (90d)" value={stats.atRisk} icon={UserMinus} color="bg-orange-500" />
                <StatCard label="Suspicious" value={stats.suspicious} icon={AlertTriangle} color="bg-red-500" />
            </div>

            {/* List Control */}
            <div className="bg-white border shadow-sm rounded-lg overflow-hidden">
                <div className="p-4 border-b flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50">
                    <h2 className="font-bold text-lg text-gray-700">Customers</h2>
                    
                    <div className="flex gap-4 items-center w-full md:w-auto">
                        <div className="flex bg-white rounded border overflow-hidden">
                            {['all', 'churn', 'suspicious', 'suspended'].map((f: any) => (
                                <button 
                                    key={f} 
                                    onClick={() => setFilter(f)} 
                                    className={`px-3 py-1.5 text-xs font-bold uppercase ${filter === f ? 'bg-black text-white' : 'hover:bg-gray-100 text-gray-600'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                        <div className="relative flex-1 md:w-64">
                            <input type="text" placeholder="Search..." className="pl-9 pr-4 py-1.5 border rounded w-full text-sm" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                            <Search className="absolute left-3 top-2 h-4 w-4 text-gray-400" />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 text-gray-500 uppercase font-bold text-xs border-b">
                            <tr>
                                <th className="p-4">Customer</th>
                                <th className="p-4">LTV</th>
                                <th className="p-4">Last Order</th>
                                <th className="p-4">Risk Score</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredUsers.map(u => {
                                const totalSpent = (u.orders || []).reduce((acc, o) => acc + o.total, 0);
                                const lastOrder = u.orders?.[0]?.date;
                                
                                return (
                                    <tr key={u.id} className="hover:bg-gray-50 group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-xs text-gray-600">
                                                    {u.name[0]}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900">{u.name}</p>
                                                    <p className="text-xs text-gray-500">{u.email}</p>
                                                </div>
                                                {u.role === 'admin' && <span className="bg-purple-100 text-purple-700 px-2 rounded text-[10px] uppercase font-bold">Admin</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 font-mono font-medium">${totalSpent.toFixed(2)}</td>
                                        <td className="p-4 text-gray-500">{lastOrder ? new Date(lastOrder).toLocaleDateString() : 'Never'}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-16 bg-gray-200 rounded-full overflow-hidden">
                                                    <div className={`h-full ${u.riskScore && u.riskScore > 50 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${u.riskScore || 10}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${u.isSuspended ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                {u.isSuspended ? 'Suspended' : 'Active'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right flex justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                            <button title="Email" className="p-2 border rounded hover:bg-gray-100"><Mail className="h-4 w-4 text-gray-600" /></button>
                                            <button title={u.isSuspended ? "Unsuspend" : "Suspend"} onClick={async () => { await db.toggleUserSuspension(u.id, !u.isSuspended); onRefresh(); }} className="p-2 border rounded hover:bg-gray-100">
                                                <Ban className={`h-4 w-4 ${u.isSuspended ? 'text-green-600' : 'text-orange-500'}`} />
                                            </button>
                                            {u.role !== 'admin' && (
                                                <button title="Delete" onClick={async () => { if (confirm('Permanently delete user data?')) { await db.deleteUser(u.id); onRefresh(); } }} className="p-2 border rounded hover:bg-red-50 text-red-500">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {filteredUsers.length === 0 && <div className="p-12 text-center text-gray-400">No customers found matching filter.</div>}
                </div>
            </div>
        </div>
    );
};
