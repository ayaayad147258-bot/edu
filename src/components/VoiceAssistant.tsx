import React, { useState, useEffect } from 'react';
import { GradeData } from '../types';
import { voiceManager } from '../services/VoiceManager';

interface VoiceAssistantProps {
  onUpdateSchedule: (gradeId: string, text: string) => Promise<void>;
  onAddTeacher: (text: string) => Promise<void>;
  onNavigate: (view: 'home' | 'stages' | 'grade' | 'admin' | 'teachers') => void;
  grades: GradeData[];
  apiKey?: string; // Kept for compatibility if we want to add online mode back later, but currently unused/offline-focused
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ onUpdateSchedule, onAddTeacher, onNavigate, grades, apiKey }) => {
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState("اضغط للتحدث");

  useEffect(() => {
    let mounted = true;

    const processVoiceLoop = async () => {
      if (!isActive || !mounted) return;

      setIsListening(true);
      setFeedback("أستمع إليك... | Listening");

      try {
        const command = await voiceManager.listen();
        if (!mounted || !isActive) return;

        setIsListening(false);
        setFeedback(`سمعت: "${command}"`);
        console.log("Voice Command:", command);

        // --- Command Processing Logic ---
        const lowerCmd = command.toLowerCase();

        if (lowerCmd.includes("جدول") || lowerCmd.includes("حصص")) {
          await voiceManager.say("حاضر، سأقوم بفتح جدول الحصص للمراحل الدراسية.");
          onNavigate('stages');
        }
        else if (lowerCmd.includes("تسجيل") || lowerCmd.includes("جديد")) {
          await voiceManager.say("جاري تحويلك للصفحة الرئيسية للتسجيل.");
          onNavigate('home');
        }
        else if (lowerCmd.includes("مدرسين") || lowerCmd.includes("معلمين")) {
          await voiceManager.say("تفضل، هذه قائمة المدرسين لدينا.");
          onNavigate('teachers');
        }
        else if (lowerCmd.includes("المعاصر") || lowerCmd.includes("كتب")) {
          await voiceManager.say("كتب المعاصر متوفرة في قسم الرياضيات، هل أفتح لك القائمة؟");
          console.log("Processing El-Moasser request...");
        }
        else {
          // Default: Try to parse as admin command (Update/Add)
          if (lowerCmd.includes("ضيف") || lowerCmd.includes("مدرس")) {
            await voiceManager.say("جاري إضافة المدرس...");
            await onAddTeacher(command);
            await voiceManager.say("تمت المحاولة.");
          } else if (lowerCmd.includes("حدث") || lowerCmd.includes("تغيير")) {
            const grade = grades.find(g => command.includes(g.name));
            if (grade) {
              await voiceManager.say(`جاري تحديث جدول ${grade.name}`);
              await onUpdateSchedule(grade.id, command);
            } else {
              await voiceManager.say("لم أتعرف على الصف الدراسي. يرجى التوضيح.");
            }
          } else {
            await voiceManager.say("عذراً، لم أفهم الأمر. يمكنك قول: الجدول، أو تسجيل، أو المدرسين.");
          }
        }

      } catch (error) {
        // console.error("Voice Error:", error);
        if (mounted && isActive) {
          setFeedback("لم أسمع جيداً...");
        }
      }

      // Continuous loop check
      if (mounted && isActive) {
        // Small delay to prevent rapid loops on error
        await new Promise(r => setTimeout(r, 1000));
        processVoiceLoop();
      }
    };

    if (isActive) {
      processVoiceLoop();
    } else {
      setIsListening(false);
      setFeedback("اضغط للتحدث");
      // Ensure synth stops
      window.speechSynthesis.cancel();
    }

    return () => { mounted = false; };
  }, [isActive, onNavigate, onAddTeacher, onUpdateSchedule, grades]);

  const toggleAssistant = () => {
    if (isActive) {
      setIsActive(false);
    } else {
      setIsActive(true);
    }
  };

  return (
    <div className="fixed bottom-8 left-8 z-[100] flex flex-col items-end gap-4">
      {isActive && (
        <div className="rounded-3xl shadow-2xl p-6 w-72 border bg-white border-emerald-100 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></div>
            <span className="font-black text-emerald-600">
              المساعد الذكي (Offline)
            </span>
          </div>
          <p className="text-gray-600 text-sm font-bold leading-relaxed">
            {feedback}
          </p>
        </div>
      )}

      <button
        onClick={toggleAssistant}
        className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 ${isActive
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-[#10b981] text-white hover:bg-emerald-600'
          }`}
      >
        {isActive ? (
          <span className="text-3xl">✕</span>
        ) : (
          <span className="text-4xl">🎙️</span>
        )}
      </button>
    </div>
  );
};
