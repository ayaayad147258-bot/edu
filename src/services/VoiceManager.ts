export class VoiceManager {
    private recognition: any; // SpeechRecognition
    private synth: SpeechSynthesis;
    public supported: boolean = false;
    private lang: string;
    private isListening: boolean = false;

    constructor(lang = 'ar-EG') { // Egyptian Arabic
        this.lang = lang;
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        this.synth = window.speechSynthesis;

        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.lang = lang;
            this.recognition.interimResults = false;
            this.recognition.maxAlternatives = 1;
            this.recognition.continuous = false; // Single utterance mode
            this.supported = true;

            console.log('✅ Speech Recognition initialized:', {
                lang,
                supported: this.supported,
                browser: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other'
            });
        } else {
            console.error("❌ Speech Recognition not supported in this browser.");
            console.warn("💡 Try using Chrome or Edge for best results");
            this.supported = false;
        }
    }

    // Listen Promise with enhanced error handling
    listen(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.supported) {
                console.error('❌ Browser not supported');
                return reject("المتصفح لا يدعم التعرف على الصوت. استخدم Chrome أو Edge");
            }

            if (this.isListening) {
                console.warn('⚠️ Already listening, stopping previous instance');
                try { this.recognition.stop(); } catch (e) { /* ignore */ }
                this.isListening = false;
            }

            // Request microphone permission explicitly
            navigator.mediaDevices?.getUserMedia({ audio: true })
                .then(() => {
                    console.log('🎤 Microphone permission granted');
                    this.startRecognition(resolve, reject);
                })
                .catch((err) => {
                    console.error('❌ Microphone permission denied:', err);
                    reject('من فضلك اسمح للمتصفح باستخدام المايك من الإعدادات');
                });
        });
    }

    private startRecognition(resolve: (value: string) => void, reject: (reason: any) => void) {
        try {
            this.isListening = true;
            console.log('🎙️ Starting speech recognition...');

            this.recognition.start();

            // Timeout after 10 seconds
            const timeout = setTimeout(() => {
                if (this.isListening) {
                    console.warn('⏱️ Recognition timeout');
                    this.recognition.stop();
                    this.isListening = false;
                    reject('timeout');
                }
            }, 10000);

            this.recognition.onresult = (event: any) => {
                clearTimeout(timeout);
                const transcript = event.results[0][0].transcript;
                const confidence = event.results[0][0].confidence;

                console.log('✅ Recognized:', {
                    text: transcript,
                    confidence: (confidence * 100).toFixed(1) + '%'
                });

                this.isListening = false;
                resolve(transcript);
            };

            this.recognition.onerror = (event: any) => {
                clearTimeout(timeout);
                this.isListening = false;

                console.error('❌ Recognition error:', event.error);

                // Better error messages
                const errorMessages: Record<string, string> = {
                    'no-speech': 'مفيش صوت اتسمع. جرب تاني وتكلم أوضح',
                    'audio-capture': 'مفيش مايك متصل أو المايك مش شغال',
                    'not-allowed': 'من فضلك اسمح للمتصفح باستخدام المايك',
                    'network': 'مشكلة في الإنترنت. تأكد من الاتصال',
                    'aborted': 'تم إلغاء التسجيل',
                    'language-not-supported': 'اللغة العربية مش مدعومة في متصفحك. جرب Chrome'
                };

                const message = errorMessages[event.error] || 'حدث خطأ. جرب مرة تانية';
                reject(message);
            };

            this.recognition.onend = () => {
                console.log('🔚 Recognition ended');
                this.isListening = false;
            };

            // Event when recognition actually starts
            this.recognition.onstart = () => {
                console.log('▶️ Recognition started - speak now!');
            };

        } catch (error) {
            this.isListening = false;
            console.error('❌ Failed to start recognition:', error);
            reject('فشل بدء التسجيل. جرب تاني');
        }
    }

    // Speak Promise
    say(text: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.synth) {
                console.warn('⚠️ Speech synthesis not available');
                return resolve(); // Fail silently
            }

            // Cancel previous speech
            this.synth.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = this.lang;
            utterance.pitch = 1;
            utterance.rate = 1;
            utterance.volume = 1;

            utterance.onend = () => {
                console.log('🔊 Speech finished:', text.substring(0, 50) + '...');
                resolve();
            };

            utterance.onerror = (e) => {
                console.error("❌ Speech Synthesis Error", e);
                resolve(); // Resolve anyway to continue flow
            };

            console.log('🔊 Speaking:', text);
            this.synth.speak(utterance);
        });
    }

    // Stop listening
    stop() {
        if (this.isListening && this.recognition) {
            try {
                this.recognition.stop();
                this.isListening = false;
                console.log('⏹️ Recognition stopped');
            } catch (e) {
                console.warn('Warning stopping recognition:', e);
            }
        }
    }
}

export const voiceManager = new VoiceManager();

