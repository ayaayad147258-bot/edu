
import { GradeData, Teacher, Course } from '../types';

// الوصول إلى Firebase المعرف في index.html
declare var db: any;
declare var storage: any;

/**
 * وظيفة مساعدة لإزالة القيم undefined من الكائنات قبل إرسالها لـ Firestore
 */
const cleanForFirestore = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    return value === undefined ? null : value;
  }));
};

export const dbService = {
  /**
   * رفع أي ملف (صورة، فيديو، PDF) إلى Firebase Storage
   */
  async uploadFile(file: File, path: string): Promise<string> {
    if (typeof storage === 'undefined') {
      throw new Error("Firebase Storage is not initialized properly.");
    }
    // مسار فريد للملف لتجنب التكرار
    const extension = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${extension}`;
    const storageRef = storage.ref().child(`${path}/${fileName}`);
    
    // بدء الرفع
    const snapshot = await storageRef.put(file);
    // الحصول على رابط التحميل المباشر
    return await snapshot.ref.getDownloadURL();
  },

  async saveGrades(grades: GradeData[]) {
    localStorage.setItem('academy_grades', JSON.stringify(grades));
    if (typeof db !== 'undefined') {
      try {
        const batch = db.batch();
        grades.forEach(grade => {
          const ref = db.collection('grades').doc(grade.id);
          batch.set(ref, cleanForFirestore(grade));
        });
        await batch.commit();
      } catch (err) {
        console.error("Firebase Save Grades Error:", err);
      }
    }
  },
  
  async saveTeachers(teachers: Teacher[]) {
    localStorage.setItem('academy_teachers', JSON.stringify(teachers));
    if (typeof db !== 'undefined') {
      try {
        const batch = db.batch();
        teachers.forEach(teacher => {
          const ref = db.collection('teachers').doc(teacher.id);
          batch.set(ref, cleanForFirestore(teacher));
        });
        await batch.commit();
      } catch (err) {
        console.error("Firebase Save Teachers Error:", err);
      }
    }
  },
  
  async saveCourses(courses: Course[]) {
    localStorage.setItem('academy_courses', JSON.stringify(courses));
    if (typeof db !== 'undefined') {
      try {
        const batch = db.batch();
        courses.forEach(course => {
          const ref = db.collection('courses').doc(course.id);
          batch.set(ref, cleanForFirestore(course));
        });
        await batch.commit();
      } catch (err) {
        console.error("Firebase Save Courses Error:", err);
      }
    }
  },

  async loadData() {
    const cached = {
      grades: JSON.parse(localStorage.getItem('academy_grades') || 'null'),
      teachers: JSON.parse(localStorage.getItem('academy_teachers') || 'null'),
      courses: JSON.parse(localStorage.getItem('academy_courses') || 'null'),
    };

    if (typeof db !== 'undefined') {
      try {
        const [gradesSnap, teachersSnap, coursesSnap] = await Promise.all([
          db.collection('grades').get(),
          db.collection('teachers').get(),
          db.collection('courses').get()
        ]);

        const remoteData = {
          grades: gradesSnap.docs.map((doc: any) => doc.data()) as GradeData[],
          teachers: teachersSnap.docs.map((doc: any) => doc.data()) as Teacher[],
          courses: coursesSnap.docs.map((doc: any) => doc.data()) as Course[],
        };

        if (remoteData.grades.length > 0 || remoteData.teachers.length > 0 || remoteData.courses.length > 0) {
          localStorage.setItem('academy_grades', JSON.stringify(remoteData.grades));
          localStorage.setItem('academy_teachers', JSON.stringify(remoteData.teachers));
          localStorage.setItem('academy_courses', JSON.stringify(remoteData.courses));
          return remoteData;
        }
      } catch (err) {
        console.error("Firebase Load Error:", err);
      }
    }

    return cached;
  }
};
