
export interface BookingData {
  studentName: string;
  parentPhone: string;
  teacherName: string; // تم التعديل لتطابق الكود المطلوب (teacherName)
  timestamp: string;
}

/**
 * وظيفة إرسال البيانات إلى شيت جوجل.
 * 
 * كود Google Apps Script النهائي والمطور (انسخه وضعه في Apps Script):
 * -----------------------------------------------------------
 * function doPost(e) {
 *   var ss = SpreadsheetApp.getActiveSpreadsheet();
 *   var sheet = ss.getSheetByName("شيت حجوزات") || ss.getSheets()[0];
 *   
 *   try {
 *     // استلام البيانات من URLSearchParams أو JSON
 *     var data = e.parameter;
 *     if (!data.studentName && e.postData && e.postData.contents) {
 *       data = JSON.parse(e.postData.contents);
 *     }
 *     
 *     // ترتيب الأعمدة المطلوب:
 *     // العمود A: اسم الطالب
 *     // العمود B: رقم ولي الأمر
 *     // العمود C: اسم المدرس
 *     // العمود D: التاريخ والساعة
 *     
 *     sheet.appendRow([
 *       data.studentName || "", 
 *       "'" + (data.parentPhone || ""), // إضافة ' للحفاظ على الصفر الشمال
 *       data.teacherName || "",
 *       data.timestamp || new Date().toLocaleString('ar-EG')
 *     ]);
 *     
 *     return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
 *   } catch(err) {
 *     return ContentService.createTextOutput("Error").setMimeType(ContentService.MimeType.TEXT);
 *   }
 * }
 * -----------------------------------------------------------
 */
export const submitBookingToSheet = async (data: BookingData) => {
  const webhookUrl = localStorage.getItem('google_sheet_webhook_url');
  
  if (!webhookUrl) {
    console.warn("رابط شيت جوجل غير مضبوط في لوحة التحكم.");
    return false;
  }

  try {
    // تجهيز البيانات باستخدام URLSearchParams كما هو مطلوب في الكود المرفق
    const params = new URLSearchParams();
    params.append('studentName', data.studentName);
    params.append('parentPhone', data.parentPhone);
    params.append('teacherName', data.teacherName);
    params.append('timestamp', data.timestamp);

    // استخدام mode: 'no-cors' لتجنب مشاكل CORS مع تطبيقات جوجل سكريبت
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      body: params,
    });
    
    return true;
  } catch (error) {
    console.error("خطأ في الربط:", error);
    return false;
  }
};
