
import React from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../context/StoreProvider';
import { SEO } from '../components/SEO';
import { Breadcrumbs } from '../components/Breadcrumbs';

export const PolicyPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const { content } = useStore();
    
    const policy = content?.policies.find(p => p.slug === slug);

    if (!policy) {
        return <div className="p-20 text-center">Page not found</div>;
    }

    return (
        <div className="min-h-screen bg-white">
            <SEO title={policy.title} description={policy.title} />
            <div className="max-w-4xl mx-auto px-6 py-8 sm:py-16">
                <div className="mb-8">
                    <Breadcrumbs items={[{ label: policy.title, path: '' }]} />
                </div>
                <h1 className="text-4xl font-display font-bold text-gray-900 mb-8 border-b border-gray-100 pb-8">
                    {policy.title}
                </h1>
                <div 
                    className="prose prose-lg max-w-none text-gray-600 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: policy.content }}
                />
            </div>
        </div>
    );
};
