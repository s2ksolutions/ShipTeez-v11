
import React, { useState, useEffect } from 'react';
import { Product, PromoCode } from '../../types';
import { db } from '../../services/db';
import { generateCopy } from '../../services/geminiService';
import { Sparkles, Copy, Monitor, Mail, ArrowRight, Loader2, Image as ImageIcon } from 'lucide-react';

export const CreativesGenerator: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [promos, setPromos] = useState<PromoCode[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<string>('');
    const [selectedPromo, setSelectedPromo] = useState<string>('');
    const [creativeType, setCreativeType] = useState<'banner' | 'email'>('banner');
    const [generatedCode, setGeneratedCode] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        const load = async () => {
            setProducts(await db.getAllProducts());
            setPromos(await db.getAllPromos());
        };
        load();
    }, []);

    const handleGenerate = async () => {
        setIsGenerating(true);
        const product = products.find(p => p.id === selectedProduct);
        const promo = promos.find(p => p.code === selectedPromo);
        
        let prompt = "";
        let context = "";

        if (product) context += `Product: ${product.title}. Description: ${product.description}. Price: $${product.price}. `;
        if (promo) context += `Promo Code: ${promo.code} for ${promo.value}${promo.discountType === 'percentage' ? '%' : '$'} Off. `;

        if (creativeType === 'banner') {
            prompt = `Create HTML/CSS for a responsive banner ad (300x250 size container, but fluid). 
            Context: ${context}
            Design: Clean, modern, eye-catching. 
            Output: ONLY HTML code starting with <div style="...">. Use inline CSS. Include a placeholder <img> tag if no product image provided (or use product image URL if you have context). 
            Make it look like a professional e-commerce ad.`;
        } else {
            prompt = `Create HTML for a promotional email.
            Context: ${context}
            Design: Simple, elegant, readable.
            Output: ONLY HTML code starting with <div style="...">. Use inline CSS suitable for email clients.
            Include a "Shop Now" button.`;
        }

        try {
            const result = await generateCopy(prompt, "html creative");
            // Basic cleanup to ensure we just get the div if AI wraps in markdown
            const clean = result.replace(/```html/g, '').replace(/```/g, '').trim();
            setGeneratedCode(clean);
        } catch (e) {
            alert("Generation failed");
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedCode);
        alert("Copied HTML to clipboard!");
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in h-full">
            <div className="space-y-6">
                <div className="bg-white p-6 border shadow-sm rounded-lg">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Sparkles className="h-5 w-5 text-purple-600"/> AI Creative Studio</h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">1. Select Content Source</label>
                            <select className="w-full border p-2 rounded text-sm mb-2" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                                <option value="">-- Choose Product (Optional) --</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                            </select>
                            <select className="w-full border p-2 rounded text-sm" value={selectedPromo} onChange={e => setSelectedPromo(e.target.value)}>
                                <option value="">-- Choose Promo (Optional) --</option>
                                {promos.map(p => <option key={p.code} value={p.code}>{p.code} ({p.value}% Off)</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">2. Creative Type</label>
                            <div className="flex gap-2">
                                <button onClick={() => setCreativeType('banner')} className={`flex-1 py-3 border rounded font-bold text-sm flex items-center justify-center gap-2 ${creativeType === 'banner' ? 'bg-black text-white' : 'hover:bg-gray-50'}`}>
                                    <Monitor className="h-4 w-4" /> Web Banner
                                </button>
                                <button onClick={() => setCreativeType('email')} className={`flex-1 py-3 border rounded font-bold text-sm flex items-center justify-center gap-2 ${creativeType === 'email' ? 'bg-black text-white' : 'hover:bg-gray-50'}`}>
                                    <Mail className="h-4 w-4" /> Email Blast
                                </button>
                            </div>
                        </div>

                        <button onClick={handleGenerate} disabled={isGenerating} className="w-full bg-purple-600 text-white py-3 font-bold uppercase rounded hover:bg-purple-700 flex items-center justify-center gap-2">
                            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin"/> : <><Sparkles className="h-4 w-4"/> Generate Creative</>}
                        </button>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 border rounded text-xs text-gray-500">
                    <strong>Tip:</strong> Ensure you have selected a product or promo code to give the AI context for the creative.
                </div>
            </div>

            <div className="flex flex-col h-full bg-white border shadow-sm rounded-lg overflow-hidden">
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <h3 className="font-bold text-sm">Preview & Code</h3>
                    {generatedCode && <button onClick={copyToClipboard} className="text-xs flex items-center gap-1 bg-white border px-2 py-1 rounded hover:bg-gray-100"><Copy className="h-3 w-3"/> Copy HTML</button>}
                </div>
                
                <div className="flex-1 overflow-auto p-8 bg-checkered flex items-center justify-center">
                    {generatedCode ? (
                        <div dangerouslySetInnerHTML={{ __html: generatedCode }} className="shadow-2xl bg-white max-w-full" />
                    ) : (
                        <div className="text-gray-400 text-center">
                            <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-20"/>
                            <p>Generated creative will appear here</p>
                        </div>
                    )}
                </div>

                {generatedCode && (
                    <div className="h-48 border-t bg-gray-900 text-gray-300 p-4 overflow-auto font-mono text-xs">
                        {generatedCode}
                    </div>
                )}
            </div>
        </div>
    );
};
