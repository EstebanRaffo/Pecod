// HU21: DTO de respuesta del panel de analíticas
export class AnalyticsResponseDto {
  courseId: string;
  title: string;
  status: 'published' | 'unpublished' | 'draft';
  enrolledCount: number;
  averageProgress: number; // porcentaje 0-100
  ratingAverage: number | null; // 1 decimal o null si no hay reseñas
  ratingCount: number;
}
