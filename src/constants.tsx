
import { Stage, Teacher, Course, GradeData, StageSubjects } from './types';

export const COLORS = {
  primary: '#0a192f',
  secondary: '#10b981',
  accent: '#f97316',
};

export const ACADEMY_CONFIG = {
  phone: '01011828609',
  googleSheet: 'https://docs.google.com/spreadsheets/d/1vVjXx-RvBcK45bfo-5LY5W0t2amk4rt_KN80he7wAE4/edit?usp=sharing',
};

export const STAGES: { id: Stage; name: string; icon: string }[] = [
  { id: 'primary', name: 'المرحلة الابتدائية', icon: '🧒' },
  { id: 'preparatory', name: 'المرحلة الإعدادية', icon: '👦' },
  { id: 'secondary', name: 'المرحلة الثانوية', icon: '🎓' },
  { id: 'languages', name: 'قسم اللغات', icon: '🌍' },
];

export const INITIAL_STAGE_SUBJECTS: StageSubjects[] = [
  { stage: 'primary', subjects: ['اللغة العربية', 'الرياضيات', 'اللغة الإنجليزية', 'العلوم', 'الدراسات الاجتماعية'] },
  { stage: 'preparatory', subjects: ['اللغة العربية', 'الرياضيات', 'اللغة الإنجليزية', 'العلوم', 'الدراسات الاجتماعية', 'جبر', 'هندسة'] },
  { stage: 'secondary', subjects: ['اللغة العربية', 'الفيزياء', 'الكيمياء', 'الأحياء', 'الرياضيات بحتة', 'رياضيات تطبيقية', 'اللغة الإنجليزية', 'اللغة الفرنسية', 'التاريخ', 'الجغرافيا'] },
  { stage: 'languages', subjects: ['English (Main)', 'Mathematics (Lang)', 'Science (Lang)', 'Arabic', 'Social Studies'] },
];

export const INITIAL_TEACHERS: Teacher[] = [
  { 
    id: 't1', 
    name: 'أ. محمد أحمد', 
    subject: 'اللغة العربية', 
    imageUrl: 'https://picsum.photos/seed/t1/400', 
    whatsapp: '01011828609',
    availability: 'السبت، الإثنين، الأربعاء',
    teachingHours: '4:00 - 8:00 مساءً',
    bio: 'خبير في تدريس اللغة العربية للمرحلة الابتدائية والإعدادية.',
    grades: ['الرابع الابتدائي', 'الخامس الابتدائي'],
    stages: ['primary']
  }
];

export const INITIAL_COURSES: Course[] = [
  { 
    id: 'c1', 
    title: 'دورة تأسيس النحو', 
    description: 'تأسيس شامل في قواعد النحو من الصفر للمرحلة الابتدائية.', 
    stage: 'primary', 
    grade: 'الرابع الابتدائي', 
    gradeId: 'p4',
    teacherId: 't1',
    media: [
      { id: 'm1', title: 'مقدمة الكورس', url: 'https://www.w3schools.com/html/mov_bbb.mp4', type: 'video' },
      { id: 'm2', title: 'ملزمة النحو الأساسية', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', type: 'pdf' }
    ]
  },
];

const createEmptySchedule = () => [
  { day: 'السبت', slots: [] },
  { day: 'الأحد', slots: [] },
  { day: 'الاثنين', slots: [] },
  { day: 'الثلاثاء', slots: [] },
  { day: 'الأربعاء', slots: [] },
  { day: 'الخميس', slots: [] },
  { day: 'الجمعة', slots: [] },
];

export const INITIAL_GRADES: GradeData[] = [
  { id: 'p1', name: 'الصف الأول الابتدائي', stage: 'primary', schedule: createEmptySchedule(), teachers: [], courses: [] },
  { id: 'p2', name: 'الصف الثاني الابتدائي', stage: 'primary', schedule: createEmptySchedule(), teachers: [], courses: [] },
  { id: 'p3', name: 'الصف الثالث الابتدائي', stage: 'primary', schedule: createEmptySchedule(), teachers: [], courses: [] },
  { id: 'p4', name: 'الصف الرابع الابتدائي', stage: 'primary', schedule: createEmptySchedule(), teachers: ['t1'], courses: ['c1'] },
  { id: 'p5', name: 'الصف الخامس الابتدائي', stage: 'primary', schedule: createEmptySchedule(), teachers: ['t1'], courses: [] },
  { id: 'p6', name: 'الصف السادس الابتدائي', stage: 'primary', schedule: createEmptySchedule(), teachers: [], courses: [] },
  { id: 'pr1', name: 'الصف الأول الإعدادي', stage: 'preparatory', schedule: createEmptySchedule(), teachers: [], courses: [] },
  { id: 'pr2', name: 'الصف الثاني الإعدادي', stage: 'preparatory', schedule: createEmptySchedule(), teachers: [], courses: [] },
  { id: 'pr3', name: 'الصف الثالث الإعدادي', stage: 'preparatory', schedule: createEmptySchedule(), teachers: [], courses: [] },
  { id: 's1', name: 'الصف الأول الثانوي', stage: 'secondary', schedule: createEmptySchedule(), teachers: [], courses: [] },
  { id: 's2', name: 'الصف الثاني الثانوي', stage: 'secondary', schedule: createEmptySchedule(), teachers: [], courses: [] },
  { id: 's3', name: 'الصف الثالث الثانوي', stage: 'secondary', schedule: createEmptySchedule(), teachers: [], courses: [] },
  { id: 'l1', name: 'Primary 1 (Languages)', stage: 'languages', schedule: createEmptySchedule(), teachers: [], courses: [] },
  { id: 'l2', name: 'Primary 2 (Languages)', stage: 'languages', schedule: createEmptySchedule(), teachers: [], courses: [] },
  { id: 'l3', name: 'Prep 1 (Languages)', stage: 'languages', schedule: createEmptySchedule(), teachers: [], courses: [] },
  { id: 'l4', name: 'Secondary 1 (Languages)', stage: 'languages', schedule: createEmptySchedule(), teachers: [], courses: [] },
];
