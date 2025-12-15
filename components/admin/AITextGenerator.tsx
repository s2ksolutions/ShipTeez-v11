
import React, { useState } from 'react';
import { generateCopy } from '../../services/geminiService';
import { Sparkles, Loader2 } from 'lucide-react';

interface AITextGeneratorProps {
    context: string;
    type?: string;
    onGenerate: (text: string) => void;
    className?: string;
}

export const AITextGenerator: React.FC<AITextGeneratorProps> = ({ context, type = "marketing text", onGenerate, className }) => {
    const [loading, setLoading] = useState(false);

    const handleGenerate = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setLoading(true);
        try {
            const text = await generateCopy(context, type);
            if (text) onGenerate(text);
        } catch (error) {
            console.error("AI Generation failed", error);
            alert("Failed to generate text. Please check API key.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button 
            onClick={handleGenerate}
            disabled={loading}
            className={`p-2 bg-purple-100 text-purple-600 rounded-md hover:bg-purple-200 transition-colors disabled:opacity-50 ${className}`}
            title="Generate with AI"
        >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        </button>
    );
};
