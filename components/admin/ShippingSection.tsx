
import React, { useState } from 'react';
import { StoreContent, ShippingZone, ShippingTemplate } from '../../types';
import { Truck, Globe, Package, Settings, Plus, Trash2, Edit2, Check, X, Box, AlertTriangle, Save, Loader2 } from 'lucide-react';

interface ShippingSectionProps {
    content: StoreContent;
    onUpdateContent: (fn: (c: StoreContent) => StoreContent) => void;
    onSaveContent: () => Promise<void>;
}

export const ShippingSection: React.FC<ShippingSectionProps> = ({ content, onUpdateContent, onSaveContent }) => {
    // Zones
    const [newZoneName, setNewZoneName] = useState('');
    const [newZoneRate, setNewZoneRate] = useState(0);

    // Templates
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateBase, setNewTemplateBase] = useState(0);
    const [newTemplateAddl, setNewTemplateAddl] = useState(0);
    
    // Editing State
    const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
    const [editBuffer, setEditBuffer] = useState<Partial<ShippingTemplate>>({});
    
    // UI State
    const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const carriers = content.shipping.carriers || { fedex: false, ups: false, usps: true, dhl: false };
    const zones = content.shipping.zones || [];
    const templates = content.shippingTemplates || [];

    const handleCarrierToggle = (key: keyof typeof carriers) => {
        onUpdateContent(c => ({
            ...c,
            shipping: {
                ...c.shipping,
                carriers: { ...carriers, [key]: !carriers[key] }
            }
        }));
    };

    const handleAddZone = () => {
        if (!newZoneName) return;
        const newZone: ShippingZone = {
            id: crypto.randomUUID(),
            name: newZoneName,
            countries: [],
            rate: newZoneRate
        };
        onUpdateContent(c => ({
            ...c,
            shipping: { ...c.shipping, zones: [...zones, newZone] }
        }));
        setNewZoneName('');
        setNewZoneRate(0);
    };

    const handleDeleteZone = (id: string) => {
        onUpdateContent(c => ({
            ...c,
            shipping: { ...c.shipping, zones: zones.filter(z => z.id !== id) }
        }));
    };

    // --- Template Handlers ---
    const handleAddTemplate = () => {
        if (!newTemplateName.trim()) return;
        const newT: ShippingTemplate = {
            id: crypto.randomUUID(),
            name: newTemplateName,
            baseRate: newTemplateBase,
            additionalItemRate: newTemplateAddl
        };
        onUpdateContent(c => ({ ...c, shippingTemplates: [...templates, newT] }));
        setNewTemplateName('');
        setNewTemplateBase(0);
        setNewTemplateAddl(0);
    };

    const startEditing = (t: ShippingTemplate) => {
        setEditTemplateId(t.id);
        setEditBuffer({ ...t });
    };

    const updateBuffer = (key: keyof ShippingTemplate, value: any) => {
        setEditBuffer(prev => ({ ...prev, [key]: value }));
    };

    const commitEdit = () => {
        if (!editTemplateId) return;
        onUpdateContent(c => ({
            ...c,
            shippingTemplates: (c.shippingTemplates || []).map(t => 
                t.id === editTemplateId ? { ...t, ...editBuffer } : t
            )
        }));
        setEditTemplateId(null);
        setEditBuffer({});
    };

    const cancelEdit = () => {
        setEditTemplateId(null);
        setEditBuffer({});
    };

    const handleDeleteClick = (id: string) => {
        setDeleteConfirmation(id);
    };

    const executeDelete = () => {
        if (!deleteConfirmation) return;
        onUpdateContent(c => ({
            ...c,
            shippingTemplates: (c.shippingTemplates || []).filter(t => t.id !== deleteConfirmation)
        }));
        setDeleteConfirmation(null);
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            await onSaveContent();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in relative">
            
            {/* Custom Delete Modal to bypass sandbox confirm() restrictions */}
            {deleteConfirmation && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95">
                        <div className="flex items-center gap-3 mb-4 text-red-600">
                            <AlertTriangle className="h-6 w-6"/>
                            <h3 className="font-bold text-lg">Delete Template?</h3>
                        </div>
                        <p className="text-gray-600 mb-6 text-sm">
                            Are you sure you want to delete this shipping template? Products using it will fall back to global rates.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setDeleteConfirmation(null)} 
                                className="px-4 py-2 border rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={executeDelete} 
                                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 shadow-sm"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* General Settings */}
            <div className="bg-white p-6 border shadow-sm rounded-lg">
                <h2 className="font-bold text-lg mb-6 flex items-center gap-2"><Settings className="h-5 w-5 text-gray-600"/> General Shipping Settings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                        <label className="font-bold text-xs uppercase text-gray-500">Global Base Rate</label>
                        <div className="relative mt-1">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input 
                                type="number" 
                                className="border p-2 pl-6 w-full rounded focus:ring-black focus:border-black" 
                                value={content.shipping.baseRate} 
                                onChange={e => onUpdateContent(c => ({ ...c, shipping: { ...c.shipping, baseRate: parseFloat(e.target.value) } }))} 
                            />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Cost for the first item.</p>
                    </div>
                    <div>
                        <label className="font-bold text-xs uppercase text-gray-500">Additional Item</label>
                        <div className="relative mt-1">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input 
                                type="number" 
                                className="border p-2 pl-6 w-full rounded focus:ring-black focus:border-black" 
                                value={content.shipping.additionalItemRate ?? 0} 
                                onChange={e => onUpdateContent(c => ({ ...c, shipping: { ...c.shipping, additionalItemRate: parseFloat(e.target.value) } }))} 
                            />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Cost for each extra item.</p>
                    </div>
                    <div>
                        <label className="font-bold text-xs uppercase text-gray-500">Free Shipping Over</label>
                        <div className="relative mt-1">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input 
                                type="number" 
                                className="border p-2 pl-6 w-full rounded focus:ring-black focus:border-black" 
                                value={content.shipping.freeShippingThreshold} 
                                onChange={e => onUpdateContent(c => ({ ...c, shipping: { ...c.shipping, freeShippingThreshold: parseFloat(e.target.value) } }))} 
                            />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Set to 0 to disable.</p>
                    </div>
                    <div>
                        <label className="font-bold text-xs uppercase text-gray-500">Handling Fee</label>
                        <div className="relative mt-1">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input 
                                type="number" 
                                className="border p-2 pl-6 w-full rounded focus:ring-black focus:border-black" 
                                value={content.shipping.handlingFee || 0} 
                                onChange={e => onUpdateContent(c => ({ ...c, shipping: { ...c.shipping, handlingFee: parseFloat(e.target.value) } }))} 
                            />
                        </div>
                    </div>
                </div>
                <div className="mt-6 pt-6 border-t flex items-center gap-2">
                    <input 
                        type="checkbox" 
                        id="shipEnabled"
                        checked={content.shipping.enabled} 
                        onChange={e => onUpdateContent(c => ({ ...c, shipping: { ...c.shipping, enabled: e.target.checked } }))} 
                        className="h-4 w-4 text-black focus:ring-black rounded"
                    /> 
                    <label htmlFor="shipEnabled" className="font-bold text-sm text-gray-700 cursor-pointer">Enable Shipping Module</label>
                </div>
            </div>

            {/* Template Manager */}
            <div className="bg-white p-6 border shadow-sm rounded-lg">
                <h2 className="font-bold text-lg mb-6 flex items-center gap-2"><Box className="h-5 w-5 text-purple-600"/> Shipping Templates</h2>
                <p className="text-sm text-gray-500 mb-4">Create profiles for specific product types (e.g. Heavy, Fragile). These override global rates when applied to a product.</p>
                
                <div className="overflow-hidden border rounded-lg mb-6">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-xs">
                            <tr>
                                <th className="p-4">Template Name</th>
                                <th className="p-4">Base Rate</th>
                                <th className="p-4">Addl. Item</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {templates.map(t => {
                                const isEditing = editTemplateId === t.id;
                                return (
                                    <tr key={t.id} className={isEditing ? "bg-blue-50/50" : "hover:bg-gray-50 group"}>
                                        <td className="p-4 font-medium">
                                            {isEditing ? (
                                                <input 
                                                    className="border p-2 w-full rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                                    value={editBuffer.name} 
                                                    onChange={e => updateBuffer('name', e.target.value)} 
                                                    autoFocus
                                                />
                                            ) : t.name}
                                        </td>
                                        <td className="p-4">
                                            {isEditing ? (
                                                <input 
                                                    type="number" 
                                                    className="border p-2 w-24 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                                    value={editBuffer.baseRate} 
                                                    onChange={e => updateBuffer('baseRate', parseFloat(e.target.value))} 
                                                />
                                            ) : `$${t.baseRate.toFixed(2)}`}
                                        </td>
                                        <td className="p-4">
                                            {isEditing ? (
                                                <input 
                                                    type="number" 
                                                    className="border p-2 w-24 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                                    value={editBuffer.additionalItemRate} 
                                                    onChange={e => updateBuffer('additionalItemRate', parseFloat(e.target.value))} 
                                                />
                                            ) : `+$${t.additionalItemRate.toFixed(2)}`}
                                        </td>
                                        <td className="p-4 text-right">
                                            {isEditing ? (
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={commitEdit} className="bg-green-600 text-white p-1.5 rounded hover:bg-green-700 transition-colors" title="Save Changes"><Check className="h-4 w-4"/></button>
                                                    <button onClick={cancelEdit} className="bg-gray-200 text-gray-600 p-1.5 rounded hover:bg-gray-300 transition-colors" title="Cancel"><X className="h-4 w-4"/></button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => startEditing(t)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded transition-colors" title="Edit"><Edit2 className="h-4 w-4"/></button>
                                                    <button onClick={() => handleDeleteClick(t.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors" title="Delete"><Trash2 className="h-4 w-4"/></button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {templates.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">No custom templates defined.</td></tr>}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-end bg-purple-50 p-6 rounded-lg border border-purple-100 border-dashed">
                    <div className="flex-1 w-full">
                        <label className="text-xs font-bold uppercase text-gray-500 block mb-1">New Template Name</label>
                        <input className="border p-2 w-full text-sm rounded bg-white focus:ring-purple-500 focus:border-purple-500" placeholder="e.g. Stickers, Heavy Item" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} />
                    </div>
                    <div className="w-full md:w-32">
                        <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Base Rate</label>
                        <input type="number" className="border p-2 w-full text-sm rounded bg-white focus:ring-purple-500 focus:border-purple-500" placeholder="0.00" value={newTemplateBase} onChange={e => setNewTemplateBase(parseFloat(e.target.value))} />
                    </div>
                    <div className="w-full md:w-32">
                        <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Addl. Item</label>
                        <input type="number" className="border p-2 w-full text-sm rounded bg-white focus:ring-purple-500 focus:border-purple-500" placeholder="0.00" value={newTemplateAddl} onChange={e => setNewTemplateAddl(parseFloat(e.target.value))} />
                    </div>
                    <button onClick={handleAddTemplate} className="bg-purple-600 text-white px-6 py-2 font-bold uppercase text-xs rounded hover:bg-purple-700 h-9 flex items-center gap-2 w-full md:w-auto justify-center shadow-sm">
                        <Plus className="h-3 w-3" /> Create
                    </button>
                </div>
            </div>

            {/* Carrier Integrations */}
            <div className="bg-white p-6 border shadow-sm rounded-lg">
                <h2 className="font-bold text-lg mb-6 flex items-center gap-2"><Truck className="h-5 w-5 text-blue-600"/> Carrier Integrations</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(carriers).map(([key, enabled]) => (
                        <div key={key} className={`border rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-all ${enabled ? 'bg-black text-white border-black shadow-md' : 'bg-gray-50 text-gray-400 hover:border-gray-300'}`} onClick={() => handleCarrierToggle(key as any)}>
                            <span className="uppercase font-bold text-lg">{key}</span>
                            <span className="text-[10px] uppercase mt-1 font-bold">{enabled ? 'Active' : 'Disabled'}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Shipping Zones */}
            <div className="bg-white p-6 border shadow-sm rounded-lg">
                <h2 className="font-bold text-lg mb-6 flex items-center gap-2"><Globe className="h-5 w-5 text-green-600"/> International Zones</h2>
                
                <div className="overflow-hidden border rounded-lg mb-6">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-xs">
                            <tr><th className="p-4">Zone Name</th><th className="p-4">Rate</th><th className="p-4 text-right">Actions</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {zones.map(z => (
                                <tr key={z.id} className="hover:bg-gray-50">
                                    <td className="p-4 font-medium">{z.name}</td>
                                    <td className="p-4">${z.rate.toFixed(2)}</td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => handleDeleteZone(z.id)} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors"><Trash2 className="h-4 w-4"/></button>
                                    </td>
                                </tr>
                            ))}
                            {zones.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-gray-400 italic">No specific zones configured. Using Global Base Rate for all.</td></tr>}
                        </tbody>
                    </table>
                </div>

                <div className="flex gap-4 items-end bg-gray-50 p-6 rounded-lg border border-dashed border-gray-300">
                    <div className="flex-1">
                        <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Zone Name</label>
                        <input className="border p-2 w-full text-sm rounded focus:ring-black focus:border-black" placeholder="e.g. Europe, Asia" value={newZoneName} onChange={e => setNewZoneName(e.target.value)} />
                    </div>
                    <div className="w-32">
                        <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Rate</label>
                        <input type="number" className="border p-2 w-full text-sm rounded focus:ring-black focus:border-black" placeholder="0.00" value={newZoneRate} onChange={e => setNewZoneRate(parseFloat(e.target.value))} />
                    </div>
                    <button onClick={handleAddZone} className="bg-black text-white px-6 py-2 font-bold uppercase text-xs rounded hover:bg-gray-800 h-9 flex items-center gap-2 shadow-sm">
                        <Plus className="h-3 w-3" /> Add Zone
                    </button>
                </div>
            </div>

            <button 
                onClick={handleSaveAll} 
                disabled={isSaving}
                className="w-full bg-green-600 text-white py-4 font-bold uppercase tracking-widest hover:bg-green-700 shadow-md rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
            >
                {isSaving ? <Loader2 className="h-5 w-5 animate-spin"/> : <Save className="h-5 w-5"/>}
                Save Shipping Configuration
            </button>
        </div>
    );
};
