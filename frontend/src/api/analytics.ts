// HU21: Cliente API para panel de analíticas del profesor
import { api } from './client';

export interface AnalyticsData {
  courseId: string;
  title: string;
  status: 'published' | 'unpublished' | 'draft';
  enrolledCount: number;
  averageProgress: number;
  ratingAverage: number | null;
  ratingCount: number;
}

export async function getAnalytics(): Promise<AnalyticsData[]> {
  const { data } = await api.get<AnalyticsData[]>('/professor/analytics');
  return data;
}
