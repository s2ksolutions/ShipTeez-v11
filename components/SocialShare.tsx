
import React, { useState } from 'react';
import { Facebook, Twitter, Linkedin, Link2, Check, QrCode, X, Download } from 'lucide-react';

export const SocialShare: React.FC<{ title: string }> = ({ title }) => {
    const url = window.location.href;
    const [copied, setCopied] = useState(false);
    const [showQr, setShowQr] = useState(false);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const share = (platform: string) => {
        let link = '';
        const text = encodeURIComponent(`Check out ${title} on ShipTeez!`);
        const u = encodeURIComponent(url);

        switch(platform) {
            case 'facebook': link = `https://www.facebook.com/sharer/sharer.php?u=${u}`; break;
            case 'twitter': link = `https://twitter.com/intent/tweet?url=${u}&text=${text}`; break;
            case 'linkedin': link = `https://www.linkedin.com/shareArticle?mini=true&url=${u}&title=${text}`; break;
        }
        window.open(link, '_blank', 'width=600,height=400');
    };

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;

    const handleDownloadQr = async () => {
        try {
            const response = await fetch(qrUrl);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `product-qr.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("Failed to download QR code", e);
        }
    };

    return (
        <div className="flex items-center gap-2 mt-4 relative">
            <span className="text-xs font-bold uppercase text-gray-500 mr-2">Share:</span>
            <button onClick={() => share('facebook')} className="p-2 bg-gray-100 rounded-full hover:bg-[#1877F2] hover:text-white transition-colors">
                <Facebook className="h-4 w-4" />
            </button>
            <button onClick={() => share('twitter')} className="p-2 bg-gray-100 rounded-full hover:bg-[#1DA1F2] hover:text-white transition-colors">
                <Twitter className="h-4 w-4" />
            </button>
            <button onClick={() => share('linkedin')} className="p-2 bg-gray-100 rounded-full hover:bg-[#0A66C2] hover:text-white transition-colors">
                <Linkedin className="h-4 w-4" />
            </button>
            <button onClick={copyToClipboard} className="p-2 bg-gray-100 rounded-full hover:bg-gray-800 hover:text-white transition-colors relative" title="Copy Link">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Link2 className="h-4 w-4" />}
            </button>
            <button onClick={() => setShowQr(true)} className="p-2 bg-gray-100 rounded-full hover:bg-black hover:text-white transition-colors" title="Get QR Code">
                <QrCode className="h-4 w-4" />
            </button>

            {/* QR Popover */}
            {showQr && (
                <div className="absolute bottom-full left-0 mb-2 z-50 animate-in zoom-in-95 origin-bottom-left">
                    <div className="bg-white p-4 rounded-xl shadow-2xl border border-gray-200 w-64 text-center relative">
                        <button 
                            onClick={() => setShowQr(false)}
                            className="absolute top-2 right-2 text-gray-400 hover:text-black p-1 rounded-full hover:bg-gray-100"
                        >
                            <X className="h-4 w-4"/>
                        </button>
                        
                        <h4 className="font-bold text-sm text-gray-900 mb-3">Scan to Shop</h4>
                        <div className="bg-gray-50 p-2 rounded-lg mb-3 border border-gray-100 inline-block">
                            <img src={qrUrl} alt="Product QR" className="w-40 h-40 mix-blend-multiply" />
                        </div>
                        
                        <button 
                            onClick={handleDownloadQr}
                            className="w-full flex items-center justify-center gap-2 bg-black text-white py-2 rounded text-xs font-bold uppercase hover:bg-gray-800 transition-colors"
                        >
                            <Download className="h-3 w-3"/> Save Image
                        </button>
                    </div>
                    {/* Arrow */}
                    <div className="absolute bottom-[-6px] left-36 w-3 h-3 bg-white border-b border-r border-gray-200 transform rotate-45"></div>
                </div>
            )}
            
            {/* Backdrop for QR modal if needed on mobile to close when clicking outside */}
            {showQr && (
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowQr(false)}></div>
            )}
        </div>
    );
};
