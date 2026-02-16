
export const safeStorage = {
    getItem: (key: string): string | null => {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn(`Error reading from localStorage key "${key}":`, e);
            return null;
        }
    },

    setItem: (key: string, value: string): void => {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn(`Error writing to localStorage key "${key}":`, e);
        }
    },

    removeItem: (key: string): void => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn(`Error removing from localStorage key "${key}":`, e);
        }
    },

    getSession: (key: string): string | null => {
        try {
            return sessionStorage.getItem(key);
        } catch (e) {
            console.warn(`Error reading from sessionStorage key "${key}":`, e);
            return null;
        }
    },

    setSession: (key: string, value: string): void => {
        try {
            sessionStorage.setItem(key, value);
        } catch (e) {
            console.warn(`Error writing to sessionStorage key "${key}":`, e);
        }
    }
};
