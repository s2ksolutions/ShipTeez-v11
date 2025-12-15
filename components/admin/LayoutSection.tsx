
import React, { useState, useRef, useEffect } from 'react';
import { StoreContent, LayoutComponent, ThemeColors } from '../../types';
import { GripVertical, Eye, EyeOff, Settings, Palette, Layout, Save, Type, Image as ImageIcon, ChevronDown, ChevronUp, Plus, Trash2, Sparkles, Upload, Loader2, Wand2, Link2, CaseSensitive, Monitor, CreditCard, PlaySquare } from 'lucide-react';
import { adminMiddleware } from '../../services/adminMiddleware';

const POPULAR_GOOGLE_FONTS = [
    "Roboto", "Open Sans", "Lato", "Montserrat", "Oswald", "Source Sans Pro", "Slabo 27px", "Raleway", "PT Sans", "Merriweather", 
    "Noto Sans", "Playfair Display", "Nunito", "Rubik", "Poppins", "Work Sans", "Inter", "Fira Sans", "Quicksand", "Barlow",
    "Inconsolata", "Mukta", "Titillium Web", "Karla", "Josefin Sans", "Libre Baskerville", "Anton", "Cabin", "Pacifico", "Dancing Script"
].sort();

interface LayoutSectionProps {
    content: StoreContent;
    onUpdateContent: (fn: (c: StoreContent) => StoreContent) => void;
    onSaveContent: () => Promise<void>;
}

export const LayoutSection: React.FC<LayoutSectionProps> = ({ content, onUpdateContent, onSaveContent }) => {
    const [activeTab, setActiveTab] = useState<'structure' | 'theme'>('structure');
    const [expandedSection, setExpandedSection] = useState<string | null>(null);
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
    const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);
    
    // Hero Generation State
    const [heroPrompt, setHeroPrompt] = useState('');
    const [isGeneratingHero, setIsGeneratingHero] = useState(false);
    
    // Slide AI State
    const [slidePrompts, setSlidePrompts] = useState<Record<string, string>>({});
    const [generatingSlideId, setGeneratingSlideId] = useState<string | null>(null);

    // Font Mode State (derived from content if possible, else default)
    const [fontMode, setFontMode] = useState<'preset' | 'google' | 'custom'>(
        content.theme.googleFontName ? 'google' : content.theme.customFontUrl ? 'custom' : 'preset'
    );

    // Dynamic Font Injection for Preview
    useEffect(() => {
        if (fontMode !== 'google' || !content.theme.googleFontName) return;
        
        const fontName = content.theme.googleFontName;
        const linkId = 'preview-google-font';
        let link = document.getElementById(linkId) as HTMLLinkElement;
        
        if (!link) {
            link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
        
        link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@300;400;500;700&display=swap`;
        
    }, [content.theme.googleFontName, fontMode]);

    // --- DRAG AND DROP LOGIC ---
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedItemIndex(index);
        e.dataTransfer.effectAllowed = "move";
        const ghost = document.createElement('div');
        ghost.classList.add('hidden');
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedItemIndex === null || draggedItemIndex === index) return;

        const layout = [...content.layout];
        const item = layout[draggedItemIndex];
        
        layout.splice(draggedItemIndex, 1);
        layout.splice(index, 0, item);

        const updatedLayout = layout.map((comp, idx) => ({ ...comp, order: idx }));
        
        onUpdateContent(c => ({ ...c, layout: updatedLayout }));
        setDraggedItemIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedItemIndex(null);
    };

    const handleAddComponent = (type: LayoutComponent['type']) => {
        const newComp: LayoutComponent = {
            id: `new-${Date.now()}`,
            type,
            title: `New ${type}`,
            isEnabled: true,
            order: content.layout.length,
            config: {},
            styles: {}
        };
        onUpdateContent(c => ({ ...c, layout: [...c.layout, newComp] }));
    };

    const handleRemoveComponent = (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // Stop drag or expand events
        if(confirm("Remove this section?")) {
            onUpdateContent(c => ({ ...c, layout: c.layout.filter(l => l.id !== id) }));
        }
    };

    // --- UPDATE HELPERS ---
    const updateSection = (id: string, updates: Partial<LayoutComponent>) => {
        onUpdateContent(c => ({
            ...c,
            layout: c.layout.map(comp => comp.id === id ? { ...comp, ...updates } : comp)
        }));
    };

    const updateConfig = (id: string, key: string, value: any) => {
        onUpdateContent(c => ({
            ...c,
            layout: c.layout.map(comp => comp.id === id ? { 
                ...comp, 
                config: { ...comp.config, [key]: value } 
            } : comp)
        }));
    };

    const updateStyle = (id: string, key: string, value: any) => {
        onUpdateContent(c => ({
            ...c,
            layout: c.layout.map(comp => comp.id === id ? { 
                ...comp, 
                styles: { ...comp.styles, [key]: value } 
            } : comp)
        }));
    };

    const updateTheme = (key: keyof ThemeColors, value: string) => {
        onUpdateContent(c => ({
            ...c,
            theme: { ...c.theme, [key]: value }
        }));
    };

    const switchFontMode = (mode: 'preset' | 'google' | 'custom') => {
        setFontMode(mode);
        onUpdateContent(c => ({
            ...c,
            theme: {
                ...c.theme,
                googleFontName: mode === 'google' ? c.theme.googleFontName : undefined,
                customFontUrl: mode === 'custom' ? c.theme.customFontUrl : undefined
            }
        }));
    };

    const handleAiThemeGeneration = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsGeneratingTheme(true);
        try {
            // Used Middleware
            const generatedTheme = await adminMiddleware.theme.generateFromImage(file);
            
            // Apply
            onUpdateContent(c => ({
                ...c,
                theme: { ...c.theme, ...generatedTheme, googleFontName: undefined, customFontUrl: undefined }
            }));
            setFontMode('preset');
            alert("Theme successfully generated from image!");
        } catch (error) {
            console.error("Theme generation failed", error);
            alert("Failed to generate theme. Please try a different image.");
        } finally {
            setIsGeneratingTheme(false);
            e.target.value = '';
        }
    };

    const handleGenerateHero = async (id: string) => {
        if (!heroPrompt.trim()) return;
        setIsGeneratingHero(true);
        try {
            const img = await adminMiddleware.content.generateHeroImage(heroPrompt);
            updateStyle(id, 'backgroundImage', img);
            setHeroPrompt('');
        } catch (e) {
            alert("Failed to generate hero background.");
        } finally {
            setIsGeneratingHero(false);
        }
    };

    const handleGenerateSlideBg = async (compId: string, slides: any[], slideIndex: number, slideId: string) => {
        const prompt = slidePrompts[slideId];
        if (!prompt) return;
        setGeneratingSlideId(slideId);
        try {
            const img = await adminMiddleware.content.generateHeroImage(prompt);
            const newSlides = [...slides];
            newSlides[slideIndex] = { ...newSlides[slideIndex], image: img };
            updateConfig(compId, 'slides', newSlides);
            setSlidePrompts(prev => ({ ...prev, [slideId]: '' }));
        } catch (e) {
            alert("Failed to generate slide image.");
        } finally {
            setGeneratingSlideId(null);
        }
    };

    const sortedLayout = [...content.layout].sort((a, b) => a.order - b.order);

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header / Tabs */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 border shadow-sm">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Layout className="h-6 w-6 text-indigo-600" /> Site Layout & Theme
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Customize your homepage structure and global styling.</p>
                </div>
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('structure')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'structure' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        Page Structure
                    </button>
                    <button 
                        onClick={() => setActiveTab('theme')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'theme' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        Global Theme
                    </button>
                </div>
            </div>

            {/* --- STRUCTURE TAB --- */}
            {activeTab === 'structure' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Component List (Left) */}
                    <div className="lg:col-span-2 space-y-4">
                         {sortedLayout.map((comp, index) => (
                            <div 
                                key={comp.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                                className={`bg-white border rounded-lg shadow-sm transition-all ${draggedItemIndex === index ? 'opacity-50 border-indigo-400 border-dashed bg-indigo-50' : 'hover:border-indigo-300'}`}
                            >
                                {/* Header Bar */}
                                <div className="flex items-center p-4 gap-4">
                                    <div className="cursor-move text-gray-400 hover:text-gray-600 p-1">
                                        <GripVertical className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm uppercase tracking-wide bg-gray-100 px-2 py-0.5 rounded text-gray-600">{comp.type}</span>
                                            <span className="font-medium text-gray-900">{comp.title || comp.id}</span>
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); updateSection(comp.id, { isEnabled: !comp.isEnabled }); }}
                                        className={`p-2 rounded-full ${comp.isEnabled ? 'text-green-600 hover:bg-green-50' : 'text-gray-300 hover:bg-gray-100'}`}
                                        title={comp.isEnabled ? "Section Visible" : "Section Hidden"}
                                    >
                                        {comp.isEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                    </button>
                                    
                                    <button onClick={(e) => handleRemoveComponent(e, comp.id)} className="p-2 rounded-full text-red-400 hover:text-red-600 hover:bg-red-50">
                                        <Trash2 className="h-4 w-4" />
                                    </button>

                                    <button 
                                        onClick={() => setExpandedSection(expandedSection === comp.id ? null : comp.id)}
                                        className={`p-2 rounded-full hover:bg-gray-100 transition-transform ${expandedSection === comp.id ? 'rotate-180 bg-gray-100' : ''}`}
                                    >
                                        <ChevronDown className="h-4 w-4 text-gray-600" />
                                    </button>
                                </div>

                                {/* Expanded Settings */}
                                {expandedSection === comp.id && (
                                    <div className="border-t bg-gray-50/50 p-6 space-y-6 animate-in slide-in-from-top-2">
                                        {/* Common Config */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Section Title</label>
                                                <input className="w-full border rounded p-2 text-sm" value={comp.title || ''} onChange={(e) => updateSection(comp.id, { title: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Background Color</label>
                                                <div className="flex gap-2">
                                                    <input type="color" className="h-9 w-12 p-0 border rounded cursor-pointer" value={comp.styles?.backgroundColor || '#ffffff'} onChange={(e) => updateStyle(comp.id, 'backgroundColor', e.target.value)} />
                                                    <input type="text" className="w-full border rounded p-2 text-sm" value={comp.styles?.backgroundColor || ''} onChange={(e) => updateStyle(comp.id, 'backgroundColor', e.target.value)} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Type Specific Config */}
                                        {comp.type === 'Hero' && (
                                            <div className="space-y-4 border-t pt-4 border-gray-200">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="font-bold text-xs uppercase text-indigo-600">Hero Configuration</h4>
                                                    <select 
                                                        className="text-xs border rounded p-1" 
                                                        value={comp.config?.heroType || 'standard'} 
                                                        onChange={(e) => updateConfig(comp.id, 'heroType', e.target.value)}
                                                    >
                                                        <option value="standard">Standard Hero</option>
                                                        <option value="slider">Image Slider</option>
                                                        <option value="cards">Pricing / Cards</option>
                                                    </select>
                                                </div>

                                                {(comp.config?.heroType === 'standard' || !comp.config?.heroType) && (
                                                    <>
                                                        <div>
                                                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Main Heading</label>
                                                            <input className="w-full border rounded p-2 text-sm" value={comp.config?.heading || ''} onChange={(e) => updateConfig(comp.id, 'heading', e.target.value)} />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Subheading</label>
                                                            <textarea className="w-full border rounded p-2 text-sm" value={comp.config?.subheading || ''} onChange={(e) => updateConfig(comp.id, 'subheading', e.target.value)} />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Button Text</label>
                                                                <input className="w-full border rounded p-2 text-sm" value={comp.config?.buttonText || ''} onChange={(e) => updateConfig(comp.id, 'buttonText', e.target.value)} />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Button Link</label>
                                                                <input className="w-full border rounded p-2 text-sm" placeholder="/shop, https://..." value={comp.config?.targetLink || ''} onChange={(e) => updateConfig(comp.id, 'targetLink', e.target.value)} />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Background Image URL</label>
                                                            <div className="flex gap-2">
                                                                <input className="w-full border rounded p-2 text-sm" placeholder="https://..." value={comp.styles?.backgroundImage || ''} onChange={(e) => updateStyle(comp.id, 'backgroundImage', e.target.value)} />
                                                                {comp.styles?.backgroundImage && <img src={comp.styles.backgroundImage} className="h-9 w-9 object-cover rounded border" />}
                                                            </div>
                                                        </div>
                                                        
                                                        {/* AI Hero Generator & Opacity Control */}
                                                        <div className="bg-white p-3 rounded border border-indigo-100 space-y-3">
                                                            <div className="flex items-center gap-2">
                                                                <Sparkles className="h-4 w-4 text-indigo-600"/>
                                                                <span className="text-xs font-bold uppercase text-indigo-900">AI Background Generator</span>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <input 
                                                                    className="flex-1 border rounded p-2 text-xs" 
                                                                    placeholder="Describe scene (e.g. Modern minimalist studio)"
                                                                    value={heroPrompt}
                                                                    onChange={e => setHeroPrompt(e.target.value)}
                                                                />
                                                                <button 
                                                                    onClick={() => handleGenerateHero(comp.id)} 
                                                                    disabled={isGeneratingHero || !heroPrompt}
                                                                    className="bg-indigo-600 text-white px-3 py-1 rounded text-xs font-bold uppercase hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                                                                >
                                                                    {isGeneratingHero ? <Loader2 className="h-3 w-3 animate-spin"/> : <Wand2 className="h-3 w-3"/>} Generate
                                                                </button>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                                                                    Overlay Opacity ({(comp.styles?.overlayOpacity ?? 0.4) * 100}%)
                                                                </label>
                                                                <input 
                                                                    type="range" 
                                                                    min="0" max="1" step="0.1" 
                                                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                                                    value={comp.styles?.overlayOpacity ?? 0.4}
                                                                    onChange={(e) => updateStyle(comp.id, 'overlayOpacity', parseFloat(e.target.value))}
                                                                />
                                                            </div>
                                                        </div>
                                                    </>
                                                )}

                                                {comp.config?.heroType === 'slider' && (
                                                    <div className="space-y-3 bg-gray-100 p-3 rounded">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs font-bold uppercase text-gray-500">Slides</span>
                                                            <button 
                                                                onClick={() => {
                                                                    const newSlide = { id: crypto.randomUUID(), image: '', heading: 'New Slide', subheading: '', buttonText: 'Shop', link: '', overlayOpacity: 0.4 };
                                                                    updateConfig(comp.id, 'slides', [...(comp.config?.slides || []), newSlide]);
                                                                }}
                                                                className="text-xs bg-black text-white px-2 py-1 rounded flex items-center gap-1"
                                                            >
                                                                <Plus className="h-3 w-3"/> Add Slide
                                                            </button>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Auto-Slide Interval (Seconds)</label>
                                                            <input 
                                                                type="number" min="2" max="60"
                                                                className="w-full border rounded p-2 text-sm" 
                                                                value={comp.config?.sliderInterval || 5} 
                                                                onChange={(e) => updateConfig(comp.id, 'sliderInterval', parseInt(e.target.value))} 
                                                            />
                                                        </div>
                                                        {(comp.config?.slides || []).map((slide, idx) => (
                                                            <div key={slide.id} className="bg-white p-3 rounded border space-y-2">
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="text-xs font-bold">Slide {idx + 1}</span>
                                                                    <button onClick={() => updateConfig(comp.id, 'slides', comp.config?.slides?.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-red-500"/></button>
                                                                </div>
                                                                
                                                                {/* Slide AI Generator */}
                                                                <div className="flex gap-2 mb-2">
                                                                    <input 
                                                                        className="flex-1 border p-1 text-xs rounded" 
                                                                        placeholder="AI Prompt for Background..." 
                                                                        value={slidePrompts[slide.id] || ''}
                                                                        onChange={e => setSlidePrompts(prev => ({...prev, [slide.id]: e.target.value}))}
                                                                    />
                                                                    <button 
                                                                        onClick={() => handleGenerateSlideBg(comp.id, comp.config?.slides || [], idx, slide.id)} 
                                                                        disabled={generatingSlideId === slide.id || !slidePrompts[slide.id]}
                                                                        className="bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 rounded text-xs font-bold uppercase disabled:opacity-50"
                                                                    >
                                                                        {generatingSlideId === slide.id ? <Loader2 className="h-3 w-3 animate-spin"/> : <Sparkles className="h-3 w-3"/>}
                                                                    </button>
                                                                </div>

                                                                <input className="w-full border p-1 text-xs mb-1" placeholder="Image URL" value={slide.image} onChange={e => {
                                                                    const s = [...(comp.config?.slides || [])]; s[idx].image = e.target.value; updateConfig(comp.id, 'slides', s);
                                                                }} />
                                                                <input className="w-full border p-1 text-xs mb-1" placeholder="Heading" value={slide.heading} onChange={e => {
                                                                    const s = [...(comp.config?.slides || [])]; s[idx].heading = e.target.value; updateConfig(comp.id, 'slides', s);
                                                                }} />
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <input className="w-full border p-1 text-xs" placeholder="Btn Text" value={slide.buttonText} onChange={e => {
                                                                        const s = [...(comp.config?.slides || [])]; s[idx].buttonText = e.target.value; updateConfig(comp.id, 'slides', s);
                                                                    }} />
                                                                    <input className="w-full border p-1 text-xs" placeholder="Link" value={slide.link} onChange={e => {
                                                                        const s = [...(comp.config?.slides || [])]; s[idx].link = e.target.value; updateConfig(comp.id, 'slides', s);
                                                                    }} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-xs text-gray-500 flex justify-between">Overlay Opacity <span>{Math.round((slide.overlayOpacity ?? 0.4) * 100)}%</span></label>
                                                                    <input 
                                                                        type="range" min="0" max="1" step="0.1" 
                                                                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                                                        value={slide.overlayOpacity ?? 0.4}
                                                                        onChange={(e) => {
                                                                            const s = [...(comp.config?.slides || [])]; 
                                                                            s[idx].overlayOpacity = parseFloat(e.target.value); 
                                                                            updateConfig(comp.id, 'slides', s);
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <div>
                                                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                                                                Height
                                                            </label>
                                                            <input className="w-full border rounded p-2 text-sm" value={comp.styles?.height || '600px'} onChange={(e) => updateStyle(comp.id, 'height', e.target.value)} />
                                                        </div>
                                                    </div>
                                                )}

                                                {comp.config?.heroType === 'cards' && (
                                                    <div className="space-y-3 bg-gray-100 p-3 rounded">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs font-bold uppercase text-gray-500">Info Cards</span>
                                                            <button 
                                                                onClick={() => {
                                                                    const newCard = { id: crypto.randomUUID(), title: 'Plan', price: '$10', description: 'Features...', buttonText: 'Subscribe', link: '' };
                                                                    updateConfig(comp.id, 'cards', [...(comp.config?.cards || []), newCard]);
                                                                }}
                                                                className="text-xs bg-black text-white px-2 py-1 rounded flex items-center gap-1"
                                                            >
                                                                <Plus className="h-3 w-3"/> Add Card
                                                            </button>
                                                        </div>
                                                        {(comp.config?.cards || []).map((card, idx) => (
                                                            <div key={card.id} className="bg-white p-3 rounded border space-y-2">
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="text-xs font-bold">Card {idx + 1}</span>
                                                                    <button onClick={() => updateConfig(comp.id, 'cards', comp.config?.cards?.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-red-500"/></button>
                                                                </div>
                                                                <input className="w-full border p-1 text-xs mb-1" placeholder="Title (e.g. Monthly)" value={card.title} onChange={e => {
                                                                    const c = [...(comp.config?.cards || [])]; c[idx].title = e.target.value; updateConfig(comp.id, 'cards', c);
                                                                }} />
                                                                <input className="w-full border p-1 text-xs mb-1" placeholder="Price / Subtitle" value={card.price} onChange={e => {
                                                                    const c = [...(comp.config?.cards || [])]; c[idx].price = e.target.value; updateConfig(comp.id, 'cards', c);
                                                                }} />
                                                                <textarea className="w-full border p-1 text-xs mb-1" placeholder="Description" value={card.description} onChange={e => {
                                                                    const c = [...(comp.config?.cards || [])]; c[idx].description = e.target.value; updateConfig(comp.id, 'cards', c);
                                                                }} />
                                                                <div className="flex gap-2 items-center">
                                                                    <input className="w-full border p-1 text-xs" placeholder="Link" value={card.link} onChange={e => {
                                                                        const c = [...(comp.config?.cards || [])]; c[idx].link = e.target.value; updateConfig(comp.id, 'cards', c);
                                                                    }} />
                                                                    <label className="flex items-center gap-1 text-xs whitespace-nowrap"><input type="checkbox" checked={card.highlight} onChange={e => {
                                                                        const c = [...(comp.config?.cards || [])]; c[idx].highlight = e.target.checked; updateConfig(comp.id, 'cards', c);
                                                                    }} /> Highlight</label>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Text Color</label>
                                                        <input type="color" className="w-full h-8" value={comp.styles?.textColor || '#ffffff'} onChange={(e) => updateStyle(comp.id, 'textColor', e.target.value)} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {(comp.type === 'Featured' || comp.type === 'RelatedProducts') && (
                                            <div className="space-y-4 border-t pt-4 border-gray-200">
                                                <h4 className="font-bold text-xs uppercase text-indigo-600">Collection Settings</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Source Type</label>
                                                        <select className="w-full border rounded p-2 text-sm" value={comp.config?.sourceType || 'random'} onChange={(e) => updateConfig(comp.id, 'sourceType', e.target.value)}>
                                                            <option value="random">Random Selection</option>
                                                            <option value="tag">Filter by Tag</option>
                                                        </select>
                                                    </div>
                                                    {comp.config?.sourceType === 'tag' && (
                                                        <div>
                                                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Tag Name</label>
                                                            <input className="w-full border rounded p-2 text-sm" placeholder="e.g. Featured" value={comp.config?.sourceValue || ''} onChange={(e) => updateConfig(comp.id, 'sourceValue', e.target.value)} />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Product Limit</label>
                                                        <input type="number" className="w-full border rounded p-2 text-sm" value={comp.config?.limit || 4} onChange={(e) => updateConfig(comp.id, 'limit', parseInt(e.target.value))} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {comp.type === 'Newsletter' && (
                                            <div className="space-y-4 border-t pt-4 border-gray-200">
                                                <h4 className="font-bold text-xs uppercase text-indigo-600">Newsletter Settings</h4>
                                                <div>
                                                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Subtext</label>
                                                    <input className="w-full border rounded p-2 text-sm" value={comp.config?.subheading || ''} onChange={(e) => updateConfig(comp.id, 'subheading', e.target.value)} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                     <div>
                                                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Text Color</label>
                                                        <input type="color" className="w-full h-8" value={comp.styles?.textColor || '#000000'} onChange={(e) => updateStyle(comp.id, 'textColor', e.target.value)} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {comp.type === 'AdvancedSearch' && (
                                            <div className="space-y-4 border-t pt-4 border-gray-200">
                                                 <h4 className="font-bold text-xs uppercase text-indigo-600">Search Configuration</h4>
                                                 <div>
                                                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Placeholder Text</label>
                                                    <input className="w-full border rounded p-2 text-sm" value={comp.config?.placeholder || ''} onChange={(e) => updateConfig(comp.id, 'placeholder', e.target.value)} />
                                                </div>
                                            </div>
                                        )}

                                        {comp.type === 'AdBox' && (
                                            <div className="space-y-4 border-t pt-4 border-gray-200">
                                                <h4 className="font-bold text-xs uppercase text-indigo-600">Advertisement Configuration</h4>
                                                <div>
                                                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Ad Size</label>
                                                    <select className="w-full border rounded p-2 text-sm" value={comp.config?.adSize || 'responsive'} onChange={e => updateConfig(comp.id, 'adSize', e.target.value)}>
                                                        <option value="responsive">Responsive (Full Width)</option>
                                                        <option value="728x90">Leaderboard (728x90)</option>
                                                        <option value="300x250">Medium Rectangle (300x250)</option>
                                                        <option value="336x280">Large Rectangle (336x280)</option>
                                                        <option value="160x600">Wide Skyscraper (160x600)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Ad Script / HTML</label>
                                                    <textarea 
                                                        className="w-full border rounded p-2 text-xs font-mono h-20" 
                                                        placeholder="<script>...</script> or <a href='...'><img src='...'/></a>"
                                                        value={comp.config?.adScript || ''} 
                                                        onChange={e => updateConfig(comp.id, 'adScript', e.target.value)}
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-500">Alternatively, use Image Link:</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input className="border p-2 rounded text-sm" placeholder="Image URL" value={comp.config?.adImageUrl || ''} onChange={e => updateConfig(comp.id, 'adImageUrl', e.target.value)} />
                                                    <input className="border p-2 rounded text-sm" placeholder="Link Target URL" value={comp.config?.adLinkUrl || ''} onChange={e => updateConfig(comp.id, 'adLinkUrl', e.target.value)} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                        
                        <div className="p-4 border-2 border-dashed border-gray-200 rounded-lg flex gap-2 overflow-x-auto">
                            <button onClick={() => handleAddComponent('Hero')} className="px-3 py-2 text-xs font-bold uppercase bg-gray-50 hover:bg-gray-100 rounded border flex items-center gap-1 whitespace-nowrap"><Plus className="h-3 w-3"/> Hero</button>
                            <button onClick={() => handleAddComponent('Featured')} className="px-3 py-2 text-xs font-bold uppercase bg-gray-50 hover:bg-gray-100 rounded border flex items-center gap-1 whitespace-nowrap"><Plus className="h-3 w-3"/> Collection</button>
                            <button onClick={() => handleAddComponent('TextBanner')} className="px-3 py-2 text-xs font-bold uppercase bg-gray-50 hover:bg-gray-100 rounded border flex items-center gap-1 whitespace-nowrap"><Plus className="h-3 w-3"/> Text Banner</button>
                            <button onClick={() => handleAddComponent('Newsletter')} className="px-3 py-2 text-xs font-bold uppercase bg-gray-50 hover:bg-gray-100 rounded border flex items-center gap-1 whitespace-nowrap"><Plus className="h-3 w-3"/> Email</button>
                            <button onClick={() => handleAddComponent('AdBox')} className="px-3 py-2 text-xs font-bold uppercase bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 flex items-center gap-1 whitespace-nowrap"><Plus className="h-3 w-3"/> Ad Box</button>
                            <button onClick={() => handleAddComponent('AdvancedSearch')} className="px-3 py-2 text-xs font-bold uppercase bg-purple-50 hover:bg-purple-100 text-purple-700 rounded border border-purple-200 flex items-center gap-1 whitespace-nowrap"><Plus className="h-3 w-3"/> Adv. Search</button>
                            <button onClick={() => handleAddComponent('RelatedProducts')} className="px-3 py-2 text-xs font-bold uppercase bg-green-50 hover:bg-green-100 text-green-700 rounded border border-green-200 flex items-center gap-1 whitespace-nowrap"><Plus className="h-3 w-3"/> You May Like</button>
                        </div>
                    </div>

                    {/* Sidebar (Instructions / Global Actions) */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 border shadow-sm rounded-lg sticky top-24">
                            <h3 className="font-bold text-gray-900 mb-4">Actions</h3>
                            <button 
                                onClick={onSaveContent} 
                                className="w-full bg-black text-white py-3 rounded-md font-bold uppercase tracking-widest hover:bg-gray-800 flex items-center justify-center gap-2 mb-4"
                            >
                                <Save className="h-4 w-4" /> Save Layout
                            </button>
                            <p className="text-xs text-gray-500 leading-relaxed mb-4">
                                Drag and drop sections to reorder your homepage. Toggle visibility with the eye icon. Expand sections to edit text and images.
                            </p>
                            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded text-xs text-indigo-800">
                                <strong>Tip:</strong> Changes here update the live store immediately upon saving.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- THEME TAB --- */}
            {activeTab === 'theme' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* ... Theme settings (unchanged) ... */}
                    <div className="col-span-1 md:col-span-2">
                         <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 border border-indigo-100 rounded-lg shadow-sm">
                            <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-purple-600" /> AI Theme Generator
                            </h3>
                            <p className="text-sm text-indigo-700 mb-4">
                                Upload an image (logo, moodboard, photo) and AI will extract a matching color palette, font style, and shape settings for you.
                            </p>
                            <div className="flex gap-4 items-center">
                                <label className="cursor-pointer bg-white border border-indigo-200 text-indigo-600 px-4 py-2 rounded-md font-bold text-sm hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center gap-2 shadow-sm">
                                    <Upload className="h-4 w-4" /> Upload Image
                                    <input type="file" accept="image/*" className="hidden" onChange={handleAiThemeGeneration} disabled={isGeneratingTheme} />
                                </label>
                                {isGeneratingTheme && (
                                    <span className="flex items-center gap-2 text-sm text-purple-600 font-bold bg-white px-3 py-2 rounded-full shadow-sm animate-pulse">
                                        <Loader2 className="h-4 w-4 animate-spin"/> Analyzing Colors & Style...
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* ... rest of theme ui ... */}
                </div>
            )}
        </div>
    );
};
