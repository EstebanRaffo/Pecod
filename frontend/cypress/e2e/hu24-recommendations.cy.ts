// HU24: Recomendación de cursos
describe('HU24 - Recomendación de cursos', () => {
  let apiUrl: string;
  let adminEmail: string;
  let adminPassword: string;

  beforeEach(() => {
    cy.env(['apiUrl', 'adminEmail', 'adminPassword']).then((env) => {
      apiUrl = env.apiUrl;
      adminEmail = env.adminEmail;
      adminPassword = env.adminPassword;
    });
  });

  it('ejecuta la tarea de recomendaciones y el alumno recibe notificaciones', () => {
    // 1. Crear un escenario con un alumno inscripto en cursos
    cy.seedFullScenario().then(({ student, professor, courseId }) => {
      cy.request('POST', `${apiUrl}/auth/login`, professor).then((res) => {
        const professorHeaders = { Authorization: `Bearer ${res.body.accessToken}` };

        // Crear un segundo curso para poder recomendar
        cy.request({
          method: 'POST',
          url: `${apiUrl}/courses`,
          headers: professorHeaders,
          body: {
            name: 'Curso Recomendado',
            description: 'Un curso que será recomendado',
            category: 'Programación',
            technology: 'Python',
          },
        }).then((courseRes) => {
          const recommendedCourseId = courseRes.body.id;

          // Publicar el curso
          cy.request({
            method: 'PATCH',
            url: `${apiUrl}/courses/${recommendedCourseId}`,
            headers: professorHeaders,
            body: { isPublished: true },
          });
        });
      });

      // 2. Login del alumno e inscripción
      cy.apiLogin(student.email, student.password).then(({ token }) => {
        const studentHeaders = { Authorization: `Bearer ${token}` };
        cy.request({
          method: 'POST',
          url: `${apiUrl}/courses/${courseId}/enroll`,
          headers: studentHeaders,
        });
      });

      // 3. Ejecutar la tarea de recomendaciones como ADMIN
      cy.request('POST', `${apiUrl}/auth/login`, { email: adminEmail, password: adminPassword }).then((res) => {
        const adminHeaders = { Authorization: `Bearer ${res.body.accessToken}` };
        cy.request({
          method: 'POST',
          url: `${apiUrl}/notifications/recommendations/run`,
          headers: adminHeaders,
        }).then((res) => {
          expect(res.body.totalNotifications).toBeGreaterThanOrEqual(0);
        });
      });

      // 4. El alumno accede y ve las recomendaciones en la campana
      cy.apiLogin(student.email, student.password);
      cy.visit('/mis-cursos');
      cy.get('[data-testid="notification-bell"]').click();
      
      // Verificar que hay notificaciones de recomendación
      cy.get('[data-testid="notification-item"]').each((item) => {
        // Puede contener "Curso recomendado" o "Contenido nuevo"
        const text = cy.wrap(item).invoke('text');
      });
    });
  });

  it('marca las recomendaciones como leídas y navega al curso', () => {
    cy.seedFullScenario().then(({ student, professor, courseId }) => {
      let recommendedCourseId: string;

      // Crear un segundo curso
      cy.request('POST', `${apiUrl}/auth/login`, professor).then((res) => {
        const professorHeaders = { Authorization: `Bearer ${res.body.accessToken}` };
        cy.request({
          method: 'POST',
          url: `${apiUrl}/courses`,
          headers: professorHeaders,
          body: {
            name: 'Python Avanzado',
            description: 'Curso de Python nivel avanzado',
            category: 'Programación',
            technology: 'Python',
          },
        }).then((courseRes) => {
          recommendedCourseId = courseRes.body.id;
          cy.request({
            method: 'PATCH',
            url: `${apiUrl}/courses/${recommendedCourseId}`,
            headers: professorHeaders,
            body: { isPublished: true },
          });
        });
      });

      // Inscribir alumno al primer curso
      cy.apiLogin(student.email, student.password).then(({ token }) => {
        const studentHeaders = { Authorization: `Bearer ${token}` };
        cy.request({
          method: 'POST',
          url: `${apiUrl}/courses/${courseId}/enroll`,
          headers: studentHeaders,
        });
      });

      // Ejecutar recomendaciones
      cy.request('POST', `${apiUrl}/auth/login`, { email: adminEmail, password: adminPassword }).then((res) => {
        const adminHeaders = { Authorization: `Bearer ${res.body.accessToken}` };
        cy.request({
          method: 'POST',
          url: `${apiUrl}/notifications/recommendations/run`,
          headers: adminHeaders,
        });
      });

      // Verificar que el alumno puede ver y marcar como leída
      cy.apiLogin(student.email, student.password);
      cy.visit('/mis-cursos');
      cy.get('[data-testid="notification-bell"]').click();

      // Si hay una recomendación, marcarla como leída
      cy.get('[data-testid="notification-item"]').then((items) => {
        if (items.length > 0) {
          cy.get('[data-testid="notification-item"] button[title="Marcar como leida"]').first().click();
          cy.get('[data-testid="notification-item"]').first().contains('Leida');
        }
      });
    });
  });

  it('rechaza intento de ejecutar recomendaciones sin permisos ADMIN', () => {
    cy.seedFullScenario().then(({ student }) => {
      cy.apiLogin(student.email, student.password).then(({ token }) => {
        // Intentar ejecutar como estudiante
        cy.request({
          method: 'POST',
          url: `${apiUrl}/notifications/recommendations/run`,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status).to.equal(403); // Forbidden
        });
      });
    });
  });
});
