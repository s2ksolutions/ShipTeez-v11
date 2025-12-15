
import React, { useState, useRef, useEffect } from 'react';
import { Product } from '../types';
import { useStore } from '../context/StoreProvider';
import { X, Tag, Heart, Ruler, Check, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SocialShare } from './SocialShare';
import { SizeGuideModal } from './SizeGuideModal';

interface ProductModalProps {
    product: Product;
    onClose: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({ product, onClose }) => {
    const { addToCart, toggleWishlist, isInWishlist, content, savedPromoCode, savePromoCode, showToast } = useStore();
    const [activeImage, setActiveImage] = useState<string>(product.images[0]);
    const [selectedSize, setSelectedSize] = useState<string>('');
    const [selectedColor, setSelectedColor] = useState<string>('');
    const [showSizeGuide, setShowSizeGuide] = useState(false);
    
    // Promo Input State
    const [promoInput, setPromoInput] = useState('');

    // Zoom State
    const [isHovering, setIsHovering] = useState(false);
    const [isZoomEnabled, setIsZoomEnabled] = useState(false); // Default false: Click to Zoom
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const imageRef = useRef<HTMLDivElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    const linkedGuide = content?.sizeGuides?.find(g => g.id === product.sizeGuideId);

    // Initialize defaults
    useEffect(() => {
        if(product.sizes && product.sizes.length) setSelectedSize(product.sizes[1] || product.sizes[0]);
        if(product.colors && product.colors.length) setSelectedColor(product.colors[0]);
        setActiveImage(product.images[0]);
        setIsZoomEnabled(false);
    }, [product]);

    // Focus Trap
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key !== 'Tab') return;

            const element = modalRef.current;
            if (!element) return;

            const focusableElements = element.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            
            const firstElement = focusableElements[0] as HTMLElement;
            const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleMouseEnter = () => {
        if (isZoomEnabled) setIsHovering(true);
    };

    const handleMouseLeave = () => {
        setIsHovering(false);
    };

    const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isZoomEnabled) {
            // Enable Zoom
            setIsZoomEnabled(true);
            setIsHovering(true);
            
            // Immediately center zoom on click location
            if (imageRef.current) {
                const { left, top, width, height } = imageRef.current.getBoundingClientRect();
                const x = ((e.clientX - left) / width) * 100;
                const y = ((e.clientY - top) / height) * 100;
                setMousePos({ x, y });
            }
        } else {
            // Disable Zoom
            setIsZoomEnabled(false);
            setIsHovering(false);
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!imageRef.current || !isZoomEnabled) return;
        const { left, top, width, height } = imageRef.current.getBoundingClientRect();
        const x = ((e.clientX - left) / width) * 100;
        const y = ((e.clientY - top) / height) * 100;
        setMousePos({ x, y });
    };

    const handleSavePromo = () => {
        if (promoInput.trim()) {
            savePromoCode(promoInput.trim());
            setPromoInput('');
            showToast("Promo code saved for checkout", "success");
        }
    };

    const handleRemovePromo = () => {
        savePromoCode(null);
    };

    const handleAddToCart = () => {
        // Updated: Pass true to open drawer
        addToCart(product, 1, selectedSize, selectedColor, true);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            {/* Unified Backdrop Opacity: bg-black/25 */}
            <div 
                className="absolute inset-0 bg-black/25 backdrop-blur-sm transition-opacity" 
                onClick={onClose}
            ></div>
            
            {showSizeGuide && linkedGuide && (
                <SizeGuideModal guide={linkedGuide} onClose={() => setShowSizeGuide(false)} />
            )}

            <div ref={modalRef} className="relative w-full max-w-6xl bg-white sm:rounded-none shadow-2xl overflow-hidden flex flex-col md:flex-row h-full md:h-auto md:max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 p-2 bg-white/50 rounded-full hover:bg-black hover:text-white text-black transition-colors"
                >
                    <X className="h-6 w-6" />
                </button>

                {/* Left: Image Section */}
                <div className="w-full md:w-3/5 bg-gray-50 flex flex-col justify-center relative h-1/2 md:h-auto">
                     <div className="flex flex-col-reverse gap-4 h-full p-6 md:p-8">
                        {/* Thumbnails */}
                        {product.images.length > 1 && (
                            <div className="flex gap-4 overflow-x-auto py-2 no-scrollbar justify-center">
                                {product.images.map((image, idx) => (
                                    <button
                                    key={idx}
                                    onClick={() => { setActiveImage(image); setIsZoomEnabled(false); }}
                                    className={`relative flex-shrink-0 h-16 w-16 cursor-pointer border transition-all ${
                                        activeImage === image ? 'border-black opacity-100' : 'border-transparent opacity-60 hover:opacity-100'
                                    }`}
                                    >
                                    <img src={image} alt="" className="h-full w-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Main Image */}
                        <div 
                            className={`flex-1 w-full relative overflow-hidden bg-white shadow-sm group flex items-center justify-center ${isZoomEnabled ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
                            ref={imageRef}
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                            onMouseMove={handleMouseMove}
                            onClick={handleImageClick}
                        >
                            <img
                            src={activeImage}
                            alt={product.title}
                            className={`max-h-full max-w-full object-contain transition-opacity duration-200 ${isHovering ? 'opacity-0' : 'opacity-100'}`}
                            />
                            
                            <div 
                                className="absolute inset-0 bg-no-repeat bg-contain bg-center pointer-events-none"
                                style={{
                                    backgroundImage: `url(${activeImage})`,
                                    backgroundPosition: `${mousePos.x}% ${mousePos.y}%`,
                                    transform: 'scale(2.5)', 
                                    transformOrigin: `${mousePos.x}% ${mousePos.y}%`,
                                    opacity: isHovering ? 1 : 0
                                }}
                            />
                        </div>
                     </div>
                </div>

                {/* Right: Details Section */}
                <div className="w-full md:w-2/5 bg-white flex flex-col h-1/2 md:h-auto">
                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6 md:p-10">
                        <div className="mb-6">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-gray-500 mb-3">
                                {product.category}
                            </div>
                            <h2 className="text-3xl font-display font-bold text-gray-900 leading-tight mb-4">{product.title}</h2>
                            <div className="flex items-center justify-between pb-6 border-b border-gray-100">
                                <div className="flex items-baseline gap-3">
                                    <span className="text-2xl font-medium text-gray-900">${product.price.toFixed(2)}</span>
                                </div>
                                
                                <button onClick={() => toggleWishlist(product.id)} className={`text-gray-400 hover:text-red-500 transition-colors`}>
                                    <Heart className={`h-6 w-6 ${isInWishlist(product.id) ? 'fill-red-500 text-red-500' : ''}`} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-8">
                            {/* Size Selection */}
                            {product.sizes && product.sizes.length > 0 && (
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-sm font-bold text-gray-900 uppercase">Size: {selectedSize}</span>
                                        {linkedGuide && (
                                            <button onClick={() => setShowSizeGuide(true)} className="text-xs text-gray-500 underline hover:text-black flex items-center gap-1">
                                                <Ruler className="h-3 w-3"/> Size Guide
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        {product.sizes.map(size => (
                                            <button
                                                key={size}
                                                onClick={() => setSelectedSize(size)}
                                                className={`h-10 px-4 min-w-[3rem] text-sm font-medium border transition-all ${
                                                    selectedSize === size 
                                                    ? 'border-black bg-black text-white' 
                                                    : 'border-gray-300 text-gray-900 hover:border-black'
                                                }`}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Color Selection */}
                            {product.colors && product.colors.length > 0 && (
                                <div>
                                    <span className="text-sm font-bold text-gray-900 uppercase mb-3 block">Color</span>
                                    <div className="flex flex-wrap gap-3">
                                        {product.colors.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setSelectedColor(color)}
                                                className={`h-8 w-8 rounded-full border border-gray-200 flex items-center justify-center focus:outline-none transition-all ${
                                                    selectedColor === color ? 'ring-1 ring-offset-2 ring-black' : 'hover:scale-110'
                                                }`}
                                                style={{ backgroundColor: color.toLowerCase().includes('white') ? '#ffffff' : color.toLowerCase() }}
                                                title={color}
                                            >
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {/* Promo Code Logic */}
                            <div>
                                {savedPromoCode ? (
                                    <div className="bg-green-50 border border-green-100 rounded-lg p-3 flex justify-between items-center animate-in fade-in slide-in-from-top-2">
                                        <div>
                                            <p className="text-xs font-bold text-green-700 flex items-center gap-1">
                                                <Check className="h-3 w-3" /> Code saved for checkout
                                            </p>
                                            <p className="text-sm font-mono font-medium text-green-800 mt-0.5">{savedPromoCode}</p>
                                        </div>
                                        <button 
                                            onClick={handleRemovePromo}
                                            className="text-gray-400 hover:text-red-500 p-1"
                                            title="Remove saved code"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold uppercase tracking-wide text-gray-500 flex items-center gap-1">
                                            <Tag className="h-3 w-3" /> Have a promo code?
                                        </label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={promoInput}
                                                onChange={e => setPromoInput(e.target.value)}
                                                className="text-sm border-gray-300 rounded focus:ring-black focus:border-black px-3 py-1 w-full"
                                                placeholder="Enter code"
                                            />
                                            <button 
                                                onClick={handleSavePromo} 
                                                className="bg-gray-100 hover:bg-black hover:text-white text-gray-900 px-4 text-xs uppercase font-bold rounded transition-colors"
                                                disabled={!promoInput.trim()}
                                            >
                                                Save
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-gray-400">Code will be automatically applied at checkout.</p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">
                                    {product.description}
                                </p>
                                <SocialShare title={product.title} />
                            </div>
                        </div>
                    </div>

                    {/* Fixed Actions Footer */}
                    <div className="p-4 md:px-10 md:pb-10 border-t border-gray-100 bg-white z-10 shrink-0">
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={handleAddToCart}
                                className="w-full bg-gray-900 hover:bg-black text-white px-6 py-4 text-sm font-bold uppercase tracking-widest transition-transform active:scale-[0.99]"
                            >
                                Add to Cart — ${product.price.toFixed(2)}
                            </button>
                            <Link to={`/product/${product.slug || product.id}`} className="text-center text-xs font-medium text-gray-500 hover:text-black mt-2 underline">
                                View Full Product Page
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
