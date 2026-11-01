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

  // HU19: Intentos configurables
  describe('HU19 - Intentos configurables', () => {
    it('HU19 CA1: Profesor crea evaluación con maxAttempts=1', () => {
      cy.seedFullScenario().then(({ professor, courseId }) => {
        cy.apiLogin(professor.email, professor.password);
        cy.visit(`/profesor/cursos/${courseId}`);

        cy.get('[aria-label="Editar Evaluaciones"]').click();
        cy.contains('+ Crear evaluación').click();
        cy.get('input[placeholder="Título de la evaluación"]').type('Solo un intento');
        // Buscar el tercer input en el flex (title, minScore, maxAttempts)
        cy.get('input[type="number"]').eq(1).clear().type('1'); // maxAttempts = 1
        cy.get('input[placeholder="Pregunta 1"]').type('¿1+1?');
        cy.get('input[placeholder="Opción 1"]').type('2');
        cy.get('input[placeholder="Opción 2"]').type('3');
        cy.get('input[type="radio"]').first().check({ force: true });
        cy.contains('button', 'Guardar evaluación').click();

        cy.contains('Solo un intento').should('be.visible');
      });
    });

    it('HU19 CA8: Alumno ve "Intento 1 de 1" en evaluación con maxAttempts=1', () => {
      cy.env(['apiUrl']).then(({ apiUrl }) => {
        cy.seedFullScenario().then(({ professor, student, courseId }) => {
          cy.apiLogin(professor.email, professor.password).then(({ token }) => {
            cy.request({
              method: 'POST',
              url: `${apiUrl}/courses/${courseId}/evaluations`,
              headers: { Authorization: `Bearer ${token}` },
              body: {
                title: 'Un intento',
                minScore: 50,
                maxAttempts: 1,
                questions: [{
                  text: '¿Verdadero o falso?',
                  options: [
                    { text: 'Verdadero', isCorrect: true },
                    { text: 'Falso', isCorrect: false },
                  ],
                }],
              },
            }).then(({ body }) => {
              cy.apiLogin(student.email, student.password).then(({ token: studentToken }) => {
                cy.request({
                  method: 'POST',
                  url: `${apiUrl}/courses/${courseId}/enroll`,
                  headers: { Authorization: `Bearer ${studentToken}` },
                });

                cy.visit(`/evaluaciones/${body.id}`);
                cy.contains('Intento 1 de 1').should('be.visible');
              });
            });
          });
        });
      });
    });

    it('HU19 CA1: Profesor edita maxAttempts de una evaluación existente', () => {
      cy.env(['apiUrl']).then(({ apiUrl }) => {
        cy.seedFullScenario().then(({ professor, courseId }) => {
          cy.apiLogin(professor.email, professor.password).then(({ token }) => {
            cy.request({
              method: 'POST',
              url: `${apiUrl}/courses/${courseId}/evaluations`,
              headers: { Authorization: `Bearer ${token}` },
              body: {
                title: 'Editar intentos',
                minScore: 50,
                maxAttempts: 2,
                questions: [{
                  text: 'Pregunta?',
                  options: [
                    { text: 'A', isCorrect: true },
                    { text: 'B', isCorrect: false },
                  ],
                }],
              },
            }).then(({ body }) => {
              cy.visit(`/profesor/cursos/${courseId}`);
              cy.get('[aria-label="Editar Evaluaciones"]').click();
              cy.contains('Editar intentos').click();
              cy.get('[aria-label="Ver Editar intentos"]').click();

              // Buscar el botón de editar para maxAttempts y cambiar a 4
              cy.contains('Máximo de intentos:').parent().within(() => {
                cy.get('button[title*="intentos"]').click();
              });
              cy.get('input[type="number"]').last().clear().type('4');
              cy.contains('button', 'Ok').click();

              cy.contains('Máximo de intentos: 4').should('be.visible');
            });
          });
        });
      });
    });

    it('HU19 CA6: Alumno agotó intentos con limit=2, profesor sube a 3, alumno puede rendir nuevamente', () => {
      cy.env(['apiUrl']).then(({ apiUrl }) => {
        cy.seedFullScenario().then(({ professor, student, courseId }) => {
          let evaluationId = '';
          cy.apiLogin(professor.email, professor.password).then(({ token }) => {
            cy.request({
              method: 'POST',
              url: `${apiUrl}/courses/${courseId}/evaluations`,
              headers: { Authorization: `Bearer ${token}` },
              body: {
                title: 'Aumentar intentos',
                minScore: 100, // força desaprobación
                maxAttempts: 2,
                questions: [{
                  text: 'Pregunta imposible',
                  options: [
                    { text: 'Opción A', isCorrect: true },
                    { text: 'Opción B', isCorrect: false },
                  ],
                }],
              },
            }).then(({ body }) => {
              evaluationId = body.id;
              const wrongOptionId = body.questions[0].options.find((o: any) => !o.isCorrect).id;

              // Alumno falla 2 intentos
              cy.apiLogin(student.email, student.password).then(({ token: studentToken }) => {
                cy.request({
                  method: 'POST',
                  url: `${apiUrl}/courses/${courseId}/enroll`,
                  headers: { Authorization: `Bearer ${studentToken}` },
                });

                cy.visit(`/evaluaciones/${evaluationId}`);
                cy.get(`input[value="${wrongOptionId}"]`).check({ force: true });
                cy.contains('button', 'Enviar evaluación').click();
                cy.contains('Desaprobado').should('be.visible');

                cy.visit(`/evaluaciones/${evaluationId}`);
                cy.contains('Intento 2 de 2').should('be.visible');
                cy.get(`input[value="${wrongOptionId}"]`).check({ force: true });
                cy.contains('button', 'Enviar evaluación').click();
                cy.contains('Desaprobado').should('be.visible');

                // Intento 3 bloqueado
                cy.visit(`/evaluaciones/${evaluationId}`);
                cy.contains('Alcanzaste el límite de 2 intentos').should('be.visible');

                // Profesor aumenta el límite a 3
                cy.apiLogin(professor.email, professor.password);
                cy.request({
                  method: 'PATCH',
                  url: `${apiUrl}/evaluations/${evaluationId}`,
                  headers: { Authorization: `Bearer ${token}` },
                  body: { maxAttempts: 3 },
                });

                // Alumno ahora puede rendir el 3er intento
                cy.apiLogin(student.email, student.password);
                cy.visit(`/evaluaciones/${evaluationId}`);
                cy.contains('Intento 3 de 3').should('be.visible');
                cy.get(`input[value="${wrongOptionId}"]`).check({ force: true });
                cy.contains('button', 'Enviar evaluación').click();
                cy.contains('Desaprobado').should('be.visible');
              });
            });
          });
        });
      });
    });
  });
});
