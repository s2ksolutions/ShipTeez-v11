import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreProvider';
import { db } from '../services/db';
import { Product } from '../types';
import { ProductCard } from '../components/ProductCard';
import { ProductModal } from '../components/ProductModal';
import { SEO } from '../components/SEO';
import { Heart, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';

export const Wishlist: React.FC = () => {
    const { wishlist } = useStore();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    useEffect(() => {
        const loadWishlist = async () => {
            if (wishlist.size === 0) {
                setProducts([]);
                setLoading(false);
                return;
            }

            try {
                const all = await db.getAllProducts();
                const filtered = all.filter(p => wishlist.has(p.id));
                setProducts(filtered);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadWishlist();
    }, [wishlist]);

    return (
        <div className="min-h-screen bg-white">
            <SEO title="My Wishlist" description="Your saved items" />
            {selectedProduct && <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />}

            <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <Breadcrumbs />
                </div>
                <h1 className="text-3xl font-display font-bold text-gray-900 mb-8 flex items-center gap-3">
                    <Heart className="h-8 w-8 text-black fill-black" /> My Wishlist ({products.length})
                </h1>

                {loading ? (
                     <div className="text-center py-20 text-gray-500">Loading...</div>
                ) : products.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 border border-gray-200">
                        <Heart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900">Your wishlist is empty</h3>
                        <p className="mt-2 text-gray-500">Save items you love to revisit them later.</p>
                        <Link to="/" className="mt-6 inline-flex items-center gap-2 text-black font-bold uppercase tracking-wide border-b-2 border-black pb-1 hover:text-gray-600 hover:border-gray-600 transition-colors">
                            Start Shopping <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-y-12 gap-x-6 sm:grid-cols-2 lg:grid-cols-4 xl:gap-x-8">
                        {products.map(product => (
                            <ProductCard 
                                key={product.id} 
                                product={product} 
                                onClick={setSelectedProduct} 
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};