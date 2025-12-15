
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedProductData, User, ThemeColors } from "../types";
import { settingsService } from './settings';

// Helper to ensure we have a key from environment or settings
const getAIClient = async (): Promise<GoogleGenAI> => {
  let key = process.env.API_KEY;
  if (!key) {
      try {
          const settings = await settingsService.load();
          key = settings.apiKey;
      } catch (e) {
          console.warn("Could not load settings for Gemini Key", e);
      }
  }
  
  if (!key) {
      console.error("Gemini API Key is missing. Please configure it in Admin Settings.");
  }
  return new GoogleGenAI({ apiKey: key || '' });
};

// Helper to clean base64 string for API
const cleanBase64 = (dataUrl: string) => {
  return dataUrl.split(',')[1] || dataUrl;
};

// Helper to clean markdown json blocks
const cleanJson = (text: string) => {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

export const generateCopy = async (context: string, type: string = "marketing text"): Promise<string> => {
    const ai = await getAIClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are a professional e-commerce copywriter. Write engaging, concise, and SEO-optimized ${type}.
        Context provided: "${context}".
        
        Return ONLY the text content, no markdown formatting or intro/outro.`
    });

    return response.text || "";
};

export const generateProductMetadata = async (type: 'Mug' | 'T-Shirt', style: string): Promise<GeneratedProductData> => {
  const ai = await getAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Generate a creative, trendy product idea for a ${type} with a design style of "${style}". 
    Provide metadata including title, description, and visual description.
    
    CONSTRAINTS:
    - Category must be exactly "${type}".
    - If category is "Mug": Sizes MUST be ["11oz", "15oz"]. Colors should be minimal.
    - If category is "T-Shirt": Sizes MUST be ["S", "M", "L", "XL", "2XL"].`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          designDescription: { type: Type.STRING },
          price: { type: Type.NUMBER },
          sku: { type: Type.STRING },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          category: { type: Type.STRING },
          hierarchy: { type: Type.ARRAY, items: { type: Type.STRING } },
          colors: { type: Type.ARRAY, items: { type: Type.STRING } },
          sizes: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["title", "description", "designDescription", "price", "sku", "tags", "category", "hierarchy", "colors", "sizes"]
      }
    }
  });
  
  const text = response.text;
  if (!text) throw new Error("No response from AI");
  try {
      return JSON.parse(cleanJson(text)) as GeneratedProductData;
  } catch (e) {
      console.error("Failed to parse JSON", text);
      throw new Error("Invalid JSON response");
  }
};

export const generateMetadataFromImage = async (base64Image: string): Promise<GeneratedProductData> => {
    const ai = await getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
            {
                inlineData: {
                    mimeType: 'image/jpeg', 
                    data: cleanBase64(base64Image)
                }
            },
            { text: `Analyze this product image deeply. Create Title, Description, Tags, and Hierarchy. Category must be valid (e.g. Mug, T-Shirt).` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            designDescription: { type: Type.STRING },
            price: { type: Type.NUMBER },
            sku: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            category: { type: Type.STRING },
            hierarchy: { type: Type.ARRAY, items: { type: Type.STRING } },
            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
            sizes: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["title", "description", "designDescription", "price", "sku", "tags", "category", "hierarchy", "colors", "sizes"]
        }
      }
    });
    
    const text = response.text;
    if (!text) throw new Error("No response from AI");
    try {
        return JSON.parse(cleanJson(text)) as GeneratedProductData;
    } catch (e) {
        console.error("Failed to parse JSON", text);
        throw new Error("Invalid JSON response");
    }
};

export const generateFlatDesign = async (designDescription: string): Promise<string> => {
    const ai = await getAIClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: `Create a high-quality, flat vector art design based on this description: "${designDescription}". 
        The design should be suitable for printing on merchandise (Mugs, T-Shirts). 
        Isolated on a white background. No text unless specified. Professional graphic design style.`,
        config: {
            // Note: responseMimeType is not supported for image models
        }
    });

    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    
    throw new Error("Failed to generate image");
};

export const generateCompositeProductImage = async (mockupBase64: string, designBase64: string, category: string): Promise<string> => {
    const ai = await getAIClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: 'image/png',
                        data: cleanBase64(mockupBase64)
                    }
                },
                {
                    inlineData: {
                        mimeType: 'image/png',
                        data: cleanBase64(designBase64)
                    }
                },
                {
                    text: `Composite the second image (the design) onto the first image (the ${category} product mockup). 
                    Apply realistic warping, lighting, and shading so the design looks printed on the product.
                    Maintain the original product background. Return the final composite image.`
                }
            ]
        }
    });

    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    return mockupBase64;
};

export const generateProductImage = async (
    designDescription: string, 
    category: string, 
    view: 'Front' | 'Lifestyle', 
    designBase64?: string,
    orientation?: string
): Promise<string> => {
    const ai = await getAIClient();
    
    let contents: any[] = [];
    let prompt = "";

    if (designBase64) {
        contents.push({
            inlineData: {
                mimeType: 'image/png',
                data: cleanBase64(designBase64)
            }
        });
        prompt = `Generate a realistic product photograph of a ${category} featuring this design. 
        View: ${view} ${orientation || ''}. 
        The product should be high quality. Professional product photography lighting.`;
    } else {
        prompt = `Generate a realistic product photograph of a ${category} with a design described as: "${designDescription}".
        View: ${view} ${orientation || ''}.
        Professional product photography lighting.`;
    }
    
    contents.push({ text: prompt });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: contents }
    });

    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    
    throw new Error("Failed to generate product image");
};

export const generateLifestyleScene = async (productImage: string, promptText: string): Promise<string> => {
    const ai = await getAIClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: cleanBase64(productImage)
                    }
                },
                {
                    text: `Place this product into a lifestyle scene: ${promptText}. 
                    Ensure lighting and perspective match. Photorealistic quality.`
                }
            ]
        }
    });

    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    return productImage;
};

export const generateHeroImage = async (promptText: string): Promise<string> => {
    const ai = await getAIClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: `Generate a wide, high-resolution website hero background image.
        Theme: ${promptText}.
        Style: Professional, clean, suitable for overlaying text.
        Aspect Ratio: 16:9 or wider.`
    });

    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error("Failed to generate hero image");
};

export const generateThemeFromImage = async (base64Image: string): Promise<ThemeColors> => {
    const ai = await getAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: cleanBase64(base64Image)
                    }
                },
                { text: `Analyze this image and generate a UI Theme configuration (JSON).` }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    primary: { type: Type.STRING },
                    secondary: { type: Type.STRING },
                    accent: { type: Type.STRING },
                    background: { type: Type.STRING },
                    text: { type: Type.STRING },
                    fontFamily: { type: Type.STRING },
                    borderRadius: { type: Type.STRING }
                },
                required: ["primary", "secondary", "accent", "background", "text", "fontFamily", "borderRadius"]
            }
        }
    });

    const text = response.text;
    if (!text) throw new Error("No response");
    try {
        return JSON.parse(cleanJson(text)) as ThemeColors;
    } catch (e) {
        throw new Error("Invalid JSON from theme generation");
    }
};

export const compressImage = (base64: string, maxWidth: number = 1024, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Failed to get canvas context"));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (e) => reject(e);
    });
};

export const compositeImageClientSide = (
  mockupBase64: string,
  designBase64: string,
  scale: number,
  xOffset: number,
  yOffset: number,
  opacity: number = 0.95
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const mockup = new Image();
    mockup.src = mockupBase64;
    mockup.crossOrigin = "anonymous";
    mockup.onload = () => {
        const design = new Image();
        design.src = designBase64;
        design.crossOrigin = "anonymous";
        design.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = mockup.width;
            canvas.height = mockup.height;
            const ctx = canvas.getContext('2d');
            if(!ctx) { reject(new Error("No ctx")); return; }

            ctx.drawImage(mockup, 0, 0);

            const dAspectRatio = design.width / design.height;
            let dWidth = mockup.width * scale;
            let dHeight = dWidth / dAspectRatio;

            const x = (mockup.width * xOffset) - (dWidth / 2);
            const y = (mockup.height * yOffset) - (dHeight / 2);

            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.globalCompositeOperation = 'multiply';
            ctx.drawImage(design, x, y, dWidth, dHeight);
            ctx.restore();

            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        design.onerror = () => reject(new Error("Failed to load design image"));
    };
    mockup.onerror = () => reject(new Error("Failed to load mockup image"));
  });
};

export const generatePromoIdea = async (theme: string): Promise<{ code: string, discountType: 'percentage' | 'fixed', value: number }> => {
    const ai = await getAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Create a promotional campaign idea for an online store based on the theme "${theme}". discountType must be 'percentage' or 'fixed'.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    code: { type: Type.STRING },
                    discountType: { type: Type.STRING },
                    value: { type: Type.NUMBER }
                },
                required: ['code', 'discountType', 'value']
            }
        }
    });

    const text = response.text;
    if (!text) throw new Error("No response");
    try {
        return JSON.parse(cleanJson(text));
    } catch (e) {
        throw new Error("Invalid JSON from promo generation");
    }
};

export const chatWithShopAI = async (message: string, history: any[], user?: User | null, systemPrompt?: string): Promise<string> => {
    const ai = await getAIClient();
    
    let userContext = "";
    if (user) {
        userContext = `\nActive User: ${user.name} (${user.email}).`;
        if (user.orders && user.orders.length > 0) {
            userContext += `\nRecent Orders:\n${user.orders.slice(0, 3).map(o => 
                `- Order #${o.id}: ${o.status} (Total: $${o.total.toFixed(2)}, Tracking: ${o.trackingNumber || 'Pending'})`
            ).join('\n')}`;
        } else {
            userContext += `\nUser has no recent orders.`;
        }
    } else {
        userContext = "\nUser is a guest (not logged in).";
    }

    const defaultPrompt = `You are a helpful, friendly customer support assistant for "ShipTeez". 
    - Shipping takes 3-5 business days.
    - We offer a 30-day return policy.
    - We use high-quality ceramic and 100% cotton materials.
    - Be concise and polite.`;

    const context = `${systemPrompt || defaultPrompt}
    - If the user asks about an order, check the "Recent Orders" context below.
    ${userContext}
    
    Current conversation history:
    ${history.map(h => `${h.role}: ${h.text}`).join('\n')}
    User: ${message}
    Model:`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: context
    });

    return response.text || "I'm sorry, I couldn't understand that.";
};
