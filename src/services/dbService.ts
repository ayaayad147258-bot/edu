
import { GradeData, Teacher, Course } from '../types';

import { db, storage } from './firebase';
import { collection, doc, getDocs, writeBatch, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

/**
 * وظيفة مساعدة لضغط الصور قبل الرفع
 */
const compressImage = async (file: File): Promise<File> => {
  // Only compress images
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;

    img.onload = () => {
      URL.revokeObjectURL(url); // Clean up

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }

      // Max dimension 1200px
      const MAX_WIDTH = 1200;
      let width = img.width;
      let height = img.height;

      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        // Convert to standard JPEG with 0.8 quality
        const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        // If compressed is larger (rare), return original
        if (newFile.size > file.size) resolve(file);
        else resolve(newFile);
      }, 'image/jpeg', 0.8);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      console.warn("Image load failed for compression", err);
      resolve(file); // Fallback to original
    };
  });
};


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
  async uploadFile(file: File, path: string, onProgress?: (progress: number) => void): Promise<string> {
    if (!storage) {
      throw new Error("Firebase Storage is not initialized properly.");
    }

    // 1. Compress if image
    let fileToUpload = file;
    try {
      fileToUpload = await compressImage(file);
    } catch (err) {
      console.warn("Compression failed, using original file", err);
    }

    // 2. Prepare Upload
    const extension = fileToUpload.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${extension}`;
    const storageRef = ref(storage, `${path}/${fileName}`);

    // 3. Resumable Upload
    const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => {
          console.error("Upload failed:", error);
          reject(error);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        }
      );
    });
  },

  async saveGrades(grades: GradeData[]) {
    console.log('🔄 saveGrades called with', grades.length, 'grades');
    localStorage.setItem('academy_grades', JSON.stringify(grades));
    if (db) {
      try {
        console.log('📤 Saving grades to Firebase...');
        const batch = writeBatch(db);
        grades.forEach(grade => {
          const gradeRef = doc(db, 'grades', grade.id);
          batch.set(gradeRef, cleanForFirestore(grade));
        });
        await batch.commit();
        console.log('✅ Grades saved successfully to Firebase');
      } catch (err) {
        console.error("❌ Firebase Save Grades Error:", err);
        console.error("Error details:", { code: (err as any).code, message: (err as any).message });
      }
    } else {
      console.warn('⚠️ Firebase DB is not initialized - grades only saved to localStorage');
    }
  },

  async saveTeachers(teachers: Teacher[]) {
    console.log('🔄 saveTeachers called with', teachers.length, 'teachers');
    localStorage.setItem('academy_teachers', JSON.stringify(teachers));
    if (db) {
      try {
        console.log('📤 Saving teachers to Firebase...');
        const batch = writeBatch(db);
        teachers.forEach(teacher => {
          const teacherRef = doc(db, 'teachers', teacher.id);
          batch.set(teacherRef, cleanForFirestore(teacher));
        });
        await batch.commit();
        console.log('✅ Teachers saved successfully to Firebase');
      } catch (err) {
        console.error("❌ Firebase Save Teachers Error:", err);
        console.error("Error details:", { code: (err as any).code, message: (err as any).message });
      }
    } else {
      console.warn('⚠️ Firebase DB is not initialized - teachers only saved to localStorage');
    }
  },

  async saveCourses(courses: Course[]) {
    console.log('🔄 saveCourses called with', courses.length, 'courses');
    localStorage.setItem('academy_courses', JSON.stringify(courses));
    if (db) {
      try {
        console.log('📤 Saving courses to Firebase...');
        const batch = writeBatch(db);
        courses.forEach(course => {
          const courseRef = doc(db, 'courses', course.id);
          batch.set(courseRef, cleanForFirestore(course));
        });
        await batch.commit();
        console.log('✅ Courses saved successfully to Firebase');
      } catch (err) {
        console.error("❌ Firebase Save Courses Error:", err);
        console.error("Error details:", { code: (err as any).code, message: (err as any).message });
      }
    } else {
      console.warn('⚠️ Firebase DB is not initialized - courses only saved to localStorage');
    }
  },

  async deleteTeacher(id: string) {
    console.log('🗑️ deleteTeacher called for id:', id);
    if (!db) {
      console.warn('⚠️ Firebase DB is not initialized - cannot delete from Firebase');
      return;
    }
    try {
      console.log('📤 Deleting teacher from Firebase...');
      await deleteDoc(doc(db, 'teachers', id));
      console.log('✅ Teacher deleted successfully from Firebase');
    } catch (err) {
      console.error("❌ Firebase Delete Teacher Error:", err);
      console.error("Error details:", { code: (err as any).code, message: (err as any).message });
      throw err;
    }
  },

  async deleteCourse(id: string) {
    console.log('🗑️ deleteCourse called for id:', id);
    if (!db) {
      console.warn('⚠️ Firebase DB is not initialized - cannot delete from Firebase');
      return;
    }
    try {
      console.log('📤 Deleting course from Firebase...');
      await deleteDoc(doc(db, 'courses', id));
      console.log('✅ Course deleted successfully from Firebase');
    } catch (err) {
      console.error("❌ Firebase Delete Course Error:", err);
      console.error("Error details:", { code: (err as any).code, message: (err as any).message });
      throw err;
    }
  },

  async loadData() {
    console.log('📥 loadData called');
    const cached = {
      grades: JSON.parse(localStorage.getItem('academy_grades') || 'null'),
      teachers: JSON.parse(localStorage.getItem('academy_teachers') || 'null'),
      courses: JSON.parse(localStorage.getItem('academy_courses') || 'null'),
    };
    console.log('💾 Cached data:', {
      gradesCount: cached.grades?.length || 0,
      teachersCount: cached.teachers?.length || 0,
      coursesCount: cached.courses?.length || 0
    });

    if (db) {
      console.log('🔄 Firebase DB available, fetching remote data...');
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

        console.log('✅ Remote data fetched:', {
          gradesCount: remoteData.grades.length,
          teachersCount: remoteData.teachers.length,
          coursesCount: remoteData.courses.length
        });

        // Always update cache and return remote data, even if empty (to handle deletions)
        localStorage.setItem('academy_grades', JSON.stringify(remoteData.grades));
        localStorage.setItem('academy_teachers', JSON.stringify(remoteData.teachers));
        localStorage.setItem('academy_courses', JSON.stringify(remoteData.courses));
        console.log('💾 Cache updated with remote data');
        return remoteData;

      } catch (err) {
        console.error("❌ Firebase Load Error:", err);
        console.error("Error details:", { code: (err as any).code, message: (err as any).message });
        console.warn('⚠️ Falling back to cached data');
      }
    } else {
      console.warn('⚠️ Firebase DB is not initialized - using cached data only');
    }

    return cached;
  }
};
