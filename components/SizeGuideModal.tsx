
import React from 'react';
import { SizeGuide } from '../types';
import { X, Ruler } from 'lucide-react';

interface SizeGuideModalProps {
    guide: SizeGuide;
    onClose: () => void;
}

export const SizeGuideModal: React.FC<SizeGuideModalProps> = ({ guide, onClose }) => {
    // Basic markdown table parser for display
    const renderTable = (content: string) => {
        const rows = content.split('\n').filter(line => line.trim() !== '' && !line.includes('---'));
        if (rows.length === 0) return null;

        const header = rows[0].split('|').filter(c => c.trim()).map(c => c.trim());
        const body = rows.slice(1).map(row => row.split('|').filter(c => c.trim()).map(c => c.trim()));

        return (
            <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-100 text-xs font-bold uppercase text-gray-600">
                    <tr>
                        {header.map((h, i) => <th key={i} className="p-3 border-b">{h}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {body.map((row, i) => (
                        <tr key={i}>
                            {row.map((cell, j) => <td key={j} className="p-3 font-medium text-gray-800">{cell}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-full max-w-lg bg-white shadow-2xl p-6 flex flex-col animate-in zoom-in-95 duration-200 rounded-lg">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-display font-bold flex items-center gap-2"><Ruler className="h-5 w-5"/> {guide.title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <X className="h-5 w-5"/>
                    </button>
                </div>
                <div className="overflow-x-auto border rounded-lg">
                    {renderTable(guide.content)}
                </div>
                <div className="mt-6 text-center">
                    <button onClick={onClose} className="bg-black text-white px-6 py-2 text-sm font-bold uppercase rounded hover:bg-gray-800">Close</button>
                </div>
            </div>
        </div>
    );
};
