import { Teacher, Course, GradeData } from '../types';

/**
 * App Context for Voice Functions
 * Contains all state and actions needed by voice commands
 */
export interface AppContext {
    // Current State
    grades: GradeData[];
    teachers: Teacher[];
    courses: Course[];
    currentView: string;

    // State Setters
    setGrades: (grades: GradeData[]) => void;
    setTeachers: (teachers: Teacher[]) => void;
    setCourses: (courses: Course[]) => void;

    // Navigation
    navigate: (view: 'home' | 'stages' | 'grade' | 'admin' | 'teachers') => void;

    // Helper Functions
    findTeacher: (query: string) => Teacher | null;
    findCourse: (query: string) => Course | null;
    findGrade: (query: string) => GradeData | null;
}

/**
 * Voice Functions - Execute operations based on AI function calls
 */

// ============ NAVIGATION ============
export async function navigate(
    params: { view: string },
    context: AppContext
): Promise<{ success: boolean; message: string }> {
    try {
        context.navigate(params.view as any);

        const viewNames: Record<string, string> = {
            home: 'الصفحة الرئيسية',
            stages: 'صفحة الجدول',
            admin: 'لوحة التحكم',
            teachers: 'قائمة المدرسين',
            grade: 'صفحة الصف',
        };

        return {
            success: true,
            message: `تم الانتقال إلى ${viewNames[params.view] || params.view}`,
        };
    } catch (error) {
        return {
            success: false,
            message: 'حدث خطأ أثناء التنقل',
        };
    }
}

// ============ TEACHER MANAGEMENT ============
export async function addTeacher(
    params: {
        name: string;
        subject: string;
        whatsapp?: string;
        availability?: string;
        teachingHours?: string;
        bio?: string;
        grades?: string[];
        stages?: string[];
    },
    context: AppContext
): Promise<{ success: boolean; message: string; data?: Teacher }> {
    try {
        // Validation
        if (!params.name || !params.subject) {
            return {
                success: false,
                message: 'محتاج على الأقل الاسم والمادة',
            };
        }

        // Generate ID
        const id = `t-${Date.now()}`;

        // Create teacher object with defaults
        const newTeacher: Teacher = {
            id,
            name: params.name,
            subject: params.subject,
            whatsapp: params.whatsapp || '',
            availability: params.availability || '',
            teachingHours: params.teachingHours || '',
            bio: params.bio || `مدرس ${params.subject}`,
            imageUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(params.name)}&background=random`,
            grades: params.grades || [],
            stages: params.stages || ['primary'],
        };

        // Add to context
        context.setTeachers([...context.teachers, newTeacher]);

        return {
            success: true,
            message: `تم إضافة الأستاذ ${params.name} بنجاح!`,
            data: newTeacher,
        };
    } catch (error) {
        console.error('Add Teacher Error:', error);
        return {
            success: false,
            message: 'حدث خطأ أثناء إضافة المدرس',
        };
    }
}

export async function searchTeachers(
    params: {
        query?: string;
        subject?: string;
        stage?: string;
    },
    context: AppContext
): Promise<{ success: boolean; message: string; data?: Teacher[] }> {
    try {
        let results = context.teachers;

        // Filter by query
        if (params.query) {
            const q = params.query.toLowerCase();
            results = results.filter(
                t => t.name.toLowerCase().includes(q) ||
                    t.subject.toLowerCase().includes(q)
            );
        }

        // Filter by subject
        if (params.subject) {
            results = results.filter(
                t => t.subject.toLowerCase().includes(params.subject!.toLowerCase())
            );
        }

        // Filter by stage
        if (params.stage) {
            results = results.filter(t => t.stages?.includes(params.stage!));
        }

        if (results.length === 0) {
            return {
                success: true,
                message: 'مفيش نتائج للبحث ده',
                data: [],
            };
        }

        const names = results.map(t => t.name).join('، ');
        return {
            success: true,
            message: `لقيت ${results.length} مدرس: ${names}`,
            data: results,
        };
    } catch (error) {
        return {
            success: false,
            message: 'حدث خطأ أثناء البحث',
        };
    }
}

// ============ COURSE MANAGEMENT ============
export async function addCourse(
    params: {
        title: string;
        description?: string;
        stage: string;
        grade: string;
        teacherName?: string;
    },
    context: AppContext
): Promise<{ success: boolean; message: string; data?: Course }> {
    try {
        // Validation
        if (!params.title || !params.stage || !params.grade) {
            return {
                success: false,
                message: 'محتاج على الأقل العنوان والمرحلة والصف',
            };
        }

        // Find teacher by name if provided
        let teacherId = '';
        if (params.teacherName) {
            const teacher = context.findTeacher(params.teacherName);
            if (teacher) {
                teacherId = teacher.id;
            }
        }

        // Find grade
        const grade = context.findGrade(params.grade);
        if (!grade) {
            return {
                success: false,
                message: `مفيش صف اسمه ${params.grade}`,
            };
        }

        // Generate ID
        const id = `c-${Date.now()}`;

        // Create course
        const newCourse: Course = {
            id,
            title: params.title,
            description: params.description || '',
            stage: params.stage as any,
            grade: params.grade,
            gradeId: grade.id,
            teacherId,
            media: [],
        };

        // Add to context
        context.setCourses([...context.courses, newCourse]);

        return {
            success: true,
            message: `تم إضافة كورس "${params.title}" بنجاح!`,
            data: newCourse,
        };
    } catch (error) {
        console.error('Add Course Error:', error);
        return {
            success: false,
            message: 'حدث خطأ أثناء إضافة الكورس',
        };
    }
}

// ============ SCHEDULE MANAGEMENT ============
export async function updateSchedule(
    params: {
        gradeName: string;
        day: string;
        period: number;
        subject?: string;
        teacherName?: string;
        remove?: boolean;
    },
    context: AppContext
): Promise<{ success: boolean; message: string }> {
    try {
        // Find grade
        const grade = context.findGrade(params.gradeName);
        if (!grade) {
            return {
                success: false,
                message: `مفيش صف اسمه "${params.gradeName}"`,
            };
        }

        // Validate day
        const dayIndex = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'].indexOf(params.day);
        if (dayIndex === -1) {
            return {
                success: false,
                message: 'اليوم غير صحيح',
            };
        }

        // Validate period
        if (params.period < 1 || params.period > 8) {
            return {
                success: false,
                message: 'رقم الحصة غير صحيح (من 1 لـ 8)',
            };
        }

        // Clone grades
        const updatedGrades = context.grades.map(g => {
            if (g.id !== grade.id) return g;

            // Clone schedule
            const newSchedule = [...g.schedule];

            // Find or create day
            let daySchedule = newSchedule.find(d => d.day === params.day);
            if (!daySchedule) {
                daySchedule = { day: params.day, periods: Array(8).fill(null) };
                newSchedule.push(daySchedule);
            }

            // Update period
            if (params.remove) {
                daySchedule.periods[params.period - 1] = null;
            } else {
                daySchedule.periods[params.period - 1] = params.subject || 'مادة جديدة';
            }

            return { ...g, schedule: newSchedule };
        });

        context.setGrades(updatedGrades);

        if (params.remove) {
            return {
                success: true,
                message: `تم حذف الحصة من يوم ${params.day}`,
            };
        }

        return {
            success: true,
            message: `تم ${params.subject ? 'إضافة' : 'تحديث'} حصة ${params.subject || ''} يوم ${params.day} الحصة ${params.period}`,
        };
    } catch (error) {
        console.error('Update Schedule Error:', error);
        return {
            success: false,
            message: 'حدث خطأ أثناء تحديث الجدول',
        };
    }
}

// ============ STATISTICS ============
export async function getStatistics(
    params: { metric: string },
    context: AppContext
): Promise<{ success: boolean; message: string; data?: any }> {
    try {
        const stats = {
            teachers: context.teachers.length,
            courses: context.courses.length,
            grades: context.grades.length,
        };

        if (params.metric === 'all') {
            return {
                success: true,
                message: `عندك ${stats.teachers} مدرس، ${stats.courses} كورس، ${stats.grades} صف دراسي`,
                data: stats,
            };
        }

        if (params.metric === 'teachers') {
            return {
                success: true,
                message: `عندك ${stats.teachers} مدرس`,
                data: { count: stats.teachers },
            };
        }

        if (params.metric === 'courses') {
            return {
                success: true,
                message: `عندك ${stats.courses} كورس`,
                data: { count: stats.courses },
            };
        }

        if (params.metric === 'grades') {
            return {
                success: true,
                message: `عندك ${stats.grades} صف دراسي`,
                data: { count: stats.grades },
            };
        }

        return {
            success: false,
            message: 'نوع الإحصائية غير معروف',
        };
    } catch (error) {
        return {
            success: false,
            message: 'حدث خطأ أثناء جلب الإحصائيات',
        };
    }
}

/**
 * Execute function call from AI
 */
export async function executeFunctionCall(
    functionCall: any,
    context: AppContext
): Promise<{ success: boolean; message: string; data?: any }> {
    const { name, args } = functionCall;

    console.log(`🔧 Executing function: ${name}`, args);

    switch (name) {
        case 'navigate':
            return navigate(args, context);

        case 'addTeacher':
            return addTeacher(args, context);

        case 'searchTeachers':
            return searchTeachers(args, context);

        case 'addCourse':
            return addCourse(args, context);

        case 'updateSchedule':
            return updateSchedule(args, context);

        case 'getStatistics':
            return getStatistics(args, context);

        default:
            return {
                success: false,
                message: `الوظيفة "${name}" غير معروفة`,
            };
    }
}
