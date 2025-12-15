
import React from 'react';
import { StoreContent } from '../../types';
import { Share2 } from 'lucide-react';

interface SocialSectionProps {
    content: StoreContent;
    onUpdateContent: (fn: (c: StoreContent) => StoreContent) => void;
    onSaveContent: () => Promise<void>;
}

export const SocialSection: React.FC<SocialSectionProps> = ({ content, onUpdateContent, onSaveContent }) => {
    return (
        <div className="max-w-2xl mx-auto bg-white p-8 border shadow-sm animate-in fade-in">
            <h2 className="font-bold text-xl mb-6">Social Media Links</h2>
            <div className="space-y-4">
                {['facebook', 'twitter', 'instagram', 'pinterest', 'tiktok'].map(platform => (
                    <div key={platform} className="flex items-center gap-4">
                        <label className="w-24 capitalize font-bold text-sm text-gray-600">{platform}</label>
                        <div className="flex-1 relative">
                            <input
                                className="w-full border p-2 pl-8 rounded"
                                placeholder={`https://${platform}.com/...`}
                                value={(content.socials as any)[platform] || ''}
                                onChange={e => onUpdateContent(c => ({ ...c, socials: { ...c.socials, [platform]: e.target.value } }))}
                            />
                            <Share2 className="h-4 w-4 text-gray-400 absolute left-2.5 top-2.5" />
                        </div>
                    </div>
                ))}
            </div>
            <button onClick={onSaveContent} className="mt-8 w-full bg-black text-white py-3 font-bold uppercase hover:bg-gray-800">Save Socials</button>
        </div>
    );
};
