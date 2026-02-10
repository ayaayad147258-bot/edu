/// <reference types="vite/client" />

interface AIStudio {
    hasSelectedApiKey(): Promise<boolean>;
    openSelectKey(): Promise<void>;
    getKey(): Promise<string | null>;
}

interface Window {
    aistudio?: AIStudio;
}
