
import { GoogleGenAI, Type } from "@google/genai";
import { DaySchedule, Teacher } from "../types";

// Helper for fallback parsing
const parseScheduleRegex = (text: string): DaySchedule[] => {
  // Map input variations to Standard Arabic Day Names
  const daysMap: { [key: string]: string } = {
    'الأحد': 'الأحد', 'الاحد': 'الأحد', 'sunday': 'الأحد', 'sun': 'الأحد', 'حد': 'الأحد',
    'الإثنين': 'الإثنين', 'الاثنين': 'الإثنين', 'monday': 'الإثنين', 'mon': 'الإثنين', 'الاتنين': 'الإثنين',
    'الثلاثاء': 'الثلاثاء', 'thursday': 'الثلاثاء', 'tue': 'الثلاثاء', 'tues': 'الثلاثاء', 'تلات': 'الثلاثاء',
    'الأربعاء': 'الأربعاء', 'الاربعاء': 'الأربعاء', 'wed': 'الأربعاء', 'اربع': 'الأربعاء',
    'الخميس': 'الخميس', 'thu': 'الخميس', 'thurs': 'الخميس',
    'الجمعة': 'الجمعة', 'fri': 'الجمعة',
    'السبت': 'السبت', 'sat': 'السبت'
  };

  // Subject Configuration with Arabic Names
  const subjectConfig: { [key: string]: { name: string, color: string, icon: string, keywords: string[] } } = {
    'Math': { name: 'الرياضيات', color: 'bg-blue-100 text-blue-800', icon: '📐', keywords: ['رياضيات', 'جبر', 'هندسة', 'حساب', 'math', 'ماث'] },
    'Science': { name: 'العلوم', color: 'bg-green-100 text-green-800', icon: '🔬', keywords: ['علوم', 'فيزياء', 'kimya', 'science', 'physics', 'chemistry', 'biology', 'أحياء', 'كيمياء', 'ساينس'] },
    'Arabic': { name: 'اللغة العربية', color: 'bg-emerald-100 text-emerald-800', icon: '📖', keywords: ['عربي', 'لغة عربية', 'arabic', 'نحو', 'نصوص', 'لغه عربيه', 'اللغه العربيه'] },
    'English': { name: 'اللغة الإنجليزية', color: 'bg-red-100 text-red-800', icon: '🅰️', keywords: ['انجليزي', 'إنجليزي', 'english', 'انقلش'] },
    'Social': { name: 'الدراسات الاجتماعية', color: 'bg-yellow-100 text-yellow-800', icon: '🌍', keywords: ['دراسات', 'تاريخ', 'جغرافيا', 'social', 'history'] },
    'Religion': { name: 'التربية الدينية', color: 'bg-purple-100 text-purple-800', icon: '🕌', keywords: ['دين', 'تربية دينية', 'islamic', 'quran', 'قرآن'] },
    'Art': { name: 'التربية الفنية', color: 'bg-pink-100 text-pink-800', icon: '🎨', keywords: ['رسم', 'art', 'فنية'] },
    'Sport': { name: 'التربية الرياضية', color: 'bg-orange-100 text-orange-800', icon: '⚽', keywords: ['ألعاب', 'رياضة', 'sport', 'pe'] }
  };

  const schedule: DaySchedule[] = [];
  const getDaySchedule = (dKey: string) => {
    let d = schedule.find(s => s.day === dKey);
    if (!d) {
      d = { day: dKey, slots: [] };
      schedule.push(d);
    }
    return d;
  };

  // Pre-processing: Normalize text
  const cleanedText = text
    .replace(/،/g, ' ')
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    // Fix "and" attached to words (e.g. "والسبت" -> " والسبت ")
    .replace(/ و/g, ' و ')
    .replace(/\s+/g, ' ');

  // Split into logical lines/statements
  const lines = text.split(/\n|\.|،/).map(l => l.trim()).filter(l => l.length > 2);

  let currentSubject = 'نشاط عام';
  let currentStyles = { color: 'bg-gray-100 text-gray-800', icon: '📚' };

  for (const line of lines) {
    // 1. Check if this line defines a NEW Subject (Context Switch)
    let foundSubjectInLine = '';
    let foundConfig = null;

    for (const [key, config] of Object.entries(subjectConfig)) {
      if (config.keywords.some(k => line.toLowerCase().includes(k))) {
        foundSubjectInLine = config.name;
        foundConfig = config;
        break;
      }
    }

    const hasTime = /\d/.test(line);
    const hasDay = Object.keys(daysMap).some(d => line.includes(d));

    // Case A: Pure Subject Line (e.g. "اللغة العربية")
    if (foundSubjectInLine && !hasTime && !hasDay) {
      currentSubject = foundSubjectInLine;
      currentStyles = foundConfig!;
      continue; // Move to next line to find days/times for this subject
    }

    // Case B: Schedule Line (e.g. "Saturday 4pm" or "Saturday and Monday 5")
    if (hasDay) {
      let activeSubject = currentSubject;
      let activeStyles = currentStyles;

      if (foundSubjectInLine) {
        activeSubject = foundSubjectInLine;
        activeStyles = foundConfig!;
      }

      // Extract Days using the comprehensive map
      const dayMatches: { day: string, index: number }[] = [];
      for (const [ar, output] of Object.entries(daysMap)) {
        const regex = new RegExp(ar, 'gi');
        let match;
        while ((match = regex.exec(line)) !== null) {
          // Avoid duplicate matches for same index
          if (!dayMatches.some(d => d.index === match!.index)) {
            dayMatches.push({ day: output, index: match.index });
          }
        }
      }
      dayMatches.sort((a, b) => a.index - b.index);

      // Extract all times
      const timeMatches: { time: string, index: number, raw: string }[] = [];
      const timeRegex = /(\d{1,2})(:\d{2})?\s*(م|ص|pm|am|مساءً|صباحاً)?|الساعة\s*(\d{1,2})/gi;
      let tMatch;
      while ((tMatch = timeRegex.exec(line)) !== null) {
        let raw = tMatch[0];
        let hourStr = tMatch[1] || tMatch[4];
        let hour = parseInt(hourStr);
        if (hour) {
          let period = 'ص'; // Default Arabic Morning
          // Heuristics for PM
          if (raw.match(/م|pm|مساءً|PM/i)) period = 'م';
          else if (hour >= 12 && hour <= 6) period = 'م';
          else if (hour >= 1 && hour <= 6) period = 'م';
          else if (hour >= 7 && hour <= 11) period = 'ص';

          // Format in Arabic style: 4:00 م
          let finalTime = `${hour}:00 ${period}`;
          timeMatches.push({ time: finalTime, index: tMatch.index, raw });
        }
      }

      if (dayMatches.length > 0) {
        if (timeMatches.length === 1) {
          // Shared Time: Assign this single time to ALL found days
          dayMatches.forEach(dm => {
            const dayObj = getDaySchedule(dm.day);
            dayObj.slots.push({
              id: `s-${Math.random()}`,
              subject: activeSubject,
              time: timeMatches[0].time,
              color: activeStyles.color,
              icon: activeStyles.icon
            });
          });
        } else if (timeMatches.length > 1) {
          // Multiple Times: Assign to closest day
          dayMatches.forEach((dm, i) => {
            const nextDayIndex = dayMatches[i + 1]?.index ?? Infinity;
            const relevantTime = timeMatches.find(tm => tm.index > dm.index && tm.index < nextDayIndex);
            const usedTime = relevantTime || timeMatches[timeMatches.length - 1];

            if (usedTime) {
              const dayObj = getDaySchedule(dm.day);
              dayObj.slots.push({
                id: `s-${Math.random()}`,
                subject: activeSubject,
                time: usedTime.time,
                color: activeStyles.color,
                icon: activeStyles.icon
              });
            }
          });
        }
      }
    }
  }

  // Fallback
  if (schedule.length === 0 && text.trim()) {
    schedule.push({
      day: 'الأحد',
      slots: [{
        id: `s-${Math.random()}`,
        subject: text.trim().substring(0, 30),
        time: '09:00 ص',
        color: 'bg-blue-100 text-blue-800',
        icon: '📝'
      }]
    });
  }

  return schedule;
};

export const parseScheduleWithAI = async (textInput: string, apiKey?: string): Promise<DaySchedule[]> => {
  try {
    const key = apiKey || process.env.API_KEY;
    if (!key) {
      console.warn("API Key missing, using Smart Context Regex parser.");
      return parseScheduleRegex(textInput);
    }
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `أنت مساعد ذكي يفهم اللهجة المصرية واللغة العربية جيداً.
      قم بتحويل النص التالي (جدول حصص) إلى تنسيق JSON منظم.
      
      النص: "${textInput}"
      
      المطلوب:
      1. مصفوفة من الأيام، ويجب أن تكون أسماء الأيام باللغة العربية (الأحد، الإثنين، الثلاثاء، إلخ).
      2. كل يوم يحتوي على قائمة "slots" (حصص).
      3. بيانات الحصة:
         - subject: اسم المادة باللغة العربية.
         - time: الوقت بتنسيق عربي (مثل "09:00 ص" أو "04:00 م").
         - color: لون مناسب من Tailwind (مثال: "bg-blue-100 text-blue-800").
         - icon: إيموجي مناسب.
         - id: معرف عشوائي.
      
      تعامل بذكاء مع النصوص غير المرتبة أو المكتوبة باللهجة العامية (مثل "ماث"، "ساينس"، "الاتنين").`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              day: { type: Type.STRING },
              slots: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    subject: { type: Type.STRING },
                    time: { type: Type.STRING },
                    color: { type: Type.STRING },
                    icon: { type: Type.STRING }
                  },
                  required: ['id', 'subject', 'time', 'color', 'icon']
                }
              }
            },
            required: ['day', 'slots']
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    return JSON.parse(text.trim()) as DaySchedule[];
  } catch (error) {
    console.error("AI Schedule Parsing Error:", error);
    return parseScheduleRegex(textInput);
  }
};

export const parseTeachersWithAI = async (textInput: string, apiKey?: string): Promise<Partial<Teacher>[]> => {
  try {
    const key = apiKey || process.env.API_KEY;
    if (!key) {
      console.warn("API Key is missing for teacher parsing.");
      return [];
    }
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `قم بتحليل النص التالي لاستخراج بيانات المدرسين وتحويلها إلى JSON.
      المدخلات: "${textInput}"
      
      المخرجات المطلوبة (باللغة العربية):
      - name: اسم المدرس.
      - subject: المادة (عربي).
      - bio: نبذة مختصرة (عربي).
      - availability: أيام التواجد (عربي).
      - teachingHours: ساعات العمل (عربي).
      - grades: قائمة الصفوف (عربي).
      - imageUrl: رابط صورة عشوائي.
      - id: معرف عشوائي.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              subject: { type: Type.STRING },
              bio: { type: Type.STRING },
              availability: { type: Type.STRING },
              teachingHours: { type: Type.STRING },
              grades: { type: Type.ARRAY, items: { type: Type.STRING } },
              imageUrl: { type: Type.STRING }
            },
            required: ['id', 'name', 'subject', 'bio', 'availability', 'teachingHours', 'grades', 'imageUrl']
          }
        }
      }
    });

    return JSON.parse(response.text.trim());
  } catch (error) {
    console.error("AI Teacher Parsing Error:", error);
    return [];
  }
};
