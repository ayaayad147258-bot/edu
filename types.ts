
export type Stage = 'primary' | 'preparatory' | 'secondary' | 'languages';

export interface ScheduleSlot {
  id: string;
  subject: string;
  time: string;
  color: string;
  icon?: string;
  teacherId?: string;
}

export interface DaySchedule {
  day: string;
  slots: ScheduleSlot[];
}

export interface Teacher {
  id: string;
  name: string;
  subject: string;
  imageUrl: string;
  whatsapp?: string;
  availability?: string;
  teachingHours?: string;
  bio?: string;
  grades?: string[];
  stages?: Stage[];
  hourlyRates?: Record<string, number>;
}

export interface CourseMedia {
  id: string;
  title: string;
  url: string;
  type: 'video' | 'pdf' | 'image';
}

export interface Course {
  id: string;
  title: string;
  description: string;
  stage: Stage;
  grade: string;
  gradeId: string; // Linking to specific GradeData.id
  price?: string;
  teacherId?: string;
  thumbnailUrl?: string;
  media: CourseMedia[];
}

export interface GradeData {
  id: string;
  name: string;
  stage: Stage;
  schedule: DaySchedule[];
  teachers: string[];
  courses: string[];
}

export interface StageSubjects {
  stage: Stage;
  subjects: string[];
}
