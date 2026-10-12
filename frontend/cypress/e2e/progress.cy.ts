describe('HU16 - Progreso individual del curso', () => {
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

  it('muestra 0% sin temas, persiste vistos, permite desmarcar y recalcula al agregar temas', () => {
    cy.seedFullScenario().then(({ student, professor, courseId }) => {
      let professorToken: string;
      const topicIds: string[] = [];

      cy.request('POST', `${apiUrl}/auth/login`, professor).then((res) => {
        professorToken = res.body.accessToken;
        cy.request({
          url: `${apiUrl}/courses/${courseId}/progress`,
          headers: { Authorization: `Bearer ${professorToken}` },
          failOnStatusCode: false,
        }).its('status').should('eq', 403);
      });

      cy.apiLogin(student.email, student.password).then(({ token }) => {
        const headers = { Authorization: `Bearer ${token}` };
        cy.request({
          url: `${apiUrl}/courses/${courseId}/progress`, headers, failOnStatusCode: false,
        }).its('status').should('eq', 403);
        cy.request({ method: 'POST', url: `${apiUrl}/courses/${courseId}/enroll`, headers });
      });

      cy.visit(`/mis-cursos/${courseId}`);
      cy.contains('0 de 0 temas vistos').should('be.visible');
      cy.get('progress').should('have.value', 0);

      cy.then(() => {
        for (const order of [1, 2, 3]) {
          cy.request({
            method: 'POST', url: `${apiUrl}/courses/${courseId}/topics`,
            headers: { Authorization: `Bearer ${professorToken}` },
            body: { title: `Tema ${order}`, order },
          }).then((res) => topicIds.push(res.body.id));
        }
      });
      cy.reload();
      cy.contains('0 de 3 temas vistos').should('be.visible');
      cy.then(() => cy.get(`#tema-${topicIds[0]}`).contains('Marcar como visto').click());
      cy.contains('1 de 3 temas vistos').should('be.visible');
      cy.get('progress').should('have.value', 33);
      cy.reload();
      cy.then(() => cy.get(`#tema-${topicIds[0]} input`).should('be.checked'));
      cy.get('progress').should('have.value', 33);

      cy.visit('/mis-cursos');
      cy.contains('1 de 3 temas vistos').should('be.visible');
      cy.get('progress').should('have.value', 33);

      cy.then(() => cy.request({
        method: 'POST', url: `${apiUrl}/courses/${courseId}/topics`,
        headers: { Authorization: `Bearer ${professorToken}` },
        body: { title: 'Tema nuevo', order: 4 },
      }));
      cy.visit(`/mis-cursos/${courseId}`);
      cy.contains('1 de 4 temas vistos').should('be.visible');
      cy.get('progress').should('have.value', 25);
      cy.then(() => cy.get(`#tema-${topicIds[0]}`).contains('Visto (desmarcar)').click());
      cy.contains('0 de 4 temas vistos').should('be.visible');
      cy.get('progress').should('have.value', 0);
      cy.reload();
      cy.then(() => cy.get(`#tema-${topicIds[0]} input`).should('not.be.checked'));
      cy.viewport(390, 844);
      cy.contains('Marcar como visto').should('be.visible');
      cy.get('progress').should('be.visible');
    });
  });

  it('mantiene separado el progreso de dos alumnos del mismo curso', () => {
    cy.seedFullScenario().then(({ student, professor, institutionId, courseId }) => {
      let topicId: string;
      let otherStudent: { email: string; password: string };

      cy.request('POST', `${apiUrl}/auth/login`, professor).then((res) => {
        cy.request({
          method: 'POST', url: `${apiUrl}/courses/${courseId}/topics`,
          headers: { Authorization: `Bearer ${res.body.accessToken}` },
          body: { title: 'Tema compartido', order: 1 },
        }).then((topic) => { topicId = topic.body.id; });
      });
      cy.request('POST', `${apiUrl}/auth/login`, {
        email: adminEmail, password: adminPassword,
      }).then((res) => {
        cy.request({
          method: 'POST', url: `${apiUrl}/users`,
          headers: { Authorization: `Bearer ${res.body.accessToken}` },
          body: { name: 'Otro alumno', email: `otro-${Date.now()}@cypress.com`, role: 'STUDENT', institutionId },
        }).then((user) => {
          otherStudent = { email: user.body.user.email, password: user.body.temporaryPassword };
        });
      });
      cy.apiLogin(student.email, student.password).then(({ token }) => {
        const headers = { Authorization: `Bearer ${token}` };
        cy.request({ method: 'POST', url: `${apiUrl}/courses/${courseId}/enroll`, headers });
        cy.then(() => cy.request({
          method: 'PUT', url: `${apiUrl}/courses/${courseId}/topics/${topicId}/viewed`, headers,
        })).its('body.percentage').should('eq', 100);
      });
      cy.then(() => cy.apiLogin(otherStudent.email, otherStudent.password)).then(({ token }) => {
        const headers = { Authorization: `Bearer ${token}` };
        cy.request({
          method: 'PUT', url: `${apiUrl}/courses/${courseId}/topics/${topicId}/viewed`,
          headers, failOnStatusCode: false,
        }).its('status').should('eq', 403);
        cy.request({ method: 'POST', url: `${apiUrl}/courses/${courseId}/enroll`, headers });
      });
      cy.visit(`/mis-cursos/${courseId}`);
      cy.contains('0 de 1 temas vistos').should('be.visible');
      cy.get('input[type="checkbox"]').should('not.be.checked');
      cy.apiLogin(student.email, student.password);
      cy.reload();
      cy.contains('1 de 1 temas vistos').should('be.visible');
      cy.get('input[type="checkbox"]').should('be.checked');
    });
  });
});