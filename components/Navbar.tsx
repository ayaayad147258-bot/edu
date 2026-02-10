
import logo from '../assets/logo.png';
import React from 'react';
import { ACADEMY_CONFIG } from '../constants';

interface NavbarProps {
  onNavigate: (view: 'home' | 'stages' | 'grade' | 'admin' | 'teachers') => void;
  isAdmin: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate, isAdmin }) => {
  return (
    <nav className="bg-white border-b sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('home')}>
            <img
              src={logo}
              alt="Educators Academy Logo"
              className="h-14 w-auto object-contain"
            />
            <div className="flex flex-col">
              <span className="text-[#0a192f] font-black text-xl leading-none hidden md:block">Educators Academy</span>
              <span className="text-[#10b981] font-bold text-xs hidden md:block tracking-widest">CENTER OF EXCELLENCE</span>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-8 space-x-reverse text-gray-600 font-medium">
            <button onClick={() => onNavigate('home')} className="hover:text-[#10b981] transition font-bold">الرئيسية</button>
            <button onClick={() => onNavigate('stages')} className="hover:text-[#10b981] transition font-bold">المراحل</button>
            <button onClick={() => onNavigate('teachers')} className="hover:text-[#10b981] transition font-bold">المدرسين</button>
            <button onClick={() => onNavigate('admin')} className={`px-4 py-2 rounded-xl font-bold transition-all ${isAdmin ? 'bg-[#0a192f] text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {isAdmin ? '👑 لوحة التحكم' : '🔑 دخول الإدارة'}
            </button>
          </div>

          <a
            href={`https://wa.me/20${ACADEMY_CONFIG.phone}`}
            target="_blank"
            className="bg-[#f97316] text-white px-6 py-2.5 rounded-full font-black hover:bg-orange-600 transition shadow-xl shadow-orange-500/20 active:scale-95"
          >
            حجز سريع
          </a>
        </div>
      </div>
    </nav>
  );
};
