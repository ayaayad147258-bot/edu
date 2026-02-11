
import React, { useState } from 'react';
import { Teacher, Stage } from '../types';
import { STAGES, ACADEMY_CONFIG } from '../constants';
import { BookingModal } from './BookingModal';

interface TeachersListProps {
  teachers: Teacher[];
  onBack: () => void;
}

export const TeachersList: React.FC<TeachersListProps> = ({ teachers, onBack }) => {
  const [selectedStage, setSelectedStage] = useState<Stage | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [bookingTargetName, setBookingTargetName] = useState<string | null>(null);

  const filteredTeachers = teachers.filter(t => {
    const matchesStage = selectedStage === 'all' || t.stages?.includes(selectedStage);
    const matchesSearch = 
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.subject.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStage && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      {bookingTargetName && (
        <BookingModal 
          targetName={bookingTargetName} 
          type="مدرس" 
          onClose={() => setBookingTargetName(null)} 
        />
      )}

      <button onClick={onBack} className="mb-8 text-gray-400 hover:text-[#0a192f] flex items-center gap-3 font-black text-lg transition-colors group">
        <span className="bg-white p-3 rounded-2xl shadow-sm group-hover:-translate-x-2 transition-transform">←</span> العودة للرئيسية
      </button>

      <div className="text-center mb-16">
        <h1 className="text-5xl font-black text-[#0a192f] mb-4">نخبة مدرسينا 👨‍🏫</h1>
        <p className="text-gray-500 text-xl font-medium">أفضل المعلمين في مصر لضمان تفوقك الدراسي</p>
      </div>

      {/* Search and Filter Section */}
      <div className="flex flex-col items-center gap-8 mb-16">
        {/* Search Bar */}
        <div className="relative w-full max-w-2xl group">
          <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl group-focus-within:scale-110 transition-transform">🔍</span>
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث عن مدرس أو مادة دراسية..."
            className="w-full bg-white border-2 border-gray-100 rounded-[2rem] py-6 pr-16 pl-8 text-xl font-bold shadow-xl shadow-gray-200/20 focus:border-[#10b981] focus:ring-4 focus:ring-[#10b981]/5 outline-none transition-all placeholder:text-gray-300"
          />
        </div>

        {/* Stage Tabs */}
        <div className="flex flex-wrap justify-center gap-3">
          <button 
            onClick={() => setSelectedStage('all')} 
            className={`px-8 py-3 rounded-2xl font-black transition-all ${selectedStage === 'all' ? 'bg-[#0a192f] text-white shadow-xl scale-105' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}`}
          >
            الكل
          </button>
          {STAGES.map(stage => (
            <button 
              key={stage.id} 
              onClick={() => setSelectedStage(stage.id)} 
              className={`px-8 py-3 rounded-2xl font-black transition-all flex items-center gap-2 ${selectedStage === stage.id ? 'bg-[#10b981] text-white shadow-xl scale-105' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}`}
            >
              <span>{stage.icon}</span> {stage.name}
            </button>
          ))}
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {filteredTeachers.map(teacher => (
          <div key={teacher.id} className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-100 hover:border-[#10b981] hover:-translate-y-2 transition-all group flex flex-col h-full">
            <div className="relative mb-6">
               <img src={teacher.imageUrl} className="w-32 h-32 rounded-[2rem] mx-auto border-4 border-gray-50 shadow-md group-hover:scale-105 transition-transform object-cover" alt={teacher.name} />
               <div className="absolute -bottom-2 right-1/2 translate-x-1/2 bg-[#10b981] text-white px-4 py-1 rounded-full text-xs font-black shadow-lg whitespace-nowrap">
                 {teacher.subject}
               </div>
            </div>
            <div className="text-center flex-1 flex flex-col">
              <h3 className="text-2xl font-black text-[#0a192f] mb-2">{teacher.name}</h3>
              <p className="text-gray-400 text-sm font-medium mb-6 line-clamp-3 flex-1">{teacher.bio || 'مدرس متميز في الأكاديمية.'}</p>
              <div className="bg-gray-50 p-4 rounded-2xl text-right space-y-2 mb-6">
                <div className="text-xs font-black text-gray-400">📅 التواجد:</div>
                <div className="text-sm font-bold text-[#0a192f]">{teacher.availability}</div>
              </div>
              <button 
                onClick={() => setBookingTargetName(teacher.name)}
                className="block w-full bg-[#0a192f] text-white py-4 rounded-2xl font-black hover:bg-[#10b981] transition-all shadow-lg active:scale-95"
              >
                تواصل للحجز
              </button>
            </div>
          </div>
        ))}
        {filteredTeachers.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-black text-gray-400">لم يتم العثور على مدرسين يطابقون بحثك</h3>
            <button 
              onClick={() => {setSearchTerm(''); setSelectedStage('all');}}
              className="mt-4 text-[#10b981] font-black hover:underline"
            >
              إعادة تعيين البحث
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
