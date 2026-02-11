
import { GradeData, Teacher, Course } from '../types';

import { db, storage } from './firebase';
import { collection, doc, getDocs, writeBatch, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
    if (!storage) {
      throw new Error("Firebase Storage is not initialized properly.");
    }
    // مسار فريد للملف لتجنب التكرار
    const extension = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${extension}`;
    const storageRef = ref(storage, `${path}/${fileName}`);

    // بدء الرفع
    const snapshot = await uploadBytes(storageRef, file);
    // الحصول على رابط التحميل المباشر
    return await getDownloadURL(snapshot.ref);
  },

  async saveGrades(grades: GradeData[]) {
    localStorage.setItem('academy_grades', JSON.stringify(grades));
    if (db) {
      try {
        const batch = writeBatch(db);
        grades.forEach(grade => {
          const gradeRef = doc(db, 'grades', grade.id);
          batch.set(gradeRef, cleanForFirestore(grade));
        });
        await batch.commit();
      } catch (err) {
        console.error("Firebase Save Grades Error:", err);
      }
    }
  },

  async saveTeachers(teachers: Teacher[]) {
    localStorage.setItem('academy_teachers', JSON.stringify(teachers));
    if (db) {
      try {
        const batch = writeBatch(db);
        teachers.forEach(teacher => {
          const teacherRef = doc(db, 'teachers', teacher.id);
          batch.set(teacherRef, cleanForFirestore(teacher));
        });
        await batch.commit();
      } catch (err) {
        console.error("Firebase Save Teachers Error:", err);
      }
    }
  },

  async saveCourses(courses: Course[]) {
    localStorage.setItem('academy_courses', JSON.stringify(courses));
    if (db) {
      try {
        const batch = writeBatch(db);
        courses.forEach(course => {
          const courseRef = doc(db, 'courses', course.id);
          batch.set(courseRef, cleanForFirestore(course));
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

    if (db) {
      try {
        const [gradesSnap, teachersSnap, coursesSnap] = await Promise.all([
          getDocs(collection(db, 'grades')),
          getDocs(collection(db, 'teachers')),
          getDocs(collection(db, 'courses'))
        ]);

        const remoteData = {
          grades: gradesSnap.docs.map((doc) => doc.data()) as GradeData[],
          teachers: teachersSnap.docs.map((doc) => doc.data()) as Teacher[],
          courses: coursesSnap.docs.map((doc) => doc.data()) as Course[],
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
