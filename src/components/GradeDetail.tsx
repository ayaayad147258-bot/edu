
import React, { useState } from 'react';
import { GradeData, Teacher, Course, CourseMedia } from '../types';
import { ACADEMY_CONFIG, STAGES } from '../constants';
import { BookingModal } from './BookingModal';

interface GradeDetailProps {
  grade: GradeData;
  teachers: Teacher[];
  courses: Course[];
  onBack: () => void;
}

export const GradeDetail: React.FC<GradeDetailProps> = ({ grade, teachers, courses, onBack }) => {
  const formatTimeForDisplay = (timeStr: string) => {
    if (!timeStr) return '';

    // Check if it's already 12h (contains AM/PM or Arabic suffix)
    if (timeStr.match(/AM|PM|ص|م/)) return timeStr;

    // Try parsing "HH:mm"
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      let h = parseInt(match[1]);
      const m = match[2];
      const period = h >= 12 ? 'م' : 'ص';
      h = h % 12 || 12;
      return `${h}:${m} ${period}`;
    }

    return timeStr; // Fallback
  };

  const [activeTab, setActiveTab] = useState<'schedule' | 'teachers' | 'courses'>('schedule');

  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<CourseMedia | null>(null);
  const [bookingTarget, setBookingTarget] = useState<{ name: string, type: 'مدرس' | 'كورس' | 'حصة' } | null>(null);

  const [showRamadan, setShowRamadan] = useState(false);

  // Determine which schedule to show
  const activeSchedule = (showRamadan && grade.ramadanSchedule && grade.ramadanSchedule.length > 0)
    ? grade.ramadanSchedule
    : grade.schedule;

  const gradeTeachers = teachers.filter(t => grade.teachers.includes(t.id));
  const gradeCourses = courses.filter(c => grade.courses.includes(c.id));

  const getYouTubeEmbedUrl = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}`;
    }
    return null;
  };

  const isDirectVideo = (url: string) => {
    return url.includes('firebasestorage') || url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov');
  };

  const getPdfEmbedUrl = (url: string) => {
    // 1. Google Drive Links (convert /view to /preview)
    if (url.includes('drive.google.com') && !url.includes('/preview')) {
      return url.replace('/view', '/preview').replace('/edit', '/preview');
    }
    // 2. Generic PDFs (use Google Docs Viewer for better compatibility)
    // NOTE: If it's already a docs.google.com link, we trust it, otherwise wrap it.
    if (url.includes('docs.google.com/presentation') || url.includes('docs.google.com/document')) {
      return url.replace('/edit', '/preview').replace('/view', '/preview');
    }

    return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {bookingTarget && (
        <BookingModal
          targetName={bookingTarget.name}
          type={bookingTarget.type}
          onClose={() => setBookingTarget(null)}
        />
      )}

      <button onClick={onBack} className="mb-8 text-gray-400 flex items-center gap-3 hover:text-[#0a192f] transition-all group font-black">
        <span className="bg-white p-2 rounded-xl shadow-sm group-hover:-translate-x-1 transition-transform">←</span> العودة للصفوف الدراسية
      </button>

      <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden mb-12 border border-gray-100 animate-in fade-in zoom-in-95 duration-700">
        <div className="bg-[#0a192f] p-12 text-white relative overflow-hidden text-right">
          <div className="relative z-10">
            <h1 className="text-5xl font-black mb-4">{grade.name}</h1>
            <p className="text-blue-200/80 text-xl font-medium max-w-2xl">استعرض جدول المواعيد، قائمة المدرسين، والمحتوى التعليمي المتاح لهذا الصف</p>
          </div>
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#10b981] rounded-full blur-[140px] opacity-20 -mr-40 -mt-40"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#f97316] rounded-full blur-[120px] opacity-10 -ml-32 -mb-32"></div>
        </div>

        <div className="flex border-b bg-gray-50/50 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 py-6 px-10 font-black text-xl transition-all flex items-center justify-center gap-3 ${activeTab === 'schedule' ? 'text-[#10b981] border-b-4 border-[#10b981] bg-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <span>🗓️</span> الجدول الدراسي
          </button>
          <button
            onClick={() => setActiveTab('teachers')}
            className={`flex-1 py-6 px-10 font-black text-xl transition-all flex items-center justify-center gap-3 ${activeTab === 'teachers' ? 'text-[#10b981] border-b-4 border-[#10b981] bg-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <span>👨‍🏫</span> المدرسين المتميزين
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`flex-1 py-6 px-10 font-black text-xl transition-all flex items-center justify-center gap-3 ${activeTab === 'courses' ? 'text-[#10b981] border-b-4 border-[#10b981] bg-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <span>📚</span> الكورسات التعليمية
          </button>
        </div>

        <div className="p-8 md:p-14 text-right">
          {activeTab === 'schedule' && (
            <div>
              {/* Ramadan Toggle */}
              {grade.ramadanSchedule && grade.ramadanSchedule.length > 0 && (
                <div className="flex justify-center mb-8">
                  <button
                    onClick={() => setShowRamadan(!showRamadan)}
                    className={`relative px-8 py-3 rounded-full font-black text-lg transition-all flex items-center gap-3 shadow-lg ${showRamadan ? 'bg-[#f97316] text-white' : 'bg-[#0a192f] text-white hover:bg-[#10b981]'}`}
                  >
                    <span>{showRamadan ? '🌙 عرض الجدول الأساسي' : '🌙 عرض جدول رمضان'}</span>
                    {showRamadan && <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                    </span>}
                  </button>
                </div>
              )}

              {showRamadan && (
                <div className="text-center mb-6 animate-in fade-in zoom-in">
                  <h2 className="text-3xl font-black text-[#f97316]">🌙 جدول شهر رمضان المبارك</h2>
                  <p className="text-gray-500 font-bold mt-2">كل عام وأنتم بخير - مواعيد مخففة</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-7 gap-6 animate-in slide-in-from-bottom-8 duration-500">
                {activeSchedule.map((day, idx) => (
                  <div key={idx} className="flex flex-col gap-4">
                    <div className="bg-[#0a192f] text-white py-4 rounded-3xl text-center font-black shadow-xl">
                      {day.day}
                    </div>
                    <div className="space-y-4">
                      {(() => {
                        const renderedKeys = new Set<string>();
                        return day.slots.map(slot => {
                          // Create a robust unique key by trimming and lowercasing components
                          const safeDay = (day.day || '').trim();
                          const safeSubject = (slot.subject || '').trim();
                          const safeTime = (slot.time || '').trim();
                          const key = `${safeDay}-${safeSubject}-${safeTime}`;

                          if (renderedKeys.has(key)) return null;
                          renderedKeys.add(key);

                          const teacher = teachers.find(t => t.id === slot.teacherId);
                          return (
                            <div
                              key={slot.id}
                              onClick={() => teacher && setSelectedTeacher(teacher)}
                              className={`${slot.color} p-6 rounded-[2rem] shadow-sm border border-black/5 flex flex-col gap-3 transform hover:scale-[1.05] hover:shadow-xl transition-all cursor-pointer`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-3xl">{slot.icon || '📖'}</span>
                                {teacher && <span className="text-[10px] bg-white/40 backdrop-blur-md px-3 py-1 rounded-full font-black uppercase text-gray-900">أ/ {teacher.name.split(' ')[1] || teacher.name}</span>}
                              </div>
                              <div>
                                <div className="font-black text-2xl text-gray-900 leading-tight">{slot.subject}</div>
                                <div className="text-sm font-bold opacity-70 mt-1">{formatTimeForDisplay(slot.time)}</div>

                              </div>
                            </div>
                          );
                        });
                      })()}
                      {day.slots.length === 0 && (
                        <div className="text-gray-200 text-center py-10 italic text-sm border-2 border-dashed border-gray-100 rounded-3xl">مساحة حرّة</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'teachers' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 animate-in slide-in-from-right-8 duration-500">
              {gradeTeachers.map(teacher => (
                <div key={teacher.id} onClick={() => setSelectedTeacher(teacher)} className="group bg-white rounded-[3rem] border border-gray-100 shadow-lg hover:shadow-2xl hover:border-[#10b981]/30 transition-all cursor-pointer overflow-hidden flex flex-col h-full active:scale-95">
                  <div className="h-48 overflow-hidden relative">
                    <img src={teacher.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt={teacher.name} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                    <div className="absolute bottom-4 right-6 bg-white/20 backdrop-blur-md text-white px-5 py-1.5 rounded-full text-xs font-black">
                      نخبة إيدوكيتورز
                    </div>
                  </div>
                  <div className="p-8 text-center flex-1 flex flex-col items-center">
                    <h3 className="text-3xl font-black mb-1 text-[#0a192f]">{teacher.name}</h3>
                    <p className="text-[#10b981] font-black text-xl mb-6">{teacher.subject}</p>
                    <div className="w-full h-px bg-gray-50 mb-6"></div>
                    <button onClick={(e) => { e.stopPropagation(); setBookingTarget({ name: teacher.name, type: 'مدرس' }); }} className="mt-auto w-full bg-[#10b981] text-white py-5 rounded-2xl font-black text-xl hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/10">
                      حجز الحصص والدروس
                    </button>
                  </div>
                </div>
              ))}
              {gradeTeachers.length === 0 && (
                <div className="col-span-full py-32 text-center">
                  <p className="text-gray-300 font-black text-2xl">سيتم إضافة مدرسي هذا الصف قريباً</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'courses' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in slide-in-from-left-8 duration-500">
              {gradeCourses.map(course => {
                const teacher = teachers.find(t => t.id === course.teacherId);
                return (
                  <div key={course.id} className="bg-white border-2 border-gray-100 rounded-[3.5rem] flex flex-col hover:border-[#f97316] transition-all group overflow-hidden shadow-sm hover:shadow-2xl active:scale-[0.98]">
                    <div className="h-64 overflow-hidden relative">
                      <img src={course.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt={course.title} />
                      <div className="absolute top-6 right-6 bg-[#f97316] text-white px-5 py-2 rounded-full text-xs font-black shadow-2xl animate-pulse">
                        كورس متميز (4K Content)
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                    </div>
                    <div className="p-10 flex-1 flex flex-col">
                      <h3 className="text-3xl font-black text-[#0a192f] group-hover:text-[#f97316] transition-colors mb-4">{course.title}</h3>
                      <p className="text-gray-500 text-xl leading-relaxed mb-8 flex-1 line-clamp-3">{course.description}</p>

                      <div className="space-y-4 mb-10">
                        <h4 className="font-black text-sm text-gray-300 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-4 h-0.5 bg-gray-200"></span> محتويات الكورس
                        </h4>
                        {course.media.map(m => (
                          <div key={m.id} onClick={() => setSelectedMedia(m)} className="flex items-center justify-between bg-gray-50 hover:bg-orange-50 p-5 rounded-3xl border border-gray-100 hover:border-orange-200 transition-all cursor-pointer group/item">
                            <div className="flex items-center gap-4">
                              <span className="text-3xl bg-white w-12 h-12 rounded-2xl shadow-sm flex items-center justify-center">
                                {m.type === 'video' ? '🎥' : m.type === 'pdf' ? '📄' : '🖼️'}
                              </span>
                              <span className="font-black text-xl text-[#0a192f]">{m.title}</span>
                            </div>
                            <span className="text-[#f97316] font-black text-sm opacity-0 group-hover/item:opacity-100 transition-all">مشاهدة الآن ←</span>
                          </div>
                        ))}
                      </div>

                      <button onClick={() => setBookingTarget({ name: course.title, type: 'كورس' })} className="w-full bg-[#f97316] text-white py-6 rounded-3xl font-black text-2xl hover:bg-orange-600 transition-all shadow-2xl shadow-orange-500/30">
                        اشترك في الكورس الآن 🚀
                      </button>
                    </div>
                  </div>
                );
              })}
              {gradeCourses.length === 0 && (
                <div className="col-span-full py-32 text-center">
                  <p className="text-gray-300 font-black text-2xl">لا توجد كورسات متاحة حالياً</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* High-End Media Player Modal */}
      {selectedMedia && (
        <div className="fixed inset-0 z-[120] bg-[#0a192f]/98 flex flex-col p-4 sm:p-10 animate-in fade-in duration-500">
          <div className="flex justify-between items-center mb-8 text-right">
            <div className="flex items-center gap-6">
              <button onClick={() => setSelectedMedia(null)} className="text-white bg-white/10 w-16 h-16 rounded-3xl flex items-center justify-center hover:bg-red-500 transition-all text-2xl shadow-2xl">✕</button>
              <div>
                <h2 className="text-white text-3xl font-black">{selectedMedia.title}</h2>
                <p className="text-blue-400 font-bold text-sm">محتوى حصري من إيدوكيتورز أكاديمي</p>
              </div>
            </div>
            <a href={selectedMedia.url} target="_blank" rel="noopener noreferrer" className="text-white font-black bg-[#10b981] px-10 py-4 rounded-2xl shadow-xl hover:bg-emerald-600 transition-all hidden sm:flex items-center gap-2">
              <span>فتح / تحميل</span> 🔗
            </a>
          </div>

          <div className="flex-1 bg-black rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] relative flex items-center justify-center border border-white/10 group">
            {selectedMedia.type === 'video' ? (
              getYouTubeEmbedUrl(selectedMedia.url) ? (
                <iframe src={`${getYouTubeEmbedUrl(selectedMedia.url)}?autoplay=1&rel=0&modestbranding=1`} className="w-full h-full border-none shadow-inner" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen></iframe>
              ) : isDirectVideo(selectedMedia.url) ? (
                <video src={selectedMedia.url} controls className="max-h-full max-w-full rounded-2xl" autoPlay playsInline controlsList="nodownload" />
              ) : (
                <div className="text-center p-10">
                  <p className="text-white text-2xl font-bold mb-6">هذا الفيديو مستضاف على منصة خارجية</p>
                  <a href={selectedMedia.url} target="_blank" rel="noopener noreferrer" className="bg-[#f97316] text-white px-8 py-4 rounded-2xl font-black text-xl hover:bg-orange-600 transition-all shadow-lg inline-flex items-center gap-2">
                    <span>مشاهدة الفيديو في نافذة جديدة</span> ↗️
                  </a>
                </div>
              )
            ) : selectedMedia.type === 'pdf' ? (
              <iframe src={getPdfEmbedUrl(selectedMedia.url)} className="w-full h-full border-none bg-white rounded-2xl" title="PDF Viewer" />
            ) : (
              <img src={selectedMedia.url} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-1000" />
            )}
            <div className="absolute top-10 left-10 pointer-events-none opacity-20 hidden sm:block">
              <span className="text-white text-9xl font-black select-none">EDUCATORS</span>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Profile Sidepanel */}
      {selectedTeacher && (
        <div
          className="fixed inset-0 z-[110] flex justify-end items-center bg-[#0a192f]/90 backdrop-blur-2xl animate-in fade-in p-0 sm:p-6 duration-500 cursor-pointer"
          onClick={() => setSelectedTeacher(null)}
        >
          <div
            className="bg-white h-full sm:h-auto w-full max-w-2xl sm:rounded-[3.5rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.4)] animate-in slide-in-from-left duration-700 text-right flex flex-col cursor-default relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedTeacher(null)}
              className="fixed top-6 left-6 z-[120] bg-red-500 hover:bg-red-600 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-2xl border-4 border-white/20 hover:scale-110 transition-all animate-pulse"
              title="إغلاق"
            >
              <span className="text-4xl font-black mb-1">×</span>
            </button>
            <div className="relative h-80 bg-[#0a192f]">
              <img src={selectedTeacher.imageUrl} className="w-full h-full object-cover opacity-70" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a192f] via-[#0a192f]/40 to-transparent"></div>
              <div className="absolute bottom-10 right-12">
                <h2 className="text-5xl font-black text-white mb-2">{selectedTeacher.name}</h2>
                <div className="flex gap-3">
                  <div className="bg-[#10b981] text-white px-6 py-2 rounded-full inline-block font-black text-lg shadow-xl">{selectedTeacher.subject}</div>
                  {selectedTeacher.whatsapp && (
                    <a href={`https://wa.me/20${selectedTeacher.whatsapp}`} target="_blank" rel="noopener noreferrer" className="bg-[#25D366] text-white px-6 py-2 rounded-full inline-flex items-center gap-2 font-black text-lg shadow-xl hover:bg-[#128C7E] transition-colors">
                      <span>واتساب</span> 💬
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="p-12 flex-1 space-y-10 overflow-y-auto">
              <div className="animate-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-2xl font-black text-[#0a192f] mb-6 flex items-center gap-3">
                  <span className="w-1.5 h-6 bg-[#10b981] rounded-full"></span> النبذة المهنية
                </h3>
                <p className="text-gray-600 text-2xl leading-relaxed bg-gray-50/50 p-10 rounded-[2.5rem] border-2 border-dashed border-gray-100 font-medium italic">
                  {selectedTeacher.bio || "مدرس خبير ومتميز ساهم في نجاح آلاف الطلاب على مدار سنوات عمله."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-8 duration-700">
                <div className="bg-emerald-50/50 p-8 rounded-[2rem] border-2 border-emerald-100 flex flex-col items-center text-center">
                  <span className="text-4xl mb-3">🗓️</span>
                  <p className="text-gray-400 text-xs font-black mb-1 uppercase tracking-tighter">أيام التواجد بالأكاديمية</p>
                  <p className="text-[#0a192f] font-black text-2xl">{selectedTeacher.availability || "متوفر طوال الأسبوع"}</p>
                </div>
                <div className="bg-blue-50/50 p-8 rounded-[2rem] border-2 border-blue-100 flex flex-col items-center text-center">
                  <span className="text-4xl mb-3">⏰</span>
                  <p className="text-gray-400 text-xs font-black mb-1 uppercase tracking-tighter">مواعيد الحصص</p>
                  <p className="text-[#0a192f] font-black text-2xl">{selectedTeacher.teachingHours || 'مواعيد مرنة'}</p>
                </div>
              </div>

              {selectedTeacher.hourlyRates && (
                <div className="animate-in slide-in-from-bottom-8 duration-700 delay-100">
                  <h3 className="text-2xl font-black text-[#0a192f] mb-6 flex items-center gap-3">
                    <span className="w-1.5 h-6 bg-[#f97316] rounded-full"></span> أسعار الحصص
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.entries(selectedTeacher.hourlyRates).map(([type, price]) => (
                      <div key={type} className="flex justify-between items-center bg-orange-50/50 p-6 rounded-2xl border border-orange-100">
                        <span className="font-bold text-[#0a192f] text-lg">{type}</span>
                        <span className="font-black text-[#f97316] text-xl">{price} ج.م</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-4 mt-auto">
                <button onClick={() => setBookingTarget({ name: selectedTeacher.name, type: 'مدرس' })} className="w-full bg-[#10b981] text-white py-6 rounded-3xl font-black text-2xl shadow-2xl shadow-emerald-500/30 hover:bg-emerald-600 transition-all active:scale-95 animate-in slide-in-from-bottom-12 duration-1000">
                  حجز موعد مع الأستاذ الآن 📥
                </button>
                <button onClick={() => setSelectedTeacher(null)} className="w-full bg-gray-100 text-gray-500 py-4 rounded-3xl font-bold text-xl hover:bg-gray-200 transition-all active:scale-95">
                  إغلاق النافذة ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
