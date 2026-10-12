describe('HU18 - Certificado de finalización', () => {
  let apiUrl: string;

  beforeEach(() => {
    cy.env(['apiUrl']).then((env) => {
      apiUrl = env.apiUrl;
    });
  });

  it('CA2 & CA3: Deshabilitado en curso sin temas o con temas pendientes, e informa qué falta', () => {
    cy.seedFullScenario().then(({ student, courseId }) => {
      cy.apiLogin(student.email, student.password).then(({ token }) => {
        cy.request({
          method: 'POST',
          url: `${apiUrl}/courses/${courseId}/enroll`,
          headers: { Authorization: `Bearer ${token}` },
        });

        // Curso sin temas
        cy.visit(`/mis-cursos/${courseId}`);
        cy.contains('Certificado de finalización').should('be.visible');
        cy.get('[data-testid="download-certificate-button"]').should('be.disabled');
        cy.contains('El curso no tiene temas cargados.').should('be.visible');
      });
    });
  });

  it('CA1 & CA9: Habilita certificado al completar 100% de temas (curso sin evaluaciones) y se identifica en Mis cursos', () => {
    cy.seedFullScenario().then(({ professor, student, courseId }) => {
      let professorToken: string;
      const topicIds: string[] = [];

      cy.apiLogin(professor.email, professor.password).then(({ token }) => {
        professorToken = token;
        // Agregar 2 temas al curso
        for (const order of [1, 2]) {
          cy.request({
            method: 'POST',
            url: `${apiUrl}/courses/${courseId}/topics`,
            headers: { Authorization: `Bearer ${professorToken}` },
            body: { title: `Clase ${order}`, order },
          }).then((res) => topicIds.push(res.body.id));
        }
      });

      cy.apiLogin(student.email, student.password).then(({ token }) => {
        cy.request({
          method: 'POST',
          url: `${apiUrl}/courses/${courseId}/enroll`,
          headers: { Authorization: `Bearer ${token}` },
        });

        cy.visit(`/mis-cursos/${courseId}`);
        // Con temas pero 0% de avance: deshabilitado
        cy.get('[data-testid="download-certificate-button"]').should('be.disabled');
        cy.contains('Faltan temas por ver.').should('be.visible');

        // Marcar todos los temas como vistos
        cy.then(() => {
          cy.get(`#tema-${topicIds[0]}`).contains('Marcar como visto').click();
          cy.get(`#tema-${topicIds[1]}`).contains('Marcar como visto').click();
        });

        // Se habilita la opción de descargar certificado
        cy.get('[data-testid="download-certificate-button"]').should('not.be.disabled');

        // CA9: En Mis cursos se identifica como curso finalizado con certificado disponible
        cy.visit('/mis-cursos');
        cy.get('[data-testid="certificate-badge"]').should('be.visible')
          .and('contain', 'Certificado disponible');

        // CA5 & CA6: Descargar certificado registra emisión y muestra el código
        cy.visit(`/mis-cursos/${courseId}`);
        cy.get('[data-testid="download-certificate-button"]').click();
        cy.contains('Certificado emitido · Código: CERT-').should('be.visible');

        // La descarga posterior mantiene el certificado emitido
        cy.reload();
        cy.contains('Certificado emitido · Código: CERT-').should('be.visible');
        cy.get('[data-testid="download-certificate-button"]').should('not.be.disabled');
      });
    });
  });

  it('CA3, CA4 & CA8: Curso con evaluaciones, intentos agotados y persistencia en curso despublicado', () => {
    cy.seedFullScenario().then(({ professor, student, courseId }) => {
      let professorToken: string;
      let topicId: string;
      let evalId: string;
      let correctOptionId: string;
      let wrongOptionId: string;

      cy.apiLogin(professor.email, professor.password).then(({ token }) => {
        professorToken = token;
        cy.request({
          method: 'POST',
          url: `${apiUrl}/courses/${courseId}/topics`,
          headers: { Authorization: `Bearer ${professorToken}` },
          body: { title: 'Tema único', order: 1 },
        }).then((res) => {
          topicId = res.body.id;

          cy.request({
            method: 'POST',
            url: `${apiUrl}/courses/${courseId}/evaluations`,
            headers: { Authorization: `Bearer ${professorToken}` },
            body: {
              title: 'Evaluación final',
              minScore: 100,
              questions: [
                {
                  text: '¿Pregunta 1?',
                  options: [
                    { text: 'Correcta', isCorrect: true },
                    { text: 'Incorrecta', isCorrect: false },
                  ],
                },
              ],
            },
          }).then((evalRes) => {
            evalId = evalRes.body.id;
            correctOptionId = evalRes.body.questions[0].options.find((o: any) => o.isCorrect).id;
            wrongOptionId = evalRes.body.questions[0].options.find((o: any) => !o.isCorrect).id;
          });
        });
      });

      cy.apiLogin(student.email, student.password).then(({ token }) => {
        cy.request({
          method: 'POST',
          url: `${apiUrl}/courses/${courseId}/enroll`,
          headers: { Authorization: `Bearer ${token}` },
        });

        // 1. Marca el tema como visto pero la evaluación aún no fue aprobada
        cy.visit(`/mis-cursos/${courseId}`);
        cy.then(() => cy.get(`#tema-${topicId}`).contains('Marcar como visto').click());
        cy.get('[data-testid="download-certificate-button"]').should('be.disabled');
        cy.contains('Faltan evaluaciones por aprobar.').should('be.visible');

        // 2. Rinde y aprueba la evaluación
        cy.visit(`/evaluaciones/${evalId}`);
        cy.then(() => cy.get(`input[value="${correctOptionId}"]`).check({ force: true }));
        cy.contains('button', 'Enviar evaluación').click();
        cy.contains('Aprobado').should('be.visible');

        // 3. Vuelve a la cursada: ambas condiciones cumplidas -> certificado habilitado
        cy.visit(`/mis-cursos/${courseId}`);
        cy.get('[data-testid="download-certificate-button"]').should('not.be.disabled');

        // 4. CA8: El profesor despublica el curso, pero el alumno inscripto aún puede descargar su certificado
        cy.then(() => {
          cy.request({
            method: 'PATCH',
            url: `${apiUrl}/courses/${courseId}/unpublish`,
            headers: { Authorization: `Bearer ${professorToken}` },
          });
        });

        cy.reload();
        cy.get('[data-testid="download-certificate-button"]').should('not.be.disabled');
        cy.get('[data-testid="download-certificate-button"]').click();
        cy.contains('Certificado emitido · Código: CERT-').should('be.visible');
      });
    });
  });

  it('CA4: Si el alumno agota los intentos sin aprobar, no puede obtener el certificado y el sistema se lo informa', () => {
    cy.seedFullScenario().then(({ professor, student, courseId }) => {
      let professorToken: string;
      let evalId: string;
      let wrongOptionId: string;

      cy.apiLogin(professor.email, professor.password).then(({ token }) => {
        professorToken = token;
        cy.request({
          method: 'POST',
          url: `${apiUrl}/courses/${courseId}/topics`,
          headers: { Authorization: `Bearer ${professorToken}` },
          body: { title: 'Tema único', order: 1 },
        });

        cy.request({
          method: 'POST',
          url: `${apiUrl}/courses/${courseId}/evaluations`,
          headers: { Authorization: `Bearer ${professorToken}` },
          body: {
            title: 'Examen difícil',
            minScore: 100,
            questions: [
              {
                text: 'Pregunta',
                options: [
                  { text: 'Correcta', isCorrect: true },
                  { text: 'Incorrecta', isCorrect: false },
                ],
              },
            ],
          },
        }).then((res) => {
          evalId = res.body.id;
          wrongOptionId = res.body.questions[0].options.find((o: any) => !o.isCorrect).id;
        });
      });

      cy.apiLogin(student.email, student.password).then(({ token }) => {
        cy.request({
          method: 'POST',
          url: `${apiUrl}/courses/${courseId}/enroll`,
          headers: { Authorization: `Bearer ${token}` },
        });

        // Rinde 2 veces con opción incorrecta (agota intentos)
        for (const _attempt of [1, 2]) {
          cy.visit(`/evaluaciones/${evalId}`);
          cy.then(() => cy.get(`input[value="${wrongOptionId}"]`).check({ force: true }));
          cy.contains('button', 'Enviar evaluación').click();
          cy.contains('Desaprobado').should('be.visible');
        }

        // En la cursada se informa que agotó los intentos y no puede obtener el certificado
        cy.visit(`/mis-cursos/${courseId}`);
        cy.get('[data-testid="download-certificate-button"]').should('be.disabled');
        cy.contains('Agotaste los intentos de una evaluación sin aprobarla; no podés obtener el certificado.').should('be.visible');
      });
    });
  });
});
