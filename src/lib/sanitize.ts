export const sanitizeText = (str: string): string =>
  str.trim().replace(/<[^>]*>/g, '').slice(0, 10000);

export const sanitizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.toString();
  } catch { return ''; }
};

// Validação de e-mail razoável (não exaustiva, mas barra "a@", "a@b", espaços, etc.).
export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
