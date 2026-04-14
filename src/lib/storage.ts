/**
 * Utilitário de acesso seguro ao Storage (localStorage/sessionStorage).
 * Evita exceções do tipo 'SecurityError' no Safari/iPad quando cookies estão bloqueados
 * ou em modo privado restrito.
 */

export const safeStorage = {
  getItem: (key: string, storage: "local" | "session" = "local"): string | null => {
    if (typeof window === "undefined") return null;
    try {
      const s = storage === "local" ? localStorage : sessionStorage;
      return s.getItem(key);
    } catch (e) {
      console.warn(`[Storage] Erro ao ler '${key}' de ${storage}:`, e);
      return null;
    }
  },

  setItem: (key: string, value: string, storage: "local" | "session" = "local"): boolean => {
    if (typeof window === "undefined") return false;
    try {
      const s = storage === "local" ? localStorage : sessionStorage;
      s.setItem(key, value);
      return true;
    } catch (e) {
      console.warn(`[Storage] Erro ao gravar '${key}' em ${storage}:`, e);
      return false;
    }
  },

  removeItem: (key: string, storage: "local" | "session" = "local"): boolean => {
    if (typeof window === "undefined") return false;
    try {
      const s = storage === "local" ? localStorage : sessionStorage;
      s.removeItem(key);
      return true;
    } catch (e) {
      console.warn(`[Storage] Erro ao remover '${key}' de ${storage}:`, e);
      return false;
    }
  }
};
