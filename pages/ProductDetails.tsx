
import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Product } from '../types';
import { SEO } from '../components/SEO';
import { db } from '../services/db';
import { useStore } from '../context/StoreProvider';
import { SocialShare } from '../components/SocialShare';
import { ProductCard } from '../components/ProductCard';
import { SizeGuideModal } from '../components/SizeGuideModal';
import { Loader2, Check, Tag, Heart, Ruler, Info, Trash2 } from 'lucide-react';
import { generateUUID } from '../utils';
import { Breadcrumbs } from '../components/Breadcrumbs';

// --- Skeleton Component ---
const ProductDetailsSkeleton = () => (
    <div className="pt-6 pb-16 sm:pb-24 bg-white animate-pulse min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-8">
            <div className="h-4 w-48 bg-gray-200 rounded"></div>
        </div>
        <div className="mx-auto mt-8 max-w-2xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
            <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-12">
                {/* Left: Image Skeleton */}
                <div className="flex flex-col-reverse gap-6">
                    <div className="mx-auto hidden w-full max-w-2xl sm:block lg:max-w-none">
                        <div className="grid grid-cols-4 gap-6">
                            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-sm"></div>)}
                        </div>
                    </div>
                    <div className="aspect-square w-full bg-gray-200 rounded-sm relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                    </div>
                </div>

                {/* Right: Details Skeleton */}
                <div className="mt-10 px-4 sm:mt-16 sm:px-0 lg:mt-0 space-y-6">
                    <div className="h-10 w-3/4 bg-gray-200 rounded"></div>
                    <div className="h-8 w-1/4 bg-gray-200 rounded"></div>
                    <div className="space-y-2 pt-4">
                        <div className="h-4 w-full bg-gray-200 rounded"></div>
                        <div className="h-4 w-full bg-gray-200 rounded"></div>
                        <div className="h-4 w-2/3 bg-gray-200 rounded"></div>
                    </div>
                    <div className="pt-6">
                        <div className="h-4 w-20 bg-gray-200 rounded mb-2"></div>
                        <div className="flex gap-3">
                            {[1,2,3,4,5].map(i => <div key={i} className="h-10 w-12 bg-gray-200 rounded"></div>)}
                        </div>
                    </div>
                    <div className="pt-6 flex gap-4">
                        <div className="h-14 flex-1 bg-gray-200 rounded"></div>
                        <div className="h-14 w-16 bg-gray-200 rounded"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

export const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // 'id' matches route param but can contain slug
  const [product, setProduct] = useState<Product | null>(null);
  const [activeImage, setActiveImage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);

  // Global Context
  const { addToCart, toggleWishlist, isInWishlist, content, user, savedPromoCode, savePromoCode, showToast } = useStore();

  // Variant State
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  
  // Promo Input
  const [promoInput, setPromoInput] = useState('');

  // Zoom State
  const [isHovering, setIsHovering] = useState(false);
  const [isZoomEnabled, setIsZoomEnabled] = useState(false); // Default false: Click to enable
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLDivElement>(null);

  const linkedGuide = content?.sizeGuides?.find(g => g.id === product?.sizeGuideId);
  
  // Breadcrumb State - Construct dynamic crumbs based on product hierarchy
  const getCrumbs = () => {
      if(!product) return [];
      const crumbs = []; // No root 'Shop' needed as Breadcrumbs component adds it
      
      // Prefer splitting the category string to ensure alignment with Shop filters
      if (product.category) {
          const parts = product.category.split(' > ');
          parts.forEach((part, index) => {
              // Construct cumulative path (e.g. Home, Home > Decor)
              const cumulativePath = parts.slice(0, index + 1).join(' > ');
              crumbs.push({ 
                  label: part, 
                  path: `/?category=${encodeURIComponent(cumulativePath)}` 
              });
          });
      } else if(product.hierarchy) {
          // Fallback to legacy hierarchy array if category string is missing
          product.hierarchy.forEach(item => {
              crumbs.push({ label: item, path: `/?search=${encodeURIComponent(item)}` });
          });
      }
      
      crumbs.push({ label: product.title, path: '' });
      return crumbs;
  };

  useEffect(() => {
    const load = async () => {
        if (!id) return;
        setLoading(true);
        try {
            // Support lookup by ID OR Slug
            const found = await db.getProduct(id);
            
            if (found) {
                // Visibility Check (Allow Admin to view)
                if (found.isHidden && user?.role !== 'admin') {
                    setProduct(null);
                    setLoading(false);
                    return;
                }

                setProduct(found);
                setActiveImage(found.images[0]);
                setIsZoomEnabled(false);
                // Defaults
                if(found.sizes && found.sizes.length) setSelectedSize(found.sizes[1] || found.sizes[0]);
                if(found.colors && found.colors.length) setSelectedColor(found.colors[0]);

                // Load Related Products (Async separately to show main product fast)
                db.getAllProducts().then(all => {
                    const related = all.filter(p => 
                        p.id !== found.id && 
                        !p.isHidden && // Ensure hidden products don't show up in related
                        (
                            p.category === found.category || 
                            p.tags.some(t => found.tags.includes(t))
                        )
                    ).slice(0, 4);
                    setRelatedProducts(related);
                });

                // Log View Event
                db.logEvent({
                    id: generateUUID(),
                    type: 'product_view',
                    productId: found.id,
                    timestamp: Date.now()
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    load();
  }, [id, user]);

  // Handle Color Switching for Variant Images
  useEffect(() => {
      if (product && selectedColor && product.colorVariants) {
          const variant = product.colorVariants.find(v => v.color === selectedColor);
          if (variant) {
              setActiveImage(variant.image);
          }
      }
  }, [selectedColor, product]);

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

  if (loading) {
      return <ProductDetailsSkeleton />;
  }

  if (!product) return <div className="p-20 text-center text-gray-500 font-bold text-lg">Product Not Found</div>;

  return (
    <div className="bg-white min-h-screen font-sans">
      <SEO title={product.title} description={product.description} product={product} />
      
      {showSizeGuide && linkedGuide && (
          <SizeGuideModal guide={linkedGuide} onClose={() => setShowSizeGuide(false)} />
      )}

      <div className="pt-6 pb-16 sm:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-8">
            <Breadcrumbs items={getCrumbs()} />
        </div>

        <div className="mx-auto mt-8 max-w-2xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-12">
            {/* Image Gallery */}
            <div className="flex flex-col-reverse gap-6">
              <div className="mx-auto hidden w-full max-w-2xl sm:block lg:max-w-none">
                <div className="grid grid-cols-4 gap-6" aria-orientation="horizontal" role="tablist">
                  {/* Standard Images */}
                  {product.images.map((image, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setActiveImage(image); setIsZoomEnabled(false); }}
                      className={`relative flex h-24 cursor-pointer items-center justify-center bg-gray-50 text-sm font-medium uppercase text-gray-900 hover:bg-gray-100 ${
                          activeImage === image ? 'ring-2 ring-black' : 'ring-transparent'
                      }`}
                    >
                      <span className="absolute inset-0 overflow-hidden">
                        <img src={image} alt="" className="h-full w-full object-cover object-center" />
                      </span>
                    </button>
                  ))}
                  
                  {/* Mapped Variants (Hidden ones that aren't in main array but exist in variants) */}
                  {product.colorVariants?.filter(v => v.isHidden && !product.images.includes(v.image)).map((v, idx) => (
                      <button
                      key={`var-${idx}`}
                      onClick={() => { setActiveImage(v.image); setIsZoomEnabled(false); setSelectedColor(v.color); }}
                      className={`relative flex h-24 cursor-pointer items-center justify-center bg-gray-50 text-sm font-medium uppercase text-gray-900 hover:bg-gray-100 ${
                          activeImage === v.image ? 'ring-2 ring-black' : 'ring-transparent'
                      }`}
                      title={v.color}
                    >
                      <span className="absolute inset-0 overflow-hidden">
                        <img src={v.image} alt={v.color} className="h-full w-full object-cover object-center" />
                        <span className="absolute bottom-0 right-0 bg-white/80 text-[8px] px-1 text-black font-bold">{v.color}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Image with Zoom */}
              <div 
                className={`aspect-square w-full relative overflow-hidden bg-gray-50 group ${isZoomEnabled ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
                ref={imageRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onMouseMove={handleMouseMove}
                onClick={handleImageClick}
              >
                {product.isHidden && <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-center text-xs font-bold py-1 z-20">PREVIEW MODE (HIDDEN)</div>}
                <img
                  src={activeImage}
                  alt={product.title}
                  className={`h-full w-full object-contain object-center transition-opacity duration-200 ${isHovering ? 'opacity-0' : 'opacity-100'}`}
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

            {/* Product Info Column */}
            <div className="mt-10 px-4 sm:mt-16 sm:px-0 lg:mt-0">
              <h1 className="text-4xl font-display font-bold tracking-tight text-gray-900">{product.title}</h1>
              
              <div className="mt-4 flex items-end gap-3 border-b border-gray-100 pb-6">
                <p className="text-3xl font-medium tracking-tight text-gray-900">${product.price.toFixed(2)}</p>
              </div>

              {/* Advanced Options (Moved Up) */}
              <div className="mt-8 space-y-6">
                  
                  {/* Colors */}
                  {product.colors && product.colors.length > 0 && (
                      <div>
                          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Color: <span className="text-gray-500 font-normal capitalize">{selectedColor}</span></h3>
                          <div className="flex flex-wrap gap-3">
                              {product.colors.map(color => (
                                  <button
                                    key={color}
                                    onClick={() => setSelectedColor(color)}
                                    className={`group relative h-10 w-10 rounded-full flex items-center justify-center focus:outline-none transition-all ${selectedColor === color ? 'ring-2 ring-offset-2 ring-black' : 'hover:scale-110 ring-1 ring-gray-200'}`}
                                  >
                                    <span 
                                        className="h-full w-full rounded-full border border-black/10"
                                        style={{ backgroundColor: color.toLowerCase().includes('white') ? '#ffffff' : color.toLowerCase() }}
                                        title={color}
                                    />
                                    {selectedColor === color && <Check className={`h-4 w-4 absolute ${color.toLowerCase().includes('white') || color.toLowerCase().includes('yellow') ? 'text-black' : 'text-white'}`} />}
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}

                  {/* Sizes */}
                  {product.sizes && product.sizes.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Size: <span className="text-gray-500 font-normal">{selectedSize}</span></h3>
                            {linkedGuide && (
                                <button onClick={() => setShowSizeGuide(true)} className="text-xs text-gray-500 hover:text-black underline flex items-center gap-1 transition-colors">
                                    <Ruler className="h-3 w-3"/> Size Guide
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                            {product.sizes.map(size => (
                                <button
                                    key={size}
                                    onClick={() => setSelectedSize(size)}
                                    className={`relative flex items-center justify-center border py-3 text-sm font-medium rounded-md focus:outline-none transition-all ${
                                        selectedSize === size 
                                        ? 'border-black bg-black text-white shadow-md' 
                                        : 'border-gray-200 text-gray-900 hover:border-gray-400 bg-white'
                                    }`}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                      </div>
                  )}

                  {/* Promo Code Logic */}
                  <div className="pt-2">
                      {savedPromoCode ? (
                          <div className="bg-green-50 border border-green-100 rounded-lg p-3 flex justify-between items-center max-w-sm">
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
                          <div className="max-w-sm">
                              <div className="flex gap-2">
                                  <input 
                                    type="text" 
                                    value={promoInput}
                                    onChange={(e) => setPromoInput(e.target.value)}
                                    placeholder="Promo Code"
                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:border-black focus:ring-black sm:text-sm px-4 py-3 bg-gray-50 focus:bg-white transition-colors"
                                  />
                                  <button 
                                    onClick={handleSavePromo}
                                    className="bg-gray-100 hover:bg-black hover:text-white text-gray-900 px-6 py-2 text-xs font-bold uppercase rounded-md transition-colors whitespace-nowrap"
                                    disabled={!promoInput.trim()}
                                  >
                                    Save
                                  </button>
                              </div>
                              <p className="text-[10px] text-gray-400 mt-1">Code will be automatically applied at checkout.</p>
                          </div>
                      )}
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-4 pt-2">
                    <button
                        type="button"
                        onClick={() => addToCart(product, 1, selectedSize, selectedColor, true)}
                        className="flex-1 bg-black border border-transparent py-4 px-8 items-center justify-center text-base font-bold text-white uppercase tracking-widest hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black shadow-lg hover:shadow-xl transition-all active:scale-[0.99] rounded-md"
                    >
                        Add to Cart
                    </button>

                    <button
                        type="button"
                        onClick={() => toggleWishlist(product.id)}
                        className={`p-4 rounded-md border flex items-center justify-center transition-all ${isInWishlist(product.id) ? 'border-red-200 bg-red-50 text-red-500' : 'border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600'}`}
                        title="Add to Wishlist"
                    >
                        <Heart className={`h-6 w-6 flex-shrink-0 ${isInWishlist(product.id) ? 'fill-current' : ''}`} />
                    </button>
                  </div>
              </div>
              
              <div className="mt-6">
                  <SocialShare title={product.title} />
              </div>

              {/* Description (Moved Down) */}
              <div className="mt-10 border-t border-gray-100 pt-8">
                <h3 className="text-lg font-bold text-gray-900 mb-4">About this product</h3>
                <div className="prose prose-sm text-gray-600 leading-relaxed max-w-none">
                    <p>{product.description}</p>
                </div>
              </div>

              {/* Item Specifics Table (Moved Down & Fixed) */}
              {product.itemSpecifics && Object.keys(product.itemSpecifics).length > 0 && (
                  <div className="mt-8 border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 text-xs font-bold uppercase text-gray-600 flex items-center gap-2 tracking-wider">
                          <Info className="h-4 w-4"/> Technical Specifications
                      </div>
                      <div className="divide-y divide-gray-100 bg-white">
                          {Object.entries(product.itemSpecifics).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
                              <div key={key} className="grid grid-cols-[35%_65%] sm:grid-cols-[140px_1fr]">
                                  <div className="p-3 sm:p-4 text-sm font-medium text-gray-500 bg-gray-50/50 border-r border-gray-100 flex items-center">
                                      {key}
                                  </div>
                                  <div className="p-3 sm:p-4 text-sm text-gray-900 font-medium break-words leading-relaxed">
                                      {value}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {/* Tags & SKU */}
              <div className="mt-8 pt-6 border-t border-gray-100">
                 <div className="flex flex-wrap items-center gap-2">
                   {product.tags.map(tag => (
                       <span key={tag} className="inline-flex items-center bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600 uppercase tracking-wide hover:bg-gray-200 cursor-pointer rounded-full transition-colors">
                           #{tag}
                       </span>
                   ))}
                </div>
                 <p className="text-xs text-gray-400 mt-4 font-mono">SKU: {product.sku}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
            <div className="mt-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <h2 className="text-2xl font-bold font-display text-gray-900 mb-8">You Might Also Like</h2>
                <div className="grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-4 xl:gap-x-8">
                    {relatedProducts.map(rel => (
                         <ProductCard 
                            key={rel.id} 
                            product={rel} 
                            onClick={() => window.location.href = `#/product/${rel.slug || rel.id}`} 
                         />
                    ))}
                </div>
            </div>
        )}

      </div>
    </div>
  );
};
