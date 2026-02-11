
import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { GradeDetail } from './components/GradeDetail';
import { AdminDashboard } from './components/AdminDashboard';
import { TeachersList } from './components/TeachersList';
import { STAGES, INITIAL_TEACHERS, INITIAL_COURSES, INITIAL_GRADES, ACADEMY_CONFIG } from './constants';
import { Stage, GradeData, Teacher, Course } from './types';
import { dbService } from './services/dbService';
import logo from './assets/logo.png';


import { parseScheduleWithAI, parseTeachersWithAI } from './services/geminiService';
import { VoiceAssistant } from './components/VoiceAssistant';

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'stages' | 'grade' | 'admin' | 'teachers'>('home');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [apiKey, setApiKey] = useState('');

  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<GradeData | null>(null);

  const [grades, setGrades] = useState<GradeData[]>(INITIAL_GRADES);
  const [teachers, setTeachers] = useState<Teacher[]>(INITIAL_TEACHERS);
  const [courses, setCourses] = useState<Course[]>(INITIAL_COURSES);

  useEffect(() => {
    const fetchData = async () => {
      const data = await dbService.loadData();
      if (data.grades && data.grades.length > 0) setGrades(data.grades);
      if (data.teachers && data.teachers.length > 0) setTeachers(data.teachers);
      if (data.courses && data.courses.length > 0) setCourses(data.courses);

      // Check for API Key
      if (window.aistudio) {
        const key = await window.aistudio.getKey();
        if (key) setApiKey(key);
      }
    };
    fetchData();
  }, []);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === '55') {
      setIsAdminAuthenticated(true);
    } else {
      alert('كلمة المرور غير صحيحة!');
    }
  };

  const handleStageSelect = (stage: Stage) => {
    setSelectedStage(stage);
    setView('stages');
  };

  const handleGradeSelect = (gradeId: string) => {
    const grade = grades.find(g => g.id === gradeId);
    if (grade) {
      setSelectedGrade(grade);
      setView('grade');
    }
  };

  // Voice Assistant Handlers
  const handleVoiceUpdateSchedule = async (gradeId: string, text: string) => {
    try {
      const newSchedule = await parseScheduleWithAI(text, apiKey);
      const updatedGrades = grades.map(g => {
        if (g.id === gradeId) {
          return { ...g, schedule: newSchedule };
        }
        return g;
      });
      setGrades(updatedGrades);
      await dbService.saveGrades(updatedGrades);
    } catch (error) {
      console.error("Voice Schedule Error:", error);
    }
  };

  const handleVoiceAddTeacher = async (text: string) => {
    try {
      const newTeachersData = await parseTeachersWithAI(text, apiKey);
      if (newTeachersData.length > 0) {
        const newTeachers = newTeachersData.map(t => ({
          ...t,
          id: t.id || `t-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          imageUrl: t.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name || 'Teacher')}&background=random`
        })) as Teacher[];

        const updatedTeachers = [...teachers, ...newTeachers];
        setTeachers(updatedTeachers);
        await dbService.saveTeachers(updatedTeachers);
      }
    } catch (error) {
      console.error("Voice Teacher Add Error:", error);
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-gray-50 selection:bg-[#10b981] selection:text-white">
      <Navbar onNavigate={(v) => { setView(v); setSelectedStage(null); }} isAdmin={isAdminAuthenticated} />

      {/* Voice Assistant for Admin */}
      {isAdminAuthenticated && (
        <VoiceAssistant
          onUpdateSchedule={handleVoiceUpdateSchedule}
          onAddTeacher={handleVoiceAddTeacher}
          grades={grades}
          apiKey={apiKey}
        />
      )}

      {view === 'home' && (
        <main>
          {/* Hero Section */}
          <section className="relative bg-[#0a192f] text-white py-24 md:py-32 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 relative z-10 flex flex-col items-center text-center">
              <div className="mb-10 animate-in fade-in zoom-in duration-1000">
                <img src={logo} alt="Logo" className="w-48 md:w-64 h-auto drop-shadow-[0_0_30px_rgba(16,185,129,0.3)] mx-auto" />
              </div>
              <div className="inline-block bg-[#10b981]/20 border border-[#10b981]/30 text-[#10b981] px-6 py-2 rounded-full font-black text-sm mb-8 animate-bounce">
                🚀 منصة الأكاديمية المطورة للعام 2025
              </div>
              <h1 className="text-5xl md:text-8xl font-black mb-8 leading-tight">
                Educators Academy<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#10b981] to-[#34d399]">البيت الثاني لأولادك</span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mb-12 leading-relaxed font-bold">
                نستخدم أحدث تقنيات الذكاء الاصطناعي لتنظيم رحلة تعليمية ذكية، سهلة، وممتعة لكل طالب وولي أمر.
              </p>
              <div className="flex flex-wrap justify-center gap-6">
                <button onClick={() => setView('stages')} className="bg-[#10b981] px-12 py-5 rounded-2xl font-black text-xl hover:bg-emerald-600 transition-all shadow-2xl shadow-emerald-500/20 active:scale-95">
                  ابدأ رحلتك الآن
                </button>
                <a href={`https://wa.me/20${ACADEMY_CONFIG.phone}`} target="_blank" className="bg-white/5 backdrop-blur-xl border border-white/10 px-12 py-5 rounded-2xl font-black text-xl hover:bg-white/10 transition-all active:scale-95">
                  تواصل واتساب
                </a>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#10b981] rounded-full blur-[180px] opacity-20 -mr-64 -mt-64"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#f97316] rounded-full blur-[180px] opacity-10 -ml-64 -mb-64"></div>
          </section>

          {/* Stages Grid (Home) */}
          <section className="py-24 max-w-7xl mx-auto px-4">
            <div className="text-right mb-16">
              <h2 className="text-5xl font-black mb-4 text-[#0a192f]">المراحل الدراسية</h2>
              <div className="h-2 w-32 bg-gradient-to-r from-[#10b981] to-transparent rounded-full"></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {STAGES.map((stage) => (
                <div key={stage.id} onClick={() => handleStageSelect(stage.id)} className="group bg-white p-12 rounded-[3rem] shadow-xl border-2 border-transparent hover:border-[#10b981] hover:-translate-y-3 transition-all cursor-pointer text-center relative overflow-hidden active:scale-95">
                  <div className="text-7xl mb-8 relative z-10 group-hover:scale-110 transition-transform duration-500">{stage.icon}</div>
                  <h3 className="text-3xl font-black text-[#0a192f] relative z-10">{stage.name}</h3>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {view === 'stages' && (
        <div className="max-w-7xl mx-auto px-4 py-20 animate-in fade-in slide-in-from-bottom-6">
          <button onClick={() => setView('home')} className="mb-10 text-gray-400 hover:text-[#0a192f] flex items-center gap-3 font-black text-lg transition-colors group">
            <span className="bg-white p-3 rounded-2xl shadow-sm group-hover:-translate-x-2 transition-transform">←</span> العودة للرئيسية
          </button>

          {!selectedStage ? (
            <div>
              <h2 className="text-4xl font-black text-[#0a192f] mb-12 text-right">اختر المرحلة الدراسية</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {STAGES.map((stage) => (
                  <div key={stage.id} onClick={() => setSelectedStage(stage.id)} className="group bg-white p-12 rounded-[3rem] shadow-xl border-2 border-transparent hover:border-[#10b981] hover:-translate-y-3 transition-all cursor-pointer text-center active:scale-95">
                    <div className="text-7xl mb-8">{stage.icon}</div>
                    <h3 className="text-3xl font-black text-[#0a192f]">{stage.name}</h3>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-12">
                <button onClick={() => setSelectedStage(null)} className="text-[#10b981] font-black hover:underline text-xl">تغيير المرحلة الدراسية</button>
                <h2 className="text-4xl font-black text-[#0a192f]">صفوف {STAGES.find(s => s.id === selectedStage)?.name}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                {grades.filter(g => g.stage === selectedStage).map(grade => (
                  <div key={grade.id} onClick={() => handleGradeSelect(grade.id)} className="bg-white p-10 rounded-[2.5rem] shadow-xl hover:shadow-2xl hover:border-[#10b981] border-2 border-transparent transition-all cursor-pointer text-center group active:scale-95">
                    <h3 className="text-2xl font-black text-[#0a192f] leading-tight">{grade.name}</h3>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'grade' && selectedGrade && (
        <GradeDetail grade={selectedGrade} teachers={teachers} courses={courses} onBack={() => setView('stages')} />
      )}

      {view === 'teachers' && <TeachersList teachers={teachers} onBack={() => setView('home')} />}

      {view === 'admin' && (
        !isAdminAuthenticated ? (
          <div className="min-h-[80vh] flex items-center justify-center p-4">
            <form onSubmit={handleAdminLogin} className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md text-center border-t-8 border-[#0a192f]">
              <img src={logo} alt="Logo" className="w-24 h-auto mx-auto mb-6" />
              <h2 className="text-4xl font-black text-[#0a192f] mb-8">دخول الإدارة 🔐</h2>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="كلمة المرور"
                className="w-full border-2 rounded-2xl p-4 mb-6 font-bold text-center text-lg focus:border-[#10b981] outline-none transition-all"
              />
              <button type="submit" className="w-full bg-[#0a192f] text-white py-4 rounded-2xl font-black text-xl hover:bg-[#10b981] transition-all shadow-lg active:scale-95">دخول لوحة التحكم</button>
            </form>
          </div>
        ) : (
          <AdminDashboard
            grades={grades} setGrades={setGrades}
            teachers={teachers} setTeachers={setTeachers}
            courses={courses} setCourses={setCourses}
            onLogout={() => setIsAdminAuthenticated(false)}
          />
        )
      )}
    </div>
  );
};

export default App;
