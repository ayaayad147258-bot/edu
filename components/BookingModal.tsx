
import React, { useState } from 'react';
import { BookingData, submitBookingToSheet } from '../services/sheetService';
import { ACADEMY_CONFIG } from '../constants';

interface BookingModalProps {
  targetName: string;
  type: 'مدرس' | 'كورس' | 'حصة';
  onClose: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({ targetName, type, onClose }) => {
  const [studentName, setStudentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName || !parentPhone) return;

    setIsSubmitting(true);

    const now = new Date();
    const formattedTimestamp = now.toLocaleString('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const bookingData: BookingData = {
      studentName,
      parentPhone,
      teacherName: targetName,
      timestamp: formattedTimestamp,
    };

    // 1. الإرسال لشيت جوجل في الخلفية
    await submitBookingToSheet(bookingData);

    // 2. تجهيز الرابط بشكل صحيح
    const myNum = ACADEMY_CONFIG.phone; // '01011828609'
    const cleanPhone = myNum.startsWith('0') ? `2${myNum}` : `20${myNum}`;
    const msg = `أهلاً مستر ناصر، أرغب في حجز موعد للطالب: ${studentName} مع المدرس/الكورس: ${targetName}`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    
    setWhatsappUrl(url);
    setSuccess(true);
    
    // الحل الجذري: استخدام window.open مع '_blank' لتجاوز قيود الـ Iframe والأمان
    // المحاولة الأولى: توجيه تلقائي
    const newWindow = window.open(url, '_blank');
    
    // إذا فشل التوجيه التلقائي (بسبب حظر النوافذ المنبثقة)، سيقوم المستخدم بالضغط على الزر في واجهة النجاح
    setTimeout(() => {
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        console.warn("Popup blocked or failed to redirect automatically.");
      }
      setIsSubmitting(false);
    }, 1200);
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a192f]/80 backdrop-blur-md animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 text-center shadow-2xl animate-in zoom-in-95">
          <div className="text-7xl mb-6">✅</div>
          <h3 className="text-3xl font-black text-[#0a192f] mb-3">تم الحفظ بنجاح!</h3>
          <p className="text-gray-500 font-bold mb-8 text-lg leading-relaxed">جاري فتح الواتساب الآن..</p>
          
          <div className="space-y-4">
            <a 
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-[#25d366] text-white py-5 rounded-2xl font-black text-xl hover:bg-[#1ebe57] transition-all shadow-xl shadow-green-500/20"
            >
              اضغط هنا إذا لم يتم فتح الواتساب
            </a>
            <button 
              onClick={onClose}
              className="block w-full text-gray-400 font-bold hover:text-[#0a192f] transition-colors"
            >
              إغلاق العودة للموقع
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a192f]/60 backdrop-blur-sm animate-in fade-in duration-300 text-right">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border-t-8 border-[#2d5a4c]">
        <div className="p-8 text-center">
          <h3 className="text-3xl font-black text-[#2d5a4c] mb-2">تواصل للحجز 🎓</h3>
          <p className="text-gray-400 font-bold text-lg">الحجز مع: {targetName}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="px-8 pb-10 space-y-5">
          <div>
            <label className="block text-sm font-black text-gray-500 mb-2 mr-1">اسم الطالب الثلاثي:</label>
            <input 
              required
              type="text" 
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-4 bg-gray-50 focus:border-[#10b981] outline-none font-black text-right text-lg"
              placeholder="مثال: محمد أحمد علي"
            />
          </div>
          
          <div>
            <label className="block text-sm font-black text-gray-500 mb-2 mr-1">رقم ولي الأمر:</label>
            <input 
              required
              type="tel" 
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-4 bg-gray-50 focus:border-[#10b981] outline-none font-black text-left text-lg"
              dir="ltr"
              placeholder="010xxxxxxxx"
            />
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#25d366] text-white py-5 rounded-xl font-black text-xl hover:bg-[#1ebe57] transition-all shadow-xl shadow-green-500/10 disabled:opacity-50"
            >
              {isSubmitting ? 'جاري الحفظ والتحويل...' : 'تأكيد البيانات والحجز'}
            </button>
            <button 
              type="button"
              onClick={onClose}
              className="w-full text-gray-400 font-bold mt-4 hover:text-red-500 transition-colors"
            >
              إلغاء الطلب
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
