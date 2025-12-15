
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbsProps {
    items?: { label: string; path?: string }[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
    const location = useLocation();
    
    let crumbs = items;

    // Default structure for Home/Shop root
    if (!crumbs && location.pathname === '/') {
        crumbs = [{ label: 'All', path: '' }];
    } else if (!crumbs) {
        // Auto-generate basic structure if not provided and not root
        const pathnames = location.pathname.split('/').filter(x => x);
        crumbs = pathnames.map((value, index) => {
            const to = `/${pathnames.slice(0, index + 1).join('/')}`;
            const label = value.replace(/-/g, ' ');
            return { label, path: to };
        });
    }

    return (
        <nav aria-label="Breadcrumb" className="flex items-center">
            <ol className="flex items-center flex-wrap gap-1.5 text-sm text-gray-500 font-medium">
                <li className="flex items-center">
                    <Link 
                        to="/" 
                        className="hover:text-gray-900 transition-colors duration-200 font-medium text-gray-500 hover:underline decoration-1 underline-offset-4"
                        title="Shop"
                    >
                        Shop
                    </Link>
                </li>
                
                {crumbs?.map((crumb, index) => {
                    return (
                        <li key={index} className="flex items-center min-w-0 animate-in fade-in slide-in-from-left-1">
                            <ChevronRight className="h-4 w-4 text-gray-300 mx-1 flex-shrink-0" />
                            
                            {crumb.path ? (
                                <Link 
                                    to={crumb.path} 
                                    className="capitalize hover:text-gray-900 transition-colors duration-200 truncate max-w-[120px] sm:max-w-xs hover:underline decoration-1 underline-offset-4 decoration-gray-300"
                                >
                                    {crumb.label}
                                </Link>
                            ) : (
                                <span 
                                    className="capitalize font-medium text-gray-900 truncate max-w-[150px] sm:max-w-md select-none" 
                                    aria-current="page"
                                    title={crumb.label}
                                >
                                    {crumb.label}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};
