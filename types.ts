
export interface ColorVariant {
  color: string;
  image: string; // Base64 or URL
  isHidden: boolean; // If true, not shown in main carousel, only on selection
}

export interface Product {
  id: string;
  sku: string;
  title: string;
  description: string;
  slug: string; // SEO Friendly URL
  aliases?: string[]; // Alternative SEO URLs
  price: number;
  originalPrice?: number;
  category: 'Mug' | 'T-Shirt' | 'Art Print';
  hierarchy: string[];
  tags: string[];
  images: string[]; 
  designAsset?: string;
  sizes: string[];
  colors: string[];
  colorVariants?: ColorVariant[]; // New: Color to Image Mapping
  itemSpecifics?: Record<string, string>; // New: Custom Attributes
  stock: number;
  promoCode?: string;
  sizeGuideId?: string; // Linked Size Guide
  shippingTemplateId?: string; // New: Linked Shipping Template
  createdAt: number;
  isHidden?: boolean; // New: Visibility Toggle
  // Marketing Flags
  isFeatured?: boolean;
  isClearance?: boolean;
  isBogo?: boolean;
}

export interface GeneratedProductData {
  title: string;
  description: string;
  designDescription: string;
  category: 'Mug' | 'T-Shirt';
  hierarchy: string[];
  tags: string[];
  sku: string;
  price: number;
  colors: string[];
  sizes: string[];
}

export enum SortOption {
  Newest = 'newest',
  PriceLow = 'price_low',
  PriceHigh = 'price_high',
}

export interface FilterState {
  category: string | null;
  search: string;
}

export interface CartItem extends Product {
    cartItemId: string;
    selectedSize?: string;
    selectedColor?: string;
    quantity: number;
}

export interface UserPreferences {
    marketing: boolean;
    account: boolean;
}

export interface Address {
    id: string;
    name: string;
    street: string;
    line2?: string; // Apartment, Suite, etc.
    city: string;
    state: string;
    zip: string;
    isDefaultShipping?: boolean;
    isDefaultBilling?: boolean;
    /** @deprecated use isDefaultShipping */
    isDefault?: boolean; 
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'customer';
    isSuspended?: boolean;
    orders: Order[];
    addresses?: Address[]; // New field
    token?: string; // JWT Token for remote backend
    lastLogin?: number;
    riskScore?: number; // 0-100
    tags?: string[]; // 'VIP', 'Churn Risk', 'New'
    preferences?: UserPreferences;
    lastIp?: string;
    userAgent?: string;
    stripeCustomerId?: string; // Stripe Customer
}

export interface OrderLog {
    id: string;
    timestamp: number;
    type: 'status_change' | 'email_sent' | 'note' | 'refund' | 'tracking';
    message: string;
    author?: string; // 'System' or Admin Name
}

export interface Order {
    id: string;
    date: number;
    total: number;
    status: 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Refunded' | 'On Hold';
    items: CartItem[];
    trackingNumber?: string;
    trackingCarrier?: string; // New: Carrier Name
    trackingLink?: string; // New: Direct URL
    shippingAddress?: any;
    shippingAddressLine2?: string;
    billingAddress?: any;
    billingAddressLine2?: string;
    discountApplied?: number;
    shippingCost?: number;
    promoCode?: string;
    // New Fields
    customerName?: string;
    customerEmail?: string;
    userId?: string;
    logs?: OrderLog[];
    refundAmount?: number;
    isOverdue?: boolean; // Calculated runtime usually, but helpful for type checks
    internalNotes?: string;
    // Stripe & Fraud Fields
    stripeChargeId?: string;
    stripePaymentIntentId?: string;
    paymentLast4?: string; // New: Searchable Last 4
    isFraudSuspect?: boolean;
    fraudScore?: number;
    // Analytics
    utmSource?: string;
    utmCampaign?: string;
    utmMedium?: string;
}

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export interface PromoCode {
    code: string;
    discountType: 'percentage' | 'fixed';
    value: number;
    isActive: boolean;
    usageCount: number;
    expiresAt?: number; // Timestamp
    // Advanced
    maxUses?: number;
    minOrderValue?: number;
    categoryRestriction?: string;
}

export interface StoreProfile {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    email: string;
    phone: string;
}

export interface AdminPreferences {
    autoScrollLog?: boolean;
}

export interface AppSettings {
    // Core Connectivity
    mode?: 'local' | 'remote';
    apiUrl: string;
    
    // Secrets / Keys
    apiKey?: string; // Gemini
    stripePublishableKey?: string;
    stripeSecretKey?: string;
    googleClientId?: string;
    googleClientSecret?: string;
    googleRedirectUri?: string;
    recaptchaSiteKey?: string;
    recaptchaSecretKey?: string;
    
    // Database / Backend Config
    dbType?: 'sqlite' | 'postgres' | 'mongodb' | 'mysql';
    databaseUrl?: string; // Connection String
    redisUrl?: string;
    redisEnabled?: boolean;
    
    // Email / SMTP
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    
    storeProfile?: StoreProfile;
    adminPreferences?: AdminPreferences;
}

// --- CMS & Marketing Types ---

export interface Policy {
    id: string;
    title: string;
    content: string; // HTML or Markdown text
    slug: string;
}

export interface PopupConfig {
    enabled: boolean;
    title: string;
    description: string;
    promoCode?: string;
    image?: string;
    // Targeting
    targetNonPurchasersOnly?: boolean;
    daysSinceLastOrder?: number; // e.g., show only if user hasn't bought in 30 days
}

export interface WelcomePopupConfig extends PopupConfig {
    delay: number; // seconds
}

export interface AdConfig {
    enabled: boolean;
    provider: 'adsense' | 'custom';
    script?: string; // HTML/Script code
    placementLocations: ('home_top' | 'product_sidebar' | 'footer_top')[];
}

export interface MarketingConfig {
    banner: {
        enabled: boolean;
        text: string;
        link?: string;
        bgColor: string;
        textColor: string;
    };
    welcomePopup: WelcomePopupConfig;
    exitPopup: PopupConfig;
    ads?: AdConfig; 
}

export interface SocialLinks {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    pinterest?: string;
    tiktok?: string;
}

// --- New Layout & Theme Types ---

export interface BrandingConfig {
    siteName: string;
    logoUrl?: string;
    logoMode: 'icon_text' | 'image_only' | 'text_only'; 
    logoScale: number; // Percentage (e.g. 100 = 100%)
    faviconUrl?: string;
}

export interface ThemeColors {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    fontFamily: string;
    borderRadius: string;
    // New Fields for advanced customization
    primaryButtonText?: string;
    secondaryButtonText?: string;
    googleFontName?: string; 
    customFontUrl?: string; 
}

export interface ComponentStyles {
    backgroundColor?: string;
    textColor?: string;
    linkColor?: string;
    buttonColor?: string;
    buttonTextColor?: string;
    padding?: string;
    height?: string;
    backgroundImage?: string;
    textAlign?: 'left' | 'center' | 'right';
    fontSize?: string;
    overlayOpacity?: number;
}

export interface ComponentConfig {
    // For Hero / Newsletter / Banner
    heading?: string;
    subheading?: string;
    buttonText?: string;
    targetLink?: string;
    
    // Hero Variants
    heroType?: 'standard' | 'slider' | 'cards';
    sliderInterval?: number; // Seconds
    slides?: {
        id: string;
        image: string;
        heading: string;
        subheading: string;
        buttonText: string;
        link: string;
        overlayOpacity?: number;
    }[];
    cards?: {
        id: string;
        title: string;
        price: string;
        description: string;
        buttonText: string;
        link: string;
        highlight?: boolean;
    }[];

    // For Featured / Grid
    sourceType?: 'random' | 'tag' | 'manual';
    sourceValue?: string; // Tag name or empty for random
    productIds?: string[]; // For manual selection
    limit?: number; // Number of items to show
    
    // For Search
    placeholder?: string;

    // For AdBox
    adSize?: '728x90' | '300x250' | '160x600' | '336x280' | 'responsive';
    adScript?: string; // Or Image URL
    adImageUrl?: string;
    adLinkUrl?: string;
}

export interface LayoutComponent {
    id: string;
    type: 'Hero' | 'Featured' | 'ProductGrid' | 'NewArrivals' | 'Newsletter' | 'TextBanner' | 'AdvancedSearch' | 'AdBox' | 'RelatedProducts';
    title?: string; // Internal admin title OR displayed header
    isEnabled: boolean;
    order: number;
    styles?: ComponentStyles;
    config?: ComponentConfig;
}

export interface ShippingZone {
    id: string;
    name: string;
    countries: string[];
    rate: number;
}

export interface ShippingTemplate {
    id: string;
    name: string;
    baseRate: number;
    additionalItemRate: number;
}

export interface ShippingConfig {
    baseRate: number;
    additionalItemRate: number; // Global Fallback
    freeShippingThreshold: number; // 0 to disable
    enabled: boolean;
    zones?: ShippingZone[];
    carriers?: {
        fedex: boolean;
        ups: boolean;
        usps: boolean;
        dhl: boolean;
    };
    handlingFee?: number;
}

export interface FooterConfig {
    brandDescription: string;
    shopHeader: string;
    supportHeader: string;
    newsletterHeader: string;
    newsletterText: string;
    copyrightText: string;
}

export interface PageTextConfig {
    accountWelcome: string; // "Hello, {name}"
    accountSupportIntro: string; // "No tickets yet..."
    loginTitle: string; // "Welcome Back"
    loginSubtitle: string; 
    registerTitle: string; 
    registerSubtitle: string;
    chatbotSystemPrompt?: string;
}

export interface EmailTemplate {
    id: string;
    name: string; // e.g., "Order Confirmation"
    subject: string;
    body: string; // Text content
}

export interface EmailSettings {
    senderName: string;
    replyToEmail: string;
    headerHtml?: string; // New: Global Header
    footerHtml?: string; // New: Global Footer (replaces plain footerText)
    footerText?: string; // Deprecated but kept for type safety until migration
}

export interface SizeGuide {
    id: string;
    category: string;
    title: string;
    content: string; // Markdown table
}

export interface ItemSpecificTemplate {
    id: string;
    name: string;
    specifics: Record<string, string>;
}

export interface SecurityConfig {
    enableCaptcha: boolean;
    enableRecaptcha?: boolean; // V2 Checkbox
    adminIps: string[];
    maxLoginAttempts?: number;
    blockTorExitNodes?: boolean;
    enableFingerprinting?: boolean;
    sessionTimeoutMinutes?: number;
    // New Checkout Triggers
    blockDisposableEmails: boolean;
    maxCardAttempts: number;
    strictAddressValidation: boolean;
    blockedIPs?: string; 
}

export interface StoreContent {
    policies: Policy[];
    marketing: MarketingConfig;
    socials: SocialLinks;
    navCategories: string[];
    branding: BrandingConfig;
    theme: ThemeColors;
    layout: LayoutComponent[];
    shipping: ShippingConfig;
    shippingTemplates?: ShippingTemplate[];
    footer: FooterConfig;
    pageText: PageTextConfig;
    emailTemplates: EmailTemplate[];
    emailSettings: EmailSettings;
    sizeGuides: SizeGuide[];
    itemSpecificTemplates?: ItemSpecificTemplate[]; // New
    security?: SecurityConfig;
}

export interface CaptchaChallenge {
    token: string;
    challenge: string;
}

export interface Subscriber {
    email: string;
    createdAt: number;
    isVerified: boolean;
    verificationToken?: string;
}

export interface Unsubscriber {
    email: string;
    createdAt: number;
}

// --- Support Types ---

export interface Attachment {
    name: string;
    type: 'image' | 'file';
    url: string; // Base64 or URL
    size: number;
}

export interface TicketMessage {
    role: 'user' | 'admin';
    text: string;
    timestamp: number;
    senderName?: string;
    attachments?: Attachment[];
}

export interface SupportTicket {
    id: string;
    userId: string;
    userEmail: string; // denormalized for admin convenience
    orderId?: string;
    subject: string;
    status: 'Open' | 'Closed';
    messages: TicketMessage[];
    createdAt: number;
    updatedAt: number;
    isRead?: boolean; // Track unread status for customer
    isLocked?: boolean;
    closedAt?: number;
}

export interface ToastMessage {
    message: string;
    type: 'success' | 'error';
}

export interface SecurityEvent {
    id: string;
    timestamp: number;
    type: 'login_fail' | 'blocked_ip' | 'suspicious_activity' | 'admin_login';
    ip: string;
    details: string;
    severity: 'low' | 'medium' | 'high';
}

export interface SEOSubmission {
    target: 'Google' | 'Bing' | 'Yandex' | 'OpenAI' | 'Anthropic' | 'GoogleGemini' | 'Grok' | 'Perplexity' | 'BingChat';
    status: 'pending' | 'success' | 'failed';
    lastSubmitted: number;
    details?: string;
}

export interface AnalyticsEvent {
    id: string;
    type: 'visit' | 'conversion' | 'product_view';
    campaign?: string; // utm_campaign
    source?: string; // utm_source
    medium?: string; // utm_medium
    timestamp: number;
    revenue?: number; // For conversions
    orderId?: string;
    productId?: string; // For product views
}

export interface CampaignStats {
    name: string;
    visits: number;
    conversions: number;
    revenue: number;
    adSpend?: number; // User input for ROI calc
    roi?: number;
}

// --- Suspension System ---

export interface AppealDocument {
    id: string;
    type: 'id_front' | 'id_back' | 'utility_bill' | 'card_proof';
    url: string; // Base64 or URL
    uploadedAt: number;
}

export interface SuspensionCase {
    id: string;
    userId: string;
    reason: string;
    status: 'Under Review' | 'Action Required' | 'Resolved' | 'Rejected' | 'Open';
    documents: AppealDocument[];
    customerStatement?: string;
    adminNotes?: string;
    createdAt: number;
    updatedAt: number;
}
