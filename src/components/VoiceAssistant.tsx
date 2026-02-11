
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
  const [mode, setMode] = useState<'online' | 'offline'>(apiKey ? 'online' : 'offline');

  // --- Online AI Resources ---
  const audioContextRes = useRef<AudioContext | null>(null);
  const nextStartTime = useRef(0);
  const sources = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- Offline AI Resources ---
  const recognitionRef = useRef<any>(null); // webkitSpeechRecognition
  const synthesisRef = useRef<SpeechSynthesis>(window.speechSynthesis);

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

  // --- Offline Logic (Web Speech API) ---
  const speak = (text: string) => {
    if (!synthesisRef.current) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-EG'; // Egyptian Arabic
    synthesisRef.current.speak(utterance);
  };

  const startOfflineAssistant = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("المتصفح لا يدعم المساعد الصوتي. يرجى استخدام Chrome أو Edge.");
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'ar-EG';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsActive(true);
      setIsConnecting(false);
      speak("أهلاً بك. أنا المساعد الصوتي. يمكنك أن تطلب مني تحديث الجداول أو إضافة مدرسين.");
    };

    recognition.onresult = async (event: any) => {
      const lastResult = event.results[event.results.length - 1];
      const text = lastResult[0].transcript;
      if (lastResult.isFinal) {
        console.log("Heard:", text);

        // Simple Intent Recognition
        if (text.includes("جدول") || text.includes("حصص")) {
          // Try to find grade name
          const grade = grades.find(g => text.includes(g.name));
          if (grade) {
            speak(`جاري تحديث جدول ${grade.name}`);
            await onUpdateSchedule(grade.id, text);
            speak("تم التحديث بنجاح");
          } else {
            speak("من فضلك حدد اسم الصف الدراسي بوضوح");
          }
        } else if (text.includes("مدرس") || text.includes("أستاذ") || text.includes("مستر")) {
          speak("جاري إضافة بيانات المدرس");
          await onAddTeacher(text);
          speak("تمت الإضافة");
        } else {
          speak("لم أفهم الأمر. يمكنك قول: حدث جدول الصف الرابع، أو: ضيف مستر محمد مدرس دراسات");
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Error:", event.error);
      stopAssistant();
    };

    recognition.onend = () => {
      if (isActive) recognition.start(); // Restart if still active
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // --- AI Connection ---
  const toggleAssistant = async () => {
    if (isActive) {
      stopAssistant();
      return;
    }

    // Determine Mode
    const key = apiKey || process.env.API_KEY;
    if (key) {
      setMode('online');
      startOnlineAssistant(key);
    } else {
      setMode('offline');
      setIsConnecting(true);
      startOfflineAssistant();
    }
  };

  const startOnlineAssistant = async (key: string) => {
    setIsConnecting(true);
    try {
      // Initialize GoogleGenAI right before making an API call
      const ai = new GoogleGenAI({ apiKey: key });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      audioContextRes.current = outputCtx;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          // ... (Existing callbacks kept for brevity, effectively same structure)
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
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                let result = "حدث خطأ";
                if (fc.name === 'updateSchedule') {
                  await onUpdateSchedule(fc.args.gradeId, fc.args.scheduleText);
                  result = "تم التحديث";
                } else if (fc.name === 'addTeacher') {
                  await onAddTeacher(fc.args.teacherInfo);
                  result = "تمت الإضافة";
                }
                sessionPromise.then(s => s.sendToolResponse({
                  functionResponses: { id: fc.id, name: fc.name, response: { result } }
                }));
              }
            }
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
          },
          onclose: () => stopAssistant(),
          onerror: () => stopAssistant(),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `أنت مساعد أكاديمية Educators. مهمتك: إدارة الجداول وإضافة المدرسين.`,
          tools: [{
            functionDeclarations: [
              { name: 'updateSchedule', parameters: { type: Type.OBJECT, properties: { gradeId: { type: Type.STRING }, scheduleText: { type: Type.STRING } }, required: ['gradeId', 'scheduleText'] } },
              { name: 'addTeacher', parameters: { type: Type.OBJECT, properties: { teacherInfo: { type: Type.STRING } }, required: ['teacherInfo'] } }
            ]
          }]
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setIsConnecting(false);
      // Fallback to offline if online fails
      alert("فشل الاتصال بالخادم. الانتقال للوضع المحلي.");
      setMode('offline');
      startOfflineAssistant();
    }
  };

  const stopAssistant = () => {
    setIsActive(false);
    setIsConnecting(false);

    // Stop Online
    streamRef.current?.getTracks().forEach(track => track.stop());
    sessionRef.current?.close();

    // Stop Offline
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  return (
    <div className="fixed bottom-8 left-8 z-[100] flex flex-col items-end gap-4">
      {isActive && (
        <div className={`rounded-3xl shadow-2xl p-6 w-72 border animate-in slide-in-from-bottom-4 ${mode === 'online' ? 'bg-white border-emerald-100' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex gap-1">
              <span className={`w-1.5 h-6 rounded-full animate-bounce ${mode === 'online' ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ animationDelay: '0s' }}></span>
              <span className={`w-1.5 h-10 rounded-full animate-bounce ${mode === 'online' ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ animationDelay: '0.1s' }}></span>
              <span className={`w-1.5 h-4 rounded-full animate-bounce ${mode === 'online' ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ animationDelay: '0.2s' }}></span>
            </div>
            <span className={`font-black ${mode === 'online' ? 'text-emerald-600' : 'text-blue-600'}`}>
              {mode === 'online' ? 'Gemini Live Connected' : 'المساعد الصوتي المحلي'}
            </span>
          </div>
          <p className="text-gray-500 text-sm font-bold leading-relaxed">
            {mode === 'online'
              ? 'مثال: "ضيف أستاذ ناصر مدرس لغة عربية متميز للثانوي بيتواجد سبت وتلات"'
              : 'جرب قول: "حدث جدول الصف الخامس..." أو "ضيف مدرس..."'
            }
          </p>
        </div>
      )}

      <button
        onClick={toggleAssistant}
        disabled={isConnecting}
        className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 ${isActive
            ? 'bg-red-500 text-white'
            : mode === 'online' ? 'bg-[#10b981] text-white hover:bg-emerald-600' : 'bg-blue-600 text-white hover:bg-blue-700'
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
