import { api } from './client';

export interface CourseProgress {
  viewed: number;
  total: number;
  percentage: number;
  viewedTopicIds: string[];
}

export async function getCourseProgress(courseId: string) {
  const { data } = await api.get<CourseProgress>(`/courses/${courseId}/progress`);
  return data;
}

export async function setTopicViewed(courseId: string, topicId: string, viewed: boolean) {
  const url = `/courses/${courseId}/topics/${topicId}/viewed`;
  const { data } = viewed
    ? await api.put<CourseProgress>(url)
    : await api.delete<CourseProgress>(url);
  return data;
}