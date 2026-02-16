import { GoogleGenerativeAI, FunctionDeclaration, Tool } from '@google/generative-ai';

// Function call result type
export interface FunctionCallResult {
    functionName: string;
    success: boolean;
    message: string;
    data?: any;
}

// Message type for conversation history
export interface Message {
    role: 'user' | 'model';
    parts: string;
}

// Voice command response
export interface VoiceResponse {
    text: string;
    functionCalls?: any[];
    success: boolean;
}

/**
 * AI Voice Service - Integrates Gemini AI for natural language understanding
 * with function calling capabilities for voice commands
 */
export class AIVoiceService {
    private genAI: GoogleGenerativeAI | null = null;
    private model: any = null;

    constructor(apiKey?: string) {
        if (apiKey) {
            this.initialize(apiKey);
        }
    }

    /**
     * Initialize Gemini AI with API key
     */
    initialize(apiKey: string) {
        try {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({
                model: 'gemini-1.5-flash',
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 1024,
                },
            });
            console.log('✅ Gemini AI initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Gemini AI:', error);
            this.genAI = null;
            this.model = null;
        }
    }

    /**
     * Check if AI is ready
     */
    isReady(): boolean {
        return this.model !== null;
    }

    /**
     * Get available functions/tools for Gemini
     */
    private getAvailableFunctions(): FunctionDeclaration[] {
        return [
            // Navigation
            {
                name: 'navigate',
                description: 'التنقل إلى صفحة معينة في التطبيق',
                parameters: {
                    type: 'object',
                    properties: {
                        view: {
                            type: 'string',
                            enum: ['home', 'stages', 'grade', 'admin', 'teachers'],
                            description: 'الصفحة المراد الانتقال إليها: home (الرئيسية), stages (الجدول), grade (صفحة صف معين), admin (لوحة التحكم), teachers (قائمة المدرسين)',
                        },
                    },
                    required: ['view'],
                },
            },

            // Add Teacher
            {
                name: 'addTeacher',
                description: 'إضافة مدرس جديد للنظام',
                parameters: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                            description: 'اسم المدرس كاملاً',
                        },
                        subject: {
                            type: 'string',
                            description: 'المادة التي يدرسها (مثل: رياضيات، لغة عربية، فيزياء)',
                        },
                        whatsapp: {
                            type: 'string',
                            description: 'رقم الواتساب (11 رقم)',
                        },
                        availability: {
                            type: 'string',
                            description: 'أيام التواجد (مثل: السبت، الإثنين، الأربعاء)',
                        },
                        teachingHours: {
                            type: 'string',
                            description: 'ساعات التدريس (مثل: 4:00 - 8:00 مساءً)',
                        },
                        bio: {
                            type: 'string',
                            description: 'نبذة عن المدرس',
                        },
                        grades: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'الصفوف التي يدرس لها (مثل: الأول الثانوي، الثاني الإعدادي)',
                        },
                        stages: {
                            type: 'array',
                            items: {
                                type: 'string',
                                enum: ['primary', 'preparatory', 'secondary', 'languages'],
                            },
                            description: 'المراحل التعليمية: primary (ابتدائي), preparatory (إعدادي), secondary (ثانوي), languages (لغات)',
                        },
                    },
                    required: ['name', 'subject'],
                },
            },

            // Search Teachers
            {
                name: 'searchTeachers',
                description: 'البحث عن مدرسين أو عرض قائمة المدرسين',
                parameters: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'كلمة البحث (اسم المدرس، المادة، إلخ) - اتركها فارغة لعرض الكل',
                        },
                        subject: {
                            type: 'string',
                            description: 'البحث حسب المادة',
                        },
                        stage: {
                            type: 'string',
                            enum: ['primary', 'preparatory', 'secondary', 'languages'],
                            description: 'البحث حسب المرحلة',
                        },
                    },
                    required: [],
                },
            },

            // Add Course
            {
                name: 'addCourse',
                description: 'إضافة كورس جديد',
                parameters: {
                    type: 'object',
                    properties: {
                        title: {
                            type: 'string',
                            description: 'عنوان الكورس',
                        },
                        description: {
                            type: 'string',
                            description: 'وصف الكورس',
                        },
                        stage: {
                            type: 'string',
                            enum: ['primary', 'preparatory', 'secondary', 'languages'],
                            description: 'المرحلة التعليمية',
                        },
                        grade: {
                            type: 'string',
                            description: 'الصف الدراسي',
                        },
                        teacherName: {
                            type: 'string',
                            description: 'اسم المدرس',
                        },
                    },
                    required: ['title', 'stage', 'grade'],
                },
            },

            // Update Schedule
            {
                name: 'updateSchedule',
                description: 'تحديث أو إضافة حصة في الجدول',
                parameters: {
                    type: 'object',
                    properties: {
                        gradeName: {
                            type: 'string',
                            description: 'اسم الصف (مثل: الأول الثانوي، الرابع الابتدائي)',
                        },
                        day: {
                            type: 'string',
                            enum: ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
                            description: 'يوم الأسبوع',
                        },
                        period: {
                            type: 'number',
                            description: 'رقم الحصة (1-8)',
                        },
                        subject: {
                            type: 'string',
                            description: 'اسم المادة',
                        },
                        teacherName: {
                            type: 'string',
                            description: 'اسم المدرس',
                        },
                        remove: {
                            type: 'boolean',
                            description: 'true لحذف الحصة، false للإضافة/التعديل',
                        },
                    },
                    required: ['gradeName', 'day', 'period'],
                },
            },

            // Get Statistics
            {
                name: 'getStatistics',
                description: 'الحصول على إحصائيات التطبيق',
                parameters: {
                    type: 'object',
                    properties: {
                        metric: {
                            type: 'string',
                            enum: ['teachers', 'courses', 'grades', 'all'],
                            description: 'نوع الإحصائية المطلوبة',
                        },
                    },
                    required: ['metric'],
                },
            },
        ];
    }

    /**
     * Process voice command with AI
     */
    async processCommand(
        userMessage: string,
        conversationHistory: Message[] = []
    ): Promise<VoiceResponse> {
        if (!this.isReady()) {
            return {
                text: 'عذراً، الذكاء الاصطناعي غير متاح حالياً. تأكد من إضافة API Key في الإعدادات.',
                success: false,
            };
        }

        try {
            console.log('🎙️ Processing voice command:', userMessage);

            // Build conversation with system prompt
            const systemPrompt = `أنت مساعد صوتي ذكي لأكاديمية تعليمية. مهمتك مساعدة المستخدمين في:
- إضافة وإدارة المدرسين
- إضافة وإدارة الكورسات
- تحديث الجداول الدراسية
- التنقل في التطبيق
- البحث والاستعلام

استخدم الوظائف المتاحة لتنفيذ الأوامر. كن ودوداً ومحترفاً.
تحدث باللغة العربية العامية المصرية.`;

            // Prepare tools
            const tools: Tool[] = [
                {
                    functionDeclarations: this.getAvailableFunctions(),
                },
            ];

            // Create chat with history
            const chat = this.model.startChat({
                tools,
                history: [
                    {
                        role: 'user',
                        parts: [{ text: systemPrompt }],
                    },
                    {
                        role: 'model',
                        parts: [{ text: 'تمام! أنا جاهز لمساعدتك. قول لي إيه اللي تحتاجه؟' }],
                    },
                    ...conversationHistory.map(msg => ({
                        role: msg.role,
                        parts: [{ text: msg.parts }],
                    })),
                ],
            });

            // Send message
            const result = await chat.sendMessage(userMessage);
            const response = result.response;

            console.log('🤖 AI Response:', response);

            // Check for function calls
            const functionCalls = response.functionCalls();

            if (functionCalls && functionCalls.length > 0) {
                console.log('📞 Function calls detected:', functionCalls);
                return {
                    text: response.text() || 'جاري تنفيذ الأمر...',
                    functionCalls,
                    success: true,
                };
            }

            // Regular text response
            return {
                text: response.text(),
                success: true,
            };

        } catch (error) {
            console.error('❌ AI Processing Error:', error);
            return {
                text: 'عذراً، حدث خطأ أثناء معالجة الأمر. حاول مرة أخرى.',
                success: false,
            };
        }
    }
}

// Singleton instance
export const aiVoiceService = new AIVoiceService();
