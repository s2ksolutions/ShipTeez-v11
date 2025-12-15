
import React, { useState } from 'react';
import { Product } from '../types';
import { Eye, Heart, ShoppingBag, ShoppingCart, Zap, ChevronRight } from 'lucide-react';
import { useStore } from '../context/StoreProvider';
import { useNavigate, Link } from 'react-router-dom';
import { OptimizedImage } from './OptimizedImage';
import { db } from '../services/db';

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
  badge?: string;
  priority?: boolean;
  viewMode?: 'cozy' | 'compact' | 'list';
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick, badge, priority = false, viewMode = 'cozy' }) => {
  const { toggleWishlist, isInWishlist, addToCart } = useStore();
  const navigate = useNavigate();
  const isFavorite = isInWishlist(product.id);
  const isSale = product.originalPrice && product.originalPrice > product.price;
  
  // Local state for image display (color variants)
  const [activeImage, setActiveImage] = useState(product.images[0]);

  const saveLastViewed = () => {
      sessionStorage.setItem('artisan_last_viewed_product', product.id);
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
      e.stopPropagation();
      const defaultSize = product.sizes?.[0];
      const defaultColor = product.colors?.[0];
      addToCart(product, 1, defaultSize, defaultColor, true);
  };

  const handleBuyNow = (e: React.MouseEvent) => {
      e.stopPropagation();
      saveLastViewed();
      const defaultSize = product.sizes?.[0];
      const defaultColor = product.colors?.[0];
      addToCart(product, 1, defaultSize, defaultColor, false);
      navigate('/checkout');
  };

  const handleMouseEnter = () => {
      db.prefetchProduct(product.id);
      if (activeImage) {
          const img = new Image();
          img.src = activeImage;
      }
  };

  const handleColorHover = (color: string) => {
      const variant = product.colorVariants?.find(v => v.color === color);
      if (variant) {
          setActiveImage(variant.image);
      } else {
          // Reset to default main image if no specific variant image
          setActiveImage(product.images[0]);
      }
  };

  const specs = product.itemSpecifics ? Object.entries(product.itemSpecifics).slice(0, 1) : [];
  
  // Category Parsing: Split by ' > '
  const categoryParts = product.category.split(' > ');

  // Determine Priority Badge
  let activeBadge = null;
  if (product.isClearance) activeBadge = { label: 'Clearance', color: 'bg-orange-600' };
  else if (product.isBogo) activeBadge = { label: 'Buy 1 Get 1', color: 'bg-purple-600' };
  else if (isSale) activeBadge = { label: 'Sale', color: 'bg-red-600' };
  else if (product.isFeatured) activeBadge = { label: 'Featured', color: 'bg-blue-600' };
  else if (badge) activeBadge = { label: badge, color: 'bg-black' };

  // --- LIST VIEW LAYOUT ---
  if (viewMode === 'list') {
      return (
        <div 
            className="group flex flex-col sm:flex-row gap-6 p-4 border rounded-xl hover:shadow-lg transition-all bg-white cursor-pointer"
            onClick={() => { saveLastViewed(); onClick(product); }}
            onMouseEnter={handleMouseEnter}
        >
            <div className="w-full sm:w-48 h-48 flex-shrink-0 bg-gray-100 relative overflow-hidden rounded-lg">
                <OptimizedImage
                    src={activeImage || 'https://picsum.photos/400/400'}
                    alt={product.title}
                    className="h-full w-full object-cover object-center"
                    priority={priority}
                />
                {activeBadge && (
                    <span className={`absolute top-2 left-2 ${activeBadge.color} text-white text-[10px] uppercase font-bold px-2 py-1 shadow-sm rounded`}>
                        {activeBadge.label}
                    </span>
                )}
            </div>

            <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center flex-wrap gap-1 text-xs text-gray-500 uppercase tracking-wide mb-1">
                            {categoryParts.map((part, i) => (
                                <React.Fragment key={i}>
                                    {i > 0 && <ChevronRight className="h-3 w-3 text-gray-300" />}
                                    <Link 
                                        to={`/?category=${encodeURIComponent(categoryParts.slice(0, i + 1).join(' > '))}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="hover:text-black hover:underline decoration-1 underline-offset-2 transition-colors"
                                    >
                                        {part}
                                    </Link>
                                </React.Fragment>
                            ))}
                        </div>
                        <h3 className="text-lg font-display font-bold text-gray-900 group-hover:underline decoration-1 underline-offset-4 mb-2">
                            {product.title}
                        </h3>
                    </div>
                    <button 
                        onClick={handleWishlist}
                        className={`p-2 rounded-full hover:bg-gray-100 transition-all ${isFavorite ? 'text-red-500' : 'text-gray-400'}`}
                    >
                        <Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
                    </button>
                </div>

                <p className="text-sm text-gray-600 line-clamp-2 mb-4 flex-1">{product.description}</p>

                <div className="flex items-center justify-between mt-auto">
                    <div className="flex gap-2 items-baseline">
                        <p className={`text-lg font-bold ${isSale ? 'text-red-600' : 'text-gray-900'}`}>${product.price.toFixed(2)}</p>
                        {isSale && <p className="text-sm text-gray-400 line-through">${product.originalPrice?.toFixed(2)}</p>}
                    </div>
                    
                    <div className="flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={handleAddToCart}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-900 px-4 py-2 rounded-lg text-xs font-bold uppercase flex items-center gap-2 transition-colors"
                        >
                            <ShoppingCart className="h-4 w-4" /> Add
                        </button>
                        <button 
                            onClick={handleBuyNow}
                            className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase flex items-center gap-2 transition-colors shadow-md"
                        >
                            <Zap className="h-4 w-4 fill-current" /> Buy Now
                        </button>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  // --- GRID / COMPACT VIEW LAYOUT ---
  return (
    <div 
        className="group relative cursor-pointer flex flex-col transform transition-transform duration-300 will-change-transform"
        onClick={() => { saveLastViewed(); onClick(product); }}
        onMouseEnter={handleMouseEnter}
    >
      <div className="aspect-square w-full overflow-hidden bg-gray-100 relative mb-4 rounded-sm">
        <OptimizedImage
          src={activeImage || 'https://picsum.photos/400/400'}
          alt={product.title}
          className="h-full w-full object-cover object-center transition-all duration-300"
          priority={priority}
        />

        {/* Secondary Hover Image (Only if activeImage is main, and there's a 2nd main image) */}
        {activeImage === product.images[0] && product.images[1] && (
            <img 
                src={product.images[1]}
                alt={product.title}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover object-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-20 pointer-events-none"
            />
        )}
        
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-30">
             {activeBadge && (
                 <span className={`${activeBadge.color} text-white text-[10px] uppercase font-bold px-2 py-1 shadow-sm`}>
                     {activeBadge.label}
                 </span>
             )}
        </div>

        <button 
            onClick={handleWishlist}
            className={`absolute top-2 right-2 p-2 rounded-full bg-white shadow-md hover:scale-110 transition-all z-30 ${isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
            title={isFavorite ? "Remove from Wishlist" : "Add to Wishlist"}
        >
            <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
        </button>
        
        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 pointer-events-none" />

        <div className="absolute bottom-4 left-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-4 group-hover:translate-y-0 z-30">
            <button 
                onClick={handleBuyNow}
                className="flex-1 bg-white text-black py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors shadow-lg flex items-center justify-center gap-1"
            >
                <Zap className="h-3 w-3 fill-current" /> Buy Now
            </button>
            <button 
                onClick={handleAddToCart}
                className="w-12 bg-white text-black py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors shadow-lg flex items-center justify-center"
                title="Add to Cart"
            >
                <ShoppingCart className="h-4 w-4" />
            </button>
        </div>
      </div>
      
      <div className="flex flex-col space-y-1">
        <h3 className="text-base font-display font-medium text-gray-900 group-hover:underline decoration-1 underline-offset-4 line-clamp-1">
           {product.title}
        </h3>
        <div className="flex justify-between items-center">
            {/* Parsed Category Display */}
            <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide truncate max-w-[70%]">
                {categoryParts.map((part, i) => (
                    <React.Fragment key={i}>
                        {i > 0 && <ChevronRight className="h-2 w-2 text-gray-300 flex-shrink-0" />}
                        <Link 
                            to={`/?category=${encodeURIComponent(categoryParts.slice(0, i + 1).join(' > '))}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-black hover:underline decoration-1 underline-offset-2 transition-colors truncate"
                        >
                            {part}
                        </Link>
                    </React.Fragment>
                ))}
            </div>
            {specs.length > 0 && <p className="text-[10px] text-gray-400 flex-shrink-0">{specs[0][1]}</p>}
        </div>
        
        <div className="flex items-center justify-between mt-1">
            <div className="flex gap-2 items-baseline">
                <p className={`text-sm font-semibold ${isSale ? 'text-red-600' : 'text-gray-900'}`}>${product.price.toFixed(2)}</p>
                {isSale && <p className="text-xs text-gray-400 line-through">${product.originalPrice?.toFixed(2)}</p>}
            </div>
            
            {/* Interactive Color Swatches */}
            {product.colors && product.colors.length > 0 ? (
                <div className="flex gap-1 items-center" onClick={(e) => e.stopPropagation()}>
                    {product.colors.slice(0, 5).map(color => (
                        <div 
                            key={color}
                            onMouseEnter={() => handleColorHover(color)}
                            onMouseLeave={() => setActiveImage(product.images[0])}
                            className="w-3 h-3 rounded-full border border-gray-200 cursor-pointer hover:scale-125 transition-transform shadow-sm"
                            style={{ backgroundColor: color.toLowerCase().includes('white') ? '#ffffff' : color.toLowerCase() }}
                            title={color}
                        />
                    ))}
                    {product.colors.length > 5 && <span className="text-[10px] text-gray-400">+</span>}
                </div>
            ) : product.category === 'T-Shirt' && product.sizes && product.sizes.length > 0 && (
                <div className="flex gap-1 items-center">
                    {product.sizes.slice(0, 4).map(size => (
                        <span key={size} className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {size}
                        </span>
                    ))}
                    {product.sizes.length > 4 && <span className="text-[10px] text-gray-400">+</span>}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
