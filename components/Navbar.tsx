
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ShoppingBag, Search, Menu, X, User, Heart, ChevronDown, ChevronRight, Loader2, Package, MessageSquare, Settings, LogOut, LayoutDashboard, Truck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreProvider';
import { TopBanner } from './TopBanner';
import { LoginModal } from './LoginModal';
import { db } from '../services/db';
import { Product } from '../types';

// Type for the Recursive Tree
interface CategoryNode {
    name: string;
    fullPath: string;
    children: CategoryNode[];
}

const CATEGORY_SEPARATOR = " > ";

export const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isShopMenuOpen, setIsShopMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchProducts, setSearchProducts] = useState<Product[]>([]);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  
  // Scroll State
  const [isScrolled, setIsScrolled] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const { cart, openCart, wishlist, openWishlist, user, logout, activeCategories, content, isLoginModalOpen, setLoginModalOpen, openAuthModal, isLoading, unreadMessageCount } = useStore();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const cartCount = cart.reduce((a,c) => a + c.quantity, 0);

  // Get active category from URL for scoped search
  const currentCategory = useMemo(() => {
      const params = new URLSearchParams(location.search);
      return params.get('category');
  }, [location.search]);

  // --- Tree Builder Logic ---
  const categoryTree = useMemo(() => {
      const root: CategoryNode[] = [];
      // Sort to ensure parents might appear before children, though logic handles specific order
      const sortedCats = [...activeCategories].sort(); 

      sortedCats.forEach(path => {
          const parts = path.split(CATEGORY_SEPARATOR);
          let currentLevel = root;

          parts.forEach((part, index) => {
              // Reconstruct path up to this point
              const currentPath = parts.slice(0, index + 1).join(CATEGORY_SEPARATOR);
              
              let existingNode = currentLevel.find(n => n.name === part);
              
              if (!existingNode) {
                  existingNode = {
                      name: part,
                      fullPath: currentPath,
                      children: []
                  };
                  currentLevel.push(existingNode);
              }
              
              currentLevel = existingNode.children;
          });
      });
      return root;
  }, [activeCategories]);

  // Scroll Listener
  useEffect(() => {
      const handleScroll = () => {
          setIsScrolled(window.scrollY > 50);
      };
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-focus search
  useEffect(() => {
      if (isSearchActive && searchInputRef.current) {
          if (document.activeElement !== searchInputRef.current) {
              searchInputRef.current.focus();
          }
      }
  }, [isSearchActive]);

  // Load products for autosuggest
  useEffect(() => {
      const loadSearchIndex = async () => {
          try {
              const all = await db.getAllProducts();
              setSearchProducts(all.filter(p => !p.isHidden));
          } catch(e) {
              console.warn("Failed to load search index");
          }
      };
      loadSearchIndex();
  }, []);

  // Handle outside click for search close
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
              if (isSearchActive) setIsSearchActive(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSearchActive]);

  // Filter suggestions (Scoped)
  useEffect(() => {
      if (searchQuery.trim().length > 1 && searchProducts.length > 0) {
          const searchTerms = searchQuery.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
          
          const matches = searchProducts.filter(p => {
              // Scope to current category if active
              if (currentCategory && currentCategory !== 'All' && !p.category.startsWith(currentCategory)) {
                  return false;
              }

              const title = p.title.toLowerCase();
              const category = p.category.toLowerCase();
              const tags = p.tags.map(t => t.toLowerCase());
              
              return searchTerms.every(term => 
                  title.includes(term) || 
                  category.includes(term) || 
                  tags.some(tag => tag.includes(term))
              );
          }).slice(0, 5);
          
          setSuggestions(matches);
      } else {
          setSuggestions([]);
      }
  }, [searchQuery, searchProducts, currentCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      let targetUrl = `/?search=${encodeURIComponent(searchQuery)}`;
      // Preserve category context
      if (currentCategory && currentCategory !== 'All') {
          targetUrl += `&category=${encodeURIComponent(currentCategory)}`;
      }
      
      navigate(targetUrl);
      setIsSearchActive(false);
      setSuggestions([]);
      setSearchQuery('');
    }
  };

  const handleTrackOrder = (e: React.MouseEvent) => {
      e.preventDefault();
      if (user) {
          navigate('/account', { state: { tab: 'orders' } });
      } else {
          openAuthModal('login');
      }
  };

  const handleAccountNav = (tab: string) => {
      navigate('/account', { state: { tab } });
      setIsAccountMenuOpen(false);
  };

  const branding = content?.branding || { siteName: 'ShipTeez', logoUrl: '', logoMode: 'icon_text', logoScale: 100 };
  const logoScale = (branding.logoScale || 100) / 100;

  // --- Recursive Desktop Menu Item (Collapsible Accordion) ---
  const DesktopMenuItem: React.FC<{ node: CategoryNode, depth?: number }> = ({ node, depth = 0 }) => {
      const [isExpanded, setIsExpanded] = useState(false);
      const hasChildren = node.children.length > 0;
      
      return (
          <div className="w-full">
              <div className="flex items-center w-full hover:bg-gray-50 transition-colors pr-3 group select-none">
                  <Link 
                      to={`/?category=${encodeURIComponent(node.fullPath)}`} 
                      className="flex-1 py-2 text-sm text-gray-700 hover:text-black truncate font-medium"
                      style={{ paddingLeft: `${(depth * 12) + 16}px` }}
                  >
                      {node.name}
                  </Link>
                  {hasChildren && (
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsExpanded(!isExpanded); }}
                        className={`p-1.5 rounded-md transition-all ${isExpanded ? 'bg-gray-100 text-black' : 'text-gray-400 hover:text-black hover:bg-gray-50'}`}
                      >
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                  )}
              </div>
              
              {hasChildren && isExpanded && (
                  <div className="border-l border-gray-100 ml-4 my-1 animate-in slide-in-from-top-1 fade-in duration-150 origin-top">
                      {node.children.map(child => (
                          <DesktopMenuItem key={child.fullPath} node={child} depth={0} />
                      ))}
                  </div>
              )}
          </div>
      );
  };

  // --- Recursive Mobile Menu Item ---
  const MobileMenuItem: React.FC<{ node: CategoryNode, depth?: number, closeMenu: () => void }> = ({ node, depth = 0, closeMenu }) => {
      const [isExpanded, setIsExpanded] = useState(false);
      const hasChildren = node.children.length > 0;

      return (
          <div className="w-full">
              <div 
                className="flex items-stretch justify-between border-l-4 border-transparent hover:bg-gray-50 min-h-[48px]"
                style={{ paddingLeft: `${(depth * 12) + 12}px` }}
              >
                  <Link 
                      to={`/?category=${encodeURIComponent(node.fullPath)}`}
                      className="text-base font-medium text-gray-600 hover:text-black flex-1 truncate flex items-center py-2 pr-2"
                      onClick={closeMenu}
                  >
                      {node.name}
                  </Link>
                  {hasChildren && (
                      <button 
                        onClick={(e) => { e.preventDefault(); setIsExpanded(!isExpanded); }}
                        className="w-16 flex items-center justify-center text-gray-400 hover:text-black border-l border-gray-100 active:bg-gray-100 transition-colors"
                        aria-label="Toggle Submenu"
                      >
                          <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                  )}
              </div>
              {hasChildren && isExpanded && (
                  <div className="border-l border-gray-100 ml-4 my-1">
                      {node.children.map(child => (
                          <MobileMenuItem key={child.fullPath} node={child} depth={depth + 1} closeMenu={closeMenu} />
                      ))}
                  </div>
              )}
          </div>
      );
  };

  return (
    <>
    <TopBanner />
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm no-print transition-all duration-300 h-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex justify-between items-center h-full gap-4 lg:gap-8 relative">
          
          {/* Mobile Menu Button */}
          <div className={`flex items-center sm:hidden ${isSearchActive ? 'hidden' : 'block'}`}>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-900 hover:bg-gray-100 focus:outline-none"
            >
              {isOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
            </button>
          </div>

          {/* Logo Section */}
          <div className={`flex-shrink-0 flex items-center gap-2 group ${isSearchActive ? 'hidden sm:flex' : 'flex'}`}>
            <Link to="/" className="flex items-center gap-2">
              {branding.logoMode === 'image_only' && branding.logoUrl ? (
                  <img 
                    src={branding.logoUrl} 
                    alt={branding.siteName} 
                    className="object-contain transition-all duration-300" 
                    style={{ height: `${3 * logoScale}rem`, maxHeight: '4rem' }}
                  />
              ) : branding.logoMode === 'text_only' ? (
                  <span className="font-display text-2xl font-bold tracking-tight text-primary group-hover:opacity-80 transition-opacity">
                      {branding.siteName}
                  </span>
              ) : (
                  <>
                      {branding.logoUrl && (
                          <img 
                            src={branding.logoUrl} 
                            alt="" 
                            className="object-contain transition-all duration-300" 
                            style={{ height: `${2 * logoScale}rem` }}
                          />
                      )}
                      <span className="font-display text-2xl font-bold tracking-tight text-primary group-hover:opacity-80 transition-opacity">
                          {branding.siteName}
                      </span>
                  </>
              )}
            </Link>
          </div>

          {/* Search Bar */}
          <div 
                ref={searchContainerRef}
                className={`flex-1 flex items-center justify-center sm:justify-start lg:pl-4 xl:pl-12 transition-all duration-300 sm:mt-2.5 ${isSearchActive ? 'absolute inset-0 z-50 bg-white px-2 sm:static sm:bg-transparent sm:px-0' : 'hidden sm:flex max-w-md'} sm:opacity-100`}
            >
                <form onSubmit={handleSearchSubmit} className={`relative group w-full flex items-center h-12 sm:h-10`}>
                    <div className={`flex items-center w-full transition-colors duration-200 rounded-full overflow-hidden bg-gray-100`}>
                        <button 
                            type="button" 
                            className="p-3 sm:p-2 text-gray-500 hover:text-black transition-colors flex-shrink-0 pl-4"
                        >
                            <Search className="h-5 w-5" />
                        </button>
                        <input 
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setIsSearchActive(true)}
                            placeholder={currentCategory && currentCategory !== 'All' ? `Search in ${currentCategory.split(' > ').pop()}...` : "Search products..."}
                            style={{ boxShadow: 'none' }}
                            className="bg-transparent border-none outline-none ring-0 focus:ring-0 focus:outline-none focus:border-none shadow-none text-sm placeholder-gray-400 transition-all duration-300 h-full flex-1 w-full px-2"
                        />
                        {(searchQuery || isSearchActive) && (
                            <button type="button" onClick={() => { setSearchQuery(''); setSuggestions([]); if(window.innerWidth < 640) setIsSearchActive(false); }} className="p-3 sm:p-2 text-gray-400 hover:text-black pr-4 flex-shrink-0">
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Autosuggest */}
                    {isSearchActive && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-3 bg-white/95 backdrop-blur-xl border border-gray-100 rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                            <div className="py-2">
                                <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100/50 flex justify-between">
                                    <span>Suggestions</span>
                                    {currentCategory && currentCategory !== 'All' && <span className="text-gray-500">in {currentCategory.split(' > ').pop()}</span>}
                                </div>
                                {suggestions.map(p => (
                                    <div 
                                        key={p.id}
                                        onClick={() => { 
                                            navigate(`/product/${p.slug || p.id}`); 
                                            setIsSearchActive(false); 
                                            setSuggestions([]);
                                            setSearchQuery('');
                                        }}
                                        className="px-4 py-3 hover:bg-gray-50/80 cursor-pointer flex items-center gap-4 border-b border-gray-50 last:border-0 group transition-colors"
                                    >
                                        <div className="h-10 w-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200 group-hover:border-gray-300 transition-colors">
                                            <img src={p.images[0]} className="h-full w-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-black transition-colors">{p.title}</p>
                                            <p className="text-xs text-gray-500">{p.category}</p>
                                        </div>
                                        <div className="text-sm font-bold text-gray-900">${p.price.toFixed(2)}</div>
                                    </div>
                                ))}
                                <button type="submit" className="w-full text-center py-3 text-xs font-bold uppercase text-black hover:bg-gray-50/80 bg-white/50 transition-colors border-t border-gray-100">
                                    View all results
                                </button>
                            </div>
                        </div>
                    )}
                </form>
          </div>
          
          {/* Desktop Nav Links */}
          <div className={`hidden lg:flex items-center space-x-6 ${isSearchActive ? 'hidden' : ''}`}>
                <div className="relative group h-20 flex items-center" onMouseEnter={() => setIsShopMenuOpen(true)} onMouseLeave={() => setIsShopMenuOpen(false)}>
                    <Link to="/" className={`inline-flex items-center text-sm font-bold uppercase tracking-wide transition-colors ${location.pathname === '/' ? 'text-black' : 'text-gray-500 hover:text-black'}`}>
                        Shop <ChevronDown className={`ml-1 h-3 w-3 transition-transform ${isShopMenuOpen ? 'rotate-180' : ''}`} />
                    </Link>
                    
                    {/* Advanced Hierarchical Dropdown - Collapsible with No Scrollbar */}
                    {isShopMenuOpen && (
                        <div className="absolute left-1/2 -translate-x-1/2 top-[75%] w-64 bg-white/95 backdrop-blur-xl border border-gray-100 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] rounded-2xl animate-in fade-in slide-in-from-top-1 z-50 p-2 overflow-hidden">
                            <div className="py-1 relative max-h-[70vh] overflow-y-auto no-scrollbar">
                                <Link to="/" className="block px-4 py-3 text-sm text-gray-900 hover:bg-gray-50 font-bold rounded-xl transition-colors border-b border-gray-50 mb-1">Shop All</Link>
                                
                                {/* Loading State */}
                                {isLoading && categoryTree.length === 0 ? (
                                    <div className="px-4 py-6 text-center text-gray-500 text-xs flex flex-col items-center">
                                        <Loader2 className="h-5 w-5 animate-spin mb-2 text-gray-400"/>
                                        Loading categories...
                                    </div>
                                ) : (
                                    categoryTree.map(node => (
                                        <DesktopMenuItem key={node.fullPath} node={node} />
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <button onClick={handleTrackOrder} className={`text-sm font-bold uppercase tracking-wide transition-colors ${location.pathname === '/track-order' ? 'text-black' : 'text-gray-500 hover:text-black'}`}>
                    Track Order
                </button>
          </div>

          {/* Right Icons */}
          <div className={`flex items-center justify-end space-x-1 sm:space-x-4 border-l border-gray-100 pl-4 sm:pl-8 ml-2 ${isSearchActive ? 'hidden sm:flex' : ''}`}>
             <button 
                onClick={() => setIsSearchActive(true)}
                className="sm:hidden p-2 text-gray-600 hover:text-black transition-colors"
                aria-label="Search"
             >
                 <Search className="h-5 w-5" />
             </button>

             <div className="relative group hidden sm:block" onMouseEnter={() => setIsAccountMenuOpen(true)} onMouseLeave={() => setIsAccountMenuOpen(false)}>
                {user ? (
                    <button className="p-2 text-gray-600 hover:text-black transition-colors flex items-center gap-1 relative">
                        <User className="h-5 w-5" />
                        {unreadMessageCount > 0 && (
                            <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>
                        )}
                    </button>
                ) : (
                    <button 
                        onClick={() => openAuthModal('login')} 
                        className="p-2 text-gray-600 hover:text-black transition-colors font-bold text-sm uppercase tracking-wide whitespace-nowrap"
                    >
                        Sign In
                    </button>
                )}

                {/* Account Dropdown */}
                {user && isAccountMenuOpen && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-[85%] pt-4 w-64 z-50">
                        <div className="bg-white/95 backdrop-blur-xl border border-gray-100 rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden animate-in fade-in slide-in-from-top-2 w-60 mx-auto">
                            <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50">
                                <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
                                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>
                            <div className="py-1 p-1">
                                <button onClick={() => handleAccountNav('settings')} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-black rounded-xl flex items-center gap-2 group transition-colors">
                                    <LayoutDashboard className="h-4 w-4 text-gray-400 group-hover:text-black" /> Dashboard
                                </button>
                                <button onClick={() => handleAccountNav('orders')} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-black rounded-xl flex items-center gap-2 group transition-colors">
                                    <Package className="h-4 w-4 text-gray-400 group-hover:text-black" /> Orders
                                </button>
                                <button onClick={() => handleAccountNav('support')} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-black rounded-xl flex items-center gap-2 group transition-colors justify-between">
                                    <span className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-gray-400 group-hover:text-black" /> Support</span>
                                    {unreadMessageCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{unreadMessageCount}</span>}
                                </button>
                                <div className="border-t border-gray-50 my-1"></div>
                                <button onClick={() => { logout(); setIsAccountMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2 transition-colors">
                                    <LogOut className="h-4 w-4" /> Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                )}
             </div>

             <button onClick={openWishlist} className="p-2 text-gray-600 hover:text-black transition-colors relative group">
               <Heart className="h-5 w-5 group-hover:scale-110 transition-transform" />
               {wishlist.size > 0 && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse"></span>}
             </button>

             <button onClick={openCart} className="p-2 text-gray-900 hover:text-black relative transition-transform duration-200 active:scale-95">
                  <ShoppingBag className="h-5 w-5" />
                  {cartCount > 0 && (
                      <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center ring-2 ring-white font-bold animate-in zoom-in">
                          {cartCount}
                      </span>
                  )}
             </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white absolute w-full z-40 shadow-xl flex flex-col max-h-[80vh]">
          <div className="flex-1 overflow-y-auto pt-2 pb-2">
            {isLoading && categoryTree.length === 0 ? (
                <div className="px-4 py-8 text-sm text-gray-500 flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400"/> 
                    Loading categories...
                </div>
            ) : (
                <>
                    <Link to="/" className="bg-gray-50 border-black text-black block pl-3 pr-4 py-2 border-l-4 text-base font-bold" onClick={() => setIsOpen(false)}>Shop All</Link>
                    {/* Render Category Tree Recursively for Mobile */}
                    {categoryTree.map(node => (
                        <MobileMenuItem key={node.fullPath} node={node} closeMenu={() => setIsOpen(false)} />
                    ))}
                </>
            )}
          </div>

          <div className="border-t border-gray-100 bg-gray-50 p-2">
            {user ? (
                <div className="space-y-1">
                    <button 
                        onClick={() => { setIsOpen(false); navigate('/account'); }} 
                        className="w-full text-left border-transparent text-gray-900 hover:bg-white block px-3 py-3 rounded text-sm font-bold flex items-center gap-2 justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <div className="bg-gray-200 p-1.5 rounded-full"><User className="h-4 w-4 text-gray-600"/></div>
                            My Account
                        </div>
                        {unreadMessageCount > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{unreadMessageCount} new</span>}
                    </button>
                    <div className="my-1 border-t border-gray-200 mx-3"></div>
                    <button 
                        onClick={() => { setIsOpen(false); logout(); }} 
                        className="w-full text-left border-transparent text-red-600 hover:bg-red-50 block px-3 py-2 rounded text-sm font-bold flex items-center gap-2"
                    >
                        <LogOut className="h-4 w-4"/> Sign Out
                    </button>
                </div>
            ) : (
                <>
                    <button onClick={(e) => { setIsOpen(false); handleTrackOrder(e); }} className="w-full text-left border-transparent text-gray-600 hover:bg-white block px-3 py-2 text-sm font-medium flex items-center gap-2">
                        <Truck className="h-4 w-4"/> Track Order
                    </button>
                    <div className="my-1 border-t border-gray-200 mx-3"></div>
                    <button 
                        onClick={() => { setIsOpen(false); openAuthModal('login'); }} 
                        className="w-full text-left px-3 py-3 text-base font-bold text-gray-900 hover:bg-white flex items-center gap-2 border-transparent"
                    >
                        <div className="p-1.5 bg-black rounded-full text-white"><User className="h-4 w-4"/></div>
                        Sign In
                    </button>
                </>
            )}
          </div>
        </div>
      )}
    </nav>

    <LoginModal isOpen={isLoginModalOpen} onClose={() => setLoginModalOpen(false)} />
    </>
  );
};
