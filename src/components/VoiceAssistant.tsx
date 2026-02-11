
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, Type, LiveServerMessage } from '@google/genai';
import { GradeData, Teacher } from '../types';

interface VoiceAssistantProps {
  onUpdateSchedule: (gradeId: string, text: string) => Promise<void>;
  onAddTeacher: (text: string) => Promise<void>;
  grades: GradeData[];
  apiKey?: string;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ onUpdateSchedule, onAddTeacher, grades, apiKey }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState('');

  const audioContextRes = useRef<AudioContext | null>(null);
  const nextStartTime = useRef(0);
  const sources = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- Audio Utilities ---
  const encode = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number) => {
    const dataInt16 = new Int16Array(data.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, sampleRate);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
    return buffer;
  };

  const createBlob = (data: Float32Array) => {
    const int16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
    return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
  };

  // --- AI Connection ---
  const toggleAssistant = async () => {
    if (isActive) {
      stopAssistant();
      return;
    }

    const key = apiKey || process.env.API_KEY;
    if (!key) {
      alert("يرجى تفعيل مفتاح API في لوحة التحكم أولاً");
      return;
    }

    setIsConnecting(true);
    try {
      // Initialize GoogleGenAI right before making an API call as per guidelines
      const ai = new GoogleGenAI({ apiKey: key });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      audioContextRes.current = outputCtx;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              sessionPromise.then(session => session.sendRealtimeInput({ media: createBlob(inputData) }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Tool Calls
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                let result = "حدث خطأ";
                if (fc.name === 'updateSchedule') {
                  console.log("Updating schedule for:", fc.args.gradeId, fc.args.scheduleText);
                  await onUpdateSchedule(fc.args.gradeId, fc.args.scheduleText);
                  result = "تم تحديث الجدول الدراسي فوراً بنجاح";
                } else if (fc.name === 'addTeacher') {
                  // المساعد يقوم باستدعاء دالة الإضافة بالذكاء الاصطناعي في لوحة الإدارة
                  await onAddTeacher(fc.args.teacherInfo);
                  result = "تم استخراج بيانات المدرس وإضافته بنجاح";
                }
                sessionPromise.then(s => s.sendToolResponse({
                  functionResponses: { id: fc.id, name: fc.name, response: { result } }
                }));
              }
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && audioContextRes.current) {
              const ctx = audioContextRes.current;
              nextStartTime.current = Math.max(nextStartTime.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(base64Audio), ctx, 24000);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.start(nextStartTime.current);
              nextStartTime.current += buffer.duration;
              sources.current.add(source);
              source.onended = () => sources.current.delete(source);
            }

            if (message.serverContent?.interrupted) {
              sources.current.forEach(s => s.stop());
              sources.current.clear();
              nextStartTime.current = 0;
            }

            if (message.serverContent?.modelTurn?.parts[0]?.text) {
              setTranscript(prev => prev + message.serverContent?.modelTurn?.parts[0]?.text);
            }
          },
          onclose: () => stopAssistant(),
          onerror: () => stopAssistant(),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `أنت مساعد ذكي فائق السرعة لأكاديمية Educators Academy.
          مهمتك الرئيسية: مساعدة المسؤول في إدارة الجداول وإضافة المدرسين صوتياً.
          
          الصفوف المتاحة: ${grades.map(g => `${g.name} (ID: ${g.id})`).join(', ')}.
          
          القواعد:
          1. عند تلقي أمر يتعلق بجدول (مثلاً: "حدث جدول الصف الرابع...") استخدم أداة updateSchedule.
          2. عند تلقي معلومات عن مدرس جديد (مثلاً: "ضيف أستاذ علي مدرس فيزياء...") استخدم أداة addTeacher ومرر كل ما سمعته من تفاصيل (الاسم، المادة، الصفوف، المواعيد).
          3. تحدث بلهجة مصرية ودودة، مهنية، ومختصرة جداً لتوفير الوقت.
          4. لا تطلب تأكيداً طويلاً، نفذ الأمر فور فهمه وأخبر المستخدم بالنتيجة.`,
          tools: [{
            functionDeclarations: [
              {
                name: 'updateSchedule',
                description: 'تحديث الجدول الدراسي لصف معين فوراً',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    gradeId: { type: Type.STRING, description: 'معرف الصف الدراسي المستهدف' },
                    scheduleText: { type: Type.STRING, description: 'نص الجدول بالكامل كما ذكره المستخدم' }
                  },
                  required: ['gradeId', 'scheduleText']
                }
              },
              {
                name: 'addTeacher',
                description: 'إضافة مدرس جديد للأكاديمية فوراً',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    teacherInfo: { type: Type.STRING, description: 'كل تفاصيل المدرس المذكورة صوتياً (الاسم، المادة، الصفوف، المواعيد)' }
                  },
                  required: ['teacherInfo']
                }
              }
            ]
          }]
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setIsConnecting(false);
    }
  };

  const stopAssistant = () => {
    setIsActive(false);
    setIsConnecting(false);
    streamRef.current?.getTracks().forEach(track => track.stop());
    sessionRef.current?.close();
    setTranscript('');
  };

  return (
    <div className="fixed bottom-8 left-8 z-[100] flex flex-col items-end gap-4">
      {isActive && (
        <div className="bg-white rounded-3xl shadow-2xl p-6 w-72 border border-emerald-100 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex gap-1">
              <span className="w-1.5 h-6 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
              <span className="w-1.5 h-10 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
              <span className="w-1.5 h-4 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
            </div>
            <span className="font-black text-emerald-600">المساعد الذكي يستمع...</span>
          </div>
          <p className="text-gray-500 text-sm font-bold leading-relaxed">
            مثال: "ضيف أستاذ ناصر مدرس لغة عربية متميز للثانوي بيتواجد سبت وتلات"
          </p>
        </div>
      )}

      <button
        onClick={toggleAssistant}
        disabled={isConnecting}
        className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 ${isActive ? 'bg-red-500 text-white' : 'bg-[#10b981] text-white hover:bg-emerald-600'
          } ${isConnecting ? 'opacity-50 cursor-wait' : ''}`}
      >
        {isConnecting ? (
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        ) : isActive ? (
          <span className="text-3xl">✕</span>
        ) : (
          <span className="text-4xl">🎙️</span>
        )}
      </button>
    </div>
  );
};
