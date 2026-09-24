describe('HU11, HU12 - Evaluaciones y límite de 2 intentos', () => {
  it('CA: el Profesor crea una evaluación de opción múltiple', () => {
    cy.seedFullScenario().then(({ professor, courseId }) => {
      cy.apiLogin(professor.email, professor.password);
      cy.visit(`/profesor/cursos/${courseId}`);

      cy.contains('+ Crear evaluación').click();
      cy.get('input[placeholder="Título de la evaluación"]').type('Parcial Cypress');
      cy.get('input[placeholder="Pregunta 1"]').type('¿2 + 2?');
      cy.get('input[placeholder="Opción 1"]').type('4');
      cy.get('input[placeholder="Opción 2"]').type('5');
      // Marca la opción 1 ("4") como correcta
      cy.get('input[type="radio"]').first().check({ force: true });
      cy.contains('button', 'Guardar evaluación').click();

      cy.contains('Parcial Cypress').should('be.visible');
    });
  });

  it('CA: hasta 2 intentos; si desaprueba ambos, no se permite un tercero', () => {
    cy.seedFullScenario().then(({ professor, student, courseId }) => {
      const apiUrl = Cypress.env('apiUrl');

      // Crea la evaluación vía API (más rápido y estable que UI para el setup del test)
      cy.apiLogin(professor.email, professor.password).then(({ token }) => {
        cy.request({
          method: 'POST',
          url: `${apiUrl}/courses/${courseId}/evaluations`,
          headers: { Authorization: `Bearer ${token}` },
          body: {
            title: 'Evaluación límite de intentos',
            minScore: 100, // exige el 100% para forzar 2 intentos desaprobados
            questions: [
              {
                text: '¿Cuántos intentos permite V1?',
                options: [
                  { text: '2', isCorrect: true },
                  { text: '5', isCorrect: false },
                ],
              },
            ],
          },
        }).then((evalRes) => {
          const evaluationId = evalRes.body.id;
          const wrongOptionId = evalRes.body.questions[0].options.find((o: any) => !o.isCorrect).id;

          cy.apiLogin(student.email, student.password).then(({ token }) => {
            cy.request({
              method: 'POST',
              url: `${apiUrl}/courses/${courseId}/enroll`,
              headers: { Authorization: `Bearer ${token}` },
            });

            cy.visit(`/evaluaciones/${evaluationId}`);
            cy.get(`input[value="${wrongOptionId}"]`).check({ force: true });
            cy.contains('button', 'Enviar evaluación').click();
            cy.contains('Desaprobado').should('be.visible');

            // Segundo intento: recarga la página del examen y vuelve a fallar a propósito.
            cy.visit(`/evaluaciones/${evaluationId}`);
            cy.contains('Intento 2 de 2').should('be.visible');
            cy.get(`input[value="${wrongOptionId}"]`).check({ force: true });
            cy.contains('button', 'Enviar evaluación').click();
            cy.contains('Desaprobado').should('be.visible');

            // Tercer intento: la propia página no debería dejar cargar el examen.
            cy.visit(`/evaluaciones/${evaluationId}`);
            cy.contains('Alcanzaste el límite de 2 intentos').should('be.visible');
          });
        });
      });
    });
  });
});
