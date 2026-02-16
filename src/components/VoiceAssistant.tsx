import React, { useState, useEffect } from 'react';
import { GradeData, Teacher, Course } from '../types';
import { voiceManager } from '../services/VoiceManager';
import { aiVoiceService, Message } from '../services/aiVoiceService';
import { executeFunctionCall, AppContext } from '../services/voiceFunctions';

interface VoiceAssistantProps {
  // State
  grades: GradeData[];
  teachers: Teacher[];
  courses: Course[];

  // Setters
  setGrades: (grades: GradeData[]) => void;
  setTeachers: (teachers: Teacher[]) => void;
  setCourses: (courses: Course[]) => void;

  // Navigation
  onNavigate: (view: 'home' | 'stages' | 'grade' | 'admin' | 'teachers') => void;

  // API Key
  apiKey?: string;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  grades,
  teachers,
  courses,
  setGrades,
  setTeachers,
  setCourses,
  onNavigate,
  apiKey,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [feedback, setFeedback] = useState('اضغط للتحدث');
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Initialize AI when API key changes
  useEffect(() => {
    if (apiKey) {
      aiVoiceService.initialize(apiKey);
    }
  }, [apiKey]);

  // Helper functions for context
  const findTeacher = (query: string): Teacher | null => {
    const q = query.toLowerCase();
    return teachers.find(
      t => t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)
    ) || null;
  };

  const findCourse = (query: string): Course | null => {
    const q = query.toLowerCase();
    return courses.find(
      c => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    ) || null;
  };

  const findGrade = (query: string): GradeData | null => {
    const q = query.toLowerCase();
    return grades.find(g => g.name.toLowerCase().includes(q)) || null;
  };

  // Build app context
  const buildContext = (): AppContext => ({
    grades,
    teachers,
    courses,
    currentView: 'home',
    setGrades,
    setTeachers,
    setCourses,
    navigate: onNavigate,
    findTeacher,
    findCourse,
    findGrade,
  });

  useEffect(() => {
    let mounted = true;

    const processVoiceLoop = async () => {
      if (!isActive || !mounted) return;

      try {
        // 1. Listen to user
        setIsListening(true);
        setIsThinking(false);
        setIsExecuting(false);
        setFeedback('أستمع إليك... 🎤');

        const command = await voiceManager.listen();
        if (!mounted || !isActive) return;

        setIsListening(false);
        setFeedback(`سمعت: "${command}"`);
        console.log('🎙️ Voice Command:', command);

        // Add to history
        setConversationHistory(prev => [
          ...prev,
          { role: 'user', parts: command },
        ]);

        // 2. Process with AI
        if (!aiVoiceService.isReady()) {
          // Fallback: No AI available
          const fallbackMsg = 'المساعد الذكي مش شغال. تأكد من إضافة API Key. افتح F12 → Console واكتب: localStorage.setItem("gemini_api_key", "YOUR_KEY")';
          await voiceManager.say(fallbackMsg);
          setFeedback('❌ ' + fallbackMsg);

          if (mounted && isActive) {
            await new Promise(r => setTimeout(r, 3000));
            processVoiceLoop();
          }
          return;
        }

        setIsThinking(true);
        setFeedback('جاري التفكير... 🧠');

        const aiResponse = await aiVoiceService.processCommand(
          command,
          conversationHistory
        );

        if (!mounted || !isActive) return;
        setIsThinking(false);

        console.log('🤖 AI Response:', aiResponse);

        // 3. Execute function calls if any
        if (aiResponse.functionCalls && aiResponse.functionCalls.length > 0) {
          setIsExecuting(true);
          setFeedback('تنفيذ الأمر... ⚙️');

          const context = buildContext();
          const results = [];

          for (const fc of aiResponse.functionCalls) {
            const result = await executeFunctionCall(fc, context);
            results.push(result);
            console.log('✅ Function result:', result);
          }

          // Combine results for response
          const successMessages = results
            .filter(r => r.success)
            .map(r => r.message)
            .join('. ');

          const failureMessages = results
            .filter(r => !r.success)
            .map(r => r.message)
            .join('. ');

          let finalMessage = aiResponse.text;
          if (successMessages) {
            finalMessage = successMessages;
          }
          if (failureMessages) {
            finalMessage += (finalMessage ? '. ' : '') + failureMessages;
          }

          setIsExecuting(false);
          setFeedback(finalMessage);
          await voiceManager.say(finalMessage);

          // Add to history
          setConversationHistory(prev => [
            ...prev,
            { role: 'model', parts: finalMessage },
          ]);
        } else {
          // No function calls, just speak the response
          setFeedback(aiResponse.text);
          await voiceManager.say(aiResponse.text);

          // Add to history
          setConversationHistory(prev => [
            ...prev,
            { role: 'model', parts: aiResponse.text },
          ]);
        }

      } catch (error) {
        console.error('Voice Error:', error);
        if (mounted && isActive) {
          const errorMsg = typeof error === 'string' ? error : 'لم أسمع جيداً... 😕';
          setFeedback(errorMsg);

          // Don't speak error messages that are informational
          if (typeof error === 'string' && !error.includes('timeout')) {
            await voiceManager.say(error);
          }
        }
      }

      // Continue loop
      if (mounted && isActive) {
        await new Promise(r => setTimeout(r, 1000));
        processVoiceLoop();
      }
    };

    if (isActive) {
      processVoiceLoop();
    } else {
      setIsListening(false);
      setIsThinking(false);
      setIsExecuting(false);
      setFeedback('اضغط للتحدث');
      window.speechSynthesis.cancel();
    }

    return () => {
      mounted = false;
    };
  }, [isActive, conversationHistory, grades, teachers, courses]);

  const toggleAssistant = () => {
    setIsActive(!isActive);
    if (isActive) {
      // Reset history when closing
      setConversationHistory([]);
    }
  };

  const getStatusIcon = () => {
    if (isListening) return '🎤';
    if (isThinking) return '🧠';
    if (isExecuting) return '⚙️';
    return '💬';
  };

  const getStatusColor = () => {
    if (isListening) return 'bg-red-500';
    if (isThinking) return 'bg-blue-500';
    if (isExecuting) return 'bg-yellow-500';
    return 'bg-gray-300';
  };

  return (
    <div className="fixed bottom-8 left-8 z-[100] flex flex-col items-end gap-4">
      {/* Conversation Panel */}
      {isActive && (
        <div className="rounded-3xl shadow-2xl w-80 border bg-white border-emerald-100 animate-in slide-in-from-bottom-4 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${getStatusColor()} ${isListening || isThinking || isExecuting ? 'animate-pulse' : ''}`}></div>
                <span className="font-black">
                  {aiVoiceService.isReady() ? 'المساعد الذكي 🤖' : 'المساعد (بدون AI)'}
                </span>
              </div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-white/80 hover:text-white text-sm"
              >
                {showHistory ? '📖' : '📝'}
              </button>
            </div>
          </div>

          {/* Current Status */}
          <div className="p-4 border-b">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{getStatusIcon()}</span>
              <p className="text-gray-700 text-sm font-bold leading-relaxed flex-1">
                {feedback}
              </p>
            </div>
          </div>

          {/* Conversation History */}
          {showHistory && conversationHistory.length > 0 && (
            <div className="p-4 max-h-60 overflow-y-auto bg-gray-50">
              <div className="space-y-3">
                {conversationHistory.slice(-6).map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl text-sm ${msg.role === 'user'
                      ? 'bg-blue-100 text-blue-900 mr-4'
                      : 'bg-emerald-100 text-emerald-900 ml-4'
                      }`}
                  >
                    <div className="font-bold text-xs mb-1">
                      {msg.role === 'user' ? 'أنت' : 'المساعد'}
                    </div>
                    {msg.parts}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Tips */}
          {!showHistory && (
            <div className="p-4 bg-gray-50 text-xs text-gray-600">
              <div className="font-bold mb-2">💡 أمثلة:</div>
              <div className="space-y-1">
                <div>• "ضيف مدرس اسمه أحمد، رياضيات"</div>
                <div>• "ورّيني قائمة المدرسين"</div>
                <div>• "كام مدرس عندنا؟"</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={toggleAssistant}
        className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 ${isActive
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600'
          }`}
        title={isActive ? 'إيقاف المساعد' : 'تشغيل المساعد الصوتي'}
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
