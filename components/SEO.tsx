
import React, { useEffect } from 'react';
import { Product } from '../types';

interface SEOProps {
  title: string;
  description: string;
  product?: Product;
}

export const SEO: React.FC<SEOProps> = ({ title, description, product }) => {
  useEffect(() => {
    const siteTitle = 'ShipTeez';
    const fullTitle = `${title} | ${siteTitle}`;
    const currentUrl = window.location.href;
    const imageUrl = product?.images?.[0] || 'https://placehold.co/1200x630?text=ShipTeez'; // Placeholder

    // 1. Update Title
    document.title = fullTitle;

    // 2. Helper to update meta
    const updateMeta = (name: string, content: string, attribute: 'name' | 'property' = 'name') => {
      let element = document.querySelector(`meta[${attribute}="${name}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // 3. Helper for Link (Canonical)
    const updateLink = (rel: string, href: string) => {
        let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
        if (!element) {
            element = document.createElement('link');
            element.setAttribute('rel', rel);
            document.head.appendChild(element);
        }
        element.setAttribute('href', href);
    }

    // Standard
    updateMeta('description', description);
    updateLink('canonical', currentUrl);

    // Open Graph
    updateMeta('og:type', product ? 'product' : 'website', 'property');
    updateMeta('og:url', currentUrl, 'property');
    updateMeta('og:title', fullTitle, 'property');
    updateMeta('og:description', description, 'property');
    updateMeta('og:image', imageUrl, 'property');

    // Twitter
    updateMeta('twitter:card', 'summary_large_image', 'property');
    updateMeta('twitter:url', currentUrl, 'property');
    updateMeta('twitter:title', fullTitle, 'property');
    updateMeta('twitter:description', description, 'property');
    updateMeta('twitter:image', imageUrl, 'property');

    // JSON-LD
    const schemaId = 'shipteez-schema-json-ld';
    let script = document.getElementById(schemaId) as HTMLScriptElement;
    
    if (product) {
        const schema = {
            "@context": "https://schema.org/",
            "@type": "Product",
            "name": product.title,
            "image": product.images,
            "description": product.description,
            "sku": product.sku,
            "offers": {
              "@type": "Offer",
              "priceCurrency": "USD",
              "price": product.price,
              "availability": "https://schema.org/InStock"
            }
        };

        if (!script) {
            script = document.createElement('script');
            script.id = schemaId;
            script.type = 'application/ld+json';
            document.head.appendChild(script);
        }
        script.text = JSON.stringify(schema);
    } else {
        if (script) script.remove();
    }

  }, [title, description, product]);

  return null; // SEO component renders nothing visibly
};
