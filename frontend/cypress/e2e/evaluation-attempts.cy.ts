describe('HU11, HU12 - Evaluaciones y límite de 2 intentos', () => {
  it('CA: el Profesor crea una evaluación de opción múltiple', () => {
    cy.seedFullScenario().then(({ professor, courseId }) => {
      cy.apiLogin(professor.email, professor.password);
      cy.visit(`/profesor/cursos/${courseId}`);

      cy.get('[aria-label="Editar Evaluaciones"]').click();
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
    cy.env(['apiUrl']).then(({ apiUrl }) => {
    cy.seedFullScenario().then(({ professor, student, courseId }) => {

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

  it('CA: Ver, Cancelar y Guardar; solo las evaluaciones sin nota muestran los cambios', () => {
    cy.env(['apiUrl']).then(({ apiUrl }) => {
      cy.seedFullScenario().then(({ professor, student, courseId }) => {
        const evaluationIds: string[] = [];
        let wrongOptionId = '';
        cy.apiLogin(professor.email, professor.password).then(({ token }) => {
          for (const title of ['Pendiente de rendir', 'Con nota']) {
            cy.request({
              method: 'POST', url: `${apiUrl}/courses/${courseId}/evaluations`,
              headers: { Authorization: `Bearer ${token}` },
              body: {
                title, minScore: 100,
                questions: [{ text: 'Pregunta original', options: [
                  { text: 'Respuesta original', isCorrect: true },
                  { text: 'Respuesta incorrecta', isCorrect: false },
                ] }],
              },
            }).then(({ body }) => {
              evaluationIds.push(body.id);
              wrongOptionId = body.questions[0].options.find((option: any) => !option.isCorrect).id;
            });
          }
        });

        cy.apiLogin(student.email, student.password).then(({ token }) => {
          const headers = { Authorization: `Bearer ${token}` };
          cy.request({ method: 'POST', url: `${apiUrl}/courses/${courseId}/enroll`, headers });
          cy.request({ method: 'GET', url: `${apiUrl}/evaluations/${evaluationIds[1]}/take`, headers })
            .then(({ body }) => {
              cy.request({
                method: 'POST', url: `${apiUrl}/evaluations/${evaluationIds[1]}/submit`, headers,
                body: { answers: [{ questionId: body.questions[0].id, selectedOptionId: wrongOptionId }] },
              }).then(({ body: result }) => {
                expect(result.score).to.equal(0);
                expect(result.attempt).not.to.have.property('evaluationSnapshot');
              });
              cy.request({
                method: 'PATCH', url: `${apiUrl}/evaluations/${evaluationIds[1]}/questions/${body.questions[0].id}`,
                headers, body: { text: 'Cambio no autorizado' }, failOnStatusCode: false,
              }).its('status').should('eq', 403);
            });
        });

        cy.apiLogin(professor.email, professor.password);
        cy.visit(`/profesor/cursos/${courseId}`);
        for (const title of ['Pendiente de rendir', 'Con nota']) {
          cy.get(`[aria-label="Ver ${title}"]`).click().should('have.attr', 'aria-expanded', 'true');
          cy.contains('Pregunta original').should('be.visible');
          cy.get('[aria-label="Editar pregunta 1"]').click();
          cy.get('textarea[aria-label="Pregunta 1"]').clear().type('Descartar pregunta');
          cy.contains('button', 'Cancelar').click();
          cy.contains('Pregunta original').should('be.visible');
          cy.contains('Descartar pregunta').should('not.exist');
          cy.get('[aria-label="Editar respuesta 1 de pregunta 1"]').click();
          cy.get('textarea').clear().type('Descartar respuesta');
          cy.contains('button', 'Cancelar').click();
          cy.contains('Respuesta original').should('be.visible');
          cy.contains('Descartar respuesta').should('not.exist');

          cy.get('[aria-label="Editar pregunta 1"]').click();
          cy.get('textarea').clear();
          cy.contains('button', 'Guardar').should('be.disabled');
          cy.get('textarea').type('Pregunta editada');
          cy.contains('button', 'Guardar').click();
          cy.contains('Pregunta editada').should('be.visible');
          cy.get('[aria-label="Editar respuesta 1 de pregunta 1"]').click();
          cy.get('textarea').clear().type('Respuesta editada');
          cy.contains('button', 'Guardar').click();
          cy.contains('Respuesta editada').should('be.visible');
          cy.reload();
          cy.get(`[aria-label="Ver ${title}"]`).click();
          cy.contains('Pregunta editada').should('be.visible');
          cy.contains('Respuesta editada').should('be.visible');
        }

        cy.viewport(390, 844);
        cy.get('[aria-label="Editar respuesta 1 de pregunta 1"]').click();
        cy.get('textarea').should('be.visible');
        cy.contains('button', 'Guardar').should('be.visible');
        cy.contains('button', 'Cancelar').click();
        cy.document().then((document) => {
          expect(document.documentElement.scrollWidth).to.be.at.most(390);
        });

        cy.apiLogin(student.email, student.password);
        cy.then(() => cy.visit(`/evaluaciones/${evaluationIds[0]}`));
        cy.contains('Pregunta editada').should('be.visible');
        cy.contains('Respuesta editada').should('be.visible');
        cy.then(() => cy.visit(`/evaluaciones/${evaluationIds[1]}`));
        cy.contains('Intento 2 de 2').should('be.visible');
        cy.contains('Pregunta original').should('be.visible');
        cy.contains('Respuesta original').should('be.visible');
        cy.contains('Pregunta editada').should('not.exist');
        cy.contains('Respuesta editada').should('not.exist');
      });
    });
  });
});
