// HU20: Reseñas de cursos
describe('HU20: Reseñas y Calificaciones', () => {
  const student = {
    email: 'student@test.com',
    password: 'testpass123',
    name: 'Test Student',
  };

  const courseData = {
    name: 'Course with Reviews',
    description: 'A course for testing reviews',
    category: 'Technology',
  };

  beforeEach(() => {
    cy.seedFullScenario();
    cy.apiLogin(student.email, student.password);
  });

  it('HU20 CA1: Alumno con 50% de avance puede reseñar', () => {
    // Crear un curso y alcanzar 50% de avance
    cy.visit('/my-courses');
    cy.contains('Test Course').click(); // Asumir que hay un curso en el seed

    // Marcar 1 tema como visto (50% si hay 2 temas)
    cy.contains('Ver tema').first().click();
    cy.contains('Tema completado').should('exist');

    // Ir a detalles del curso
    cy.visit('/course/course-1'); // Ajustar ID

    // Verificar que el formulario de reseña está habilitado
    cy.contains('Calificar este curso').should('not.be.disabled');

    // Calificar
    cy.get('[data-cy="rating-5"]').click();
    cy.get('[data-cy="comment"]').type('Excelente curso!');
    cy.get('[data-cy="submit-review"]').click();

    // Verificar que la reseña se guardó
    cy.contains('5★').should('exist');
    cy.contains('Excelente curso!').should('exist');
  });

  it('HU20 CA2: Alumno con < 50% ve control deshabilitado', () => {
    cy.visit('/course/course-1'); // Cursor sin interacción

    // Verificar que el formulario de reseña está deshabilitado
    cy.contains('No podés calificar').should('exist');
    cy.contains('Necesitás tener al menos 50% de avance').should('exist');
  });

  it('HU20 CA4: Alumno puede editar su reseña', () => {
    // Primero, crear una reseña
    cy.visit('/course/course-1');
    cy.get('[data-cy="rating-3"]').click();
    cy.get('[data-cy="comment"]').type('Buen curso');
    cy.get('[data-cy="submit-review"]').click();

    cy.contains('3★').should('exist');

    // Editar
    cy.contains('Editar mi reseña').click();
    cy.get('[data-cy="rating-5"]').click();
    cy.get('[data-cy="comment"]').clear().type('Excelente curso actualizado');
    cy.get('[data-cy="submit-review"]').click();

    // Verificar que se actualizó
    cy.contains('5★').should('exist');
    cy.contains('Excelente curso actualizado').should('exist');
  });

  it('HU20 CA4: Alumno puede eliminar su reseña', () => {
    // Crear una reseña
    cy.visit('/course/course-1');
    cy.get('[data-cy="rating-4"]').click();
    cy.get('[data-cy="submit-review"]').click();

    cy.contains('4★').should('exist');

    // Eliminar
    cy.contains('Editar mi reseña').click();
    cy.contains('Eliminar').click();
    cy.on('window:confirm', () => true);

    // Verificar que se eliminó
    cy.contains('4★').should('not.exist');
    cy.contains('Calificar este curso').should('exist');
  });

  it('HU20 CA6: Catálogo muestra promedio y cantidad de reseñas', () => {
    // Crear varias reseñas en un curso
    cy.visit('/course/course-1');
    cy.get('[data-cy="rating-5"]').click();
    cy.get('[data-cy="submit-review"]').click();

    // Ir al catálogo
    cy.visit('/catalog');

    // Verificar que se muestra promedio y cantidad
    cy.contains('5.0').should('exist'); // Promedio
    cy.contains('1 reseña').should('exist'); // Cantidad
  });

  it('HU20 CA7: Profesor no puede reseñar', () => {
    cy.apiLogin('professor@test.com', 'testpass123');
    cy.visit('/course/course-1');

    // Verificar que no hay formulario de reseña
    cy.contains('Calificar este curso').should('not.exist');
  });

  it('HU20 CA9: Usuario no ve reseñas de otra institución', () => {
    // Crear estudiante de otra institución
    cy.apiLogin('student-other-inst@test.com', 'testpass123');
    cy.visit('/course/course-1'); // Curso de otra institución

    // Verificar que no ve las reseñas
    cy.contains('Sin calificaciones').should('exist');
  });
});
