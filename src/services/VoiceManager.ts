export class VoiceManager {
    private recognition: any; // SpeechRecognition
    private synth: SpeechSynthesis;
    public supported: boolean = false;
    private lang: string;

    constructor(lang = 'ar-EG') { // Changed default to Egyptian Arabic as per context
        this.lang = lang;
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        this.synth = window.speechSynthesis;

        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.lang = lang;
            this.recognition.interimResults = false;
            this.recognition.continuous = false; // We want single command processing
            this.supported = true;
        } else {
            console.error("Speech Recognition not supported in this browser.");
            this.supported = false;
        }
    }

    // Listen Promise
    listen(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.supported) return reject("Browser not supported");

            // Stop any previous instance to avoid conflicts
            try { this.recognition.stop(); } catch (e) { /* ignore */ }

            this.recognition.start();

            this.recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                resolve(transcript);
            };

            this.recognition.onerror = (event: any) => {
                if (event.error === 'no-speech') {
                    // Ignore no-speech or handle gently
                    reject('no-speech');
                } else {
                    reject(event.error);
                }
            };

            this.recognition.onend = () => {
                // Optional: Verify if resolved? Usually handled by onresult/onerror
            };
        });
    }

    // Speak Promise
    say(text: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.synth) return resolve(); // Fail silently if no synth

            // Cancel previous speak
            this.synth.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = this.lang;
            utterance.pitch = 1;
            utterance.rate = 1;

            utterance.onend = () => resolve();
            utterance.onerror = (e) => {
                console.error("Speech Synthesis Error", e);
                resolve(); // Resolve anyway to continue flow
            };

            this.synth.speak(utterance);
        });
    }
}

export const voiceManager = new VoiceManager();
