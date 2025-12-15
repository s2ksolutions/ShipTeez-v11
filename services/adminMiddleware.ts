
import { db } from './db';
import * as gemini from './geminiService';
import { settingsService } from './settings';
import { Product, StoreContent, AppSettings, ThemeColors } from '../types';
import { toBase64, slugify } from '../utils';

// Centralized error logging for admin actions
const logError = (context: string, error: any) => {
    console.error(`[AdminMiddleware] Error in ${context}:`, error);
    // Future: connect to an external logging service here
};

export const adminMiddleware = {
    inventory: {
        async addProduct(product: Product): Promise<void> {
            try {
                await db.saveProduct(product);
            } catch (e) {
                logError('addProduct', e);
                throw e;
            }
        },
        async updateProduct(product: Product): Promise<void> {
            try {
                await db.saveProduct(product);
            } catch (e) {
                logError('updateProduct', e);
                throw e;
            }
        },
        async deleteProducts(ids: string[]): Promise<void> {
            try {
                await db.deleteProducts(ids);
            } catch (e) {
                logError('deleteProducts', e);
                throw e;
            }
        },
        async analyzeProductImage(file: File): Promise<Partial<Product> & { base64: string }> {
            try {
                const rawBase64 = await toBase64(file);
                const base64 = await gemini.compressImage(rawBase64, 1000, 0.85);
                const metadata = await gemini.generateMetadataFromImage(base64);
                return { ...metadata, images: [base64], base64 };
            } catch (e) {
                logError('analyzeProductImage', e);
                throw e;
            }
        },
        async generateLifestyleImage(productImage: string, prompt: string): Promise<string> {
            try {
                const raw = await gemini.generateLifestyleScene(productImage, prompt);
                return await gemini.compressImage(raw, 1024, 0.85);
            } catch (e) {
                logError('generateLifestyleImage', e);
                throw e;
            }
        },
        async generateAIProducts(
            type: 'Mug' | 'T-Shirt', 
            style: string, 
            count: number, 
            orientation: string, 
            onLog: (msg: string) => void,
            mockupBase64?: string
        ): Promise<void> {
            try {
                const tasks = Array.from({ length: count }).map(async (_, idx) => {
                    const id = idx + 1;
                    try {
                        onLog(`[#${id}] Generating concept...`);
                        const meta = await gemini.generateProductMetadata(type, style);
                        
                        onLog(`[#${id}] Designing 4K Print File...`);
                        // Generate high quality, keep it large for designAsset
                        const rawDesign = await gemini.generateFlatDesign(meta.designDescription);
                        // Use a slightly compressed version for web storage/composite to save bandwidth
                        const webDesign = await gemini.compressImage(rawDesign, 2048, 0.9);
                        
                        let productImg = "";
                        if (mockupBase64) {
                            onLog(`[#${id}] Wrapping design onto custom mockup...`);
                            productImg = await gemini.generateCompositeProductImage(mockupBase64, webDesign, type);
                        } else {
                            onLog(`[#${id}] Rendering product visualization...`);
                            productImg = await gemini.generateProductImage(meta.designDescription, type, 'Front', webDesign, orientation);
                        }
                        
                        // Compress final product image for UI
                        const optimizedProductImg = await gemini.compressImage(productImg, 800, 0.85);
                        
                        await db.saveProduct({ 
                            id: crypto.randomUUID(), 
                            createdAt: Date.now(), 
                            ...meta,
                            slug: slugify(meta.title),
                            stock: 50, 
                            images: [optimizedProductImg], 
                            designAsset: rawDesign, // Store high-res here
                            isHidden: true // DEFAULT HIDDEN
                        });
                        onLog(`[#${id}] Saved (Hidden). Review in Inventory.`);
                    } catch (taskError: any) {
                        onLog(`[#${id}] FAILED: ${taskError.message}`);
                        console.error(`Task ${id} failed`, taskError);
                    }
                });

                await Promise.all(tasks);
            } catch (e: any) {
                logError('generateAIProducts', e);
                onLog(`Global Error: ${e.message}`);
                throw e;
            }
        },
        async processBulkUpload(files: File[], onProgress: (percent: number) => void): Promise<number> {
            try {
                let count = 0;
                for (let i = 0; i < files.length; i++) {
                    const rawBase64 = await toBase64(files[i]);
                    const base64 = await gemini.compressImage(rawBase64, 1000, 0.85);
                    const meta = await gemini.generateMetadataFromImage(base64);
                    await db.saveProduct({ 
                        id: crypto.randomUUID(), 
                        createdAt: Date.now(), 
                        images: [base64], 
                        stock: 50, 
                        ...meta,
                        slug: slugify(meta.title),
                        isHidden: true // DEFAULT HIDDEN
                    });
                    count++;
                    onProgress(((i + 1) / files.length) * 100);
                }
                return count;
            } catch (e) {
                logError('processBulkUpload', e);
                throw e;
            }
        },
        async processBulkMockups(
            mockupBase64: string, 
            designFiles: File[], 
            config: { scale: number, x: number, y: number, category?: string },
            onProgress: (percent: number) => void
        ): Promise<number> {
            try {
                let count = 0;
                for (let i = 0; i < designFiles.length; i++) {
                    const designBase64 = await toBase64(designFiles[i]);
                    const meta = await gemini.generateMetadataFromImage(designBase64);
                    
                    // Apply Category Override from Smart Analysis
                    if (config.category) {
                        meta.category = config.category as any;
                        if(meta.tags && !meta.tags.includes(config.category)) {
                            meta.tags.push(config.category);
                        }
                    }

                    const productImg = await gemini.compositeImageClientSide(mockupBase64, designBase64, config.scale, config.x, config.y);
                    const compressedDesign = await gemini.compressImage(designBase64, 1024, 0.9);
                    
                    await db.saveProduct({ 
                        id: crypto.randomUUID(), 
                        createdAt: Date.now(), 
                        ...meta,
                        slug: slugify(meta.title),
                        stock: 100, 
                        images: [productImg], 
                        designAsset: compressedDesign,
                        isHidden: true // DEFAULT HIDDEN
                    });
                    count++;
                    onProgress(((i + 1) / designFiles.length) * 100);
                }
                return count;
            } catch (e) {
                logError('processBulkMockups', e);
                throw e;
            }
        }
    },
    theme: {
        async generateFromImage(file: File): Promise<ThemeColors> {
            try {
                const rawBase64 = await toBase64(file);
                const optimizedBase64 = await gemini.compressImage(rawBase64, 800, 0.8);
                return await gemini.generateThemeFromImage(optimizedBase64);
            } catch (e) {
                logError('generateThemeFromImage', e);
                throw e;
            }
        }
    },
    settings: {
        async save(settings: AppSettings): Promise<void> {
            try {
                await settingsService.save(settings);
            } catch (e) {
                logError('saveSettings', e);
                throw e;
            }
        }
    },
    content: {
        async save(content: StoreContent): Promise<void> {
            try {
                await db.saveStoreContent(content);
            } catch (e) {
                logError('saveContent', e);
                throw e;
            }
        },
        async generateHeroImage(prompt: string): Promise<string> {
            try {
                const raw = await gemini.generateHeroImage(prompt);
                return await gemini.compressImage(raw, 1200, 0.85); // Optimize for web hero
            } catch (e) {
                logError('generateHeroImage', e);
                throw e;
            }
        }
    }
};
