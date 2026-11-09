import { api } from './client';

export interface ContentNotification {
  id: string;
  courseId: string;
  topicId: string | null;
  courseName: string;
  topicTitle: string;
  category?: string;
  technology?: string | null;
  event: 'NEW_CONTENT' | 'UPDATED_CONTENT';
  createdAt: string;
  readAt: string | null;
}

// HU24: Notificación de recomendación de curso
export interface CourseRecommendation {
  id: string;
  courseId: string;
  topicId: null;
  courseName: string;
  topicTitle: null;
  category: string;
  technology: string | null;
  event: 'COURSE_RECOMMENDED';
  createdAt: string;
  readAt: string | null;
}

export type Notification = ContentNotification | CourseRecommendation;

export async function getNotifications() {
  const { data } = await api.get<Notification[]>('/notifications');
  return data;
}

export async function markNotificationRead(id: string) {
  const { data } = await api.patch<Notification>(`/notifications/${id}/read`);
  return data;
}