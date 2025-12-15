import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Product, SortOption } from '../types';
import { db } from '../services/db';
import { ProductCard } from '../components/ProductCard';
import { ProductModal } from '../components/ProductModal';
import { SEO } from '../components/SEO';
import { X, ChevronDown, SlidersHorizontal, Search, Trash2, LayoutGrid, Grid3x3, List, ChevronRight, Check, ChevronLeft, ArrowLeft, ArrowRight } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';

const MIN_PRICE = 0;
const MAX_PRICE = 100;
const MIN_GAP = 5;
const CATEGORY_SEPARATOR = " > ";
const PAGE_SIZE = 24; 

// Helper Interface for Tree
interface CategoryNode {
    name: string;
    fullPath: string;
    children: CategoryNode[];
}

export const Shop: React.FC = () => {
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchParams, setSearchParams] = useSearchParams();
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    
    // Grid Layout State
    const [gridMode, setGridMode] = useState<'cozy' | 'compact' | 'list'>('cozy');

    // URL Params
    const categoryParam = searchParams.get('category');
    const tagParam = searchParams.get('tag');
    const searchParam = searchParams.get('search') || '';

    // Local Filter State
    const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam || 'All');
    const [sortOption, setSortOption] = useState<SortOption>(SortOption.Newest);
    const [selectedColors, setSelectedColors] = useState<string[]>([]);
    const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
    const [selectedSpecials, setSelectedSpecials] = useState<string[]>([]); 
    const [priceRange, setPriceRange] = useState<[number, number]>([MIN_PRICE, MAX_PRICE]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [tagSearch, setTagSearch] = useState('');
    
    // Price Editing State
    const [editingMin, setEditingMin] = useState(false);
    const [editingMax, setEditingMax] = useState(false);
    const minInputRef = useRef<HTMLInputElement>(null);
    const maxInputRef = useRef<HTMLInputElement>(null);
    
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    // Expand state for category tree
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    // Progressive Loading Logic
    useEffect(() => {
        const loadProducts = async () => {
            setLoading(true);
            try {
                // 1. Fetch IDs first (Fast & Ordered by Backend)
                const ids = await db.getProductIds();
                
                // 2. Initialize Skeletons
                const skeletons: Product[] = ids.map(id => ({
                    id,
                    title: '',
                    description: '',
                    slug: '',
                    price: 0,
                    category: '',
                    hierarchy: [],
                    tags: [],
                    images: [],
                    sizes: [],
                    colors: [],
                    stock: 0,
                    sku: '',
                    createdAt: 0,
                    _loading: true 
                } as any));
                
                setAllProducts(skeletons);
                setLoading(false); 

                // 3. Fire Parallel Requests
                const batchSize = 10;
                for (let i = 0; i < ids.length; i += batchSize) {
                    const batch = ids.slice(i, i + batchSize);
                    await Promise.all(batch.map(async (id) => {
                        const detail = await db.getProduct(id);
                        if (detail) {
                            setAllProducts(prev => prev.map(p => p.id === id ? detail : p));
                        }
                    }));
                }
            } catch (e) {
                console.error("Failed to load products", e);
                setLoading(false);
            }
        };
        loadProducts();
    }, []);

    useEffect(() => {
        if (categoryParam) {
            setSelectedCategory(categoryParam);
            const parts = categoryParam.split(CATEGORY_SEPARATOR);
            const pathsToExpand = new Set<string>();
            let currentPath = "";
            parts.forEach((part, i) => {
                currentPath = i === 0 ? part : `${currentPath}${CATEGORY_SEPARATOR}${part}`;
                if (i < parts.length - 1) pathsToExpand.add(currentPath);
            });
            setExpandedCategories(prev => new Set([...prev, ...pathsToExpand]));
        } else {
            setSelectedCategory('All');
        }
    }, [categoryParam]);

    useEffect(() => {
        if (tagParam) setSelectedTags([tagParam]);
        else setSelectedTags([]);
    }, [tagParam]);

    useEffect(() => {
        setSelectedColors([]);
        setSelectedSizes([]);
        setSelectedTags([]);
        setSelectedSpecials([]);
        setPriceRange([MIN_PRICE, MAX_PRICE]);
        setTagSearch('');
    }, [searchParam]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchParam, selectedCategory, selectedColors, selectedSizes, selectedTags, selectedSpecials, priceRange, sortOption]);

    useEffect(() => {
        if (editingMin && minInputRef.current) minInputRef.current.focus();
    }, [editingMin]);

    useEffect(() => {
        if (editingMax && maxInputRef.current) maxInputRef.current.focus();
    }, [editingMax]);

    const visibleLoadedProducts = useMemo(() => allProducts.filter(p => !(p as any)._loading && !p.isHidden), [allProducts]);

    // NEW: Filter by category first to determine available facets
    const categoryFilteredProducts = useMemo(() => {
        if (selectedCategory === 'All') return visibleLoadedProducts;
        return visibleLoadedProducts.filter(p => p.category.startsWith(selectedCategory));
    }, [visibleLoadedProducts, selectedCategory]);

    const uniqueColors = useMemo(() => Array.from(new Set(categoryFilteredProducts.flatMap(p => p.colors || []))).filter(Boolean), [categoryFilteredProducts]);
    const uniqueSizes = useMemo(() => Array.from(new Set(categoryFilteredProducts.flatMap(p => p.sizes || []))).filter(Boolean), [categoryFilteredProducts]);
    
    const uniqueTags = useMemo(() => {
        const tags = new Set<string>();
        categoryFilteredProducts.forEach(p => {
            p.tags?.forEach(t => {
                const trimmed = t.trim();
                if (trimmed) {
                    const normalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
                    tags.add(normalized);
                }
            });
        });
        return Array.from(tags).sort((a, b) => a.localeCompare(b));
    }, [categoryFilteredProducts]);

    const availableSpecials = useMemo(() => {
        const options = new Set<string>();
        categoryFilteredProducts.forEach(p => {
            if (p.originalPrice && p.price < p.originalPrice) options.add('On Sale');
            if (p.isFeatured) options.add('Featured');
            if (p.isClearance) options.add('Clearance');
            if (p.isBogo) options.add('Buy 1 Get 1');
        });
        return Array.from(options).sort();
    }, [categoryFilteredProducts]);
    
    // --- TREE BUILDER ---
    const categoryTree = useMemo(() => {
        const rawCategories = Array.from(new Set(visibleLoadedProducts.map(p => p.category)));
        const root: CategoryNode[] = [];
        
        rawCategories.sort().forEach((path: string) => {
            const parts = path.split(CATEGORY_SEPARATOR);
            let currentLevel = root;
            
            parts.forEach((part, index) => {
                const currentPath = parts.slice(0, index + 1).join(CATEGORY_SEPARATOR);
                let node = currentLevel.find(n => n.name === part);
                
                if (!node) {
                    node = { name: part, fullPath: currentPath, children: [] };
                    currentLevel.push(node);
                }
                currentLevel = node.children;
            });
        });
        return root;
    }, [visibleLoadedProducts]);

    const displayedTags = useMemo(() => uniqueTags.filter(t => t.toLowerCase().includes(tagSearch.toLowerCase())), [uniqueTags, tagSearch]);

    const filteredProducts = useMemo(() => {
        return allProducts.filter(product => {
            // Keep skeletons in the list during loading to maintain layout
            if ((product as any)._loading) return true;

            if (product.isHidden) return false;

            if (searchParam) {
                const searchTerms = searchParam.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
                const matchesAllTerms = searchTerms.every(term => {
                    const inTitle = product.title.toLowerCase().includes(term);
                    const inTags = product.tags.some(t => t.toLowerCase().includes(term));
                    const inCategory = product.category.toLowerCase().includes(term);
                    return inTitle || inTags || inCategory;
                });
                if (!matchesAllTerms) return false;
            }

            if (selectedCategory !== 'All') {
                if (!product.category.startsWith(selectedCategory)) return false;
            }

            if (selectedSpecials.length > 0) {
                const matchesSpecials = selectedSpecials.every(special => {
                    switch (special) {
                        case 'On Sale': return product.originalPrice && product.price < product.originalPrice;
                        case 'Featured': return product.isFeatured;
                        case 'Clearance': return product.isClearance;
                        case 'Buy 1 Get 1': return product.isBogo;
                        default: return false;
                    }
                });
                if (!matchesSpecials) return false;
            }

            if (selectedColors.length > 0) {
                const productColors = product.colors || [];
                if (!selectedColors.some(c => productColors.includes(c))) return false;
            }

            if (selectedSizes.length > 0) {
                const productSizes = product.sizes || [];
                if (!selectedSizes.some(s => productSizes.includes(s))) return false;
            }

            if (selectedTags.length > 0) {
                const matchesAllFilters = selectedTags.every(filterTag => {
                    const filterLower = filterTag.toLowerCase();
                    const inTags = product.tags.some(t => t.toLowerCase() === filterLower);
                    return inTags;
                });
                if (!matchesAllFilters) return false;
            }

            if (product.price < priceRange[0] || product.price > priceRange[1]) return false;

            return true;
        }).sort((a, b) => {
            // Keep skeletons neutral in sort
            if ((a as any)._loading) return 1;
            if ((b as any)._loading) return -1;

            switch (sortOption) {
                case SortOption.PriceLow: return a.price - b.price;
                case SortOption.PriceHigh: return b.price - a.price;
                default: return b.createdAt - a.createdAt;
            }
        });
    }, [allProducts, searchParam, selectedCategory, selectedColors, selectedSizes, selectedTags, selectedSpecials, priceRange, sortOption]);

    // Paginate the filtered results
    const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
    
    const displayedProducts = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        return filteredProducts.slice(start, end);
    }, [filteredProducts, currentPage]);

    const handlePageChange = (page: number) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const toggleFilter = (set: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
        set(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
    };

    const clearFilters = () => {
        setSelectedColors([]);
        setSelectedSizes([]);
        setSelectedTags([]);
        setSelectedSpecials([]);
        setPriceRange([MIN_PRICE, MAX_PRICE]);
        setTagSearch('');
        if (categoryParam) {
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('category');
            if (searchParam) {
                newParams.set('search', searchParam);
            }
            setSearchParams(newParams);
        } else {
            const newParams = new URLSearchParams(searchParams);
            if (searchParam) {
                newParams.set('search', searchParam);
            } else {
                newParams.delete('search');
            }
            setSearchParams(newParams);
        }
    };

    const handleMinPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Math.min(Number(e.target.value), priceRange[1] - MIN_GAP);
        setPriceRange([value, priceRange[1]]);
    };

    const handleMaxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Math.max(Number(e.target.value), priceRange[0] + MIN_GAP);
        setPriceRange([priceRange[0], value]);
    };

    const handleManualPriceSubmit = (type: 'min' | 'max', value: string) => {
        let num = parseInt(value) || 0;
        if (type === 'min') {
            num = Math.max(MIN_PRICE, Math.min(num, priceRange[1] - MIN_GAP));
            setPriceRange([num, priceRange[1]]);
            setEditingMin(false);
        } else {
            num = Math.min(MAX_PRICE, Math.max(num, priceRange[0] + MIN_GAP));
            setPriceRange([priceRange[0], num]);
            setEditingMax(false);
        }
    };

    const breadcrumbItems = useMemo(() => {
        if (!categoryParam || categoryParam === 'All') return undefined;
        const parts = categoryParam.split(CATEGORY_SEPARATOR);
        return parts.map((part, index) => ({
            label: part,
            path: `/?category=${encodeURIComponent(parts.slice(0, index + 1).join(CATEGORY_SEPARATOR))}`
        }));
    }, [categoryParam]);

    const activeFilterCount = selectedColors.length + selectedSizes.length + selectedTags.length + selectedSpecials.length + (priceRange[0] > MIN_PRICE || priceRange[1] < MAX_PRICE ? 1 : 0);

    const CategoryFilterTree: React.FC<{ node: CategoryNode, level?: number }> = ({ node, level = 0 }) => {
        const isSelected = selectedCategory === node.fullPath;
        const hasChildren = node.children.length > 0;
        const isExpanded = expandedCategories.has(node.fullPath);

        const toggleExpand = (e: React.MouseEvent) => {
            e.stopPropagation();
            setExpandedCategories(prev => {
                const next = new Set(prev);
                if (next.has(node.fullPath)) next.delete(node.fullPath);
                else next.add(node.fullPath);
                return next;
            });
        };

        const handleCategorySelect = () => {
            const newParams = new URLSearchParams(searchParams);
            newParams.set('category', node.fullPath);
            if (searchParam) {
                newParams.set('search', searchParam);
            }
            setSearchParams(newParams);
            setSelectedCategory(node.fullPath);
        };

        return (
            <div className="w-full">
                <div 
                    className={`flex items-center justify-between py-1.5 px-2 rounded-md transition-colors cursor-pointer group ${isSelected ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    style={{ marginLeft: `${level * 8}px` }}
                    onClick={handleCategorySelect}
                >
                    <span className={`text-sm ${isSelected ? 'font-bold' : ''}`}>{node.name}</span>
                    {hasChildren && (
                        <button 
                            onClick={toggleExpand}
                            className={`p-1 rounded-full ${isSelected ? 'text-white hover:bg-gray-800' : 'text-gray-400 hover:bg-gray-200 hover:text-black'}`}
                        >
                            <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                    )}
                </div>
                {hasChildren && isExpanded && (
                    <div className="mt-1 border-l border-gray-200 ml-3 pl-1 space-y-1">
                        {node.children.map(child => (
                            <CategoryFilterTree key={child.fullPath} node={child} level={level + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // --- Pagination Component ---
    const PaginationControls = () => {
        if (totalPages <= 1) return null;

        // Smart range logic
        const getPageNumbers = () => {
            const delta = 2;
            const range = [];
            const rangeWithDots = [];
            let l;

            range.push(1);
            for (let i = currentPage - delta; i <= currentPage + delta; i++) {
                if (i < totalPages && i > 1) {
                    range.push(i);
                }
            }
            range.push(totalPages);

            for (let i of range) {
                if (l) {
                    if (i - l === 2) {
                        rangeWithDots.push(l + 1);
                    } else if (i - l !== 1) {
                        rangeWithDots.push('...');
                    }
                }
                rangeWithDots.push(i);
                l = i;
            }
            return rangeWithDots;
        };

        return (
            <div className="flex items-center justify-center gap-2 select-none">
                <button 
                    onClick={() => handlePageChange(currentPage - 1)} 
                    disabled={currentPage === 1}
                    className="p-2 border rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-white"
                >
                    <ChevronLeft className="h-4 w-4"/>
                </button>
                
                {getPageNumbers().map((p, i) => (
                    <React.Fragment key={i}>
                        {p === '...' ? (
                            <span className="px-2 text-gray-400 text-sm">...</span>
                        ) : (
                            <button
                                onClick={() => handlePageChange(p as number)}
                                className={`h-8 min-w-[2rem] px-2 rounded-md text-sm font-bold transition-colors ${
                                    currentPage === p 
                                        ? 'bg-black text-white' 
                                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                                }`}
                            >
                                {p}
                            </button>
                        )}
                    </React.Fragment>
                ))}

                <button 
                    onClick={() => handlePageChange(currentPage + 1)} 
                    disabled={currentPage === totalPages}
                    className="p-2 border rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-white"
                >
                    <ChevronRight className="h-4 w-4"/>
                </button>
            </div>
        );
    };

    const handleAllProductsClick = () => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('category');
        if (searchParam) {
            newParams.set('search', searchParam);
        }
        setSearchParams(newParams);
        setSelectedCategory('All');
    };

    const handleCategoryReset = () => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('category');
        if (searchParam) {
            newParams.set('search', searchParam);
        }
        setSearchParams(newParams);
        setSelectedCategory('All');
    };

    return (
        <div className="min-h-screen bg-white">
            <SEO 
                title={selectedCategory === 'All' ? 'Shop All' : selectedCategory} 
                description={`Browse our collection of ${selectedCategory === 'All' ? 'products' : selectedCategory}.`}
            />
            
            <style>{`
                input[type=range]::-webkit-slider-thumb {
                    pointer-events: auto;
                    width: 16px;
                    height: 16px;
                    -webkit-appearance: none;
                    background: black;
                    border-radius: 50%;
                    border: 2px solid white;
                    box-shadow: 0 0 4px rgba(0,0,0,0.3);
                    cursor: grab;
                    margin-top: -6px;
                }
                input[type=range]::-moz-range-thumb {
                    pointer-events: auto;
                    width: 16px;
                    height: 16px;
                    background: black;
                    border-radius: 50%;
                    border: 2px solid white;
                    box-shadow: 0 0 4px rgba(0,0,0,0.3);
                    cursor: grab;
                    transform: translateY(2px);
                }
                input[type=range]::-webkit-slider-runnable-track {
                    width: 100%;
                    height: 4px;
                    background: transparent;
                }
            `}</style>

            {selectedProduct && <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />}

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <Breadcrumbs items={breadcrumbItems} />
                        <h1 className="text-3xl font-display font-bold text-gray-900 mt-2">
                            {searchParam ? `Results for "${searchParam}"` : (selectedCategory === 'All' ? 'All Products' : selectedCategory.split(CATEGORY_SEPARATOR).pop())}
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            {loading ? 'Loading...' : `${filteredProducts.filter(p => !(p as any)._loading).length} items`}
                        </p>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto items-center">
                        <button 
                            onClick={() => setIsFilterOpen(!isFilterOpen)} 
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold uppercase hover:border-black transition-colors lg:hidden"
                        >
                            <SlidersHorizontal className="h-4 w-4" /> Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
                        </button>
                        
                        <div className="hidden lg:flex items-center gap-1 border-r border-gray-200 pr-4 mr-2">
                            <button onClick={() => setGridMode('cozy')} className={`p-2 rounded hover:bg-gray-100 transition-colors ${gridMode === 'cozy' ? 'text-black' : 'text-gray-400'}`}><LayoutGrid className="h-5 w-5" /></button>
                            <button onClick={() => setGridMode('compact')} className={`p-2 rounded hover:bg-gray-100 transition-colors ${gridMode === 'compact' ? 'text-black' : 'text-gray-400'}`}><Grid3x3 className="h-5 w-5" /></button>
                            <button onClick={() => setGridMode('list')} className={`p-2 rounded hover:bg-gray-100 transition-colors ${gridMode === 'list' ? 'text-black' : 'text-gray-400'}`}><List className="h-5 w-5" /></button>
                        </div>
                        <div className="relative flex-1 md:w-48">
                            <select 
                                value={sortOption} 
                                onChange={(e) => setSortOption(e.target.value as SortOption)}
                                className="w-full appearance-none bg-white border border-gray-300 px-4 py-2 pr-8 rounded-lg text-sm font-medium focus:outline-none focus:border-black cursor-pointer"
                            >
                                <option value={SortOption.Newest}>Newest Arrivals</option>
                                <option value={SortOption.PriceLow}>Price: Low to High</option>
                                <option value={SortOption.PriceHigh}>Price: High to Low</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>
                </div>

                <div className="flex gap-8 items-start">
                    {/* Sidebar Filters */}
                    <div className={`
                        fixed inset-0 z-[60] bg-white p-6 transform transition-transform duration-300 lg:static lg:block lg:w-64 lg:p-0 lg:transform-none lg:z-auto overflow-y-auto lg:overflow-visible
                        ${isFilterOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                    `}>
                        <div className="flex justify-between items-center mb-6 lg:hidden">
                            <h2 className="text-xl font-bold font-display">Filters</h2>
                            <button onClick={() => setIsFilterOpen(false)}><X className="h-6 w-6" /></button>
                        </div>

                        {searchParam && (
                            <div className="mb-6 border-b border-gray-100 pb-4">
                                <button onClick={() => { const newParams = new URLSearchParams(searchParams); newParams.delete('search'); setSearchParams(newParams); }} className="text-xs text-gray-500 hover:text-black underline flex items-center gap-1 font-medium"><X className="h-3 w-3" /> Clear search: "{searchParam}"</button>
                            </div>
                        )}

                        {activeFilterCount > 0 && (
                            <div className="mb-6">
                                <button onClick={clearFilters} className="text-xs text-red-600 underline font-bold uppercase flex items-center gap-1"><Trash2 className="h-3 w-3" /> Clear All Filters</button>
                            </div>
                        )}

                        <div className="space-y-8">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold text-sm uppercase">Category</h3>
                                    {selectedCategory !== 'All' && (
                                        <button 
                                            onClick={handleCategoryReset}
                                            className="text-[10px] text-gray-500 hover:text-red-600 underline font-medium uppercase"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <button onClick={handleAllProductsClick} className={`w-full text-left py-1.5 px-2 rounded-md text-sm ${selectedCategory === 'All' ? 'bg-black text-white font-bold' : 'text-gray-600 hover:bg-gray-100'}`}>
                                        All Products
                                    </button>
                                    {categoryTree.map(node => <CategoryFilterTree key={node.fullPath} node={node} />)}
                                </div>
                            </div>

                            {availableSpecials.length > 0 && (
                                <div>
                                    <h3 className="font-bold text-sm uppercase mb-3">Special Offers</h3>
                                    <div className="space-y-2">
                                        {availableSpecials.map(option => (
                                            <label key={option} className="flex items-center gap-2 cursor-pointer group">
                                                <div className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${selectedSpecials.includes(option) ? 'bg-black border-black text-white' : 'border-gray-300 bg-white group-hover:border-gray-400'}`}>
                                                    {selectedSpecials.includes(option) && <Check className="h-3 w-3" />}
                                                </div>
                                                <input type="checkbox" className="hidden" checked={selectedSpecials.includes(option)} onChange={() => toggleFilter(setSelectedSpecials, option)} />
                                                <span className={`text-sm ${selectedSpecials.includes(option) ? 'font-bold text-black' : 'text-gray-600 group-hover:text-black'}`}>{option}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-sm uppercase">Price Range</h3>
                                    {(priceRange[0] > MIN_PRICE || priceRange[1] < MAX_PRICE) && <button onClick={() => setPriceRange([MIN_PRICE, MAX_PRICE])} className="text-[10px] text-gray-500 hover:text-red-600 underline font-medium uppercase">Reset</button>}
                                </div>
                                <div className="relative h-10 mb-2 select-none">
                                    <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 rounded-full -translate-y-1/2"></div>
                                    <div className="absolute top-1/2 h-1 bg-black rounded-full -translate-y-1/2 pointer-events-none" style={{ left: `${(priceRange[0] / MAX_PRICE) * 100}%`, right: `${100 - (priceRange[1] / MAX_PRICE) * 100}%` }}></div>
                                    <input type="range" min={MIN_PRICE} max={MAX_PRICE} value={priceRange[0]} onChange={handleMinPriceChange} className="absolute top-1/2 -translate-y-1/2 w-full h-1 appearance-none bg-transparent pointer-events-none z-10 p-0 m-0" />
                                    <input type="range" min={MIN_PRICE} max={MAX_PRICE} value={priceRange[1]} onChange={handleMaxPriceChange} className="absolute top-1/2 -translate-y-1/2 w-full h-1 appearance-none bg-transparent pointer-events-none z-20 p-0 m-0" />
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold text-gray-900">
                                    {editingMin ? (
                                        <div className="flex items-center">
                                            <span className="mr-1">$</span>
                                            <input ref={minInputRef} type="number" className="w-12 border border-gray-300 rounded p-1 text-xs" defaultValue={priceRange[0]} onBlur={(e) => handleManualPriceSubmit('min', e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') handleManualPriceSubmit('min', e.currentTarget.value) }} />
                                        </div>
                                    ) : (
                                        <button onClick={() => setEditingMin(true)} className="hover:bg-gray-100 px-1 py-0.5 rounded cursor-text">${priceRange[0]}</button>
                                    )}
                                    {editingMax ? (
                                        <div className="flex items-center">
                                            <span className="mr-1">$</span>
                                            <input ref={maxInputRef} type="number" className="w-12 border border-gray-300 rounded p-1 text-xs" defaultValue={priceRange[1]} onBlur={(e) => handleManualPriceSubmit('max', e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') handleManualPriceSubmit('max', e.currentTarget.value) }} />
                                        </div>
                                    ) : (
                                        <button onClick={() => setEditingMax(true)} className="hover:bg-gray-100 px-1 py-0.5 rounded cursor-text">${priceRange[1]}</button>
                                    )}
                                </div>
                            </div>

                            {uniqueColors.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-bold text-sm uppercase">Color</h3>
                                        {selectedColors.length > 0 && <button onClick={() => setSelectedColors([])} className="text-[10px] text-gray-500 hover:text-red-600 underline font-medium uppercase">Clear</button>}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {uniqueColors.map(color => (
                                            <button key={color} onClick={() => toggleFilter(setSelectedColors, color)} className={`w-6 h-6 rounded-full border shadow-sm ${selectedColors.includes(color) ? 'ring-2 ring-offset-2 ring-black' : 'hover:scale-110'} transition-all`} style={{ backgroundColor: color.toLowerCase() }} title={color} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {uniqueSizes.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-bold text-sm uppercase">Size</h3>
                                        {selectedSizes.length > 0 && <button onClick={() => setSelectedSizes([])} className="text-[10px] text-gray-500 hover:text-red-600 underline font-medium uppercase">Clear</button>}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {uniqueSizes.map(size => (
                                            <button key={size} onClick={() => toggleFilter(setSelectedSizes, size)} className={`px-3 py-1 text-xs border rounded ${selectedSizes.includes(size) ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'}`}>{size}</button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {uniqueTags.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-bold text-sm uppercase">Tags</h3>
                                        {selectedTags.length > 0 && <button onClick={() => setSelectedTags([])} className="text-[10px] text-gray-500 hover:text-red-600 underline font-medium uppercase">Clear</button>}
                                    </div>
                                    <div className="relative mb-3">
                                        <Search className="absolute left-2 top-2 h-3 w-3 text-gray-400" />
                                        <input type="text" placeholder="Search tags..." value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} className="w-full border border-gray-200 rounded px-2 pl-7 py-1 text-xs focus:outline-none focus:border-black" />
                                    </div>
                                    {selectedTags.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {selectedTags.map(tag => (
                                                <button key={tag} onClick={() => toggleFilter(setSelectedTags, tag)} className="px-2 py-1 text-[10px] uppercase font-bold rounded bg-black text-white flex items-center gap-1 hover:bg-gray-800 transition-colors shadow-sm">
                                                    {tag} <X className="h-3 w-3" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2">
                                        {displayedTags.filter(t => !selectedTags.includes(t)).length > 0 ? 
                                            displayedTags.filter(t => !selectedTags.includes(t)).map(tag => (
                                                <button key={tag} onClick={() => toggleFilter(setSelectedTags, tag)} className="px-2 py-1 text-[10px] uppercase font-bold rounded bg-gray-100 text-gray-600 hover:bg-gray-200">
                                                    {tag}
                                                </button>
                                            )) : 
                                            <span className="text-xs text-gray-400">No other tags match</span>
                                        }
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {isFilterOpen && <div className="fixed inset-0 bg-black/50 z-50 lg:hidden" onClick={() => setIsFilterOpen(false)} />}

                    <div className="flex-1">
                        {/* Top Pagination */}
                        {!loading && displayedProducts.length > 0 && (
                            <div className="mb-6 flex justify-end">
                                <PaginationControls />
                            </div>
                        )}

                        {loading && allProducts.length === 0 ? (
                            <div className={`grid gap-y-8 gap-x-6 animate-pulse ${gridMode === 'cozy' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : gridMode === 'list' ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
                                {[1,2,3,4,5,6].map(i => <div key={i} className={`bg-gray-100 rounded-lg ${gridMode === 'list' ? 'h-48' : 'aspect-square'}`}></div>)}
                            </div>
                        ) : displayedProducts.length > 0 ? (
                            <>
                                <div className={`grid gap-y-10 gap-x-6 ${gridMode === 'cozy' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : gridMode === 'list' ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
                                    {displayedProducts.map(product => {
                                        // Skeletons from progressive load state
                                        if ((product as any)._loading) {
                                            return <div key={product.id} className={`bg-gray-100 rounded-lg animate-pulse ${gridMode === 'list' ? 'h-48' : 'aspect-square'}`}></div>;
                                        }
                                        return (
                                            <ProductCard 
                                                key={product.id} 
                                                product={product} 
                                                onClick={setSelectedProduct} 
                                                viewMode={gridMode}
                                            />
                                        );
                                    })}
                                </div>
                                
                                {/* Bottom Pagination */}
                                <div className="mt-12">
                                    <PaginationControls />
                                    <p className="text-xs text-gray-400 text-center mt-3">
                                        Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredProducts.length)} of {filteredProducts.length} items
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="py-20 text-center bg-gray-50 border border-dashed rounded-lg">
                                <Search className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                                <h3 className="text-lg font-bold text-gray-900">No products found</h3>
                                <p className="text-gray-500 text-sm mt-1">Try adjusting your filters or search criteria.</p>
                                <button onClick={clearFilters} className="mt-4 text-sm font-bold text-black underline">Clear Filters</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};