
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/db';
import { AnalyticsEvent, CampaignStats, Product } from '../../types';
import { BarChart3, TrendingUp, DollarSign, MousePointer, Filter, Eye } from 'lucide-react';

export const AnalyticsSection: React.FC = () => {
    const [events, setEvents] = useState<AnalyticsEvent[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [adSpends, setAdSpends] = useState<Record<string, number>>({}); 

    useEffect(() => {
        const load = async () => {
            try {
                const data = await db.getAnalyticsEvents();
                setEvents(data);
                const prods = await db.getAllProducts();
                setProducts(prods);
            } catch (e) {
                console.error(e);
            }
        };
        load();
    }, []);

    const stats: CampaignStats[] = useMemo(() => {
        const campaigns: Record<string, CampaignStats> = {};
        
        events.forEach(e => {
            const name = e.campaign || 'Direct / None';
            if (!campaigns[name]) {
                campaigns[name] = { name, visits: 0, conversions: 0, revenue: 0 };
            }
            if (e.type === 'visit') campaigns[name].visits++;
            if (e.type === 'conversion') {
                campaigns[name].conversions++;
                campaigns[name].revenue += (e.revenue || 0);
            }
        });

        return Object.values(campaigns).map(c => {
            const spend = adSpends[c.name] || 0;
            const roi = spend > 0 ? ((c.revenue - spend) / spend) * 100 : 0;
            return { ...c, adSpend: spend, roi };
        });
    }, [events, adSpends]);

    const productStats = useMemo(() => {
        const views: Record<string, number> = {};
        events.forEach(e => {
            if (e.type === 'product_view' && e.productId) {
                views[e.productId] = (views[e.productId] || 0) + 1;
            }
        });
        
        return products.map(p => ({
            ...p,
            views: views[p.id] || 0
        })).sort((a,b) => b.views - a.views).slice(0, 10);
    }, [events, products]);

    return (
        <div className="space-y-8 animate-in fade-in">
            <h2 className="font-bold text-xl flex items-center gap-2"><BarChart3 className="h-6 w-6"/> Analytics Dashboard</h2>
            
            {/* Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 border rounded shadow-sm">
                    <p className="text-xs font-bold uppercase text-gray-500 mb-1">Total Visits</p>
                    <p className="text-3xl font-bold">{events.filter(e => e.type === 'visit').length}</p>
                </div>
                <div className="bg-white p-6 border rounded shadow-sm">
                    <p className="text-xs font-bold uppercase text-gray-500 mb-1">Total Conversions</p>
                    <p className="text-3xl font-bold">{events.filter(e => e.type === 'conversion').length}</p>
                </div>
                <div className="bg-white p-6 border rounded shadow-sm">
                    <p className="text-xs font-bold uppercase text-gray-500 mb-1">Total Attributed Revenue</p>
                    <p className="text-3xl font-bold text-green-600">${stats.reduce((a,c) => a + c.revenue, 0).toFixed(2)}</p>
                </div>
            </div>

            {/* Campaign Table */}
            <div className="bg-white border rounded shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-700">Campaign Performance</h3>
                    <span className="text-xs text-gray-500 bg-white border px-2 py-1 rounded">Last 30 Days</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 text-xs uppercase font-bold text-gray-500">
                            <tr>
                                <th className="p-4">Campaign Name</th>
                                <th className="p-4 text-right">Visits</th>
                                <th className="p-4 text-right">Orders</th>
                                <th className="p-4 text-right">Revenue</th>
                                <th className="p-4 text-right w-32">Ad Spend ($)</th>
                                <th className="p-4 text-right">ROI</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {stats.map(c => (
                                <tr key={c.name} className="hover:bg-gray-50">
                                    <td className="p-4 font-medium flex items-center gap-2">
                                        <Filter className="h-3 w-3 text-gray-400"/> {c.name}
                                    </td>
                                    <td className="p-4 text-right">{c.visits}</td>
                                    <td className="p-4 text-right">{c.conversions}</td>
                                    <td className="p-4 text-right font-mono">${c.revenue.toFixed(2)}</td>
                                    <td className="p-4 text-right">
                                        <input 
                                            type="number" 
                                            className="border p-1 w-20 text-right text-xs" 
                                            placeholder="0.00"
                                            value={adSpends[c.name] || ''}
                                            onChange={(e) => setAdSpends(prev => ({...prev, [c.name]: parseFloat(e.target.value)}))}
                                        />
                                    </td>
                                    <td className="p-4 text-right">
                                        {c.adSpend ? (
                                            <span className={`font-bold ${c.roi! > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {c.roi!.toFixed(0)}%
                                            </span>
                                        ) : <span className="text-gray-300">-</span>}
                                    </td>
                                </tr>
                            ))}
                            {stats.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400">No data available yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Product Performance Table */}
            <div className="bg-white border rounded shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-700">Top Products by Views</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 text-xs uppercase font-bold text-gray-500">
                            <tr>
                                <th className="p-4">Product</th>
                                <th className="p-4 text-right">Page Views</th>
                                <th className="p-4 text-right">Price</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {productStats.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="p-4 flex items-center gap-3">
                                        <img src={p.images[0]} className="w-8 h-8 rounded object-cover border" />
                                        <span className="font-medium">{p.title}</span>
                                    </td>
                                    <td className="p-4 text-right font-bold flex items-center justify-end gap-2">
                                        {p.views} <Eye className="h-4 w-4 text-gray-400"/>
                                    </td>
                                    <td className="p-4 text-right font-mono">${p.price.toFixed(2)}</td>
                                </tr>
                            ))}
                            {productStats.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-gray-400">No view data available yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="text-xs text-gray-500 bg-yellow-50 p-4 border border-yellow-200 rounded">
                <strong>Note:</strong> Campaign data is tracked via `utm_campaign` URL parameters. "Ad Spend" is local only for calculator purposes and not saved to the database.
            </div>
        </div>
    );
};
