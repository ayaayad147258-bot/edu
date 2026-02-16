
import React, { useState, useEffect } from 'react';
import { GradeData, Teacher, Course, Stage, StageSubjects, CourseMedia, DaySchedule, ScheduleSlot } from '../types';
import { parseScheduleWithAI, parseTeachersWithAI } from '../services/geminiService';
import { STAGES, ACADEMY_CONFIG, INITIAL_STAGE_SUBJECTS } from '../constants';
import { VoiceAssistant } from './VoiceAssistant';
import { dbService } from '../services/dbService';
import { GoogleGenAI } from "@google/genai";
import logo from '../assets/logo.png';



const TimePicker = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
  // Parse initial value
  const parseTime = (timeStr: string) => {
    let hour = '12';
    let minute = '00';
    let period = 'AM'; // 'AM' -> 'ص', 'PM' -> 'م' in UI

    if (!timeStr) return { hour, minute, period };

    // Try parsing "HH:mm" (24h)
    const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      let h = parseInt(match24[1]);
      const m = match24[2];
      period = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      hour = h.toString();
      minute = m;
      return { hour, minute, period };
    }

    // Try parsing "h:mm A" (Arabic/English)
    const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(.*)$/);
    if (match12) {
      hour = match12[1];
      minute = match12[2];
      const p = match12[3].trim();
      period = (p === 'م' || p === 'PM' || p === 'مساءً') ? 'PM' : 'AM';
      return { hour, minute, period };
    }

    return { hour, minute, period };
  };

  const { hour: initHour, minute: initMinute, period: initPeriod } = parseTime(value);
  const [hour, setHour] = useState(initHour);
  const [minute, setMinute] = useState(initMinute);
  const [period, setPeriod] = useState(initPeriod);

  // Sync internal state if value prop changes externally (optional but good)
  useEffect(() => {
    const { hour, minute, period } = parseTime(value);
    setHour(hour);
    setMinute(minute);
    setPeriod(period);
  }, [value]);

  const updateTime = (h: string, m: string, p: string) => {
    setHour(h);
    setMinute(m);
    setPeriod(p);
    const suffix = p === 'AM' ? 'ص' : 'م';
    onChange(`${h}:${m} ${suffix}`); // "09:30 ص"
  };

  return (
    <div className="flex items-center gap-1" dir="ltr">

      {/* Period */}
      <select
        value={period}
        onChange={(e) => updateTime(hour, minute, e.target.value)}
        className="bg-gray-50 border border-gray-200 rounded-lg p-1 text-sm font-bold outline-none focus:border-[#0a192f] w-16 text-center"
      >
        <option value="AM">صباحاً</option>
        <option value="PM">مساءً</option>
      </select>

      {/* Minute */}
      <select
        value={minute}
        onChange={(e) => updateTime(hour, e.target.value, period)}
        className="bg-gray-50 border border-gray-200 rounded-lg p-1 text-sm font-bold outline-none focus:border-[#0a192f] w-14 text-center"
      >
        {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <span className="font-bold">:</span>

      {/* Hour */}
      <select
        value={hour}
        onChange={(e) => updateTime(e.target.value, minute, period)}
        className="bg-gray-50 border border-gray-200 rounded-lg p-1 text-sm font-bold outline-none focus:border-[#0a192f] w-14 text-center"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
    </div>
  );
};

interface AdminDashboardProps {
  grades: GradeData[];
  setGrades: React.Dispatch<React.SetStateAction<GradeData[]>>;
  teachers: Teacher[];
  setTeachers: React.Dispatch<React.SetStateAction<Teacher[]>>;
  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  onLogout: () => void;
  apiKey: string;
  setApiKey: React.Dispatch<React.SetStateAction<string>>;
  anthropicApiKey: string;
  setAnthropicApiKey: React.Dispatch<React.SetStateAction<string>>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  grades, setGrades, teachers, setTeachers, courses, setCourses, onLogout, apiKey, setApiKey, anthropicApiKey, setAnthropicApiKey
}) => {
  const [activeTab, setActiveTab] = useState<'ai-schedule' | 'teachers' | 'subjects' | 'courses' | 'settings'>(() => {
    return (localStorage.getItem('admin_active_tab') as any) || 'ai-schedule';
  });

  // Persist Admin Tab
  useEffect(() => {
    localStorage.setItem('admin_active_tab', activeTab);
  }, [activeTab]);
  const [managementSubTab, setManagementSubTab] = useState<'list' | 'add' | 'ai-add'>('list');
  const [courseSubTab, setCourseSubTab] = useState<'list' | 'add'>('list');

  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);


  const [stageSubjects, setStageSubjects] = useState<StageSubjects[]>(() => {
    const saved = localStorage.getItem('academy_stage_subjects');
    return saved ? JSON.parse(saved) : INITIAL_STAGE_SUBJECTS;
  });

  const [aiInput, setAiInput] = useState('');
  const [scheduleAiInput, setScheduleAiInput] = useState(''); // for AI Schedule Tab
  const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'claude'>('gemini'); // AI Provider State
  const [scheduleSubTab, setScheduleSubTab] = useState<'ai' | 'manual' | 'ramadan'>('ai');
  const [manualScheduleGradeId, setManualScheduleGradeId] = useState('');
  const [manualScheduleData, setManualScheduleData] = useState<DaySchedule[]>([]);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [missingKeyProvider, setMissingKeyProvider] = useState<'gemini' | 'claude'>('gemini');
  const [uploadProgress, setUploadProgress] = useState(0); // Track upload progress


  // Ramadan State
  const [ramadanScheduleGradeId, setRamadanScheduleGradeId] = useState('');
  const [ramadanScheduleData, setRamadanScheduleData] = useState<DaySchedule[]>([]);

  useEffect(() => {
    if (manualScheduleGradeId) {
      const grade = grades.find(g => g.id === manualScheduleGradeId);
      if (grade) {
        // Deep clone to separate local editing state from global grades state
        setManualScheduleData(JSON.parse(JSON.stringify(grade.schedule || [])));
      }
    }
  }, [manualScheduleGradeId, grades]);

  // Effect for Ramadan Data
  useEffect(() => {
    if (ramadanScheduleGradeId) {
      const grade = grades.find(g => g.id === ramadanScheduleGradeId);
      if (grade) {
        setRamadanScheduleData(JSON.parse(JSON.stringify(grade.ramadanSchedule || [])));
      }
    }
  }, [ramadanScheduleGradeId, grades]);

  const [selectedGradeForAi, setSelectedGradeForAi] = useState('');

  const [teacherAiInput, setTeacherAiInput] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState(grades[0]?.id || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(localStorage.getItem('google_sheet_webhook_url') || '');

  // Manual Teacher Form State
  const [newTeacher, setNewTeacher] = useState<Partial<Teacher>>({
    name: '',
    subject: '',
    teachingHours: '',
    availability: '',
    bio: '',
    imageUrl: '',
    grades: [],
    stages: []
  });
  const [newTeacherImage, setNewTeacherImage] = useState<File | null>(null);
  const [editTeacherImage, setEditTeacherImage] = useState<File | null>(null);
  const [isAddingNewSubject, setIsAddingNewSubject] = useState(false);
  const [customSubjectName, setCustomSubjectName] = useState('');

  // Course Form State
  const [newCourseData, setNewCourseData] = useState({
    title: '',
    description: '',
    videoUrl: '',
    thumbnailUrl: '',
    gradeId: ''
  });
  const [newCourseImage, setNewCourseImage] = useState<File | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false); // New state for media upload
  const [courseContentTab, setCourseContentTab] = useState<'info' | 'content'>('info'); // New state for course edit tabs

  const allSubjects = Array.from(new Set(stageSubjects.flatMap(s => s.subjects))).sort();

  // useEffect for checking window.aistudio removed as it's handled in App.tsx
  useEffect(() => {
    dbService.saveGrades(grades);
    dbService.saveTeachers(teachers);
    dbService.saveCourses(courses);
    localStorage.setItem('academy_stage_subjects', JSON.stringify(stageSubjects));
  }, [grades, teachers, courses, stageSubjects]);

  useEffect(() => {
    localStorage.setItem('google_sheet_webhook_url', webhookUrl);
  }, [webhookUrl]);

  const handleSelectApiKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      const key = await window.aistudio.getKey();
      if (key) {
        setApiKey(key);
        alert("تم تفعيل مفتاح الـ API بنجاح! يمكنك الآن استخدام المميزات المتقدمة.");
      }
    }
  };

  const handleAddTeacherByText = async (text?: string) => {
    const input = typeof text === 'string' ? text : teacherAiInput;
    if (!input.trim()) return;

    setIsLoading(true);
    try {
      const parsed = await parseTeachersWithAI(input, apiKey);

      const newTeachersFromAI = (parsed as any[]).map(t => {
        // Map AI grade names to system IDs
        const matchedGradeIds = grades
          .filter(g => t.grades?.some((aiGrade: string) =>
            g.name.includes(aiGrade) || aiGrade.includes(g.name) ||
            (g.stage === 'primary' && aiGrade.includes('ابتدائي')) ||
            (g.stage === 'preparatory' && aiGrade.includes('إعدادي')) ||
            (g.stage === 'secondary' && aiGrade.includes('ثانوي'))
          ))
          .map(g => g.id);

        return {
          ...t,
          id: t.id || `t-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          whatsapp: ACADEMY_CONFIG.phone,
          imageUrl: t.imageUrl || `https://picsum.photos/seed/${Math.random()}/400`,
          grades: matchedGradeIds.length > 0 ? matchedGradeIds : []
        };
      });

      setTeachers(prev => {
        const uniqueTeachers = [...prev];
        newTeachersFromAI.forEach(nt => {
          if (!uniqueTeachers.find(ut => ut.name === nt.name)) uniqueTeachers.push(nt);
        });
        return uniqueTeachers;
      });

      // Update Grades-Teachers relation
      setGrades(prev => prev.map(g => {
        const toAdd = newTeachersFromAI.filter(t => t.grades?.includes(g.id)).map(t => t.id);
        if (toAdd.length > 0) {
          return { ...g, teachers: Array.from(new Set([...g.teachers, ...toAdd])) };
        }
        return g;
      }));

      alert(`تم بنجاح ربط ${newTeachersFromAI.length} مدرسين بالمراحل التعليمية المناسبة!`);
      setTeacherAiInput('');
      setManagementSubTab('list');
    } catch (err: any) {
      console.error(err);
      // Fallback handled by service, just log error or show generic message if needed
      if (!apiKey) {
        console.warn("AI Teacher parsing failed (likely due to missing key), falling back to offline regex.");
      } else {
        alert("حدث خطأ أثناء تحليل البيانات.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadMedia = async (file: File, type: 'video' | 'image' | 'pdf') => {
    if (!editingCourse) return;
    setIsUploadingMedia(true);
    try {
      // 1. Upload File
      const downloadUrl = await dbService.uploadFile(file, `course-content/${editingCourse.id}`, (progress) => setUploadProgress(progress));

      // 2. Create Media Object

      const newMedia: CourseMedia = {
        id: Math.random().toString(36).substr(2, 9),
        title: file.name,
        url: downloadUrl,
        type: type
      };

      // 3. Update State
      const updatedCourse = { ...editingCourse, media: [...(editingCourse.media || []), newMedia] };
      setEditingCourse(updatedCourse);
      setCourses(courses.map(c => c.id === editingCourse.id ? updatedCourse : c));
    } catch (error) {
      console.error("Content Upload Error:", error);
      alert("حدث خطأ أثناء رفع الملف. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsUploadingMedia(false);
      setUploadProgress(0);
    }
  };

  const handleManualAddTeacher = async (e: React.FormEvent) => {

    e.preventDefault();
    const finalSubject = isAddingNewSubject ? customSubjectName : newTeacher.subject;

    if (!newTeacher.name || !finalSubject) return alert("يرجى إكمال البيانات الأساسية");
    if (!newTeacher.stages || newTeacher.stages.length === 0) return alert("يرجى اختيار مرحلة واحدة على الأقل");

    setIsLoading(true);
    try {
      let finalImg = newTeacher.imageUrl || `https://picsum.photos/seed/${Date.now()}/400`;
      if (newTeacherImage) {
        finalImg = await dbService.uploadFile(newTeacherImage, 'teachers', (progress) => setUploadProgress(progress));
      }

      const teacherId = `t-${Date.now()}`;
      const teacherToAdd: Teacher = {
        id: teacherId,
        name: newTeacher.name!,
        subject: finalSubject!,
        imageUrl: finalImg,
        whatsapp: ACADEMY_CONFIG.phone,
        teachingHours: newTeacher.teachingHours || '',
        availability: newTeacher.availability || '',
        bio: newTeacher.bio || '',
        grades: newTeacher.grades || [],
        stages: newTeacher.stages || []
      };

      setTeachers(prev => [...prev, teacherToAdd]);

      if (newTeacher.grades && newTeacher.grades.length > 0) {
        setGrades(prev => prev.map(g => {
          if (newTeacher.grades?.includes(g.id)) {
            return { ...g, teachers: Array.from(new Set([...g.teachers, teacherId])) };
          }
          return g;
        }));
      }

      alert("تمت إضافة المدرس بنجاح وتخصيصه للصفوف المختارة!");
      setManagementSubTab('list');
      resetTeacherForm();
    } catch (err) {
      console.error(err);
      alert("خطأ أثناء حفظ بيانات المدرس");
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const resetTeacherForm = () => {
    setNewTeacher({ name: '', subject: '', bio: '', availability: '', teachingHours: '', imageUrl: '', grades: [], stages: [] });
    setNewTeacherImage(null);
    setIsAddingNewSubject(false);
    setCustomSubjectName('');
  };

  const generateAiCover = async () => {
    if (!newCourseData.title) return alert("يرجى كتابة اسم الكورس أولاً");

    if (!apiKey) {
      // Just warn in console, or allow it to fail gracefully
      console.warn("Attempting 4K image generation without API Key. This will likely fail.");
    }

    setIsGeneratingImage(true);
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey || '' });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{
            text: `High-end 4K cinematic educational course thumbnail for a subject titled "${newCourseData.title}". 
            Atmosphere: Professional, prestigious, elite academic. 
            Visuals: Dramatic studio lighting, shallow depth of field, sharp textures of books and polished wood, 
            luxurious gold and deep navy blue color palette. 
            Style: Inspirational and modern, suitable for Educators Academy.`
          }],
        },
        config: {
          imageConfig: { aspectRatio: "16:9", imageSize: "4K" }
        }
      });

      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (part?.inlineData) {
        const b64 = part.inlineData.data;
        setNewCourseData(prev => ({ ...prev, thumbnailUrl: `data:image/png;base64,${b64}` }));
      } else {
        alert("لم يتمكن الذكاء الاصطناعي من توليد صورة، يرجى المحاولة مرة أخرى.");
      }
    } catch (err: any) {
      console.error(err);
      alert("تعذر توليد الصورة (ربما تحتاج مفتاح API مدفوع).");
      if (err.message?.includes('Requested entity was not found')) {
        // Removed as state is lifted
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleManualAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseData.title || !newCourseData.gradeId) return alert("يرجى اختيار الصف واسم الكورس");

    setIsLoading(true);
    try {
      let finalThumb = newCourseData.thumbnailUrl || '';
      if (newCourseImage) {
        finalThumb = await dbService.uploadFile(newCourseImage, 'courses/thumbs', (progress) => setUploadProgress(progress));
      }

      const selectedGrade = grades.find(g => g.id === newCourseData.gradeId);
      const newId = `c-${Date.now()}`;

      const courseToAdd: Course = {
        id: newId,
        title: newCourseData.title,
        description: newCourseData.description || 'كورس تعليمي متميز من إيدوكيتورز أكاديمي',
        thumbnailUrl: finalThumb || `https://picsum.photos/seed/${newId}/800/400`,
        stage: selectedGrade ? selectedGrade.stage : 'primary',
        grade: selectedGrade ? selectedGrade.name : '',
        gradeId: newCourseData.gradeId,
        media: newCourseData.videoUrl ? [{
          id: `m-${Date.now()}`,
          title: 'الفيديو التعريفي',
          url: newCourseData.videoUrl,
          type: 'video'
        }] : []
      };

      setCourses(prev => [...prev, courseToAdd]);
      setGrades(prev => prev.map(g => {
        if (g.id === newCourseData.gradeId) {
          return { ...g, courses: Array.from(new Set([...g.courses, newId])) };
        }
        return g;
      }));
      alert("تم إنشاء الكورس بنجاح!");
      setCourseSubTab('list');
      setNewCourseData({ title: '', description: '', videoUrl: '', thumbnailUrl: '', gradeId: '' });
      setNewCourseImage(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const toggleStageSelection = (stageId: Stage) => {
    setNewTeacher(prev => {
      const stages = prev.stages || [];
      const newStages = stages.includes(stageId)
        ? stages.filter(s => s !== stageId)
        : [...stages, stageId];
      const allowedGrades = grades.filter(g => newStages.includes(g.stage)).map(g => g.id);
      const newGrades = (prev.grades || []).filter(gid => allowedGrades.includes(gid));
      return { ...prev, stages: newStages, grades: newGrades };
    });
  };

  const toggleGradeSelection = (gradeId: string) => {
    setNewTeacher(prev => {
      const gids = prev.grades || [];
      const newGids = gids.includes(gradeId)
        ? gids.filter(id => id !== gradeId)
        : [...gids, gradeId];
      return { ...prev, grades: newGids };
    });
  };

  const handleUpdateTeacher = async (teacher: Teacher) => {
    setIsLoading(true);
    try {
      let finalImg = teacher.imageUrl;
      if (editTeacherImage) {
        finalImg = await dbService.uploadFile(editTeacherImage, 'teachers', (progress) => setUploadProgress(progress));
      }
      const updatedTeacher = { ...teacher, imageUrl: finalImg };
      setTeachers(prev => prev.map(t => t.id === updatedTeacher.id ? updatedTeacher : t));
      alert("تم تحديث بيانات المدرس بنجاح!");
      setEditingTeacher(null);
      setEditTeacherImage(null);
    } catch (err) {
      console.error(err);
      alert("خطأ أثناء تحديث بيانات المدرس");
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const handleUploadCourseMedia = async (file: File, type: 'video' | 'pdf' | 'image') => {
    if (!editingCourse) return;
    setIsLoading(true);
    try {
      const url = await dbService.uploadFile(file, `courses/media/${editingCourse.id}`, (progress) => setUploadProgress(progress));
      const newMedia: CourseMedia = {
        id: `m-${Date.now()}`,
        title: file.name,
        url,
        type
      };
      setEditingCourse({ ...editingCourse, media: [...editingCourse.media, newMedia] });
      alert("تم رفع الملف بنجاح");
    } catch (err) {
      console.error(err);
      alert("خطأ أثناء رفع الملف");
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const handleAddMediaByLink = (type: 'video' | 'pdf' | 'image') => {
    if (!editingCourse) return;
    const title = prompt("أدخل عنوان المرفق:");
    const url = prompt("أدخل رابط المرفق:");
    if (title && url) {
      const newMedia: CourseMedia = {
        id: `m-${Date.now()}`,
        title,
        url,
        type
      };
      setEditingCourse({ ...editingCourse, media: [...editingCourse.media, newMedia] });
    }
  };

  const handleUpdateScheduleWithAI = async () => {
    // 1. Validation
    if (!scheduleAiInput.trim() || !selectedGradeForAi) {
      alert("يرجى اختيار الصف وإدخال نص الجدول");
      return;
    }

    const effectiveKey = selectedProvider === 'gemini' ? apiKey : anthropicApiKey;
    if (!effectiveKey) {
      setMissingKeyProvider(selectedProvider);
      setShowApiKeyModal(true);
      return;
    }



    setIsLoading(true);
    try {
      // 2. Prepare Context and Call AI
      const selectedGrade = grades.find(g => g.id === selectedGradeForAi);
      const context = selectedGrade ? `[الصف: ${selectedGrade.name}]` : '';

      // Get structured nested schedule from AI service
      const effectiveKey = selectedProvider === 'gemini' ? apiKey : anthropicApiKey;
      const aiGeneratedSchedule = await parseScheduleWithAI(`${context} ${scheduleAiInput}`, effectiveKey, selectedProvider);

      // 3. Smart Merge & Deduplicate
      setGrades(prev => prev.map(grade => {
        if (grade.id === selectedGradeForAi) {
          const currentSchedule = grade.schedule || [];

          // Deep clone to avoid mutation issues
          const updatedSchedule = [...currentSchedule];

          aiGeneratedSchedule.forEach(aiDay => {
            // Normalize AI Day Name
            const normalizedAiDay = aiDay.day.trim();

            // Find existing day or create new
            let targetDay = updatedSchedule.find(d => d.day.trim() === normalizedAiDay);
            if (!targetDay) {
              targetDay = { day: normalizedAiDay, slots: [] };
              updatedSchedule.push(targetDay);
            }

            // Merge AI slots into this day, checking for duplicates
            aiDay.slots.forEach(aiSlot => {
              const isDuplicate = targetDay!.slots.some(existingSlot =>
                existingSlot.subject.trim() === aiSlot.subject.trim() &&
                existingSlot.time.trim() === aiSlot.time.trim()
              );

              if (!isDuplicate) {
                targetDay!.slots.push(aiSlot);
              }
            });
          });

          return { ...grade, schedule: updatedSchedule };
        }
        return grade;
      }));

      alert('تم تحديث الجدول بذكاء! تم دمج الحصص الجديدة ومنع التكرار ✨');
      setScheduleAiInput('');
    } catch (err: any) {
      console.error("AI Update Error:", err);
      alert('حدث خطأ أثناء معالجة البيانات، تأكد من مفتاح API وجودة النص.');
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="max-w-7xl mx-auto px-4 py-10" dir="rtl">
      {/* Upload Progress Overlay */}
      {(uploadProgress > 0) && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl text-center max-w-sm w-full mx-4 border border-gray-100 transform scale-100 hover:scale-105 transition-transform">
            <div className="mb-6 text-7xl animate-bounce filter drop-shadow-lg">🚀</div>
            <h3 className="text-3xl font-black text-[#0a192f] mb-2">جاري الرفع...</h3>
            <p className="text-gray-400 font-bold text-sm mb-6">يرجى الانتظار قليلاً</p>

            <div className="relative w-full bg-gray-100 rounded-full h-6 mb-4 overflow-hidden inner-shadow">
              <div
                className="bg-gradient-to-r from-[#10b981] to-[#34d399] h-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                style={{ width: `${uploadProgress}%` }}
              >
                <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 animate-[shimmer_1s_infinite] skew-x-12"></div>
              </div>
            </div>
            <p className="text-[#10b981] font-black text-2xl">{Math.round(uploadProgress)}%</p>
          </div>
        </div>
      )}

      {/* API Key Banner Removed */}

      <VoiceAssistant
        grades={grades}
        apiKey={apiKey}
        onUpdateSchedule={async (gid, txt) => {
          const grade = grades.find(g => g.id === gid);
          const context = grade ? `للصف ${grade.name} (${grade.stage})` : '';
          const parsed = await parseScheduleWithAI(`${context} ${txt}`, apiKey);
          setGrades(prev => prev.map(g => g.id === gid ? { ...g, schedule: parsed } : g));
        }}
        onAddTeacher={handleAddTeacherByText}
        onNavigate={() => { }} // Admin doesn't navigate from here usually, or pass a dummy
      />

      <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6 text-right">
        <div className="flex items-center gap-4">
          <img src={logo} alt="Logo" className="w-16 h-auto" />
          <h1 className="text-4xl font-black text-[#0a192f]">لوحة الإدارة 👑</h1>
        </div>
        <div className="flex bg-white rounded-2xl p-1 shadow-lg border overflow-x-auto max-w-full">
          {[
            { id: 'ai-schedule', label: '🗓️ الجدول' },
            { id: 'teachers', label: '👨‍🏫 المدرسين' },
            { id: 'subjects', label: '📖 المواد' },
            { id: 'courses', label: '📚 الكورسات' },
            { id: 'settings', label: '⚙️ الإعدادات' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-5 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[#0a192f] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              {tab.label}
            </button>
          ))}
          <button onClick={onLogout} className="px-5 py-2.5 rounded-xl font-bold text-red-500 hover:bg-red-50">خروج</button>
        </div>
      </div>

      {/* Schedule Tab with Sub-tabs */}
      {activeTab === 'ai-schedule' && (
        <div className="bg-white rounded-[3rem] shadow-2xl p-10 animate-in fade-in border border-gray-100">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <h2 className="text-3xl font-black text-[#0a192f]">إدارة الجدول الدراسي 🗓️</h2>
            <div className="flex justify-center gap-4 mb-8">
              <button
                onClick={() => setScheduleSubTab('ai')}
                className={`px-6 py-3 rounded-2xl font-black transition-all ${scheduleSubTab === 'ai' ? 'bg-[#10b981] text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
              >
                🤖 المُنشئ الذكي (AI)
              </button>
              <button
                onClick={() => setScheduleSubTab('manual')}
                className={`px-6 py-3 rounded-2xl font-black transition-all ${scheduleSubTab === 'manual' ? 'bg-[#0a192f] text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
              >
                🛠️ المُنشئ اليدوي
              </button>
              <button
                onClick={() => setScheduleSubTab('ramadan')}
                className={`px-6 py-3 rounded-2xl font-black transition-all ${scheduleSubTab === 'ramadan' ? 'bg-[#f97316] text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
              >
                🌙 جدول رمضان
              </button>
            </div>
          </div>

          {/* AI Sub-tab */}
          {scheduleSubTab === 'ai' && (
            <div className="animate-in fade-in slide-in-from-top-4">
              {/* Artificial Model Selector */}
              <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
                {[
                  { id: 'gemini', name: 'Gemini 1.5 Pro', icon: '💎', premium: true, provider: 'gemini' },
                  { id: 'claude', name: 'Claude 3.5 Sonnet', icon: '⚡', premium: true, provider: 'claude' },
                  { id: 'offline', name: 'Local Intelligence', icon: '🧠', premium: false, provider: 'offline' },
                ].map(model => (
                  <button
                    key={model.id}
                    onClick={() => {
                      if (model.id !== 'offline') {
                        setSelectedProvider(model.provider as 'gemini' | 'claude');

                        const hasKey = model.provider === 'gemini' ? !!apiKey : !!anthropicApiKey;
                        if (!hasKey) {
                          setMissingKeyProvider(model.provider as 'gemini' | 'claude');
                          setShowApiKeyModal(true);
                        }
                      }
                    }}
                    className={`flex items-center gap-3 px-6 py-4 rounded-2xl border-2 transition-all min-w-[200px] ${(selectedProvider === model.provider && model.id !== 'offline') ? 'border-[#10b981] bg-[#0a192f] text-white shadow-lg scale-105' :
                      'border-[#0a192f] bg-white text-[#0a192f] hover:bg-gray-50'
                      }`}
                  >
                    <span className="text-2xl">{model.icon}</span>
                    <div className="text-right">
                      <p className="font-black text-sm">{model.name}</p>
                      <p className="text-xs opacity-75 font-bold">{model.premium ? (apiKey ? 'جاهز للعمل ✅' : 'يحتاج API 🔒') : 'يعمل بدون إنترنت 🌐'}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                {/* AI Grade Selector */}
                <div className="md:col-span-1">
                  <label className="block text-sm font-black text-gray-400 mb-3">اختر الصف الدراسي:</label>
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                    {grades.map(g => (
                      <button
                        key={g.id}
                        onClick={() => setSelectedGradeForAi(g.id)}
                        className={`w-full text-right p-4 rounded-2xl font-bold transition-all border-2 ${selectedGradeForAi === g.id ? 'bg-[#0a192f] text-white border-[#0a192f]' : 'bg-gray-50 text-gray-500 border-transparent hover:border-gray-200'}`}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Input Area */}
                <div className="md:col-span-2 space-y-6">
                  <textarea
                    value={scheduleAiInput}
                    onChange={(e) => setScheduleAiInput(e.target.value)}
                    className="w-full border-2 rounded-[2rem] p-8 h-64 outline-none font-bold text-xl leading-relaxed shadow-inner bg-gray-50 focus:border-[#10b981] transition-all"
                    placeholder="اكتب الجدول هنا كما تحب.. مثال: السبت 4 م لغة عربية، الأحد 6 م رياضيات..."
                  />

                  <button
                    onClick={handleUpdateScheduleWithAI}
                    disabled={isLoading}
                    className="w-full bg-[#0a192f] text-white py-6 rounded-[2.5rem] font-black text-2xl shadow-2xl hover:bg-[#10b981] transition-all active:scale-95 flex items-center justify-center gap-4"
                  >
                    {isLoading ? (
                      <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      'تحديث الجدول بذكاء ✨'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Manual Builder Sub-tab */}
          {scheduleSubTab === 'manual' && (
            <div className="animate-in fade-in slide-in-from-top-4 space-y-8">
              {/* Grade Selector for Manual */}
              <div>
                <label className="block text-sm font-black text-gray-400 mb-3">اختر الصف لتعديل الجدول:</label>
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  {grades.map(g => (
                    <button
                      key={g.id}
                      onClick={() => setManualScheduleGradeId(g.id)}
                      className={`px-6 py-3 rounded-xl font-bold transition-all border-2 min-w-fit ${manualScheduleGradeId === g.id ? 'bg-[#0a192f] text-white border-[#0a192f] shadow-lg scale-105' : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200'}`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>

              {manualScheduleGradeId ? (
                <div className="bg-gray-50 rounded-[2.5rem] p-6 border border-gray-200">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-[#0a192f]">جدول الحصص الأسبوعي ✍️</h3>
                    <button
                      onClick={() => {
                        setGrades(prev => prev.map(g => g.id === manualScheduleGradeId ? { ...g, schedule: manualScheduleData } : g));
                        alert("تم حفظ الجدول بنجاح! ✅");
                      }}
                      className="bg-[#10b981] text-white px-8 py-3 rounded-xl font-black shadow-lg hover:bg-emerald-600 transition-all active:scale-95 flex items-center gap-2"
                    >
                      <span>💾</span> حفظ التغييرات
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'].map(day => {
                      const dayData = manualScheduleData.find(d => d.day === day) || { day, slots: [] };

                      return (
                        <div key={day} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 hover:border-[#0a192f]/20 transition-all">
                          <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h4 className="font-black text-lg text-[#0a192f]">{day}</h4>
                            <button
                              onClick={() => {
                                const newSlot: ScheduleSlot = {
                                  id: `s-${Date.now()}-${Math.random()}`,
                                  subject: '',
                                  time: '',
                                  color: 'bg-blue-500', // Default
                                  teacherId: ''
                                };
                                const updatedSchedule = [...manualScheduleData];
                                const existingDayIndex = updatedSchedule.findIndex(d => d.day === day);
                                if (existingDayIndex >= 0) {
                                  updatedSchedule[existingDayIndex].slots.push(newSlot);
                                } else {
                                  updatedSchedule.push({ day, slots: [newSlot] });
                                }
                                setManualScheduleData(updatedSchedule);
                              }}
                              className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-black hover:bg-blue-100 transition-all"
                              title="إضافة حصة"
                            >
                              +
                            </button>
                          </div>

                          <div className="space-y-3">
                            {dayData.slots.map((slot, sIdx) => (
                              <div key={slot.id} className="bg-gray-50 p-3 rounded-2xl border border-gray-200 group relative">
                                <div className="space-y-2">
                                  <select
                                    value={slot.subject}
                                    onChange={(e) => {
                                      const updatedSchedule = [...manualScheduleData];
                                      const dIdx = updatedSchedule.findIndex(d => d.day === day);
                                      updatedSchedule[dIdx].slots[sIdx].subject = e.target.value;
                                      setManualScheduleData(updatedSchedule);
                                    }}
                                    className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm font-bold outline-none focus:border-[#0a192f]"
                                  >
                                    <option value="">اختيار المادة...</option>
                                    {allSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                                  </select>

                                  <TimePicker
                                    value={slot.time}
                                    onChange={(newTime) => {
                                      const updatedSchedule = [...manualScheduleData];
                                      const dIdx = updatedSchedule.findIndex(d => d.day === day);
                                      updatedSchedule[dIdx].slots[sIdx].time = newTime;
                                      setManualScheduleData(updatedSchedule);
                                    }}
                                  />
                                </div>

                                <button
                                  onClick={() => {
                                    const updatedSchedule = [...manualScheduleData];
                                    const dIdx = updatedSchedule.findIndex(d => d.day === day);
                                    updatedSchedule[dIdx].slots = updatedSchedule[dIdx].slots.filter(s => s.id !== slot.id);
                                    setManualScheduleData(updatedSchedule);
                                  }}
                                  className="absolute -top-2 -left-2 w-6 h-6 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-all font-black shadow-sm hover:bg-red-500 hover:text-white"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                            {dayData.slots.length === 0 && (
                              <p className="text-center text-gray-300 text-xs font-bold py-4">لا توجد حصص</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200">
                  <p className="text-gray-400 font-bold text-xl">👈 اختر صفاً دراسياً من القائمة أعلاه للبدء</p>
                </div>
              )}
            </div>
          )}

          {/* Ramadan Schedule Sub-tab */}
          {scheduleSubTab === 'ramadan' && (
            <div className="animate-in fade-in slide-in-from-top-4 space-y-8">
              {/* Grade Selector for Ramadan */}
              <div>
                <label className="block text-sm font-black text-gray-400 mb-3">اختر الصف لتعديل جدول رمضان:</label>
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  {grades.map(g => (
                    <button
                      key={g.id}
                      onClick={() => setRamadanScheduleGradeId(g.id)}
                      className={`px-6 py-3 rounded-xl font-bold transition-all border-2 min-w-fit ${ramadanScheduleGradeId === g.id ? 'bg-[#f97316] text-white border-[#f97316] shadow-lg scale-105' : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200'}`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>

              {ramadanScheduleGradeId ? (
                <div className="bg-orange-50/50 rounded-[2.5rem] p-6 border border-orange-100">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-[#f97316]">🌙 جدول حصص رمضان</h3>
                    <button
                      onClick={() => {
                        setGrades(prev => prev.map(g => g.id === ramadanScheduleGradeId ? { ...g, ramadanSchedule: ramadanScheduleData } : g));
                        alert("تم حفظ جدول رمضان بنجاح! ✅");
                      }}
                      className="bg-[#f97316] text-white px-8 py-3 rounded-xl font-black shadow-lg hover:bg-orange-600 transition-all active:scale-95 flex items-center gap-2"
                    >
                      <span>💾</span> حفظ الجدول الرمضاني
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'].map(dayName => {
                      const dayData = ramadanScheduleData.find(d => d.day === dayName) || { day: dayName, slots: [] };
                      return (
                        <div key={dayName} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                          <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                            <h4 className="font-black text-lg text-[#0a192f] flex items-center gap-2">
                              <span className="text-[#f97316]">📅</span> {dayName}
                            </h4>
                            <button
                              onClick={() => {
                                const newSlot: ScheduleSlot = {
                                  id: `s-${Date.now()}`,
                                  subject: 'اللغة العربية',
                                  time: '09:00 ص',
                                  color: 'bg-orange-100 text-orange-800',
                                  icon: '🌙'
                                };
                                const updatedData = [...ramadanScheduleData];
                                const dayIndex = updatedData.findIndex(d => d.day === dayName);
                                if (dayIndex >= 0) {
                                  updatedData[dayIndex].slots.push(newSlot);
                                } else {
                                  updatedData.push({ day: dayName, slots: [newSlot] });
                                }
                                setRamadanScheduleData(updatedData);
                              }}
                              className="bg-gray-50 text-[#f97316] px-4 py-2 rounded-lg text-sm font-bold hover:bg-orange-50 transition-colors"
                            >
                              + إضافة حصة
                            </button>
                          </div>

                          <div className="space-y-3">
                            {dayData.slots.length === 0 ? (
                              <p className="text-gray-300 text-sm text-center py-4 italic">لا توجد حصص مضافة لهذا اليوم</p>
                            ) : (
                              dayData.slots.map((slot, slotIndex) => (
                                <div key={slot.id} className="flex flex-wrap items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100 group hover:border-[#f97316]/30 transition-colors">
                                  <div className="flex-1 min-w-[150px]">
                                    <select
                                      value={slot.subject}
                                      onChange={(e) => {
                                        const updatedData = [...ramadanScheduleData];
                                        const dIdx = updatedData.findIndex(d => d.day === dayName);
                                        updatedData[dIdx].slots[slotIndex].subject = e.target.value;
                                        setRamadanScheduleData(updatedData);
                                      }}
                                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#f97316] outline-none"
                                    >
                                      <option value="قرآن كريم">قرآن كريم</option>
                                      {allSubjects.map(sub => (
                                        <option key={sub} value={sub}>{sub}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="w-32">
                                    <TimePicker
                                      value={slot.time}
                                      onChange={(newTime) => {
                                        const updatedData = [...ramadanScheduleData];
                                        const dIdx = updatedData.findIndex(d => d.day === dayName);
                                        updatedData[dIdx].slots[slotIndex].time = newTime;
                                        setRamadanScheduleData(updatedData);
                                      }}
                                    />
                                  </div>
                                  <button
                                    onClick={() => {
                                      const updatedData = [...ramadanScheduleData];
                                      const dIdx = updatedData.findIndex(d => d.day === dayName);
                                      updatedData[dIdx].slots.splice(slotIndex, 1);
                                      setRamadanScheduleData(updatedData);
                                    }}
                                    className="text-red-400 hover:text-red-600 p-2 opacity-50 group-hover:opacity-100 transition-opacity"
                                    title="حذف الحصة"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 bg-orange-50/30 rounded-[2.5rem] border-2 border-dashed border-orange-100/50">
                  <p className="text-gray-400 font-bold text-xl">👈 اختر صفاً دراسياً لبدء جدول رمضان</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'teachers' && (
        <div className="animate-in fade-in text-right">
          <div className="flex justify-between items-center mb-8 border-b pb-4">
            <h2 className="text-2xl font-black text-[#0a192f]">إدارة المدرسين 👨‍🏫</h2>
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button onClick={() => setManagementSubTab('list')} className={`px-4 py-2 rounded-lg font-bold ${managementSubTab === 'list' ? 'bg-white shadow text-[#10b981]' : 'text-gray-400'}`}>القائمة</button>
              <button onClick={() => setManagementSubTab('add')} className={`px-4 py-2 rounded-lg font-bold ${managementSubTab === 'add' ? 'bg-white shadow text-[#10b981]' : 'text-gray-400'}`}>إضافة ➕</button>
              <button onClick={() => setManagementSubTab('ai-add')} className={`px-4 py-2 rounded-lg font-bold ${managementSubTab === 'ai-add' ? 'bg-white shadow text-[#10b981]' : 'text-gray-400'}`}>إضافة بالذكاء ✨</button>
            </div>
          </div>

          {managementSubTab === 'ai-add' && (
            <div className="bg-white p-10 rounded-[2.5rem] shadow-xl space-y-8 max-w-2xl mx-auto border-t-8 border-[#10b981]">
              <h3 className="text-2xl font-black text-[#0a192f] text-center">إضافة مدرسين بالذكاء الاصطناعي 🪄</h3>
              <textarea
                value={teacherAiInput}
                onChange={(e) => setTeacherAiInput(e.target.value)}
                className="w-full border-2 rounded-2xl p-6 h-64 focus:border-[#10b981] outline-none font-bold text-lg shadow-inner bg-gray-50"
                placeholder="أدخل نصاً يصف المدرسين (مثال: أستاذ علي فيزياء يدرس 1 ثانوي و2 ثانوي)..."
              />
              <button
                onClick={() => handleAddTeacherByText()}
                disabled={isLoading || !teacherAiInput.trim()}
                className="w-full bg-[#0a192f] text-white py-5 rounded-2xl font-black text-xl hover:bg-[#10b981] transition-all active:scale-95"
              >
                {isLoading ? 'جاري التحليل والتحويل...' : 'تحليل وإضافة الآن ✨'}
              </button>
            </div>
          )}

          {managementSubTab === 'add' && (
            <form onSubmit={handleManualAddTeacher} className="bg-white p-8 rounded-[2.5rem] shadow-xl space-y-8 max-w-3xl mx-auto border-t-8 border-[#10b981]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-black text-gray-400 mb-2">اسم المدرس:</label>
                  <input required placeholder="الاسم" value={newTeacher.name} onChange={e => setNewTeacher({ ...newTeacher, name: e.target.value })} className="w-full border-2 rounded-xl p-4 font-bold outline-none focus:border-[#10b981]" />
                </div>
                <div>
                  <label className="block text-sm font-black text-gray-400 mb-2">المادة الدراسية:</label>
                  {!isAddingNewSubject ? (
                    <select required value={newTeacher.subject} onChange={(e) => e.target.value === 'ADD_NEW' ? setIsAddingNewSubject(true) : setNewTeacher({ ...newTeacher, subject: e.target.value })} className="w-full border-2 rounded-xl p-4 font-bold bg-white">
                      <option value="">اختر المادة...</option>
                      {allSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                      <option value="ADD_NEW" className="text-orange-500 font-black">+ مادة جديدة...</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input autoFocus required placeholder="اسم المادة" value={customSubjectName} onChange={(e) => setCustomSubjectName(e.target.value)} className="flex-1 border-2 rounded-xl p-4 font-bold outline-none border-orange-500" />
                      <button type="button" onClick={() => setIsAddingNewSubject(false)} className="bg-gray-100 px-4 rounded-xl text-gray-400 font-bold">✕</button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-500 mb-4">المراحل والصفوف الدراسية للمدرس:</label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {STAGES.map(stage => (
                    <div key={stage.id} className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${newTeacher.stages?.includes(stage.id) ? 'bg-[#10b981]/5 border-[#10b981]' : 'bg-gray-50 border-gray-100'}`} onClick={() => toggleStageSelection(stage.id)}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">{stage.icon}</span>
                        <span className={`font-black ${newTeacher.stages?.includes(stage.id) ? 'text-[#10b981]' : 'text-gray-400'}`}>{stage.name}</span>
                        <div className={`mr-auto w-5 h-5 rounded-full border-2 flex items-center justify-center ${newTeacher.stages?.includes(stage.id) ? 'border-[#10b981] bg-[#10b981]' : 'border-gray-300'}`}>
                          {newTeacher.stages?.includes(stage.id) && <span className="text-white text-[10px]">✓</span>}
                        </div>
                      </div>
                      {newTeacher.stages?.includes(stage.id) && (
                        <div className="space-y-1 mt-2 animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                          {grades.filter(g => g.stage === stage.id).map(grade => (
                            <div key={grade.id} onClick={() => toggleGradeSelection(grade.id)} className={`flex items-center gap-2 p-2 rounded-lg text-xs font-bold transition-all ${newTeacher.grades?.includes(grade.id) ? 'bg-[#10b981] text-white' : 'bg-white border text-gray-400'}`}>
                              {grade.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-2 border-dashed rounded-2xl p-8 text-center bg-gray-50 hover:bg-gray-100 transition-all cursor-pointer relative group">
                <input type="file" accept="image/*" onChange={e => setNewTeacherImage(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <div className="flex flex-col items-center">
                  <span className="text-4xl mb-2">🖼️</span>
                  <p className="text-gray-400 font-bold">{newTeacherImage ? `✓ تم اختيار: ${newTeacherImage.name}` : 'رفع صورة المدرس من الجهاز'}</p>
                </div>
              </div>

              <textarea placeholder="نبذة أكاديمية..." value={newTeacher.bio} onChange={e => setNewTeacher({ ...newTeacher, bio: e.target.value })} className="w-full border-2 rounded-xl p-4 h-32 font-bold focus:border-[#10b981] outline-none" />
              <button disabled={isLoading} className="w-full bg-[#10b981] text-white py-5 rounded-2xl font-black text-xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">
                {isLoading ? 'جاري الحفظ...' : 'حفظ بيانات المدرس'}
              </button>
            </form>
          )}

          {managementSubTab === 'list' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teachers.map(t => (
                <div key={t.id} className="bg-white p-6 rounded-[2.5rem] shadow-md border border-gray-100 group hover:border-[#10b981] transition-all flex flex-col">
                  <img src={t.imageUrl} className="w-32 h-32 rounded-[2rem] object-cover mx-auto mb-4 border-4 border-gray-50 shadow-sm" />
                  <h3 className="text-2xl font-black text-center text-[#0a192f]">{t.name}</h3>
                  <p className="text-[#10b981] font-bold text-center mb-6">{t.subject}</p>
                  <div className="flex flex-wrap gap-1 justify-center mb-4">
                    {t.grades?.map(gid => {
                      const g = grades.find(GD => GD.id === gid);
                      return g ? <span key={gid} className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded-full font-bold border border-gray-200">{g.name}</span> : null;
                    })}
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <button onClick={() => setEditingTeacher(t)} className="flex-1 bg-gray-50 text-gray-600 py-3 rounded-xl font-bold hover:bg-[#10b981] hover:text-white transition-all">تعديل ⚙️</button>
                    <button onClick={() => setTeacherToDelete(t)} className="bg-red-50 p-3 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Course Tab with 4K Cinematic AI Cover Generation */}
      {activeTab === 'courses' && (
        <div className="animate-in fade-in text-right">
          <div className="flex justify-between items-center mb-8 border-b pb-4">
            <h2 className="text-2xl font-black text-[#0a192f]">إدارة الكورسات الرقمية 📚</h2>
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button onClick={() => setCourseSubTab('list')} className={`px-4 py-2 rounded-lg font-bold ${courseSubTab === 'list' ? 'bg-white shadow text-[#f97316]' : 'text-gray-400'}`}>القائمة</button>
              <button onClick={() => setCourseSubTab('add')} className={`px-4 py-2 rounded-lg font-bold ${courseSubTab === 'add' ? 'bg-white shadow text-[#f97316]' : 'text-gray-400'}`}>إضافة كورس ➕</button>
            </div>
          </div>

          {courseSubTab === 'add' && (
            <form onSubmit={handleManualAddCourse} className="bg-white p-10 rounded-[2.5rem] shadow-xl space-y-8 max-w-2xl mx-auto border-t-8 border-[#f97316]">
              <div>
                <label className="block text-sm font-black text-gray-400 mb-2">عنوان الكورس:</label>
                <input required placeholder="عنوان الكورس" value={newCourseData.title} onChange={e => setNewCourseData({ ...newCourseData, title: e.target.value })} className="w-full border-2 rounded-2xl p-5 font-black text-2xl focus:border-[#f97316] outline-none" />
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button type="button" onClick={generateAiCover} disabled={isGeneratingImage || !newCourseData.title} className="bg-[#0a192f] text-white p-5 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-black group transition-all active:scale-95 shadow-xl">
                    {isGeneratingImage ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <span className="text-2xl group-hover:rotate-12 transition-transform">✨</span>}
                    {isGeneratingImage ? 'جاري توليد 4K...' : 'غلاف ذكي 4K'}
                  </button>
                  <div className="relative h-full">
                    <input type="file" accept="image/*" onChange={e => setNewCourseImage(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    <div className="bg-orange-50 border-2 border-dashed border-orange-200 rounded-2xl p-5 text-center font-bold text-orange-600 h-full flex items-center justify-center">
                      {newCourseImage ? `✓ ${newCourseImage.name}` : 'رفع صورة من الجهاز'}
                    </div>
                  </div>
                </div>
                {/* URL Input */}
                <input
                  type="text"
                  placeholder="أو ضع رابط الصورة هنا مباشرة..."
                  value={newCourseData.thumbnailUrl}
                  onChange={(e) => setNewCourseData({ ...newCourseData, thumbnailUrl: e.target.value })}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 font-bold text-sm focus:border-[#f97316] outline-none text-left"
                  dir="ltr"
                />

                {newCourseData.thumbnailUrl && <img src={newCourseData.thumbnailUrl} className="w-full h-56 object-cover rounded-[2rem] border-4 border-white shadow-xl animate-in zoom-in" />}
              </div>

              <select required value={newCourseData.gradeId} onChange={e => setNewCourseData({ ...newCourseData, gradeId: e.target.value })} className="w-full border-2 rounded-xl p-4 font-bold bg-white focus:border-[#f97316] outline-none">
                <option value="">اختر الصف الدراسي...</option>
                {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>

              <textarea placeholder="وصف الكورس بالتفصيل..." value={newCourseData.description} onChange={e => setNewCourseData({ ...newCourseData, description: e.target.value })} className="w-full border-2 rounded-2xl p-4 h-32 font-bold focus:border-[#f97316] outline-none" />

              <button disabled={isLoading} className="w-full bg-[#f97316] text-white py-6 rounded-[2rem] font-black text-2xl shadow-2xl hover:bg-orange-600 transition-all active:scale-95 shadow-orange-500/20">
                {isLoading ? 'جاري الإنشاء...' : 'إنشاء ونشر الكورس الآن 🚀'}
              </button>
            </form>
          )}

          {courseSubTab === 'list' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {courses.map(c => (
                <div key={c.id} className="bg-white rounded-[3rem] shadow-xl border border-gray-100 overflow-hidden group flex flex-col hover:-translate-y-2 transition-all duration-500">
                  <img src={c.thumbnailUrl} className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-1000" />
                  <div className="p-8 flex-1 flex flex-col">
                    <h3 className="text-2xl font-black mb-2 text-[#0a192f]">{c.title}</h3>
                    <p className="text-gray-400 font-bold text-sm mb-6">{c.grade}</p>
                    <div className="flex gap-2 mt-auto">
                      <button onClick={() => setEditingCourse(c)} className="flex-1 bg-gray-50 text-[#0a192f] py-4 rounded-2xl font-black hover:bg-[#0a192f] hover:text-white transition-all shadow-sm">إدارة المحتوى 📂</button>
                      <button onClick={async () => {
                        if (confirm('هل تود حذف هذا الكورس؟')) {
                          try {
                            const courseId = c.id;

                            // CRITICAL FIX: Delete from Firebase FIRST and AWAIT completion
                            console.log('🗑️ Deleting course from Firebase:', courseId);
                            await dbService.deleteCourse(courseId);
                            console.log('✅ Course deleted from Firebase');

                            // NOW update React state (triggers auto-save with correct data)
                            setCourses(prev => prev.filter(x => x.id !== courseId));
                            setGrades(prev => prev.map(g => ({
                              ...g,
                              courses: g.courses.filter(cid => cid !== courseId)
                            })));
                          } catch (err) {
                            console.error(err);
                            alert("حدث خطأ أثناء حذف الكورس");
                          }
                        }
                      }} className="bg-red-50 p-4 rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all">🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
      }

      {/* Edit Teacher Modal */}
      {
        editingTeacher && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a192f]/90 backdrop-blur-md animate-in fade-in">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateTeacher(editingTeacher);
              }}
              className="bg-white w-full max-w-4xl rounded-[2.5rem] p-8 md:p-12 shadow-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95 border-t-8 border-[#10b981]"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black text-[#0a192f]">تعديل بيانات المدرس ✏️</h2>
                <button type="button" onClick={() => setEditingTeacher(null)} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-red-100 hover:text-red-500 transition-all font-black">✕</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* Image & Basic Info */}
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="relative inline-block group cursor-pointer">
                      <img src={editingTeacher.imageUrl} alt={editingTeacher.name} className="w-40 h-40 rounded-[2.5rem] object-cover border-4 border-[#10b981] shadow-xl group-hover:brightness-75 transition-all" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        <span className="text-white text-3xl">📷</span>
                      </div>
                      <input type="file" accept="image/*" onChange={e => setEditTeacherImage(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                    <p className="text-sm font-bold text-gray-400 mt-2">اضغط لتغيير الصورة</p>
                    <label className="block text-sm font-black text-gray-400 mb-2 mt-4 text-right">رابط الصورة (اختياري):</label>
                    <input
                      type="text"
                      placeholder="https://i.ibb.co/.../image.jpg"
                      value={editingTeacher.imageUrl || ''}
                      onChange={(e) => setEditingTeacher({ ...editingTeacher, imageUrl: e.target.value })}
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 font-bold text-sm focus:border-[#10b981] outline-none text-left"
                      dir="ltr"
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">استخدم رابط مباشر (Direct Link) من ImgBB أو غيره.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-black text-gray-400 mb-2">الاسم:</label>
                    <input required value={editingTeacher.name} onChange={e => setEditingTeacher({ ...editingTeacher, name: e.target.value })} className="w-full border-2 rounded-xl p-4 font-bold outline-none focus:border-[#10b981]" />
                  </div>

                  <div>
                    <label className="block text-sm font-black text-gray-400 mb-2">المادة:</label>
                    <select required value={editingTeacher.subject} onChange={(e) => setEditingTeacher({ ...editingTeacher, subject: e.target.value })} className="w-full border-2 rounded-xl p-4 font-bold bg-white">
                      {allSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                    </select>
                  </div>
                </div>

                {/* Advanced Info & Bio */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-black text-gray-400 mb-2">النبذة التعريفية (Bio):</label>
                    <div className="relative">
                      <textarea
                        value={editingTeacher.bio}
                        onChange={e => setEditingTeacher({ ...editingTeacher, bio: e.target.value })}
                        className="w-full border-2 rounded-xl p-4 h-40 font-bold focus:border-[#10b981] outline-none resize-none"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!editingTeacher.bio) return alert("اكتب نبذة بسيطة أولاً ليقوم الذكاء الاصطناعي بتحسينها.");
                          setIsLoading(true);
                          try {
                            // Assuming GoogleGenAI is imported and API_KEY is available
                            // import { GoogleGenAI } from '@google/generative-ai';
                            // const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                            // const model = ai.getGenerativeModel({ model: "gemini-pro" });
                            // const result = await model.generateContent(`
                            //   Rewrite and improve the following teacher bio to be more professional, engaging, and inspiring for students and parents. 
                            //   Keep it in Arabic. 
                            //   Bio: "${editingTeacher.bio}"
                            // `);
                            // const response = await result.response;
                            // setEditingTeacher({...editingTeacher, bio: response.text()});
                            // Placeholder for AI logic
                            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
                            setEditingTeacher({ ...editingTeacher, bio: "نبذة محسّنة بالذكاء الاصطناعي: " + editingTeacher.bio });
                          } catch (error) {
                            console.error(error);
                            alert("حدث خطأ أثناء تحسين النص بالذكاء الاصطناعي. تأكد من مفتاح API.");
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        className="absolute bottom-4 left-4 bg-[#0a192f] text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:bg-[#10b981] transition-all"
                        disabled={isLoading}
                      >
                        {isLoading ? '...' : '✨ تحسين بالذكاء'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-black text-gray-400 mb-2">المراحل الدراسية:</label>
                    <div className="flex flex-wrap gap-2">
                      {STAGES.map(stage => (
                        <button
                          key={stage.id}
                          type="button"
                          onClick={() => {
                            const currentStages = editingTeacher.stages || [];
                            const newStages = currentStages.includes(stage.id)
                              ? currentStages.filter(s => s !== stage.id)
                              : [...currentStages, stage.id];
                            setEditingTeacher({ ...editingTeacher, stages: newStages });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-bold border-2 transition-all ${editingTeacher.stages?.includes(stage.id) ? 'bg-[#10b981] text-white border-[#10b981]' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                        >
                          {stage.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Groups & Pricing */}
              <div className="mb-8 border-t pt-8">
                <h3 className="text-xl font-black text-[#0a192f] mb-6">الصفوف والأسعار (للحصة/الشهر) 💰</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {grades.filter(g => editingTeacher.stages?.includes(g.stage)).map(grade => {
                    const isSelected = editingTeacher.grades?.includes(grade.id);
                    return (
                      <div key={grade.id} className={`p-4 rounded-xl border-2 transition-all ${isSelected ? 'border-[#10b981] bg-[#10b981]/5' : 'border-gray-100 bg-gray-50'}`}>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                const currentGrades = editingTeacher.grades || [];
                                const newGrades = isSelected
                                  ? currentGrades.filter(gid => gid !== grade.id)
                                  : [...currentGrades, grade.id];
                                setEditingTeacher({ ...editingTeacher, grades: newGrades });
                              }}
                              className="w-5 h-5 accent-[#10b981] rounded-md"
                            />
                            <span className={`font-bold text-sm ${isSelected ? 'text-[#0a192f]' : 'text-gray-400'}`}>{grade.name}</span>
                          </label>
                        </div>
                        {isSelected && (
                          <div className="animate-in slide-in-from-top-2">
                            <input
                              type="number"
                              placeholder="سعر المجموعة"
                              value={editingTeacher.hourlyRates?.[grade.id] || ''}
                              onChange={(e) => {
                                const newRates = { ...(editingTeacher.hourlyRates || {}) };
                                newRates[grade.id] = parseFloat(e.target.value);
                                setEditingTeacher({ ...editingTeacher, hourlyRates: newRates });
                              }}
                              className="w-full border rounded-lg p-2 text-sm font-bold focus:border-[#10b981] outline-none"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {grades.filter(g => editingTeacher.stages?.includes(g.stage)).length === 0 && (
                    <p className="text-gray-400 font-bold col-span-full text-center py-4">يرجى اختيار مراحل دراسية أولاً لرؤية الصفوف.</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#0a192f] text-white py-4 rounded-2xl font-black text-xl hover:bg-[#10b981] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
              >
                {isLoading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>حفظ التعديلات ✅</span>}
              </button>
            </form>
          </div>
        )
      }

      {/* Edit Course Modal with Content Manager */}
      {
        editingCourse && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a192f]/90 backdrop-blur-md animate-in fade-in">
            <div className="bg-white w-full max-w-5xl rounded-[2.5rem] p-8 md:p-12 shadow-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95 border-t-8 border-[#f97316]">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black text-[#0a192f]">تعديل الكورس والمحتوى 📚</h2>
                <button onClick={() => setEditingCourse(null)} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-red-100 hover:text-red-500 transition-all font-black">✕</button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full overflow-hidden">

                {/* Left Column: Content Management (Span 8) */}
                <div className="lg:col-span-8 flex flex-col h-full overflow-hidden bg-gray-50 rounded-[2.5rem] p-8 border border-gray-100 shadow-inner">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-black text-2xl text-[#0a192f]">العناصر التعليمية بالكورس 📚</h3>
                    <div className="flex gap-3">
                      <button onClick={() => {
                        const newMedia: CourseMedia = { id: `m-${Date.now()}`, title: 'فيديو جديد', url: '', type: 'video' };
                        setEditingCourse({ ...editingCourse, media: [...editingCourse.media, newMedia] });
                      }} className="bg-blue-100 text-blue-600 px-6 py-3 rounded-2xl font-black hover:bg-blue-500 hover:text-white transition-all flex items-center gap-2">
                        <span>+</span> فيديو
                      </button>
                      <button onClick={() => {
                        const newMedia: CourseMedia = { id: `m-${Date.now()}`, title: 'ملف PDF جديد', url: '', type: 'pdf' };
                        setEditingCourse({ ...editingCourse, media: [...editingCourse.media, newMedia] });
                      }} className="bg-red-100 text-red-500 px-6 py-3 rounded-2xl font-black hover:bg-red-500 hover:text-white transition-all flex items-center gap-2">
                        <span>+</span> ملف PDF
                      </button>
                      <button onClick={() => {
                        const newMedia: CourseMedia = { id: `m-${Date.now()}`, title: 'صورة جديدة', url: '', type: 'image' };
                        setEditingCourse({ ...editingCourse, media: [...editingCourse.media, newMedia] });
                      }} className="bg-green-100 text-green-600 px-6 py-3 rounded-2xl font-black hover:bg-green-500 hover:text-white transition-all flex items-center gap-2">
                        <span>+</span> صورة
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                    {editingCourse.media.map((item, idx) => (
                      <div key={item.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex items-start gap-4 group hover:border-[#f97316] transition-all">
                        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center text-3xl shrink-0">
                          {item.type === 'video' ? '🎥' : item.type === 'pdf' ? '📄' : '🖼️'}
                        </div>

                        <div className="flex-1 space-y-3">
                          <input
                            placeholder="عنوان العنصر (مثال: الدرس الأول)"
                            value={item.title}
                            onChange={(e) => {
                              const updated = editingCourse.media.map(m => m.id === item.id ? { ...m, title: e.target.value } : m);
                              setEditingCourse({ ...editingCourse, media: updated });
                            }}
                            className="w-full bg-[#334155] text-white placeholder-gray-400 p-3 rounded-xl font-bold text-sm outline-none border border-transparent focus:border-orange-500 transition-all"
                          />
                          <div className="flex gap-2">
                            <input
                              placeholder={item.type === 'video' ? "رابط الفيديو (YouTube/مباشر)" : "رابط الملف"}
                              value={item.url}
                              onChange={(e) => {
                                const updated = editingCourse.media.map(m => m.id === item.id ? { ...m, url: e.target.value } : m);
                                setEditingCourse({ ...editingCourse, media: updated });
                              }}
                              className="flex-1 bg-[#334155] text-white placeholder-gray-400 p-3 rounded-xl font-bold text-xs outline-none border border-transparent focus:border-orange-500 transition-all text-left"
                              dir="ltr"
                            />
                            <div className="relative overflow-hidden">
                              <button className="bg-gray-200 text-gray-600 px-4 py-3 rounded-xl font-bold text-xs hover:bg-gray-300 transition-all whitespace-nowrap">
                                رفع ملف 📂
                              </button>
                              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setIsLoading(true);
                                  try {
                                    const url = await dbService.uploadFile(file, `courses/media/${editingCourse.id}`);
                                    const updated = editingCourse.media.map(m => m.id === item.id ? { ...m, url } : m);
                                    setEditingCourse({ ...editingCourse, media: updated });
                                  } catch (err) { console.error(err); } finally { setIsLoading(false); }
                                }
                              }} />
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (confirm("حذف هذا العنصر؟")) {
                              const newMedia = editingCourse.media.filter(m => m.id !== item.id);
                              setEditingCourse({ ...editingCourse, media: newMedia });
                              // Note: We might want to implement deleteMedia in dbService too for complete cleanup
                            }
                          }}
                          className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all self-center"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                    {editingCourse.media.length === 0 && (
                      <div className="text-center py-20 opacity-50">
                        <p className="font-bold text-xl">اضغط على الأزرار أعلاه لإضافة محتوى</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Course Info (Span 4) */}
                <div className="lg:col-span-4 space-y-6 overflow-y-auto custom-scrollbar">
                  <div>
                    <label className="block text-sm font-black text-gray-400 mb-2">عنوان الكورس:</label>
                    <input value={editingCourse.title} onChange={e => setEditingCourse({ ...editingCourse, title: e.target.value })} className="w-full bg-[#334155] text-white border-none rounded-xl p-4 font-black text-lg focus:ring-2 focus:ring-[#f97316] outline-none" />
                  </div>

                  <div>
                    <label className="block text-sm font-black text-gray-400 mb-2">وصف الكورس:</label>
                    <textarea value={editingCourse.description} onChange={e => setEditingCourse({ ...editingCourse, description: e.target.value })} className="w-full bg-[#334155] text-white border-none rounded-xl p-4 h-32 font-bold focus:ring-2 focus:ring-[#f97316] outline-none resize-none" />
                  </div>

                  <div>
                    <label className="block text-sm font-black text-gray-400 mb-2">الصف الدراسي:</label>
                    <select value={editingCourse.gradeId} onChange={e => setEditingCourse({ ...editingCourse, gradeId: e.target.value })} className="w-full bg-[#334155] text-white border-none rounded-xl p-4 font-bold focus:ring-2 focus:ring-[#f97316] outline-none">
                      {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>

                  <div className="relative group cursor-pointer rounded-[2rem] overflow-hidden border-4 border-[#334155] hover:border-[#f97316] transition-all shadow-xl h-48">
                    <img src={editingCourse.thumbnailUrl} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <span className="text-white font-black">تغيير الغلاف 🖼️</span>
                    </div>
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setIsLoading(true);
                        try {
                          const url = await dbService.uploadFile(file, 'course-thumbnails');
                          setEditingCourse({ ...editingCourse, thumbnailUrl: url });
                        } catch (err) { alert("حدث خطأ في رفع الصورة"); } finally { setIsLoading(false); }
                      }
                    }} />
                  </div>

                  <input
                    type="text"
                    placeholder="أو ضع رابط الصورة هنا مباشرة..."
                    value={editingCourse.thumbnailUrl}
                    onChange={(e) => setEditingCourse({ ...editingCourse, thumbnailUrl: e.target.value })}
                    className="w-full bg-[#334155] text-white border-2 border-[#1e293b] rounded-xl p-3 font-bold text-sm focus:border-[#f97316] outline-none text-left"
                    dir="ltr"
                  />

                  <button onClick={async () => {
                    setIsLoading(true);
                    try {
                      const updated = courses.map(c => c.id === editingCourse.id ? editingCourse : c);
                      // Sync Grade Changes
                      const originalCourse = courses.find(c => c.id === editingCourse.id);
                      if (originalCourse && originalCourse.gradeId !== editingCourse.gradeId) {
                        setGrades(prev => prev.map(g => {
                          if (g.id === originalCourse.gradeId) return { ...g, courses: g.courses.filter(id => id !== editingCourse.id) };
                          if (g.id === editingCourse.gradeId) return { ...g, courses: Array.from(new Set([...g.courses, editingCourse.id])) };
                          return g;
                        }));
                      }
                      setCourses(updated);
                      alert("تم حفظ التعديلات! ✅");
                      setEditingCourse(null);
                    } catch (err) { console.error(err); } finally { setIsLoading(false); }
                  }} disabled={isLoading} className="w-full bg-[#f97316] text-white py-4 rounded-2xl font-black text-xl hover:bg-orange-600 transition-all shadow-xl active:scale-95">
                    {isLoading ? 'جاري الحفظ...' : 'حفظ التعديلات ✅'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }


      {/* Modal windows (Teacher Update, Media Edit, Delete Confirm) go here - keeping them from provided context */}
      {
        teacherToDelete && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#0a192f]/90 backdrop-blur-md animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 text-center shadow-2xl border-t-8 border-red-500 animate-in zoom-in-95">
              <div className="text-6xl mb-6">⚠️</div>
              <h3 className="text-3xl font-black text-[#0a192f] mb-4">تأكيد الحذف</h3>
              <p className="text-gray-500 text-lg mb-4 font-bold">
                أنت على وشك حذف المدرس <span className="text-red-500">"{teacherToDelete.name}"</span> نهائياً.
              </p>
              <div className="bg-red-50 p-4 rounded-2xl mb-8 border border-red-100">
                <p className="text-red-600 font-black text-sm">سيتم حذف جميع الكورسات والمواعيد المرتبطة بهذا المدرس أيضاً.</p>
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={async () => {
                  try {
                    const idToRemove = teacherToDelete.id;
                    const teacherName = teacherToDelete.name;

                    // CRITICAL FIX: Delete from Firebase FIRST and AWAIT completion
                    console.log('🗑️ Starting cascading delete for teacher:', idToRemove);
                    const teacherCourses = courses.filter(c => c.teacherId === idToRemove);

                    // Delete courses first
                    if (teacherCourses.length > 0) {
                      console.log('🗑️ Deleting', teacherCourses.length, 'courses...');
                      await Promise.all(teacherCourses.map(c => dbService.deleteCourse(c.id)));
                      console.log('✅ Courses deleted from Firebase');
                    }

                    // Then delete teacher
                    console.log('🗑️ Deleting teacher from Firebase...');
                    await dbService.deleteTeacher(idToRemove);
                    console.log('✅ Teacher deleted from Firebase');

                    // NOW update React state (this triggers auto-save, but docs are already deleted)
                    setTeachers(prev => prev.filter(t => t.id !== idToRemove));
                    setCourses(prev => prev.filter(c => c.teacherId !== idToRemove));
                    setGrades(prev => prev.map(grade => ({
                      ...grade,
                      teachers: grade.teachers.filter(tid => tid !== idToRemove)
                    })));

                    setTeacherToDelete(null);
                    alert(`تم حذف المدرس "${teacherName}" بنجاح.`);
                  } catch (err) {
                    console.error(err);
                    alert("حدث خطأ أثناء حذف المدرس من قاعدة البيانات.");
                  }
                }} className="w-full bg-red-500 text-white py-5 rounded-2xl font-black text-xl hover:bg-red-600 transition-all active:scale-95 shadow-xl shadow-red-500/20">
                  تأكيد الحذف النهائي 🗑️
                </button>
                <button onClick={() => setTeacherToDelete(null)} className="w-full bg-gray-100 text-gray-500 py-4 rounded-2xl font-black text-lg hover:bg-gray-200 transition-all">إلغاء التراجع</button>
              </div>
            </div>
          </div>
        )
      }

      {/* Improved Subjects UI */}
      {
        activeTab === 'subjects' && (
          <div className="animate-in fade-in space-y-8">
            <div className="flex justify-between items-center border-b pb-6">
              <h2 className="text-3xl font-black text-[#0a192f]">إدارة المواد الدراسية 📖</h2>
              <div className="bg-orange-50 text-orange-600 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2">
                <span>💡</span>
                يمكنك إضافة مواد جديدة مباشرة من قنوات إضافة المدرسين
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {stageSubjects.map((stageItem, idx) => (
                <div key={idx} className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-100 hover:border-[#10b981] transition-all group">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-[#0a192f] text-white flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform">
                      {STAGES.find(s => s.id === stageItem.stage)?.icon}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-[#0a192f]">{STAGES.find(s => s.id === stageItem.stage)?.name}</h3>
                      <p className="text-gray-400 font-bold text-sm">{stageItem.subjects.length} مادة مسجلة</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {stageItem.subjects.map((sub, sIdx) => (
                      <span key={sIdx} className="bg-gray-50 text-gray-600 px-4 py-2 rounded-xl font-bold border hover:bg-[#10b981] hover:text-white hover:border-[#10b981] transition-colors cursor-default">
                        {sub}
                      </span>
                    ))}
                    <button
                      onClick={() => {
                        const newSub = prompt('اسم المادة الجديدة :');
                        if (newSub) {
                          const updated = [...stageSubjects];
                          updated[idx].subjects.push(newSub);
                          setStageSubjects(updated);
                        }
                      }}
                      className="bg-gray-100 text-gray-400 px-4 py-2 rounded-xl font-bold border-2 border-dashed border-gray-200 hover:border-[#10b981] hover:text-[#10b981] transition-all"
                    >
                      + إضافة
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      }

      {/* Settings Tab */}
      {
        activeTab === 'settings' && (
          <div className="animate-in fade-in max-w-2xl mx-auto space-y-8">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-gray-100">
              <div className="flex items-center gap-4 mb-6">
                <span className="text-4xl">⚙️</span>
                <div>
                  <h2 className="text-2xl font-black text-[#0a192f]">إعدادات الربط والبيانات</h2>
                  <p className="text-gray-400 font-bold text-sm">تكوين الربط مع Google Sheets</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-black text-gray-500 mb-2">رابط Webhook (Google Apps Script):</label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/..."
                    className="w-full border-2 border-gray-200 rounded-xl p-4 font-bold text-left outline-none focus:border-[#10b981] transition-colors"
                    dir="ltr"
                  />
                  <p className="text-xs text-gray-400 mt-2 font-bold leading-relaxed">
                    * يجب إنشاء Google Apps Script جديد ونشره كـ Web App بصلاحية "Anyone".
                    <br />
                    * سيتم إرسال بيانات الحجز (اسم الطالب، ولي الأمر، المدرس، الوقت) تلقائياً لهذا الرابط عند أي حجز جديد.
                  </p>
                </div>

                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                  <h4 className="font-black text-blue-800 mb-2 text-sm">كيفية الإعداد:</h4>
                  <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1 font-bold">
                    <li>أنشئ شيت جوجل جديد.</li>
                    <li>اذهب إلى Extensions {'>'} Apps Script.</li>
                    <li>انسخ الكود الموجود في ملف <code>sheetService.ts</code>.</li>
                    <li>اضغط Deploy {'>'} New Deployment.</li>
                    <li>اختر Web app، واجعل الـ Access: Anyone.</li>
                    <li>انسخ الرابط الناتج وضعه هنا.</li>
                  </ol>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => {
                      if (!webhookUrl) return alert("يرجى إدخال الرابط أولاً");
                      // Simple Save Confirmation
                      localStorage.setItem('google_sheet_webhook_url', webhookUrl);
                      alert("تم حفظ الرابط بنجاح! سيتم استخدامه في الحجوزات القادمة.");
                    }}
                    className="w-full bg-[#0a192f] text-white py-4 rounded-2xl font-black hover:bg-[#10b981] transition-all shadow-xl active:scale-95"
                  >
                    حفظ واختبار 💾
                  </button>
                </div>
              </div>

              {/* API Key Settings Section */}
              <div className="mt-8 border-t pt-8">
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-4xl">🔑</span>
                  <div>
                    <h2 className="text-2xl font-black text-[#0a192f]">مفتاح الذكاء الاصطناعي (API Key)</h2>
                    <p className="text-gray-400 font-bold text-sm">إعدادات Gemini AI</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-black text-gray-500 mb-2">Gemini API Key:</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => {
                          setApiKey(e.target.value);
                          localStorage.setItem('gemini_api_key', e.target.value);
                        }}
                        placeholder="AIzaSy..."
                        className="flex-1 border-2 border-gray-200 rounded-xl p-4 font-bold text-left outline-none focus:border-[#10b981] transition-colors"
                        dir="ltr"
                      />
                      {apiKey && (
                        <button
                          onClick={() => {
                            setApiKey('');
                            localStorage.removeItem('gemini_api_key');
                          }}
                          className="bg-red-50 text-red-500 px-4 rounded-xl font-bold hover:bg-red-100 transition-all"
                        >
                          حذف
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-2 font-bold">
                      * يتم حفظ المفتاح محلياً في متصفحك لضمان الخصوصية.
                      <br />
                      * يستخدم لتوليد الجداول، إضافة المدرسين، وتحسين النصوص.
                    </p>
                  </div>
                </div>
              </div>

              {/* Anthropic API Key Settings Section */}
              <div className="mt-8 border-t pt-8">
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-4xl">⚡</span>
                  <div>
                    <h2 className="text-2xl font-black text-[#0a192f]">Claude API Key</h2>
                    <p className="text-gray-400 font-bold text-sm">إعدادات Anthropic Claude 3.5 Sonnet</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-black text-gray-500 mb-2">Anthropic API Key (sk-ant...):</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={anthropicApiKey}
                        onChange={(e) => {
                          setAnthropicApiKey(e.target.value);
                          localStorage.setItem('anthropic_api_key', e.target.value);
                        }}
                        placeholder="sk-ant-api..."
                        className="flex-1 border-2 border-gray-200 rounded-xl p-4 font-bold text-left outline-none focus:border-[#f97316] transition-colors"
                        dir="ltr"
                      />
                      {anthropicApiKey && (
                        <button
                          onClick={() => {
                            setAnthropicApiKey('');
                            localStorage.removeItem('anthropic_api_key');
                          }}
                          className="bg-red-50 text-red-500 px-4 rounded-xl font-bold hover:bg-red-100 transition-all"
                        >
                          حذف
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )
      }
      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95" dir="rtl">
            <h3 className="text-2xl font-black text-[#0a192f] mb-4">
              {missingKeyProvider === 'gemini' ? '💎 مفتاح Gemini' : '⚡ مفتاح Claude'} مطلوب
            </h3>
            <p className="text-gray-500 mb-6 font-bold">
              لتفعيل هذه الميزة، يرجى إدخال مفتاح API الخاص بـ {missingKeyProvider === 'gemini' ? 'Google Gemini' : 'Anthropic Claude'}.
            </p>

            <input
              type="password"
              placeholder={missingKeyProvider === 'gemini' ? 'AIzaSy...' : 'sk-ant-api...'}
              className="w-full border-2 border-gray-200 rounded-xl p-4 font-bold text-left outline-none focus:border-[#10b981] mb-6"
              autoFocus
              dir="ltr"
              onChange={(e) => {
                if (missingKeyProvider === 'gemini') {
                  setApiKey(e.target.value);
                  localStorage.setItem('gemini_api_key', e.target.value);
                } else {
                  setAnthropicApiKey(e.target.value);
                  localStorage.setItem('anthropic_api_key', e.target.value);
                }
              }}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="flex-1 bg-[#0a192f] text-white py-3 rounded-xl font-black hover:bg-[#10b981] transition-all"
              >
                حفظ ومتابعة
              </button>
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};
