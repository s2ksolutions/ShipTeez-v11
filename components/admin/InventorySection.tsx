
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Product, StoreContent, ItemSpecificTemplate } from '../../types';
import { adminMiddleware } from '../../services/adminMiddleware';
import { db } from '../../services/db';
import { toBase64, slugify } from '../../utils';
import { Plus, Trash2, Edit, Save, Upload, Layers, Loader2, Sparkles, Wand2, X, Package, Link as LinkIcon, Download, Check, Ruler, ZoomIn, List, Image as ImageIcon, Scan, GripHorizontal, Star, Palette, Crop, AlertTriangle, Folder, Globe, Tag, Eye, EyeOff, Clock, ChevronRight, ChevronDown, CornerDownRight, Percent, Filter, Box } from 'lucide-react';
import { AITextGenerator } from './AITextGenerator';
import { AIProductGenerator } from './AIProductGenerator';
import { useStore } from '../../context/StoreContext';

interface InventorySectionProps {
    products: Product[];
    content: StoreContent;
    onUpdateContent: (fn: (c: StoreContent) => StoreContent) => void;
    onSaveContent: () => Promise<void>;
    onRefresh: () => Promise<void>;
}

// Tree Node Helper Type
interface CategoryNode {
    name: string;
    fullPath: string;
    children: CategoryNode[];
}

const CATEGORY_SEPARATOR = " > ";

export const InventorySection: React.FC<InventorySectionProps> = ({ products, content, onUpdateContent, onSaveContent, onRefresh }) => {
    const { showToast } = useStore();

    // Selection / Editing
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [editTags, setEditTags] = useState('');
    const [editColors, setEditColors] = useState('');
    const [editAliases, setEditAliases] = useState<string[]>([]); // New Alias State
    const [newAlias, setNewAlias] = useState('');
    
    // Category Manager State
    const [showCategoryManager, setShowCategoryManager] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [parentCategory, setParentCategory] = useState<string | null>(null); // For sub-category creation
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [renameCategoryMap, setRenameCategoryMap] = useState<{old: string, new: string} | null>(null);

    const [sizeGuides, setSizeGuides] = useState<StoreContent['sizeGuides']>([]);
    const [specificsTemplates, setSpecificsTemplates] = useState<ItemSpecificTemplate[]>([]);

    // Modals State
    const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void; isDestructive?: boolean } | null>(null);
    const [promptModal, setPromptModal] = useState<{ title: string; message: string; onConfirm: (val: string) => void; defaultValue?: string } | null>(null);

    // Image Editing State
    const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
    const [lifestylePrompt, setLifestylePrompt] = useState('');
    const [isGeneratingLifestyle, setIsGeneratingLifestyle] = useState(false);

    // Cropping State
    const [croppingId, setCroppingId] = useState<number | null>(null);
    const [cropImage, setCropImage] = useState<string | null>(null);
    const [cropScale, setCropScale] = useState(1);
    const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
    const cropCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDraggingCrop, setIsDraggingCrop] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Specifics Editing State (Local to modal)
    const [editSpecifics, setEditSpecifics] = useState<{key: string, value: string}[]>([]);

    // Bulk Edit State
    const [bulkChanges, setBulkChanges] = useState({
        price: '',
        stock: '',
        category: '',
        sizeGuideId: '',
        shippingTemplateId: '', // New
        specificsTemplateId: '',
        colors: '',
        tags: '',
        sizes: '', // New field
        attributes: '',
        isHidden: '', // 'true' | 'false' | ''
        // Marketing Flags (Tri-state: '' = no change, 'true', 'false')
        isFeatured: '',
        isClearance: '',
        isBogo: ''
    });
    const [isBulkSaving, setIsBulkSaving] = useState(false);
    // New State for Progress Tracking
    const [bulkProgressData, setBulkProgressData] = useState<{ processed: number; total: number; startTime: number }>({ processed: 0, total: 0, startTime: 0 });

    // Hover Zoom State
    const [hoveredImage, setHoveredImage] = useState<{ src: string, x: number, y: number } | null>(null);

    // AI & Upload
    const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
    const [directFiles, setDirectFiles] = useState<File[]>([]);
    const [isDirectUploading, setIsDirectUploading] = useState(false);
    const [bulkProgress, setBulkProgress] = useState(0);

    // Bulk Mockup Generator State
    const [bulkMockup, setBulkMockup] = useState<string | null>(null);
    const [bulkFiles, setBulkFiles] = useState<File[]>([]);
    const [overlayScale, setOverlayScale] = useState(0.5); 
    const [overlayX, setOverlayX] = useState(0.5);
    const [overlayY, setOverlayY] = useState(0.5);
    const [previewShape, setPreviewShape] = useState<'square' | 'portrait' | 'landscape' | '3:4'>('square');
    const [isImporting, setIsImporting] = useState(false);
    const [dragMode, setDragMode] = useState<'move' | 'scale' | null>(null);
    const [mockupCategory, setMockupCategory] = useState<string | null>(null);
    const [isAnalyzingMockup, setIsAnalyzingMockup] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadContent = async () => {
            // Note: content prop is now live from Admin parent, but specific helpers still usable
            const fetched = await db.getStoreContent();
            setSizeGuides(fetched.sizeGuides || []);
            setSpecificsTemplates(fetched.itemSpecificTemplates || []);
        };
        loadContent();
    }, []);

    // --- Helpers for Category Tree ---
    const buildCategoryTree = (categories: string[]): CategoryNode[] => {
        const rootNodes: CategoryNode[] = [];
        const sortedCats = [...categories].sort(); // Ensure parents come before children if strict naming used

        sortedCats.forEach(catPath => {
            const parts = catPath.split(CATEGORY_SEPARATOR);
            const name = parts[parts.length - 1];
            const parentPath = parts.slice(0, parts.length - 1).join(CATEGORY_SEPARATOR);
            
            const newNode: CategoryNode = { name, fullPath: catPath, children: [] };

            if (parentPath === "") {
                rootNodes.push(newNode);
            } else {
                // Find parent in the existing tree (recursive search)
                const findParent = (nodes: CategoryNode[]): CategoryNode | undefined => {
                    for (const node of nodes) {
                        if (node.fullPath === parentPath) return node;
                        const found = findParent(node.children);
                        if (found) return found;
                    }
                    return undefined;
                };
                
                const parentNode = findParent(rootNodes);
                if (parentNode) {
                    parentNode.children.push(newNode);
                } else {
                    // Fallback: if parent doesn't exist (shouldn't happen in valid data), treat as root
                    rootNodes.push(newNode);
                }
            }
        });
        return rootNodes;
    };

    const toggleExpand = (path: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    };

    const categoryTree = useMemo(() => buildCategoryTree(content.navCategories), [content.navCategories]);

    // Handlers
    const handleEditClick = (p: Product) => { 
        setEditingProduct(p); 
        setEditTags(p.tags.join(', '));
        setEditColors(p.colors ? p.colors.join(', ') : 'White');
        setEditAliases(p.aliases || []);
        const specs = p.itemSpecifics ? Object.entries(p.itemSpecifics).map(([key, value]) => ({ key, value })) : [];
        setEditSpecifics(specs);
    };

    const handleManualAdd = () => { 
        setEditingProduct({ 
            id: crypto.randomUUID(), 
            title: 'New Product', 
            description: '', 
            slug: '', 
            price: 29.99, 
            category: 'Mug', 
            hierarchy: ['Mug'], 
            tags: [], 
            images: [], 
            sizes: ['11oz'], 
            colors: ['White'], 
            stock: 100, 
            createdAt: Date.now(), 
            sku: `SKU-${Date.now()}`,
            isHidden: true // Default Hidden
        }); 
        setEditTags(''); 
        setEditColors('White');
        setEditAliases([]);
        setEditSpecifics([]);
    };
    
    const handleUpdateProduct = async () => { 
        if (!editingProduct) return;
        try {
            const specsMap: Record<string, string> = {};
            editSpecifics.forEach(s => {
                if(s.key.trim() && s.value.trim()) specsMap[s.key.trim()] = s.value.trim();
            });

            await adminMiddleware.inventory.updateProduct({ 
                ...editingProduct, 
                slug: slugify(editingProduct.slug || editingProduct.title),
                tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
                colors: editColors.split(',').map(c => c.trim()).filter(Boolean),
                aliases: editAliases,
                itemSpecifics: specsMap
            });
            setEditingProduct(null); 
            await onRefresh();
            showToast("Product saved successfully.");
        } catch (e) {
            showToast("Failed to save product.", "error");
        }
    };

    // Category Management Logic
    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        
        let finalName = newCategoryName.trim();
        if (parentCategory) {
            finalName = `${parentCategory}${CATEGORY_SEPARATOR}${finalName}`;
        }

        if (content.navCategories.includes(finalName)) return showToast("Category exists", "error");
        
        const updatedCategories = [...content.navCategories, finalName];
        const updatedContent = { ...content, navCategories: updatedCategories };

        onUpdateContent(() => updatedContent);
        
        try {
            await adminMiddleware.content.save(updatedContent);
            await onRefresh();
            setNewCategoryName('');
            setParentCategory(null);
            // Auto expand parent
            if (parentCategory) {
                setExpandedCategories(prev => new Set(prev).add(parentCategory));
            }
            showToast("Category Added");
        } catch (e) {
            showToast("Failed to save category", "error");
        }
    };

    const handleDeleteCategory = (cat: string) => {
        setConfirmModal({
            title: "Delete Category",
            message: `Are you sure you want to delete category "${cat}"? This will also delete all sub-categories (e.g. ${cat} > Child). Products in these categories will remain but may need updating.`,
            isDestructive: true,
            onConfirm: async () => {
                // Delete category AND all its children paths
                const updatedCategories = content.navCategories.filter(n => n !== cat && !n.startsWith(cat + CATEGORY_SEPARATOR));
                const updatedContent = { ...content, navCategories: updatedCategories };

                onUpdateContent(() => updatedContent);

                try {
                    await adminMiddleware.content.save(updatedContent);
                    await onRefresh();
                    showToast("Category & Sub-categories Removed");
                } catch (e) {
                    showToast("Failed to delete category", "error");
                }
                setConfirmModal(null);
            }
        });
    };

    const handleRenameCategory = async () => {
        if (!renameCategoryMap || !renameCategoryMap.new.trim()) return;
        const { old, new: newName } = renameCategoryMap;
        
        // Construct new FULL path.
        // If 'old' is "A > B", and we rename to "C", we want "A > C".
        // If 'old' is "A", rename to "B", we want "B".
        const parts = old.split(CATEGORY_SEPARATOR);
        parts.pop(); // Remove old name
        const parentPath = parts.join(CATEGORY_SEPARATOR);
        const newFullPath = parentPath ? `${parentPath}${CATEGORY_SEPARATOR}${newName}` : newName;

        if (content.navCategories.includes(newFullPath)) {
            showToast("Category name already exists in this level", "error");
            return;
        }

        // 1. Update Content List (Rename target AND all children)
        const updatedCategories = content.navCategories.map(cat => {
            if (cat === old) return newFullPath;
            if (cat.startsWith(old + CATEGORY_SEPARATOR)) {
                return cat.replace(old + CATEGORY_SEPARATOR, newFullPath + CATEGORY_SEPARATOR);
            }
            return cat;
        });

        const updatedContent = { ...content, navCategories: updatedCategories };
        onUpdateContent(() => updatedContent);

        try {
            await adminMiddleware.content.save(updatedContent);

            // 2. Update All Products matching Old Category or Sub-categories
            // Note: Product category is a string. If it matches strictly or is a child path.
            const productsToUpdate = products.filter(p => p.category === old || p.category.startsWith(old + CATEGORY_SEPARATOR));
            
            if (productsToUpdate.length > 0) {
                showToast(`Updating ${productsToUpdate.length} products...`);
                await Promise.all(productsToUpdate.map(p => {
                    let newCat = p.category;
                    if (newCat === old) newCat = newFullPath as any;
                    else if (newCat.startsWith(old + CATEGORY_SEPARATOR)) {
                        newCat = newCat.replace(old + CATEGORY_SEPARATOR, newFullPath + CATEGORY_SEPARATOR) as any;
                    }
                    return adminMiddleware.inventory.updateProduct({ ...p, category: newCat });
                }));
            }
            
            await onRefresh();
            setRenameCategoryMap(null);
            showToast("Category Renamed Successfully");
        } catch (e) {
            showToast("Failed to rename category", "error");
        }
    };

    const handleSaveSpecificsTemplate = async () => {
        setPromptModal({
            title: "Save Template",
            message: "Enter a name for this specifics template:",
            onConfirm: async (name) => {
                const specsMap: Record<string, string> = {};
                editSpecifics.forEach(s => {
                    if(s.key.trim() && s.value.trim()) specsMap[s.key.trim()] = s.value.trim();
                });
                
                const currentContent = await db.getStoreContent();
                const newTemplate: ItemSpecificTemplate = { id: crypto.randomUUID(), name, specifics: specsMap };
                const newTemplates = [...(currentContent.itemSpecificTemplates || []), newTemplate];
                await db.saveStoreContent({ ...currentContent, itemSpecificTemplates: newTemplates });
                setSpecificsTemplates(newTemplates);
                setPromptModal(null);
                showToast("Template Saved");
            }
        });
    };

    // Correct Bulk Apply Logic with Concurrency
    const executeBulkUpdate = async () => {
        setIsBulkSaving(true);
        const productsToUpdate = products.filter(p => selectedProducts.has(p.id));
        setBulkProgressData({ processed: 0, total: productsToUpdate.length, startTime: Date.now() });

        try {
            const updates: Partial<Product> = {};
            
            // Standard Fields
            if (bulkChanges.price) updates.price = parseFloat(bulkChanges.price);
            if (bulkChanges.stock) updates.stock = parseInt(bulkChanges.stock);
            if (bulkChanges.category) updates.category = bulkChanges.category as any;
            if (bulkChanges.sizeGuideId) updates.sizeGuideId = bulkChanges.sizeGuideId === 'none' ? undefined : bulkChanges.sizeGuideId;
            if (bulkChanges.shippingTemplateId) updates.shippingTemplateId = bulkChanges.shippingTemplateId === 'global' ? undefined : bulkChanges.shippingTemplateId;
            if (bulkChanges.isHidden) updates.isHidden = bulkChanges.isHidden === 'true'; // Apply Visibility
            
            // Marketing Flags
            if (bulkChanges.isFeatured) updates.isFeatured = bulkChanges.isFeatured === 'true';
            if (bulkChanges.isClearance) updates.isClearance = bulkChanges.isClearance === 'true';
            if (bulkChanges.isBogo) updates.isBogo = bulkChanges.isBogo === 'true';

            // Arrays
            if (bulkChanges.colors) updates.colors = bulkChanges.colors.split(',').map(c => c.trim()).filter(Boolean);
            if (bulkChanges.tags) updates.tags = bulkChanges.tags.split(',').map(t => t.trim()).filter(Boolean);
            if (bulkChanges.sizes) updates.sizes = bulkChanges.sizes.split(',').map(s => s.trim()).filter(Boolean);
            
            // Specs Logic
            let specsUpdate: Record<string, string> | null = null;
            
            // 1. Template
            if (bulkChanges.specificsTemplateId) {
                const template = specificsTemplates.find(t => t.id === bulkChanges.specificsTemplateId);
                if (template) specsUpdate = { ...template.specifics };
            }
            
            // 2. Manual CSV Overrides "Key:Value, Key2:Value2"
            if (bulkChanges.attributes) {
                const manualSpecs: Record<string, string> = {};
                bulkChanges.attributes.split(',').forEach(pair => {
                    // Support : or = separator
                    const separatorIndex = pair.indexOf(':') > -1 ? pair.indexOf(':') : pair.indexOf('=');
                    if (separatorIndex > -1) {
                        const key = pair.substring(0, separatorIndex).trim();
                        const value = pair.substring(separatorIndex + 1).trim();
                        if (key && value) manualSpecs[key] = value;
                    }
                });
                // Manual overrides template if both present
                specsUpdate = { ...(specsUpdate || {}), ...manualSpecs };
            }

            // Convert set to array to iterate
            // We use a queue-based approach for concurrency to speed up processing
            const queue = [...productsToUpdate];
            const CONCURRENCY_LIMIT = 5; // Process 5 at a time
            const activeWorkers = [];

            const worker = async () => {
                while (queue.length > 0) {
                    const p = queue.pop();
                    if (!p) break;

                    const finalUpdates = { ...updates };
                    if (specsUpdate) {
                        // Merge with existing specs so we don't lose unrelated attributes
                        finalUpdates.itemSpecifics = { ...p.itemSpecifics, ...specsUpdate };
                    }

                    try {
                        await adminMiddleware.inventory.updateProduct({ ...p, ...finalUpdates });
                        setBulkProgressData(prev => ({ ...prev, processed: prev.processed + 1 }));
                    } catch (e) {
                        console.error(`Failed to update product ${p.id}`, e);
                    }
                }
            };

            // Start workers
            for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
                activeWorkers.push(worker());
            }

            await Promise.all(activeWorkers);

            await onRefresh();
            // Reset form
            setBulkChanges({ 
                price: '', stock: '', category: '', sizeGuideId: '', shippingTemplateId: '', specificsTemplateId: '', colors: '', tags: '', sizes: '', attributes: '', isHidden: '',
                isFeatured: '', isClearance: '', isBogo: '' 
            });
            setSelectedProducts(new Set()); 
            showToast(`Updated ${productsToUpdate.length} products successfully.`);
        } catch (e) {
            console.error(e);
            showToast("Failed to apply bulk updates.", "error");
        } finally {
            setIsBulkSaving(false);
            setConfirmModal(null); // Close modal
        }
    };

    const handleBulkApply = async () => {
        if (selectedProducts.size === 0) return;
        
        setConfirmModal({
            title: "Apply Bulk Updates",
            message: `Apply changes to ${selectedProducts.size} products? This cannot be undone.`,
            onConfirm: executeBulkUpdate // Pass function reference, don't execute
        });
    };

    // New Helper for explicit hide/show bulk buttons
    const handleBulkVisibility = (hidden: boolean) => {
        setBulkChanges(prev => ({ ...prev, isHidden: hidden ? 'true' : 'false' }));
        // Trigger modal directly
        setConfirmModal({
            title: hidden ? "Hide Products" : "Publish Products",
            message: `${hidden ? "Hide" : "Publish"} ${selectedProducts.size} selected products?`,
            onConfirm: async () => {
                setIsBulkSaving(true);
                const productsToUpdate = products.filter(p => selectedProducts.has(p.id));
                setBulkProgressData({ processed: 0, total: productsToUpdate.length, startTime: Date.now() });

                // Parallel Processing for Visibility Toggle
                const queue = [...productsToUpdate];
                const CONCURRENCY_LIMIT = 5;
                const workers = [];

                const worker = async () => {
                    while (queue.length > 0) {
                        const p = queue.pop();
                        if (!p) break;
                        try {
                            await adminMiddleware.inventory.updateProduct({ ...p, isHidden: hidden });
                            setBulkProgressData(prev => ({ ...prev, processed: prev.processed + 1 }));
                        } catch (e) { console.error(e); }
                    }
                };

                for(let i=0; i<CONCURRENCY_LIMIT; i++) workers.push(worker());
                
                try {
                    await Promise.all(workers);
                    await onRefresh();
                    setSelectedProducts(new Set());
                    showToast(`Updated visibility for ${productsToUpdate.length} products.`);
                } finally {
                    setIsBulkSaving(false);
                    setConfirmModal(null);
                }
            }
        });
    };

    const toggleProductVisibility = async (p: Product) => {
        try {
            await adminMiddleware.inventory.updateProduct({ ...p, isHidden: !p.isHidden });
            await onRefresh();
        } catch (e) {
            showToast("Failed to toggle visibility", "error");
        }
    };

    // Alias Handlers
    const handleGenerateAliases = (text: string) => {
        // AI returns text, let's split it assuming comma or newlines
        const raw = text.split(/,|\n/).map(s => s.trim()).filter(Boolean);
        // Clean and append UUID
        const formatted = raw.map(s => {
            const base = slugify(s);
            const uniqueSuffix = Math.random().toString(36).substring(2, 6); // e.g. 'x9a1'
            return `${base}-${uniqueSuffix}`;
        });
        setEditAliases(prev => [...prev, ...formatted]);
    };

    const handleAddAlias = () => {
        if (newAlias) {
            setEditAliases([...editAliases, slugify(newAlias)]);
            setNewAlias('');
        }
    };

    // Image Handlers
    const handleImageDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedImageIndex === null || !editingProduct) return;
        const newImages = [...editingProduct.images];
        const item = newImages[draggedImageIndex];
        newImages.splice(draggedImageIndex, 1);
        newImages.splice(dropIndex, 0, item);
        setEditingProduct({ ...editingProduct, images: newImages });
        setDraggedImageIndex(null);
    };

    const handleAddImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && editingProduct) {
            const files = Array.from(e.target.files) as File[];
            setIsAnalyzingImage(true);
            
            try {
                const newBase64s = await Promise.all(files.map(f => toBase64(f)));
                const analysis = await adminMiddleware.inventory.analyzeProductImage(files[0]);
                
                setEditingProduct(prev => {
                    if (!prev) return null;
                    const updated = { ...prev };
                    if (analysis.category) updated.category = analysis.category;
                    
                    if (updated.title === 'New Product' || !updated.description) {
                        if(analysis.title) updated.title = analysis.title;
                        if(analysis.description) updated.description = analysis.description;
                        if(analysis.tags) updated.tags = analysis.tags;
                        if(analysis.itemSpecifics) updated.itemSpecifics = analysis.itemSpecifics;
                    }
                    
                    updated.images = [...updated.images, ...newBase64s];
                    return updated;
                });

            } catch (e) {
                console.error("Image upload/analysis failed", e);
                const newBase64s = await Promise.all(files.map(f => toBase64(f)));
                setEditingProduct(prev => prev ? ({ ...prev, images: [...prev.images, ...newBase64s] }) : null);
            } finally {
                setIsAnalyzingImage(false);
            }
        }
    };

    const handleRemoveImage = (index: number) => {
        if(!editingProduct) return;
        const newImages = editingProduct.images.filter((_, i) => i !== index);
        setEditingProduct({ ...editingProduct, images: newImages });
    };

    const handleMakeMainImage = (index: number) => {
        if(!editingProduct) return;
        const newImages = [...editingProduct.images];
        const item = newImages[index];
        newImages.splice(index, 1);
        newImages.unshift(item);
        setEditingProduct({ ...editingProduct, images: newImages });
    };

    // Crop Handlers
    const startCropping = (index: number) => {
        if(!editingProduct) return;
        setCroppingId(index);
        setCropImage(editingProduct.images[index]);
        setCropScale(1);
        setCropPosition({ x: 0, y: 0 });
    };

    const handleCropSave = () => {
        if (cropCanvasRef.current && editingProduct && croppingId !== null) {
            const finalImage = cropCanvasRef.current.toDataURL('image/jpeg', 0.9);
            const newImages = [...editingProduct.images];
            newImages[croppingId] = finalImage;
            setEditingProduct({ ...editingProduct, images: newImages });
            setCroppingId(null);
            setCropImage(null);
        }
    };

    const handleCropMouseDown = (e: React.MouseEvent) => {
        setIsDraggingCrop(true);
        setDragStart({ x: e.clientX - cropPosition.x, y: e.clientY - cropPosition.y });
    };
    
    const handleCropMouseMove = (e: React.MouseEvent) => {
        if (isDraggingCrop) {
            setCropPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        }
    };

    // Crop Effect
    useEffect(() => {
        if (cropImage && cropCanvasRef.current) {
            const canvas = cropCanvasRef.current;
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.src = cropImage;
            img.onload = () => {
                if(!ctx) return;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0,0, canvas.width, canvas.height);

                const w = img.width * cropScale;
                const h = img.height * cropScale;
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                const x = cx - (w / 2) + cropPosition.x;
                const y = cy - (h / 2) + cropPosition.y;

                ctx.drawImage(img, x, y, w, h);
            };
        }
    }, [cropImage, cropScale, cropPosition]);

    const handleGenerateLifestyle = async () => {
        if(!editingProduct?.images[0] || !lifestylePrompt) return;
        setIsGeneratingLifestyle(true);
        try {
            const newImg = await adminMiddleware.inventory.generateLifestyleImage(editingProduct.images[0], lifestylePrompt);
            setEditingProduct({ ...editingProduct, images: [...editingProduct.images, newImg] });
            setLifestylePrompt('');
        } catch(e) {
            showToast("Generation failed. Please try a different prompt.", "error");
        } finally {
            setIsGeneratingLifestyle(false);
        }
    };

    const handleAnalyzeImage = async () => { 
        if (!editingProduct?.images[0]) return; 
        showToast("Feature requires new upload for analysis.", "error");
    };

    const toggleSelect = (id: string) => { const next = new Set(selectedProducts); if (next.has(id)) next.delete(id); else next.add(id); setSelectedProducts(next); };
    
    const deleteSelected = async () => { 
        if (selectedProducts.size === 0) return;
        setConfirmModal({
            title: "Delete Products",
            message: `Are you sure you want to delete ${selectedProducts.size} products? This cannot be undone.`,
            isDestructive: true,
            onConfirm: async () => {
                await adminMiddleware.inventory.deleteProducts(Array.from(selectedProducts)); 
                setSelectedProducts(new Set()); 
                await onRefresh(); 
                showToast("Products deleted successfully.");
                setConfirmModal(null);
            }
        });
    };

    const downloadPrintFile = (product: Product) => {
        if (!product.designAsset) return;
        const link = document.createElement('a');
        link.href = product.designAsset;
        link.download = `${product.sku || product.id}-print-file.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // AI Generators
    const runDirectBulkUpload = async () => {
        if (directFiles.length === 0) return;
        setIsDirectUploading(true); 
        setBulkProgress(0);
        try {
            const count = await adminMiddleware.inventory.processBulkUpload(directFiles, setBulkProgress);
            setDirectFiles([]); 
            await onRefresh(); 
            showToast(`Uploaded ${count} products successfully.`);
        } catch (e) { 
            showToast("Upload failed", "error"); 
        } finally { 
            setIsDirectUploading(false); 
        }
    };

    const handleBulkMockupUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { 
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setBulkMockup(await toBase64(file));
            
            // Smart Analyze Context
            setIsAnalyzingMockup(true);
            try {
                const res = await adminMiddleware.inventory.analyzeProductImage(file);
                if (res.category) {
                    setMockupCategory(res.category);
                }
            } catch(e) {
                console.warn("Smart mockup analysis failed", e);
            } finally {
                setIsAnalyzingMockup(false);
            }
        }
    };
    
    const handleBulkDesignsUpload = (e: React.ChangeEvent<HTMLInputElement>) => { 
        if (e.target.files) setBulkFiles(Array.from(e.target.files)); 
    };

    const handleMockupMouseMove = (e: React.MouseEvent) => {
        if (!dragMode || !previewRef.current) return;
        const rect = previewRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        if (dragMode === 'move') {
            setOverlayX(Math.max(0, Math.min(1, x)));
            setOverlayY(Math.max(0, Math.min(1, y)));
        } else if (dragMode === 'scale') {
            // Distance from center determines scale (symmetric scaling)
            const dist = Math.abs(x - overlayX);
            // Constrain between 10% and 150% container width (approx)
            const newScale = Math.max(0.1, Math.min(1.5, dist * 2));
            setOverlayScale(newScale);
        }
    };

    const runBulkMockupImport = async () => {
        if (!bulkMockup || bulkFiles.length === 0) return;
        setIsImporting(true); 
        setBulkProgress(0);
        try {
            const count = await adminMiddleware.inventory.processBulkMockups(
                bulkMockup, 
                bulkFiles, 
                { scale: overlayScale, x: overlayX, y: overlayY, category: mockupCategory || undefined }, 
                setBulkProgress
            );
            setBulkFiles([]); 
            setBulkMockup(null); 
            setMockupCategory(null);
            await onRefresh(); 
            showToast(`Successfully created ${count} mockup products.`);
        } catch (e) { 
            console.error(e); 
            showToast("Batch mockup processing failed.", "error"); 
        } finally { 
            setIsImporting(false); 
        }
    };

    const getOverlayStyle = () => {
        const baseWidth = overlayScale * 100;
        let height = baseWidth; // Default Square
        
        if (previewShape === 'portrait') height = baseWidth * 1.5;
        else if (previewShape === '3:4') height = baseWidth * 1.333;
        else if (previewShape === 'landscape') height = baseWidth * 0.66;

        return {
            width: `${baseWidth}%`,
            height: `${height}%`,
            left: `${overlayX * 100}%`,
            top: `${overlayY * 100}%`,
            transform: 'translate(-50%, -50%)'
        };
    };

    // Calculate Estimated Time Remaining
    const calculateEta = () => {
        if (bulkProgressData.processed === 0) return 0;
        const elapsed = (Date.now() - bulkProgressData.startTime) / 1000;
        const rate = bulkProgressData.processed / elapsed; // items per second
        const remaining = bulkProgressData.total - bulkProgressData.processed;
        return remaining / rate;
    };

    const eta = calculateEta();

    // -- Recursive Tree Render Component --
    const CategoryTreeItem: React.FC<{ node: CategoryNode, depth: number }> = ({ node, depth }) => {
        const isExpanded = expandedCategories.has(node.fullPath);
        const hasChildren = node.children.length > 0;
        const isRenaming = renameCategoryMap?.old === node.fullPath;

        return (
            <div className="select-none">
                <div 
                    className={`flex justify-between items-center p-2 border-b hover:bg-gray-50 group ${parentCategory === node.fullPath ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'border-l-4 border-transparent'}`}
                    style={{ paddingLeft: `${(depth * 16) + 8}px` }}
                >
                    {isRenaming ? (
                        <div className="flex items-center gap-2 flex-1">
                            <input 
                                autoFocus 
                                className="border p-1 text-sm rounded flex-1" 
                                value={renameCategoryMap.new} 
                                onChange={e => setRenameCategoryMap({...renameCategoryMap, new: e.target.value})}
                                onKeyDown={e => e.key === 'Enter' && handleRenameCategory()}
                                onClick={e => e.stopPropagation()}
                            />
                            <button onClick={(e) => { e.stopPropagation(); handleRenameCategory(); }} className="text-green-600 hover:bg-green-50 p-1 rounded"><Check className="h-4 w-4"/></button>
                            <button onClick={(e) => { e.stopPropagation(); setRenameCategoryMap(null); }} className="text-gray-400 hover:bg-gray-100 p-1 rounded"><X className="h-4 w-4"/></button>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => toggleExpand(node.fullPath)}>
                                {hasChildren ? (
                                    isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400"/> : <ChevronRight className="h-4 w-4 text-gray-400"/>
                                ) : (
                                    <div className="w-4 h-4" /> 
                                )}
                                <span className="font-medium text-sm">{node.name}</span>
                            </div>
                            
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setParentCategory(node.fullPath); setNewCategoryName(''); }} 
                                    className="p-1 text-green-600 hover:bg-green-50 rounded" 
                                    title="Add Sub-Category"
                                >
                                    <CornerDownRight className="h-3 w-3"/>
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setRenameCategoryMap({old: node.fullPath, new: node.name}); }} 
                                    className="p-1 text-blue-500 hover:bg-blue-50 rounded" 
                                    title="Rename"
                                >
                                    <Edit className="h-3 w-3"/>
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteCategory(node.fullPath); }} 
                                    className="p-1 text-red-500 hover:bg-red-50 rounded" 
                                    title="Delete"
                                >
                                    <Trash2 className="h-3 w-3"/>
                                </button>
                            </div>
                        </>
                    )}
                </div>
                {hasChildren && isExpanded && (
                    <div>
                        {node.children.map(child => (
                            <CategoryTreeItem key={child.fullPath} node={child} depth={depth + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in relative">
             {/* Hover Zoom Overlay */}
             {hoveredImage && (
                <div 
                    className="fixed z-[100] bg-white p-2 shadow-2xl border border-gray-200 rounded-lg pointer-events-none animate-in fade-in zoom-in-95 duration-150"
                    style={{ 
                        left: hoveredImage.x + 20, 
                        top: hoveredImage.y - 100,
                        maxWidth: '300px'
                    }}
                >
                    <img src={hoveredImage.src} className="w-full h-auto rounded" />
                </div>
             )}

             {/* Custom Confirm Modal */}
             {confirmModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95">
                        <div className="flex items-center gap-3 mb-4">
                            {confirmModal.isDestructive ? <AlertTriangle className="h-6 w-6 text-red-500"/> : <Check className="h-6 w-6 text-blue-500"/>}
                            <h3 className="font-bold text-lg">{confirmModal.title}</h3>
                        </div>
                        
                        {isBulkSaving ? (
                            <div className="space-y-4">
                                <div className="flex justify-between text-xs font-bold text-gray-500">
                                    <span>Processing...</span>
                                    <span>{bulkProgressData.processed} / {bulkProgressData.total}</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-blue-600 transition-all duration-300 ease-out" 
                                        style={{ width: `${(bulkProgressData.processed / bulkProgressData.total) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-blue-600 text-xs flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Updating records</p>
                                    {eta > 0 && <span className="text-xs text-gray-400 font-mono"><Clock className="h-3 w-3 inline mr-1"/>Est. {Math.ceil(eta)}s</span>}
                                </div>
                            </div>
                        ) : (
                            <>
                                <p className="text-gray-600 mb-6 text-sm">{confirmModal.message}</p>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setConfirmModal(null)} className="px-4 py-2 border rounded text-sm font-bold hover:bg-gray-50">Cancel</button>
                                    <button onClick={confirmModal.onConfirm} className={`px-4 py-2 text-white rounded text-sm font-bold ${confirmModal.isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-black hover:bg-gray-800'}`}>Confirm</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
             )}

             {/* Custom Prompt Modal */}
             {promptModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95">
                        <h3 className="font-bold text-lg mb-2">{promptModal.title}</h3>
                        <p className="text-gray-600 mb-4 text-sm">{promptModal.message}</p>
                        <input 
                            className="w-full border p-2 rounded mb-4 focus:ring-black focus:border-black" 
                            defaultValue={promptModal.defaultValue} 
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') promptModal.onConfirm(e.currentTarget.value);
                            }}
                            id="prompt-input"
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setPromptModal(null)} className="px-4 py-2 border rounded text-sm font-bold hover:bg-gray-50">Cancel</button>
                            <button 
                                onClick={() => {
                                    const input = document.getElementById('prompt-input') as HTMLInputElement;
                                    if(input && input.value) promptModal.onConfirm(input.value);
                                }} 
                                className="px-4 py-2 bg-black text-white rounded text-sm font-bold hover:bg-gray-800"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
             )}

             {/* Product Edit Modal */}
             {editingProduct && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col animate-in zoom-in-95">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50 sticky top-0 z-10">
                            <h2 className="font-bold text-lg">{editingProduct.title || 'New Product'}</h2>
                            <div className="flex items-center gap-4">
                                {/* Single Product Visibility Toggle */}
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <span className="text-xs font-bold uppercase text-gray-500">{editingProduct.isHidden ? 'Hidden' : 'Visible'}</span>
                                    <div className={`relative w-10 h-5 rounded-full transition-colors ${editingProduct.isHidden ? 'bg-gray-300' : 'bg-green-500'}`}>
                                        <input 
                                            type="checkbox" 
                                            className="hidden" 
                                            checked={!editingProduct.isHidden} 
                                            onChange={e => setEditingProduct({...editingProduct, isHidden: !e.target.checked})} 
                                        />
                                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editingProduct.isHidden ? '' : 'translate-x-5'}`}></div>
                                    </div>
                                </label>
                                <button onClick={() => setEditingProduct(null)}><X className="h-5 w-5"/></button>
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* ... (Existing modal content remains unchanged) ... */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-end">
                                    <label className="text-xs font-bold uppercase text-gray-500">Product Images</label>
                                    <label className="text-xs text-blue-600 font-bold uppercase cursor-pointer hover:underline flex items-center gap-1">
                                        {isAnalyzingImage ? <Loader2 className="h-3 w-3 animate-spin"/> : <Upload className="h-3 w-3"/>} Add Photos
                                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleAddImages} />
                                    </label>
                                </div>
                                <div className="grid grid-cols-4 sm:grid-cols-5 gap-4">
                                    {editingProduct.images.map((img, idx) => (
                                        <div 
                                            key={idx}
                                            draggable
                                            onDragStart={() => setDraggedImageIndex(idx)}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => handleImageDrop(e, idx)}
                                            className="aspect-square relative group bg-gray-100 border rounded overflow-hidden cursor-move hover:border-black transition-colors"
                                        >
                                            <img src={img} className="w-full h-full object-cover" />
                                            {/* Overlays */}
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-end p-1">
                                                <div className="flex gap-1 mb-auto">
                                                    <button onClick={() => startCropping(idx)} className="p-1 bg-white rounded-full text-gray-600 hover:text-black hover:bg-gray-50" title="Crop"><Crop className="h-3 w-3"/></button>
                                                    <button onClick={() => handleRemoveImage(idx)} className="p-1 bg-white rounded-full text-red-500 hover:bg-red-50"><Trash2 className="h-3 w-3"/></button>
                                                </div>
                                                {idx !== 0 && (
                                                    <button onClick={() => handleMakeMainImage(idx)} className="p-1 bg-white rounded-full text-blue-600 hover:bg-blue-50 mt-auto" title="Set as Main"><Star className="h-3 w-3 fill-current"/></button>
                                                )}
                                            </div>
                                            {idx === 0 && <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] uppercase font-bold text-center py-1">Main Image</div>}
                                        </div>
                                    ))}
                                    {editingProduct.images.length === 0 && (
                                        <div className="col-span-4 h-32 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-400">
                                            <ImageIcon className="h-8 w-8 mb-2 opacity-50"/>
                                            <span className="text-xs">No images uploaded</span>
                                        </div>
                                    )}
                                </div>
                                {/* ... Rest of modal ... */}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <input placeholder="Title" className="border p-2 w-full" value={editingProduct.title} onChange={e => setEditingProduct({...editingProduct, title: e.target.value})} />
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold uppercase text-gray-500 whitespace-nowrap">
                                        Slug 
                                        <AITextGenerator className="p-1 h-5 w-5 inline-flex ml-1" context={`Generate an SEO friendly URL slug for ${editingProduct.title}`} type="sku" onGenerate={(t) => setEditingProduct({...editingProduct, slug: slugify(t)})}/>
                                    </label>
                                    <input placeholder="URL Slug" className="border p-2 w-full font-mono text-sm" value={editingProduct.slug || ''} onChange={e => setEditingProduct({...editingProduct, slug: e.target.value})} />
                                </div>
                            </div>

                            {/* SEO & Aliases */}
                            <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold uppercase text-gray-500 flex items-center gap-1"><Globe className="h-3 w-3"/> SEO Aliases</label>
                                    <AITextGenerator 
                                        className="p-1 text-xs" 
                                        context={`Generate 5 unique, seo-friendly slug aliases for "${editingProduct.title}". They should be hyphenated.`} 
                                        type="slug aliases"
                                        onGenerate={handleGenerateAliases}
                                    />
                                </div>
                                <div className="flex gap-2 mb-2">
                                    <input 
                                        className="flex-1 border p-1.5 text-sm rounded" 
                                        placeholder="Add manual alias (e.g. funny-cat-mug-sale)"
                                        value={newAlias}
                                        onChange={e => setNewAlias(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddAlias()}
                                    />
                                    <button onClick={handleAddAlias} className="px-3 bg-black text-white rounded text-xs font-bold uppercase">Add</button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {editAliases.map(alias => (
                                        <span key={alias} className="bg-white border border-blue-200 text-blue-700 px-2 py-1 rounded text-xs flex items-center gap-1 font-mono">
                                            /{alias}
                                            <button onClick={() => setEditAliases(prev => prev.filter(a => a !== alias))} className="hover:text-red-500 ml-1"><X className="h-3 w-3"/></button>
                                        </span>
                                    ))}
                                </div>
                                <p className="text-[10px] text-gray-400 mt-2">These alternate URLs will all redirect to this product page. Great for A/B testing or keywords.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold uppercase text-gray-500">Price</label>
                                    <input type="number" placeholder="Price" className="border p-2 w-full" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-gray-500">Original Price</label>
                                    <input type="number" placeholder="Original Price" className="border p-2 w-full" value={editingProduct.originalPrice || ''} onChange={e => setEditingProduct({...editingProduct, originalPrice: parseFloat(e.target.value)})} />
                                </div>
                            </div>
                            
                            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg">
                                <label className="text-xs font-bold uppercase text-indigo-800 mb-3 block flex items-center gap-1"><Star className="h-3 w-3"/> Marketing Flags</label>
                                <div className="flex gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={editingProduct.isFeatured || false} onChange={e => setEditingProduct({...editingProduct, isFeatured: e.target.checked})} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 rounded"/>
                                        <span className="text-sm font-medium text-gray-700">Featured</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={editingProduct.isClearance || false} onChange={e => setEditingProduct({...editingProduct, isClearance: e.target.checked})} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 rounded"/>
                                        <span className="text-sm font-medium text-gray-700">Clearance</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={editingProduct.isBogo || false} onChange={e => setEditingProduct({...editingProduct, isBogo: e.target.checked})} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 rounded"/>
                                        <span className="text-sm font-medium text-gray-700">Buy 1 Get 1</span>
                                    </label>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold uppercase text-gray-500 flex justify-between items-center mb-1">
                                        SKU 
                                        <AITextGenerator className="p-1 h-5 w-5" context={`Generate a unique SKU for a ${editingProduct.category} product titled ${editingProduct.title}`} type="sku" onGenerate={(t) => setEditingProduct({...editingProduct, sku: t})}/>
                                    </label>
                                    <input placeholder="SKU" className="border p-2 w-full" value={editingProduct.sku} onChange={e => setEditingProduct({...editingProduct, sku: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Category</label>
                                    <select className="border p-2 w-full" value={editingProduct.category} onChange={e => setEditingProduct({...editingProduct, category: e.target.value as any})}>
                                        {content.navCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold uppercase text-gray-500 mb-1 flex justify-between">Description <AITextGenerator className="p-1 h-6 w-6" context={`Write a product description for: ${editingProduct.title}`} onGenerate={t => setEditingProduct({...editingProduct, description: t})}/></label>
                                <textarea placeholder="Description" className="border p-2 w-full h-24" value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold uppercase text-gray-500 mb-1 flex justify-between">
                                        Tags (Comma separated)
                                        <AITextGenerator className="p-1 h-5 w-5" context={`Generate 5 comma separated SEO tags for a ${editingProduct.category} titled ${editingProduct.title}`} type="tags" onGenerate={(t) => setEditTags(t)}/>
                                    </label>
                                    <input placeholder="Tags" className="border p-2 w-full" value={editTags} onChange={e => setEditTags(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-gray-500 mb-1 flex justify-between items-center">
                                        Colors <Palette className="h-3 w-3"/>
                                    </label>
                                    <input placeholder="White, Black, Blue..." className="border p-2 w-full" value={editColors} onChange={e => setEditColors(e.target.value)} />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold uppercase text-gray-500 mb-1">Size Guide Template</label>
                                    <select className="border p-2 w-full text-sm" value={editingProduct.sizeGuideId || ''} onChange={e => setEditingProduct({...editingProduct, sizeGuideId: e.target.value})}>
                                        <option value="">None</option>
                                        {sizeGuides?.map(g => <option key={g.id} value={g.id}>{g.title} ({g.category})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-gray-500 mb-1">Shipping Template</label>
                                    <select className="border p-2 w-full text-sm" value={editingProduct.shippingTemplateId || ''} onChange={e => setEditingProduct({...editingProduct, shippingTemplateId: e.target.value})}>
                                        <option value="">Global Default</option>
                                        {(content.shippingTemplates || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-3 rounded border border-gray-200">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold uppercase text-gray-500">Item Specifics</label>
                                    <div className="flex gap-2">
                                        <select 
                                            className="text-[10px] border rounded p-1" 
                                            onChange={(e) => {
                                                const t = specificsTemplates.find(x => x.id === e.target.value);
                                                if(t) setEditSpecifics(Object.entries(t.specifics).map(([key, value]) => ({key, value})));
                                                e.target.value = "";
                                            }}
                                        >
                                            <option value="">Load Template...</option>
                                            {specificsTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                        <button onClick={handleSaveSpecificsTemplate} className="text-[10px] text-blue-600 underline">Save as Template</button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {editSpecifics.map((spec, index) => (
                                        <div key={index} className="flex gap-2">
                                            <input className="border p-1 text-sm w-1/3" placeholder="Key (e.g. Material)" value={spec.key} onChange={e => { const n = [...editSpecifics]; n[index].key = e.target.value; setEditSpecifics(n); }} />
                                            <input className="border p-1 text-sm flex-1" placeholder="Value (e.g. Cotton)" value={spec.value} onChange={e => { const n = [...editSpecifics]; n[index].value = e.target.value; setEditSpecifics(n); }} />
                                            <button onClick={() => setEditSpecifics(editSpecifics.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-700"><Trash2 className="h-3 w-3"/></button>
                                        </div>
                                    ))}
                                    <button onClick={() => setEditSpecifics([...editSpecifics, {key: '', value: ''}])} className="text-xs flex items-center gap-1 text-gray-500 hover:text-black mt-2"><Plus className="h-3 w-3"/> Add Attribute</button>
                                </div>
                            </div>

                            {editingProduct.designAsset && (
                                <div className="p-3 bg-gray-100 rounded border border-gray-200">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold uppercase text-gray-600">Print File Available</span>
                                        <button onClick={() => downloadPrintFile(editingProduct)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                            <Download className="h-3 w-3" /> Download High-Res
                                        </button>
                                    </div>
                                    <img src={editingProduct.designAsset} className="h-20 object-contain mt-2 border bg-white" />
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
                            <button onClick={() => setEditingProduct(null)} className="px-4 py-2 border bg-white hover:bg-gray-100 text-sm font-bold uppercase">Cancel</button>
                            <button onClick={handleUpdateProduct} className="px-4 py-2 bg-black text-white hover:bg-gray-800 text-sm font-bold uppercase flex items-center gap-2"><Save className="h-4 w-4"/> Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Manager Modal */}
            {showCategoryManager && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg flex items-center gap-2"><Folder className="h-5 w-5 text-indigo-600"/> Manage Categories</h3>
                            <button onClick={() => setShowCategoryManager(false)}><X className="h-5 w-5"/></button>
                        </div>
                        
                        <div className="flex gap-2 mb-6">
                            {parentCategory && (
                                <div className="flex items-center gap-2 bg-gray-100 px-3 rounded text-sm text-gray-600 max-w-[150px]">
                                    <span className="truncate">{parentCategory}</span>
                                    <button onClick={() => setParentCategory(null)}><X className="h-3 w-3"/></button>
                                </div>
                            )}
                            <input 
                                className="flex-1 border rounded p-2 text-sm" 
                                placeholder={parentCategory ? "New Sub-Category Name" : "New Root Category Name"}
                                value={newCategoryName} 
                                onChange={e => setNewCategoryName(e.target.value)} 
                                onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                            />
                            <button onClick={handleAddCategory} className="bg-black text-white px-4 py-2 rounded text-xs font-bold uppercase hover:bg-gray-800"><Plus className="h-3 w-3"/> Add</button>
                        </div>

                        <div className="flex-1 overflow-y-auto border rounded bg-white">
                            {categoryTree.map(node => (
                                <CategoryTreeItem key={node.fullPath} node={node} depth={0} />
                            ))}
                            {categoryTree.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No categories found.</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* Crop Modal */}
            {croppingId !== null && cropImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><Crop className="h-4 w-4"/> Crop Image</h3>
                            <button onClick={() => setCroppingId(null)} className="text-gray-500 hover:text-black"><X className="h-4 w-4"/></button>
                        </div>
                        <div className="relative h-80 bg-gray-100 cursor-move overflow-hidden">
                            <canvas 
                                ref={cropCanvasRef} 
                                width={400} 
                                height={400} 
                                className="w-full h-full object-contain pointer-events-auto"
                                onMouseDown={handleCropMouseDown}
                                onMouseMove={handleCropMouseMove}
                                onMouseUp={() => setIsDraggingCrop(false)}
                                onMouseLeave={() => setIsDraggingCrop(false)}
                            />
                            <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-blue-400 opacity-50 flex items-center justify-center">
                                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded">1:1 Crop</span>
                            </div>
                        </div>
                        <div className="p-4 bg-white space-y-4">
                            <div>
                                <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Zoom / Scale</label>
                                <input 
                                    type="range" min="0.5" max="3" step="0.1" 
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    value={cropScale}
                                    onChange={(e) => setCropScale(parseFloat(e.target.value))}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setCroppingId(null)} className="flex-1 py-2 border rounded font-bold text-sm uppercase hover:bg-gray-50">Cancel</button>
                                <button onClick={handleCropSave} className="flex-1 py-2 bg-black text-white rounded font-bold text-sm uppercase hover:bg-gray-800 flex items-center justify-center gap-2"><Check className="h-4 w-4"/> Apply Crop</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 1. AI Product Generator (Restored) */}
            <AIProductGenerator onRefresh={onRefresh} />

            {/* 2. Bulk Mockup Generator (Restored) */}
            <div className="bg-white p-6 shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold font-display mb-4 flex items-center gap-2"><Layers className="h-5 w-5 text-blue-600" /> Batch Mockup Generator</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">1. Upload Base Mockup</label>
                            <input type="file" accept="image/*" onChange={handleBulkMockupUpload} className="block w-full text-xs" />
                            {isAnalyzingMockup && <p className="text-xs text-blue-600 mt-1 flex items-center gap-1 animate-pulse"><Scan className="h-3 w-3"/> AI Analyzing Product Type...</p>}
                            {mockupCategory && (
                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1 font-bold">
                                    <Check className="h-3 w-3"/> Detected: {mockupCategory}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">2. Upload Design Files (PNG/JPG)</label>
                            <input type="file" multiple accept="image/*" onChange={handleBulkDesignsUpload} className="block w-full text-xs" />
                            <p className="text-xs text-gray-400 mt-1">{bulkFiles.length} designs selected</p>
                        </div>
                        <div className="bg-blue-50 p-3 text-xs text-blue-800 rounded">
                            <p className="font-bold mb-1">Instructions:</p>
                            1. Upload a blank product image (Mockup).<br/>
                            2. Upload multiple artwork files.<br/>
                            3. Drag/Scale the red box on the right to define the print area.<br/>
                            4. Click Process to generate products automatically.
                        </div>
                        <button 
                            onClick={runBulkMockupImport} 
                            disabled={!bulkMockup || bulkFiles.length === 0 || isImporting}
                            className="w-full bg-blue-600 text-white py-3 font-bold uppercase rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isImporting ? 'Processing...' : `Process ${bulkFiles.length} Products`}
                        </button>
                    </div>

                    {/* Interactive Preview Canvas */}
                    <div className="flex flex-col gap-4">
                        <div className="relative bg-gray-100 border rounded flex items-center justify-center overflow-hidden h-80 select-none">
                            {bulkMockup ? (
                                <div 
                                    ref={previewRef}
                                    className="relative w-full h-full"
                                    onMouseMove={handleMockupMouseMove}
                                    onMouseUp={() => setDragMode(null)}
                                    onMouseLeave={() => setDragMode(null)}
                                >
                                    <img src={bulkMockup} className="w-full h-full object-contain pointer-events-none" />
                                    {/* Overlay Box */}
                                    <div 
                                        className="absolute border-2 border-red-500 bg-red-500/20 cursor-move flex items-center justify-center text-white text-xs font-bold group"
                                        style={getOverlayStyle()}
                                        onMouseDown={(e) => { e.preventDefault(); setDragMode('move'); }}
                                    >
                                        Design Area
                                        {/* Resize Handles */}
                                        <div 
                                            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-red-500 cursor-nwse-resize rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            onMouseDown={(e) => { e.stopPropagation(); setDragMode('scale'); }}
                                        />
                                        <div 
                                            className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-red-500 cursor-nwse-resize rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            onMouseDown={(e) => { e.stopPropagation(); setDragMode('scale'); }}
                                        />
                                        <div 
                                            className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-red-500 cursor-nesw-resize rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            onMouseDown={(e) => { e.stopPropagation(); setDragMode('scale'); }}
                                        />
                                        <div 
                                            className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-red-500 cursor-nesw-resize rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            onMouseDown={(e) => { e.stopPropagation(); setDragMode('scale'); }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="text-gray-400 text-xs text-center">
                                    <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    Upload a mockup to configure
                                </div>
                            )}
                        </div>
                        {/* Orientation Toggles */}
                        {bulkMockup && (
                            <div className="flex justify-center gap-2 flex-wrap">
                                <button onClick={() => setPreviewShape('square')} className={`px-3 py-1 text-xs font-bold uppercase border rounded ${previewShape === 'square' ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>Square (1:1)</button>
                                <button onClick={() => setPreviewShape('portrait')} className={`px-3 py-1 text-xs font-bold uppercase border rounded ${previewShape === 'portrait' ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>Portrait (2:3)</button>
                                <button onClick={() => setPreviewShape('3:4')} className={`px-3 py-1 text-xs font-bold uppercase border rounded ${previewShape === '3:4' ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>Portrait (3:4)</button>
                                <button onClick={() => setPreviewShape('landscape')} className={`px-3 py-1 text-xs font-bold uppercase border rounded ${previewShape === 'landscape' ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>Landscape (3:2)</button>
                            </div>
                        )}
                        {/* Scale Control */}
                        {bulkMockup && (
                            <div>
                                <label className="text-xs font-bold uppercase text-gray-500">Design Scale</label>
                                <input 
                                    type="range" min="0.1" max="1.5" step="0.05" 
                                    value={overlayScale} 
                                    onChange={e => setOverlayScale(parseFloat(e.target.value))} 
                                    className="w-full"
                                />
                            </div>
                        )}
                    </div>
                </div>
                {isImporting && (
                    <div className="mt-4 h-2 bg-gray-200 rounded overflow-hidden">
                        <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${bulkProgress}%` }}></div>
                    </div>
                )}
            </div>

            {/* 3. Direct Upload (Restored) */}
            <div className="bg-white p-6 shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold font-display mb-4 flex items-center gap-2"><Upload className="h-5 w-5 text-indigo-600" /> Direct Product Upload</h2>
                {/* ... Upload Logic ... */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="space-y-4">
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Select Images</label>
                        <input type="file" multiple accept="image/*" onChange={e => setDirectFiles(Array.from(e.target.files || []))} className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                        <button onClick={runDirectBulkUpload} disabled={directFiles.length===0 || isDirectUploading} className="w-full bg-indigo-600 text-white py-2 text-xs font-bold uppercase rounded hover:bg-indigo-700 disabled:opacity-50 flex justify-center items-center gap-2">{isDirectUploading ? <Loader2 className="h-3 w-3 animate-spin"/> : 'Upload & AI Tag'}</button>
                        {isDirectUploading && <div className="h-1 bg-gray-200 rounded"><div className="h-1 bg-indigo-600 rounded" style={{width: `${bulkProgress}%`}}/></div>}
                    </div>
                    <div className="bg-gray-50 p-4 border border-gray-200 text-xs text-gray-500 leading-relaxed"><strong>Note:</strong> Upload finished product images. AI will analyze them to create the listing.</div>
                </div>
            </div>

            {/* 4. Product List & Bulk Editing */}
            <div className="bg-white border border-gray-200 shadow-sm">
                
                {/* Bulk Actions Panel */}
                {selectedProducts.size > 0 && (
                    <div className="bg-indigo-50 border-b border-indigo-100 p-4 animate-in slide-in-from-top-2">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">{selectedProducts.size} Selected</span>
                                <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wide">Bulk Editor</h3>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleBulkVisibility(false)} className="bg-white border border-green-200 text-green-700 px-4 py-1.5 text-xs font-bold uppercase rounded hover:bg-green-50 flex items-center gap-1 shadow-sm"><Eye className="h-3 w-3"/> Publish All</button>
                                <button onClick={() => handleBulkVisibility(true)} className="bg-white border border-gray-300 text-gray-700 px-4 py-1.5 text-xs font-bold uppercase rounded hover:bg-gray-100 flex items-center gap-1 shadow-sm"><EyeOff className="h-3 w-3"/> Hide All</button>
                                <div className="w-px bg-indigo-200 mx-2"></div>
                                <button onClick={deleteSelected} className="bg-white border border-red-200 text-red-600 px-4 py-1.5 text-xs font-bold uppercase rounded hover:bg-red-50 flex items-center gap-1 shadow-sm"><Trash2 className="h-3 w-3"/> Delete</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 bg-white rounded-lg border border-indigo-100 shadow-sm">
                            {/* Group 1: Core Data */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold uppercase text-gray-400">Core Data</h4>
                                <input placeholder="Price" type="number" className="w-full border rounded px-3 py-2 text-xs" value={bulkChanges.price} onChange={e => setBulkChanges({...bulkChanges, price: e.target.value})} />
                                <input placeholder="Stock" type="number" className="w-full border rounded px-3 py-2 text-xs" value={bulkChanges.stock} onChange={e => setBulkChanges({...bulkChanges, stock: e.target.value})} />
                                <select className="w-full border rounded px-3 py-2 text-xs bg-white" value={bulkChanges.category} onChange={e => setBulkChanges({...bulkChanges, category: e.target.value})}>
                                    <option value="">-- Change Category --</option>
                                    {content.navCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>

                            {/* Group 2: Attributes */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold uppercase text-gray-400">Attributes</h4>
                                <input placeholder="Colors (Red, Blue)" className="w-full border rounded px-3 py-2 text-xs" value={bulkChanges.colors} onChange={e => setBulkChanges({...bulkChanges, colors: e.target.value})} />
                                <input placeholder="Sizes (S, M, L)" className="w-full border rounded px-3 py-2 text-xs" value={bulkChanges.sizes} onChange={e => setBulkChanges({...bulkChanges, sizes: e.target.value})} />
                                <input placeholder="Tags (New, Hot)" className="w-full border rounded px-3 py-2 text-xs" value={bulkChanges.tags} onChange={e => setBulkChanges({...bulkChanges, tags: e.target.value})} />
                            </div>

                            {/* Group 3: Marketing & Flags */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold uppercase text-gray-400">Marketing Flags</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="text-[9px] text-gray-500 uppercase block mb-1">Featured</label>
                                        <select className="w-full border rounded text-xs py-1.5" value={bulkChanges.isFeatured} onChange={e => setBulkChanges({...bulkChanges, isFeatured: e.target.value})}>
                                            <option value="">--</option>
                                            <option value="true">Yes</option>
                                            <option value="false">No</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-gray-500 uppercase block mb-1">Clearance</label>
                                        <select className="w-full border rounded text-xs py-1.5" value={bulkChanges.isClearance} onChange={e => setBulkChanges({...bulkChanges, isClearance: e.target.value})}>
                                            <option value="">--</option>
                                            <option value="true">Yes</option>
                                            <option value="false">No</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-gray-500 uppercase block mb-1">BOGO</label>
                                        <select className="w-full border rounded text-xs py-1.5" value={bulkChanges.isBogo} onChange={e => setBulkChanges({...bulkChanges, isBogo: e.target.value})}>
                                            <option value="">--</option>
                                            <option value="true">Yes</option>
                                            <option value="false">No</option>
                                        </select>
                                    </div>
                                </div>
                                <input placeholder="Custom Attrs (Key:Val)" className="w-full border rounded px-3 py-2 text-xs" value={bulkChanges.attributes} onChange={e => setBulkChanges({...bulkChanges, attributes: e.target.value})} />
                            </div>

                            {/* Group 4: Templates & Apply */}
                            <div className="space-y-3 flex flex-col">
                                <h4 className="text-[10px] font-bold uppercase text-gray-400">Templates</h4>
                                <select className="w-full border rounded px-3 py-2 text-xs bg-white" value={bulkChanges.sizeGuideId} onChange={e => setBulkChanges({...bulkChanges, sizeGuideId: e.target.value})}>
                                    <option value="">-- Size Guide --</option>
                                    <option value="none">None</option>
                                    {sizeGuides.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                                </select>
                                <select className="w-full border rounded px-3 py-2 text-xs bg-white" value={bulkChanges.shippingTemplateId} onChange={e => setBulkChanges({...bulkChanges, shippingTemplateId: e.target.value})}>
                                    <option value="">-- Shipping Template --</option>
                                    <option value="global">Global Default</option>
                                    {(content.shippingTemplates || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                <select className="w-full border rounded px-3 py-2 text-xs bg-white" value={bulkChanges.specificsTemplateId} onChange={e => setBulkChanges({...bulkChanges, specificsTemplateId: e.target.value})}>
                                    <option value="">-- Item Specs Template --</option>
                                    {specificsTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                
                                <div className="flex-1"></div>
                                <button onClick={handleBulkApply} disabled={isBulkSaving} className="w-full bg-indigo-600 text-white px-4 py-2.5 text-xs font-bold uppercase rounded hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-md transition-all active:scale-95">
                                    {isBulkSaving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>} 
                                    Apply Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="font-bold text-gray-700 flex items-center gap-2"><Package className="h-5 w-5"/> Inventory ({products.length})</h2>
                    <div className="flex gap-2">
                            <button onClick={() => setShowCategoryManager(true)} className="px-4 py-1 bg-white border text-gray-700 text-xs font-bold uppercase rounded flex items-center gap-1 hover:bg-gray-100"><Folder className="h-3 w-3"/> Categories</button>
                            <button onClick={handleManualAdd} className="px-4 py-1 bg-black text-white text-xs font-bold uppercase rounded flex items-center gap-1 hover:bg-gray-800"><Plus className="h-3 w-3" /> Add Product</button>
                    </div>
                </div>
                
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left text-sm table-fixed">
                        <thead className="bg-gray-100 text-gray-500 uppercase font-bold text-xs">
                            <tr>
                                <th className="p-3 w-10"><input type="checkbox" onChange={(e) => {
                                    if(e.target.checked) setSelectedProducts(new Set(products.map(p => p.id)));
                                    else setSelectedProducts(new Set());
                                }} checked={selectedProducts.size === products.length && products.length > 0} /></th>
                                <th className="p-3 w-16 text-center">Status</th>
                                <th className="p-3 w-20 text-center">Image</th>
                                <th className="p-3 w-1/4">Product</th>
                                <th className="p-3 w-32">Category</th>
                                <th className="p-3 w-48">Attributes</th>
                                <th className="p-3 w-24">Price</th>
                                <th className="p-3 w-20">Stock</th>
                                <th className="p-3 w-24 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {products.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="p-3"><input type="checkbox" checked={selectedProducts.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                                    <td className="p-3 text-center">
                                        <button onClick={() => toggleProductVisibility(p)} title={p.isHidden ? "Hidden (Click to Publish)" : "Visible (Click to Hide)"}>
                                            {p.isHidden ? <EyeOff className="h-4 w-4 text-gray-300 hover:text-red-500"/> : <Eye className="h-4 w-4 text-green-500 hover:text-green-700"/>}
                                        </button>
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="relative group cursor-zoom-in inline-block">
                                            <img 
                                                src={p.images[0]} 
                                                className={`h-10 w-10 object-cover border rounded mx-auto ${p.isHidden ? 'opacity-50 grayscale' : 'bg-gray-50'}`} 
                                                alt="" 
                                                onMouseEnter={(e) => setHoveredImage({ src: p.images[0], x: e.clientX, y: e.clientY })}
                                                onMouseLeave={() => setHoveredImage(null)}
                                            />
                                            <ZoomIn className="h-3 w-3 text-gray-400 absolute bottom-0 right-0 bg-white rounded-tl p-0.5 opacity-0 group-hover:opacity-100" />
                                        </div>
                                    </td>
                                    <td className="p-3 font-bold text-gray-800 truncate">
                                        <div className="truncate" title={p.title}>{p.title}</div>
                                        <div className="flex gap-1 mt-1">
                                            {p.isHidden && <span className="text-[9px] uppercase bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">Draft</span>}
                                            {p.isFeatured && <span className="text-[9px] uppercase bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Featured</span>}
                                            {p.isClearance && <span className="text-[9px] uppercase bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Clearance</span>}
                                            {p.isBogo && <span className="text-[9px] uppercase bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">BOGO</span>}
                                        </div>
                                    </td>
                                    <td className="p-3 truncate" title={p.category}>{p.category}</td>
                                    <td className="p-3 text-xs text-gray-500">
                                        <div className="max-h-16 overflow-hidden flex flex-col gap-1">
                                            {p.itemSpecifics ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {Object.entries(p.itemSpecifics).slice(0, 3).map(([k, v]) => (
                                                        <span key={k} className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap truncate max-w-full" title={`${k}: ${v}`}>{k}: {v}</span>
                                                    ))}
                                                    {Object.keys(p.itemSpecifics).length > 3 && <span className="text-[10px] text-gray-400">+{Object.keys(p.itemSpecifics).length - 3}</span>}
                                                </div>
                                            ) : '-'}
                                            {p.tags && p.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {p.tags.slice(0, 3).map(t => <span key={t} className="text-[9px] text-blue-600 bg-blue-50 px-1 rounded flex items-center gap-0.5 truncate max-w-full"><Tag className="h-2 w-2"/>{t}</span>)}
                                                    {p.tags.length > 3 && <span className="text-[9px] text-gray-400">+{p.tags.length - 3}</span>}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        ${p.price}
                                        {p.originalPrice && <span className="text-xs text-red-500 ml-1 line-through">${p.originalPrice}</span>}
                                    </td>
                                    <td className="p-3">{p.stock}</td>
                                    <td className="p-3 text-right">
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => handleEditClick(p)} className="text-gray-600 hover:text-black" title="Edit"><Edit className="h-4 w-4"/></button>
                                            {p.designAsset && <button onClick={() => downloadPrintFile(p)} className="text-blue-600 hover:text-blue-800" title="Download Print File"><Download className="h-4 w-4"/></button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
