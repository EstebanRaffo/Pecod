import React, { useState, useEffect } from 'react';
import { getReviewsByCourse, createReview, updateReview, deleteReview } from '../api/reviews';
import { ReviewStatistics } from '../api/reviews';

interface CourseReviewSectionProps {
  courseId: string;
  isEnrolled: boolean;
  canReview: boolean;
  reviewReason?: string;
}

export const CourseReviewSection: React.FC<CourseReviewSectionProps> = ({
  courseId,
  isEnrolled,
  canReview,
  reviewReason,
}) => {
  const [reviews, setReviews] = useState<ReviewStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadReviews();
  }, [courseId]);

  const loadReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReviewsByCourse(courseId);
      setReviews(data);

      const ownReview = data.reviews.find((review) => review.isOwnReview);
      if (ownReview) {
        setRating(ownReview.rating);
        setComment(ownReview.comment || '');
        setIsEditing(true);
      } else {
        setIsEditing(false);
      }
    } catch (err) {
      setError('No se pudieron cargar las reseñas.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (rating < 1 || rating > 5) {
      setError('La calificación debe ser entre 1 y 5 estrellas.');
      return;
    }

    if (comment && comment.length > 1000) {
      setError('El comentario no debe exceder 1000 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing) {
        await updateReview(courseId, rating, comment);
      } else {
        await createReview(courseId, rating, comment);
      }
      setIsFormOpen(false);
      setComment('');
      await loadReviews();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al guardar la reseña.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!window.confirm('¿Estás seguro de que querés eliminar tu reseña?')) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await deleteReview(courseId);
      setIsFormOpen(false);
      setComment('');
      setRating(5);
      setIsEditing(false);
      await loadReviews();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al eliminar la reseña.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando reseñas...</div>;
  }

  return (
    <div className="mt-8 border-t pt-6">
      <h3 className="text-lg font-semibold mb-4">Reseñas y Calificaciones</h3>

      {/* Resumen de calificación */}
      <div className="flex items-center gap-4 mb-6">
        {reviews?.ratingCount === 0 ? (
          <p className="text-gray-500">Sin calificaciones</p>
        ) : (
          <>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-500">{reviews?.ratingAverage?.toFixed(1)}</div>
              <div className="text-sm text-gray-600">{reviews?.ratingCount} reseña{reviews?.ratingCount === 1 ? '' : 's'}</div>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={`text-xl ${i < Math.round(reviews?.ratingAverage || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                >
                  ★
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Formulario de reseña */}
      {isEnrolled && (
        <div className="mb-8 p-4 bg-gray-50 rounded">
          {canReview ? (
            <>
              {!isFormOpen ? (
                <button
                  onClick={() => setIsFormOpen(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  {isEditing ? 'Editar mi reseña' : 'Calificar este curso'}
                </button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Calificación (1-5 estrellas)</label>
                    <div className="flex gap-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setRating(i + 1)}
                          className={`text-2xl transition ${
                            i < rating ? 'text-yellow-400' : 'text-gray-300'
                          } hover:text-yellow-400`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Comentario (opcional) - {comment.length}/1000
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value.slice(0, 1000))}
                      placeholder="¿Qué te pareció el curso?"
                      className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                    />
                  </div>

                  {error && <p className="text-red-600 text-sm">{error}</p>}

                  <div className="flex gap-2">
                    <button
                      onClick={handleSubmitReview}
                      disabled={isSubmitting}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {isSubmitting ? 'Guardando...' : isEditing ? 'Actualizar' : 'Enviar'}
                    </button>

                    {isEditing && (
                      <button
                        onClick={handleDeleteReview}
                        disabled={isSubmitting}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-400"
                      >
                        {isSubmitting ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsFormOpen(false);
                        if (!isEditing) {
                          setComment('');
                          setRating(5);
                        }
                      }}
                      className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-gray-700 text-sm">
                <strong>No podés calificar:</strong> {reviewReason}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Listado de reseñas */}
      {reviews && reviews.reviews.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-semibold">Todas las reseñas</h4>
          {reviews.reviews.map((review) => (
            <div key={review.id} className="border border-gray-200 rounded p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium">{review.studentName}</p>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={`text-sm ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(review.createdAt).toLocaleDateString('es-ES')}
                </p>
              </div>
              {review.comment && <p className="text-gray-700 text-sm">{review.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
