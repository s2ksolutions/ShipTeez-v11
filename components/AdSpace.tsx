
import React, { useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';

export const AdSpace: React.FC = () => {
    const { content } = useStore();
    const adRef = useRef<HTMLDivElement>(null);

    const config = content?.marketing?.ads;

    useEffect(() => {
        if (config?.enabled && config.script && adRef.current) {
            try {
                const container = adRef.current;
                container.innerHTML = ''; // Clear previous

                // Create a range to create a document fragment from the HTML string
                const range = document.createRange();
                range.selectNode(container);
                const documentFragment = range.createContextualFragment(config.script);
                container.appendChild(documentFragment);
            } catch (e) {
                console.error("Failed to render ad script", e);
            }
        }
    }, [config]);

    if (!config?.enabled || !config.script) return null;

    return (
        <div className="w-full my-8 flex justify-center bg-gray-50 border border-dashed border-gray-200 p-4 overflow-hidden">
            <div ref={adRef} className="ad-container" />
        </div>
    );
};
