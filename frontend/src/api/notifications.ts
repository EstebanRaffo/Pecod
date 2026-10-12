import { api } from './client';

export interface ContentNotification {
  id: string;
  courseId: string;
  topicId: string | null;
  courseName: string;
  topicTitle: string;
  event: 'NEW_CONTENT' | 'UPDATED_CONTENT';
  createdAt: string;
  readAt: string | null;
}

export async function getNotifications() {
  const { data } = await api.get<ContentNotification[]>('/notifications');
  return data;
}

export async function markNotificationRead(id: string) {
  const { data } = await api.patch<ContentNotification>(`/notifications/${id}/read`);
  return data;
}