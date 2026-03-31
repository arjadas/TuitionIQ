export interface Student {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  enrollmentDate: Date;
}

export interface CreateStudentDto {
  firstName: string;
  lastName: string;
  email: string;
}

export interface UpdateStudentDto {
  firstName: string;
  lastName: string;
  email: string;
  enrollmentDate?: Date;
}