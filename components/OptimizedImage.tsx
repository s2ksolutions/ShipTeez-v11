
import React, { useState, useEffect, useRef } from 'react';
import { ImageIcon } from 'lucide-react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    className?: string;
    priority?: boolean; // If true, loads eagerly (LCP optimization)
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({ 
    src, 
    alt, 
    className = '', 
    priority = false,
    ...props 
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // Reset state if src changes
    useEffect(() => {
        setIsLoaded(false);
        setHasError(false);
    }, [src]);

    // Check if image is already loaded from cache on mount
    useEffect(() => {
        if (imgRef.current && imgRef.current.complete) {
            if (imgRef.current.naturalWidth > 0) {
                setIsLoaded(true);
            } else {
                // If complete but 0 width, it failed
                setHasError(true);
                setIsLoaded(true);
            }
        }
    }, []);

    return (
        <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
            {/* Skeleton / Placeholder / Error Layer */}
            <div 
                className={`absolute inset-0 flex items-center justify-center bg-gray-100 transition-opacity duration-500 z-0 ${isLoaded && !hasError ? 'opacity-0' : 'opacity-100'}`}
                aria-hidden="true"
            >
                {hasError ? (
                    <div className="flex flex-col items-center justify-center text-gray-300">
                        <ImageIcon className="h-8 w-8 mb-1 opacity-50" />
                        <span className="text-[10px] font-medium uppercase tracking-wider">No Image</span>
                    </div>
                ) : (
                    <div className="h-full w-full bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-[shimmer_1.5s_infinite]" 
                         style={{ backgroundSize: '200% 100%' }} 
                    />
                )}
            </div>

            {/* Actual Image */}
            <img
                ref={imgRef}
                src={src}
                alt={alt}
                loading={priority ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={priority ? "high" : "auto"}
                onLoad={() => setIsLoaded(true)}
                onError={() => { setHasError(true); setIsLoaded(true); }}
                className={`relative z-10 w-full h-full object-cover transition-all duration-500 ease-out ${isLoaded && !hasError ? 'opacity-100 scale-100' : 'opacity-0 scale-105'} ${className}`}
                {...props}
            />
        </div>
    );
};
