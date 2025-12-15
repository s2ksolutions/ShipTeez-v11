
import React, { useState, useRef, useEffect } from 'react';
import { StoreContent, Policy, SizeGuide, EmailTemplate } from '../../types';
import { 
    FileText, Save, Plus, Trash2, Ruler, Mail, LayoutTemplate, Edit3, Settings, 
    Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, 
    List, ListOrdered, Link as LinkIcon, Code, Variable, Type, Highlighter, Eraser,
    Eye, GripVertical, GripHorizontal
} from 'lucide-react';
import { AITextGenerator } from './AITextGenerator';

interface CMSSectionProps {
    content: StoreContent;
    onUpdateContent: (fn: (c: StoreContent) => StoreContent) => void;
    onSaveContent: () => Promise<void>;
}

type CMSTab = 'pages' | 'sizes' | 'emails' | 'interface';
const GLOBAL_EMAIL_CONFIG_ID = 'global_config';

// Mock Data for Preview
const MOCK_PREVIEW_DATA: Record<string, string> = {
    '{name}': 'Jane Doe',
    '{email}': 'jane@example.com',
    '{orderId}': 'ORD-12345',
    '{total}': '$129.50',
    '{trackingNumber}': '1Z999AA10123456784',
    '{trackingLink}': '#',
    '{unsubscribeLink}': '#',
    '{year}': new Date().getFullYear().toString(),
    '{storeName}': 'ShipTeez',
    '{token}': 'a1b2c3d4e5',
    '{resetLink}': 'https://store.com/reset?token=...'
};

// --- WYSIWYG Editor Component ---
const RichTextEditor: React.FC<{ value: string; onChange: (val: string) => void; placeholder?: string; className?: string }> = ({ value, onChange, placeholder, className }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isSourceMode, setIsSourceMode] = useState(false);

    // Sync content ONLY if it changed externally to avoid cursor jumps
    useEffect(() => {
        if (editorRef.current && !isSourceMode) {
            if (editorRef.current.innerHTML !== value) {
                editorRef.current.innerHTML = value;
            }
        }
    }, [value, isSourceMode]);

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        const html = e.currentTarget.innerHTML;
        onChange(html);
    };

    const execCmd = (cmd: string, val?: string) => {
        document.execCommand(cmd, false, val);
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    return (
        <div className={`border rounded bg-white flex flex-col shadow-sm resize-y overflow-hidden min-h-[300px] ${className || 'h-[500px]'}`}>
            <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-gray-50 sticky top-0 z-10">
                {/* Basic Formatting */}
                <button onClick={() => execCmd('bold')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Bold"><Bold className="h-4 w-4"/></button>
                <button onClick={() => execCmd('italic')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Italic"><Italic className="h-4 w-4"/></button>
                <button onClick={() => execCmd('underline')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Underline"><Underline className="h-4 w-4"/></button>
                <button onClick={() => execCmd('strikeThrough')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Strikethrough"><Strikethrough className="h-4 w-4"/></button>

                <div className="w-px h-6 bg-gray-300 mx-1"></div>

                {/* Alignment */}
                <button onClick={() => execCmd('justifyLeft')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Align Left"><AlignLeft className="h-4 w-4"/></button>
                <button onClick={() => execCmd('justifyCenter')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Align Center"><AlignCenter className="h-4 w-4"/></button>
                <button onClick={() => execCmd('justifyRight')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Align Right"><AlignRight className="h-4 w-4"/></button>

                <div className="w-px h-6 bg-gray-300 mx-1"></div>

                {/* Lists */}
                <button onClick={() => execCmd('insertOrderedList')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Ordered List"><ListOrdered className="h-4 w-4"/></button>
                <button onClick={() => execCmd('insertUnorderedList')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Unordered List"><List className="h-4 w-4"/></button>

                <div className="w-px h-6 bg-gray-300 mx-1"></div>

                {/* Colors */}
                <div className="flex items-center gap-1 border rounded px-1.5 py-0.5 bg-white hover:bg-gray-50" title="Text Color">
                    <Type className="h-3 w-3 text-gray-500"/>
                    <input type="color" className="w-5 h-5 border-0 p-0 bg-transparent cursor-pointer" onChange={(e) => execCmd('foreColor', e.target.value)} />
                </div>
                <div className="flex items-center gap-1 border rounded px-1.5 py-0.5 bg-white hover:bg-gray-50" title="Highlight Color">
                    <Highlighter className="h-3 w-3 text-gray-500"/>
                    <input type="color" className="w-5 h-5 border-0 p-0 bg-transparent cursor-pointer" value="#ffffff" onChange={(e) => execCmd('hiliteColor', e.target.value)} />
                </div>

                <div className="w-px h-6 bg-gray-300 mx-1"></div>

                {/* Formatting */}
                <select onChange={(e) => execCmd('formatBlock', e.target.value)} className="h-8 text-xs border rounded bg-white px-2 focus:ring-0">
                    <option value="p">Paragraph</option>
                    <option value="h1">Heading 1</option>
                    <option value="h2">Heading 2</option>
                    <option value="h3">Heading 3</option>
                    <option value="blockquote">Quote</option>
                    <option value="pre">Code Block</option>
                </select>

                <div className="flex-1"></div>

                {/* System */}
                <button onClick={() => { const url = prompt('URL:'); if(url) execCmd('createLink', url); }} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Insert Link"><LinkIcon className="h-4 w-4"/></button>
                <button onClick={() => execCmd('removeFormat')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Clear Formatting"><Eraser className="h-4 w-4"/></button>
                <button 
                    onClick={() => setIsSourceMode(!isSourceMode)} 
                    className={`p-1.5 hover:bg-gray-200 rounded text-gray-700 ${isSourceMode ? 'bg-gray-200' : ''}`} 
                    title="Toggle HTML Source"
                >
                    <Code className="h-4 w-4"/>
                </button>
            </div>
            
            {isSourceMode ? (
                <textarea 
                    className="flex-1 p-4 font-mono text-xs w-full resize-none focus:outline-none bg-gray-50 text-gray-800" 
                    value={value} 
                    onChange={e => onChange(e.target.value)} 
                    placeholder={placeholder}
                />
            ) : (
                <div 
                    ref={editorRef}
                    className="flex-1 p-4 overflow-y-auto focus:outline-none prose prose-sm max-w-none text-gray-800"
                    contentEditable
                    onInput={handleInput}
                    suppressContentEditableWarning={true}
                />
            )}
        </div>
    );
};

export const CMSSection: React.FC<CMSSectionProps> = ({ content, onUpdateContent, onSaveContent }) => {
    const [activeTab, setActiveTab] = useState<CMSTab>('pages');
    
    // --- Sub-State for each tab ---
    const [activePolicyId, setActivePolicyId] = useState<string>(content.policies[0]?.id || '');
    const [activeSizeGuideId, setActiveSizeGuideId] = useState<string>(content.sizeGuides?.[0]?.id || '');
    const [activeEmailId, setActiveEmailId] = useState<string>(GLOBAL_EMAIL_CONFIG_ID);

    // --- Preview Pane State ---
    const [previewHeight, setPreviewHeight] = useState(300);
    const [isResizingPreview, setIsResizingPreview] = useState(false);
    const emailContainerRef = useRef<HTMLDivElement>(null);

    // --- Resizing Logic ---
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizingPreview || !emailContainerRef.current) return;
            const containerRect = emailContainerRef.current.getBoundingClientRect();
            // Calculate height relative to the top of the main container
            const newHeight = e.clientY - containerRect.top;
            
            // Constrain min and max height
            const minHeight = 150;
            const maxHeight = containerRect.height - 200; // Keep space for editor
            
            if (newHeight > minHeight && newHeight < maxHeight) {
                setPreviewHeight(newHeight);
            }
        };

        const handleMouseUp = () => setIsResizingPreview(false);

        if (isResizingPreview) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'row-resize';
        } else {
            document.body.style.cursor = 'default';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
        };
    }, [isResizingPreview]);


    // --- Pages Handlers ---
    const activePolicy = content.policies.find(p => p.id === activePolicyId);
    const updatePolicy = (key: keyof Policy, value: string) => {
        onUpdateContent(c => ({
            ...c,
            policies: c.policies.map(p => p.id === activePolicyId ? { ...p, [key]: value } : p)
        }));
    };
    const handleAddPolicy = () => {
        const newId = crypto.randomUUID();
        const newPolicy: Policy = { id: newId, title: 'New Page', slug: 'new-page', content: '<h1>New Page</h1><p>Start writing...</p>' };
        onUpdateContent(c => ({ ...c, policies: [...c.policies, newPolicy] }));
        setActivePolicyId(newId);
    };
    const handleDeletePolicy = (id: string) => {
        if(confirm('Delete this page?')) {
            onUpdateContent(c => ({ ...c, policies: c.policies.filter(p => p.id !== id) }));
            if (activePolicyId === id) setActivePolicyId(content.policies[0]?.id || '');
        }
    };

    // --- Size Guides Handlers ---
    const activeSizeGuide = content.sizeGuides?.find(g => g.id === activeSizeGuideId);
    const updateSizeGuide = (key: keyof SizeGuide, value: string) => {
        onUpdateContent(c => ({
            ...c,
            sizeGuides: c.sizeGuides.map(g => g.id === activeSizeGuideId ? { ...g, [key]: value } : g)
        }));
    };
    const handleAddSizeGuide = () => {
        const newId = crypto.randomUUID();
        const newGuide: SizeGuide = { id: newId, category: 'New Category', title: 'New Size Chart', content: '| Size | Metric |\n|---|---|' };
        onUpdateContent(c => ({ ...c, sizeGuides: [...(c.sizeGuides || []), newGuide] }));
        setActiveSizeGuideId(newId);
    };
    const handleDeleteSizeGuide = (id: string) => {
        if(confirm('Delete this size guide?')) {
            onUpdateContent(c => ({ ...c, sizeGuides: c.sizeGuides.filter(g => g.id !== id) }));
            if (activeSizeGuideId === id) setActiveSizeGuideId(content.sizeGuides?.[0]?.id || '');
        }
    };

    // --- Email Templates Handlers ---
    const activeEmail = content.emailTemplates?.find(e => e.id === activeEmailId);
    const updateEmail = (key: keyof EmailTemplate, value: string) => {
        onUpdateContent(c => ({
            ...c,
            emailTemplates: c.emailTemplates.map(e => e.id === activeEmailId ? { ...e, [key]: value } : e)
        }));
    };
    const updateEmailSettings = (key: string, value: string) => {
        onUpdateContent(c => ({
            ...c,
            emailSettings: { ...c.emailSettings, [key]: value }
        }));
    };

    // Helper to generate preview
    const generatePreviewHtml = () => {
        let bodyHtml = '';
        const header = content.emailSettings?.headerHtml || '';
        const footer = content.emailSettings?.footerHtml || '';

        if (activeEmailId === GLOBAL_EMAIL_CONFIG_ID) {
            // Previewing Global wrappers with placeholder content
            bodyHtml = `<div style="padding: 20px; font-family: sans-serif; color: #333;">
                <h2>Preview Content Area</h2>
                <p>This is where the actual email template content will go. You are currently editing the global header (above) and footer (below).</p>
                <p>Use this view to ensure your branding wraps correctly around the message.</p>
            </div>`;
        } else if (activeEmail) {
            bodyHtml = activeEmail.body;
        }

        let fullHtml = `${header}${bodyHtml}${footer}`;

        // Replace Tokens with Mock Data
        // Escape special regex chars in token keys to prevent SyntaxError
        Object.entries(MOCK_PREVIEW_DATA).forEach(([token, mockValue]) => {
            const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            fullHtml = fullHtml.replace(new RegExp(escapedToken, 'g'), mockValue);
        });

        return fullHtml;
    };

    // --- Interface Text Handlers ---
    const updateFooter = (key: string, value: string) => {
        onUpdateContent(c => ({ ...c, footer: { ...c.footer, [key]: value } }));
    };
    const updatePageText = (key: string, value: string) => {
        onUpdateContent(c => ({ ...c, pageText: { ...c.pageText, [key]: value } }));
    };

    const TabButton = ({ id, label, icon: Icon }: any) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold w-full text-left transition-colors border-l-4 ${activeTab === id ? 'bg-white border-black text-black' : 'border-transparent text-gray-500 hover:bg-gray-100 hover:text-black'}`}
        >
            <Icon className="h-4 w-4" /> {label}
        </button>
    );

    return (
        <div className="flex h-[80vh] bg-white border shadow-sm animate-in fade-in overflow-hidden">
            {/* Main Sidebar (Tabs) */}
            <div className="w-48 bg-gray-50 border-r flex flex-col pt-4 flex-shrink-0">
                <TabButton id="pages" label="Pages / Policies" icon={FileText} />
                <TabButton id="sizes" label="Size Guides" icon={Ruler} />
                <TabButton id="emails" label="Email Templates" icon={Mail} />
                <TabButton id="interface" label="Interface Text" icon={LayoutTemplate} />
            </div>

            {/* Content Area */}
            <div className="flex-1 flex overflow-hidden">
                
                {/* --- PAGES TAB --- */}
                {activeTab === 'pages' && (
                    <>
                        <div className="w-56 border-r bg-white flex flex-col">
                            <div className="p-4 border-b bg-gray-50 text-xs font-bold uppercase text-gray-500">Select Page</div>
                            <div className="flex-1 overflow-y-auto">
                                {content.policies.map(p => (
                                    <div key={p.id} onClick={() => setActivePolicyId(p.id)} className={`p-3 text-sm cursor-pointer border-b hover:bg-gray-50 ${activePolicyId === p.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}>
                                        <div className="font-medium">{p.title}</div>
                                        <div className="text-xs text-gray-400">/{p.slug}</div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={handleAddPolicy} className="p-3 text-xs font-bold uppercase flex items-center justify-center gap-2 border-t hover:bg-gray-100"><Plus className="h-3 w-3"/> New Page</button>
                        </div>
                        {activePolicy ? (
                            <div className="flex-1 flex flex-col overflow-y-auto">
                                <div className="p-6 border-b bg-white grid grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Page Title</label><input className="w-full border p-2" value={activePolicy.title} onChange={e => updatePolicy('title', e.target.value)} /></div>
                                    <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">URL Slug</label><input className="w-full border p-2 font-mono text-sm" value={activePolicy.slug} onChange={e => updatePolicy('slug', e.target.value)} /></div>
                                </div>
                                <div className="flex-1 p-6 bg-gray-50 flex flex-col">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-xs font-bold uppercase text-gray-500">Content</label>
                                        <AITextGenerator context={`Write content for a page titled: ${activePolicy.title}`} type="html content" onGenerate={(text) => updatePolicy('content', text)} />
                                    </div>
                                    <RichTextEditor 
                                        key={activePolicy.id}
                                        className="h-[600px]"
                                        value={activePolicy.content} 
                                        onChange={val => updatePolicy('content', val)} 
                                    />
                                </div>
                                <div className="p-4 border-t bg-white flex justify-between">
                                    <button onClick={() => handleDeletePolicy(activePolicy.id)} className="text-red-500 text-sm flex items-center gap-2 hover:underline"><Trash2 className="h-4 w-4"/> Delete</button>
                                    <button onClick={onSaveContent} className="bg-black text-white px-6 py-2 font-bold uppercase flex items-center gap-2 hover:bg-gray-800"><Save className="h-4 w-4" /> Save</button>
                                </div>
                            </div>
                        ) : <div className="flex-1 flex items-center justify-center text-gray-400">Select a page</div>}
                    </>
                )}

                {/* --- SIZE GUIDES TAB --- */}
                {activeTab === 'sizes' && (
                    <>
                        <div className="w-56 border-r bg-white flex flex-col">
                            <div className="p-4 border-b bg-gray-50 text-xs font-bold uppercase text-gray-500">Size Guides</div>
                            <div className="flex-1 overflow-y-auto">
                                {content.sizeGuides?.map(g => (
                                    <div key={g.id} onClick={() => setActiveSizeGuideId(g.id)} className={`p-3 text-sm cursor-pointer border-b hover:bg-gray-50 ${activeSizeGuideId === g.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}>
                                        <div className="font-medium">{g.title}</div>
                                        <div className="text-xs text-gray-400">{g.category}</div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={handleAddSizeGuide} className="p-3 text-xs font-bold uppercase flex items-center justify-center gap-2 border-t hover:bg-gray-100"><Plus className="h-3 w-3"/> New Guide</button>
                        </div>
                        {activeSizeGuide ? (
                            <div className="flex-1 flex flex-col overflow-y-auto">
                                <div className="p-6 border-b bg-white grid grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Guide Title</label><input className="w-full border p-2" value={activeSizeGuide.title} onChange={e => updateSizeGuide('title', e.target.value)} /></div>
                                    <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Product Category</label><input className="w-full border p-2" value={activeSizeGuide.category} onChange={e => updateSizeGuide('category', e.target.value)} /></div>
                                </div>
                                <div className="flex-1 p-6 bg-gray-50 flex flex-col">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-xs font-bold uppercase text-gray-500">Table Content (Markdown)</label>
                                        <AITextGenerator context={`Create a size chart for ${activeSizeGuide.category}`} type="markdown table" onGenerate={(text) => updateSizeGuide('content', text)} />
                                    </div>
                                    <textarea className="flex-1 w-full border p-4 text-sm font-mono leading-relaxed resize-none h-[500px]" value={activeSizeGuide.content} onChange={e => updateSizeGuide('content', e.target.value)} />
                                    <p className="text-xs text-gray-500 mt-2">Use Markdown table syntax. Example: | Size | Chest | Length |</p>
                                </div>
                                <div className="p-4 border-t bg-white flex justify-between">
                                    <button onClick={() => handleDeleteSizeGuide(activeSizeGuide.id)} className="text-red-500 text-sm flex items-center gap-2 hover:underline"><Trash2 className="h-4 w-4"/> Delete</button>
                                    <button onClick={onSaveContent} className="bg-black text-white px-6 py-2 font-bold uppercase flex items-center gap-2 hover:bg-gray-800"><Save className="h-4 w-4" /> Save</button>
                                </div>
                            </div>
                        ) : <div className="flex-1 flex items-center justify-center text-gray-400">Select a guide</div>}
                    </>
                )}

                {/* --- EMAILS TAB --- */}
                {activeTab === 'emails' && (
                    <>
                        {/* 1. Template Selector */}
                        <div className="w-64 border-r bg-white flex flex-col flex-shrink-0">
                            <div className="p-4 border-b bg-gray-50 text-xs font-bold uppercase text-gray-500">Templates</div>
                            <div className="flex-1 overflow-y-auto">
                                {/* Global Configuration Item */}
                                <div 
                                    onClick={() => setActiveEmailId(GLOBAL_EMAIL_CONFIG_ID)} 
                                    className={`p-3 text-sm cursor-pointer border-b hover:bg-gray-50 ${activeEmailId === GLOBAL_EMAIL_CONFIG_ID ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}
                                >
                                    <div className="font-bold flex items-center gap-2 text-indigo-900"><LayoutTemplate className="h-4 w-4"/> Global Layout</div>
                                    <div className="text-[10px] text-gray-500">Sender, Header, Footer</div>
                                </div>

                                {content.emailTemplates?.map(e => (
                                    <div key={e.id} onClick={() => setActiveEmailId(e.id)} className={`p-3 text-sm cursor-pointer border-b hover:bg-gray-50 ${activeEmailId === e.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}>
                                        <div className="font-medium">{e.name}</div>
                                        <div className="text-xs text-gray-400 truncate">{e.subject}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {/* 2. Main Area (Vertical Layout) */}
                        <div className="flex-1 flex flex-col overflow-hidden relative" ref={emailContainerRef}>
                            
                            {/* TOP: Live Preview Pane */}
                            <div style={{ height: previewHeight }} className="flex-shrink-0 border-b bg-gray-100 flex flex-col transition-all duration-75">
                                <div className="p-2 border-b bg-gray-200 flex justify-between items-center shadow-sm select-none">
                                    <h3 className="font-bold text-xs uppercase text-gray-600 flex items-center gap-2"><Eye className="h-4 w-4"/> Live Preview</h3>
                                    <div className="text-[10px] text-gray-500">Subject: {activeEmail ? activeEmail.subject.replace(/{(\w+)}/g, (m) => MOCK_PREVIEW_DATA[m] || m) : 'Global Settings'}</div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-8 bg-gray-100 flex justify-center">
                                    <div className="w-full max-w-[600px] bg-white shadow-lg min-h-full border border-gray-200 p-4">
                                        <div 
                                            className="prose prose-sm max-w-none text-sm leading-relaxed email-preview-content"
                                            dangerouslySetInnerHTML={{ __html: generatePreviewHtml() }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Resizer Handle */}
                            <div 
                                className="h-3 bg-gray-200 hover:bg-blue-400 cursor-row-resize flex items-center justify-center z-20 flex-shrink-0 transition-colors border-y border-gray-300"
                                onMouseDown={() => setIsResizingPreview(true)}
                            >
                                <GripHorizontal className="h-4 w-4 text-gray-500 pointer-events-none"/>
                            </div>

                            {/* BOTTOM: Editor Pane */}
                            <div className="flex-1 flex overflow-hidden">
                                
                                {/* Main Editor */}
                                <div className="flex-1 flex flex-col overflow-y-auto bg-gray-50 border-r border-gray-200">
                                    {activeEmailId === GLOBAL_EMAIL_CONFIG_ID ? (
                                        <div className="p-6 space-y-8">
                                            <div>
                                                <h2 className="font-bold text-xl text-gray-900">Global Configuration</h2>
                                                <p className="text-sm text-gray-500">These settings apply to all outgoing emails.</p>
                                            </div>
                                            
                                            <div className="bg-white p-6 shadow-sm border rounded-lg">
                                                <h3 className="font-bold text-sm uppercase text-gray-500 mb-4 flex items-center gap-2"><Settings className="h-4 w-4"/> Sender Info</h3>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Sender Name</label>
                                                        <input className="w-full border p-2 rounded text-sm" value={content.emailSettings?.senderName || ''} onChange={e => updateEmailSettings('senderName', e.target.value)} placeholder="ShipTeez Support" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Reply-To Email</label>
                                                        <input className="w-full border p-2 rounded text-sm" value={content.emailSettings?.replyToEmail || ''} onChange={e => updateEmailSettings('replyToEmail', e.target.value)} placeholder="support@shipteez.com" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-white p-6 shadow-sm border rounded-lg space-y-6">
                                                <div>
                                                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Global Header (HTML)</label>
                                                    <RichTextEditor 
                                                        className="h-[200px]"
                                                        value={content.emailSettings?.headerHtml || ''} 
                                                        onChange={val => updateEmailSettings('headerHtml', val)} 
                                                        placeholder="<div style='text-align:center;'><img src='...' /></div>"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Global Footer (HTML)</label>
                                                    <RichTextEditor 
                                                        className="h-[200px]"
                                                        value={content.emailSettings?.footerHtml || ''} 
                                                        onChange={val => updateEmailSettings('footerHtml', val)}
                                                        placeholder="<div style='...'>&copy; 2024. <a href='{unsubscribeLink}'>Unsubscribe</a></div>"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : activeEmail ? (
                                        <div className="flex flex-col h-full">
                                            <div className="p-6 bg-white border-b">
                                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Subject Line</label>
                                                <div className="flex gap-2">
                                                    <input className="w-full border p-2 font-medium" value={activeEmail.subject} onChange={e => updateEmail('subject', e.target.value)} />
                                                    <AITextGenerator context={`Write an email subject line for: ${activeEmail.name}`} type="email subject" onGenerate={(text) => updateEmail('subject', text)} />
                                                </div>
                                            </div>
                                            <div className="flex-1 p-6 flex flex-col">
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className="block text-xs font-bold uppercase text-gray-500">Email Body (HTML)</label>
                                                    <AITextGenerator context={`Write an email body for: ${activeEmail.name} with subject ${activeEmail.subject}`} type="email body" onGenerate={(text) => updateEmail('body', text)} />
                                                </div>
                                                <RichTextEditor 
                                                    key={activeEmail.id}
                                                    className="flex-1 min-h-[300px]"
                                                    value={activeEmail.body} 
                                                    onChange={(val) => updateEmail('body', val)} 
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center text-gray-400">Select a template</div>
                                    )}
                                    <div className="p-4 border-t bg-white flex justify-end sticky bottom-0 z-20">
                                        <button onClick={onSaveContent} className="bg-black text-white px-6 py-2 font-bold uppercase flex items-center gap-2 hover:bg-gray-800"><Save className="h-4 w-4" /> Save Changes</button>
                                    </div>
                                </div>

                                {/* Available Tokens Sidebar (Static) */}
                                <div className="w-64 bg-white p-6 overflow-y-auto">
                                    <h4 className="font-bold text-xs uppercase text-gray-500 mb-4 flex items-center gap-2"><Variable className="h-3 w-3"/> Available Tokens</h4>
                                    <div className="space-y-3">
                                        {[
                                            { label: 'Customer Name', token: '{name}' },
                                            { label: 'Unsubscribe Link', token: '{unsubscribeLink}' },
                                            { label: 'Current Year', token: '{year}' },
                                            { label: 'Store Name', token: '{storeName}' },
                                            { label: 'Order ID', token: '{orderId}' },
                                            { label: 'Total Amount', token: '{total}' },
                                            { label: 'Tracking #', token: '{trackingNumber}' },
                                            { label: 'Tracking Link', token: '{trackingLink}' },
                                            { label: 'Reset Token', token: '{token}' },
                                            { label: 'Reset Link', token: '{resetLink}' },
                                        ].map(t => (
                                            <div key={t.token} className="p-2 border rounded bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => navigator.clipboard.writeText(t.token)}>
                                                <div className="text-xs font-medium text-gray-700">{t.label}</div>
                                                <code className="text-[10px] text-blue-600 font-mono mt-1 block">{t.token}</code>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-4 text-center">Click to copy token</p>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* --- INTERFACE TEXT TAB --- */}
                {activeTab === 'interface' && (
                    <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
                        <div className="max-w-4xl mx-auto space-y-8">
                            
                            <div className="bg-white p-6 shadow-sm border rounded-lg">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><LayoutTemplate className="h-5 w-5"/> Footer Content</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-xs font-bold uppercase text-gray-500 mb-1 flex justify-between">Brand Description <AITextGenerator className="p-1" context="Short brand description for footer" onGenerate={t => updateFooter('brandDescription', t)}/></label>
                                        <RichTextEditor 
                                            className="h-40"
                                            value={content.footer.brandDescription} 
                                            onChange={val => updateFooter('brandDescription', val)} 
                                        />
                                    </div>
                                    <div><label className="text-xs font-bold uppercase text-gray-500">Shop Header</label><input className="w-full border p-2 text-sm" value={content.footer.shopHeader} onChange={e => updateFooter('shopHeader', e.target.value)} /></div>
                                    <div><label className="text-xs font-bold uppercase text-gray-500">Support Header</label><input className="w-full border p-2 text-sm" value={content.footer.supportHeader} onChange={e => updateFooter('supportHeader', e.target.value)} /></div>
                                    <div><label className="text-xs font-bold uppercase text-gray-500">Newsletter Header</label><input className="w-full border p-2 text-sm" value={content.footer.newsletterHeader} onChange={e => updateFooter('newsletterHeader', e.target.value)} /></div>
                                    <div><label className="text-xs font-bold uppercase text-gray-500">Copyright Text</label><input className="w-full border p-2 text-sm" value={content.footer.copyrightText} onChange={e => updateFooter('copyrightText', e.target.value)} /></div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-bold uppercase text-gray-500 mb-1 flex justify-between">Newsletter Text <AITextGenerator className="p-1" context="Short newsletter value prop" onGenerate={t => updateFooter('newsletterText', t)}/></label>
                                        <input className="w-full border p-2 text-sm" value={content.footer.newsletterText} onChange={e => updateFooter('newsletterText', e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 shadow-sm border rounded-lg">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Edit3 className="h-5 w-5"/> Account & Auth Text</h3>
                                <div className="space-y-4">
                                    <div><label className="text-xs font-bold uppercase text-gray-500">Account Welcome Message</label><input className="w-full border p-2 text-sm" value={content.pageText.accountWelcome} onChange={e => updatePageText('accountWelcome', e.target.value)} placeholder="Hello, {name}" /></div>
                                    <div><label className="text-xs font-bold uppercase text-gray-500">Support Intro Text</label><input className="w-full border p-2 text-sm" value={content.pageText.accountSupportIntro} onChange={e => updatePageText('accountSupportIntro', e.target.value)} /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs font-bold uppercase text-gray-500">Login Title</label><input className="w-full border p-2 text-sm" value={content.pageText.loginTitle} onChange={e => updatePageText('loginTitle', e.target.value)} /></div>
                                        <div><label className="text-xs font-bold uppercase text-gray-500">Register Title</label><input className="w-full border p-2 text-sm" value={content.pageText.registerTitle} onChange={e => updatePageText('registerTitle', e.target.value)} /></div>
                                    </div>
                                </div>
                            </div>

                            <button onClick={onSaveContent} className="w-full bg-black text-white py-4 font-bold uppercase tracking-widest hover:bg-gray-800 flex items-center justify-center gap-2">
                                <Save className="h-4 w-4" /> Save All Changes
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
