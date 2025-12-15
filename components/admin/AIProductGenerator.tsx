
import React, { useState } from 'react';
import { adminMiddleware } from '../../services/adminMiddleware';
import { toBase64 } from '../../utils';
import { Sparkles, Loader2, Wand2, Upload } from 'lucide-react';

interface AIProductGeneratorProps {
    onRefresh: () => Promise<void>;
}

export const AIProductGenerator: React.FC<AIProductGeneratorProps> = ({ onRefresh }) => {
    const [genType, setGenType] = useState<'Mug' | 'T-Shirt'>('Mug');
    const [genStyle, setGenStyle] = useState('Modern Minimalist');
    const [genCount, setGenCount] = useState(1);
    const [genOrientation, setGenOrientation] = useState('Front');
    const [genMockup, setGenMockup] = useState<string | undefined>(undefined); // Custom AI Mockup
    const [isGenerating, setIsGenerating] = useState(false);
    const [genLog, setGenLog] = useState<string[]>([]);

    const handleGenMockupUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setGenMockup(await toBase64(e.target.files[0]));
    };

    const startGeneration = async () => {
        setIsGenerating(true); 
        setGenLog([]);
        const log = (m: string) => setGenLog(p => [...p, m]);
        try {
            await adminMiddleware.inventory.generateAIProducts(genType, genStyle, genCount, genOrientation, log, genMockup);
            await onRefresh();
            alert("AI Generation Complete!");
        } catch (e: any) { 
            // Error handled by logging
        } finally { 
            setIsGenerating(false); 
        }
    };

    return (
        <div className="bg-white p-6 shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold font-display mb-4 flex items-center gap-2"><Sparkles className="h-5 w-5 text-purple-600" /> AI Product Generator</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Product Type</label>
                    <select className="w-full border p-2 rounded" value={genType} onChange={e => setGenType(e.target.value as any)}>
                        <option value="Mug">Ceramic Mug</option>
                        <option value="T-Shirt">T-Shirt</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Art Style</label>
                    <input className="w-full border p-2 rounded" value={genStyle} onChange={e => setGenStyle(e.target.value)} placeholder="e.g. Vaporwave, Bauhaus..." />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Count</label>
                    <input type="number" min="1" max="5" className="w-full border p-2 rounded" value={genCount} onChange={e => setGenCount(parseInt(e.target.value))} />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">View/Orientation</label>
                    <select className="w-full border p-2 rounded" value={genOrientation} onChange={e => setGenOrientation(e.target.value)}>
                        <option value="Front">Front View</option>
                        <option value="Perspective">Perspective</option>
                        <option value="Flat Lay">Flat Lay (Shirt)</option>
                    </select>
                </div>
            </div>
            
            {/* Advanced: Custom Mockup Upload for AI */}
            <div className="mt-4 p-4 bg-gray-50 border border-dashed rounded">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-600 cursor-pointer">
                    <Upload className="h-4 w-4" /> 
                    {genMockup ? "Custom Mockup Loaded (Click to change)" : "Optional: Upload Custom Mockup Image"}
                    <input type="file" accept="image/*" className="hidden" onChange={handleGenMockupUpload} />
                </label>
                {genMockup && <div className="mt-2 h-16 w-16 bg-white border"><img src={genMockup} className="h-full w-full object-cover" /></div>}
                <p className="text-xs text-gray-400 mt-1">If uploaded, AI will warp the design onto this specific product image instead of generating a new one.</p>
            </div>

            <div className="mt-4">
                <button 
                    onClick={startGeneration} 
                    disabled={isGenerating} 
                    className="bg-purple-600 text-white px-6 py-2 rounded font-bold uppercase text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    Generate Products
                </button>
            </div>

            {/* Console Log */}
            {genLog.length > 0 && (
                <div className="mt-4 bg-black text-green-400 p-4 font-mono text-xs h-32 overflow-y-auto rounded">
                    {genLog.map((l, i) => <div key={i}>&gt; {l}</div>)}
                </div>
            )}
        </div>
    );
};
