import React from 'react';
import { useStore } from '../context/StoreProvider';
import { Link } from 'react-router-dom';

export const TopBanner: React.FC = () => {
    const { content } = useStore();
    
    if (!content?.marketing?.banner?.enabled) return null;
    const { text, bgColor, textColor, link } = content.marketing.banner;

    return (
        <div 
            style={{ backgroundColor: bgColor, color: textColor }} 
            className="w-full text-center py-2 px-4 text-xs font-bold uppercase tracking-widest relative z-50"
        >
            {link ? (
                <Link to={link} className="hover:underline">{text}</Link>
            ) : (
                <span>{text}</span>
            )}
        </div>
    );
};