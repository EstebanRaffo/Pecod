import { api } from './client';

export interface CourseReview {
  id: string;
  courseId: string;
  studentId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewStatistics {
  ratingAverage: number | null;
  ratingCount: number;
  reviews: Array<{
    id: string;
    rating: number;
    comment?: string;
    studentName: string;
    isOwnReview: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
}

export async function createReview(courseId: string, rating: number, comment?: string): Promise<CourseReview> {
  const { data } = await api.post<CourseReview>(`/courses/${courseId}/reviews`, {
    rating,
    comment: comment || undefined,
  });
  return data;
}

export async function updateReview(courseId: string, rating: number, comment?: string): Promise<CourseReview> {
  const { data } = await api.patch<CourseReview>(`/courses/${courseId}/reviews/me`, {
    rating,
    comment: comment || undefined,
  });
  return data;
}

export async function deleteReview(courseId: string): Promise<void> {
  await api.delete(`/courses/${courseId}/reviews/me`);
}

export async function getReviewsByCourse(courseId: string): Promise<ReviewStatistics> {
  const { data } = await api.get<ReviewStatistics>(`/courses/${courseId}/reviews`);
  return data;
}
