
export const toBase64 = (file: File): Promise<string> => new Promise((r, j) => { const reader = new FileReader(); reader.onload = () => r(reader.result as string); reader.onerror = j; reader.readAsDataURL(file); });

export const generateUUID = () => {
  // Polyfill for environments where crypto.randomUUID is not available (e.g. non-secure contexts)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-');  // Replace multiple - with single -
};

export const decodeHtml = (html: string) => {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
};

// --- Security & Validation Utils ---

export const DISPOSABLE_DOMAINS = [
    'tempmail.com', 'throwawaymail.com', 'mailinator.com', '10minutemail.com', 
    'guerrillamail.com', 'yopmail.com', 'sharklasers.com', 'getnada.com',
    'dispostable.com', 'grr.la', 'mailnesia.com'
];

export const isValidEmail = (email: string): boolean => {
  // RFC 5322 compliant-ish regex
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email);
};

export const isDisposableEmail = (email: string): boolean => {
  const domain = email.split('@')[1];
  return domain ? DISPOSABLE_DOMAINS.includes(domain.toLowerCase()) : false;
};

export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  // Remove potential XSS vectors and trim whitespace
  return input.trim().replace(/[<>]/g, ''); 
};

export const sanitizeEmail = (email: string): string => {
    if (!email) return '';
    // Advanced Email Sanitation:
    // 1. Lowercase the input
    // 2. Remove all whitespace (including internal spaces which are invalid in emails)
    // 3. Strip control characters and common XSS vectors/invalid chars (<, >, ", ', backtick, parenthesis)
    return email
        .toLowerCase()
        .replace(/\s+/g, '') // Remove all spaces
        .replace(/[\x00-\x1F\x7F<>,"'`\(\)]/g, '') // Remove control chars and dangerous symbols
        .trim();
};

export const checkPasswordStrength = (password: string): { strong: boolean; message?: string } => {
    if (password.length < 8) return { strong: false, message: "Password must be at least 8 characters." };
    if (!/[A-Z]/.test(password)) return { strong: false, message: "Password must contain at least one uppercase letter." };
    if (!/[0-9]/.test(password)) return { strong: false, message: "Password must contain at least one number." };
    return { strong: true };
};
