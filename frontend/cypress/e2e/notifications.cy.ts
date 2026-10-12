describe('HU17 - Notificaciones de nuevo contenido', () => {
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

  it('recibe avisos en una sesion abierta, los ordena, enlaza al tema y persiste la lectura', () => {
    cy.seedFullScenario().then(({ student, professor, courseId }) => {
      let professorToken: string;
      let topicId: string;
      cy.request('POST', `${apiUrl}/auth/login`, professor).then((res) => { professorToken = res.body.accessToken; });
      cy.apiLogin(student.email, student.password).then(({ token }) => {
        cy.request({ method: 'POST', url: `${apiUrl}/courses/${courseId}/enroll`, headers: { Authorization: `Bearer ${token}` } });
      });
      cy.clock(undefined, ['setInterval', 'clearInterval']);
      cy.visit('/mis-cursos');
      cy.get('[data-testid="notification-bell"]').click();
      cy.contains('No hay notificaciones.').should('be.visible');
      cy.get('[data-testid="notification-bell"]').should('not.have.class', 'text-red-500').click();
      cy.then(() => cy.request({
        method: 'POST', url: `${apiUrl}/courses/${courseId}/topics`,
        headers: { Authorization: `Bearer ${professorToken}` }, body: { title: 'Tema inicial', order: 1 },
      })).then((res) => {
        topicId = res.body.id;
        cy.request({
          method: 'PATCH', url: `${apiUrl}/topics/${topicId}`,
          headers: { Authorization: `Bearer ${professorToken}` }, body: { title: 'Tema actualizado' },
        });
      });
      cy.tick(15000);
      cy.get('[data-testid="notification-bell"]').should('have.class', 'text-red-500').click();
      cy.get('[data-testid="notification-item"]').should('have.length', 2);
      cy.get('[data-testid="notification-item"]').first().contains('Contenido actualizado');
      cy.get('[data-testid="notification-item"]').last().contains('Contenido nuevo');
      cy.get('[data-testid="notification-item"]').each((item) => {
        cy.wrap(item).contains('Curso Cypress');
        cy.wrap(item).find('time').should('have.attr', 'datetime').and('match', /^\d{4}-\d{2}-\d{2}T/);
      });
      cy.get('[data-testid="notification-item"]').first().find('button[title="Marcar como leida"]').click();
      cy.get('[data-testid="notification-item"]').first().contains('Leida');
      cy.get('[data-testid="notification-bell"]').should('have.class', 'text-red-500');
      cy.get('[data-testid="notification-item"]').last().find('button[title="Marcar como leida"]').click();
      cy.get('[data-testid="notification-bell"]').should('not.have.class', 'text-red-500');
      cy.reload();
      cy.get('[data-testid="notification-bell"]').click();
      cy.get('[data-testid="notification-item"]').should('have.length', 2);
      cy.get('[data-testid="notification-item"] button[title="Marcar como leida"]').should('not.exist');
      cy.viewport(390, 844);
      cy.get('#notifications-panel').should('be.visible').then((panel) => {
        const bounds = panel[0].getBoundingClientRect();
        expect(bounds.left).to.be.at.least(0);
        expect(bounds.right).to.be.at.most(390);
      });
      cy.get('[data-testid="notification-item"]').first().contains('Tema actualizado').click();
      cy.then(() => cy.location('hash').should('eq', `#tema-${topicId}`));
      cy.then(() => cy.get(`#tema-${topicId}`).should('be.visible'));
    });
  });

  it('notifica texto, videos, grabaciones y adjuntos; excluye eliminaciones y datos generales', () => {
    cy.seedFullScenario().then(({ student, professor, courseId }) => {
      let professorHeaders: { Authorization: string };
      let studentHeaders: { Authorization: string };
      let topicId: string;
      let materialId: string;
      cy.request('POST', `${apiUrl}/auth/login`, professor).then((res) => {
        professorHeaders = { Authorization: `Bearer ${res.body.accessToken}` };
      });
      cy.apiLogin(student.email, student.password).then(({ token }) => {
        studentHeaders = { Authorization: `Bearer ${token}` };
        cy.request({ method: 'POST', url: `${apiUrl}/courses/${courseId}/enroll`, headers: studentHeaders });
      });
      cy.then(() => cy.request({
        method: 'POST', url: `${apiUrl}/courses/${courseId}/topics`, headers: professorHeaders,
        body: { title: 'Recursos', order: 1 },
      })).then((res) => { topicId = res.body.id; });
      cy.then(() => {
        for (const contentText of ['Primer texto', 'Texto modificado']) {
          cy.request({ method: 'PATCH', url: `${apiUrl}/topics/${topicId}`, headers: professorHeaders, body: { contentText } });
        }
        for (const videoUrl of ['https://example.com/first.mp4', 'https://example.com/second.mp4']) {
          cy.request({ method: 'POST', url: `${apiUrl}/topics/${topicId}/video`, headers: professorHeaders, body: { videoUrl, videoDurationSeconds: 60 } });
        }
        for (const screenRecordingUrl of ['https://example.com/first.webm', 'https://example.com/second.webm']) {
          cy.request({ method: 'POST', url: `${apiUrl}/topics/${topicId}/screen-recording`, headers: professorHeaders, body: { screenRecordingUrl, videoDurationSeconds: 60 } });
        }
        cy.request({
          method: 'POST', url: `${apiUrl}/topics/${topicId}/materials`, headers: professorHeaders,
          body: { fileName: 'apunte.pdf', fileUrl: 'https://example.com/apunte.pdf', fileType: 'pdf', sizeBytes: 1024 },
        }).then((res) => { materialId = res.body.id; });
      });
      cy.then(() => cy.request({ url: `${apiUrl}/notifications`, headers: studentHeaders })).then((res) => {
        expect(res.body).to.have.length(8);
        expect(res.body.filter((item: any) => item.event === 'NEW_CONTENT')).to.have.length(5);
        expect(res.body.filter((item: any) => item.event === 'UPDATED_CONTENT')).to.have.length(3);
      });
      cy.then(() => {
        cy.request({ method: 'PATCH', url: `${apiUrl}/topics/${topicId}`, headers: professorHeaders, body: { contentText: 'Texto modificado' } });
        cy.request({ method: 'PATCH', url: `${apiUrl}/topics/${topicId}`, headers: professorHeaders, body: { contentText: '' } });
        for (const suffix of ['video', 'screen-recording', `materials/${materialId}`]) {
          cy.request({ method: 'DELETE', url: `${apiUrl}/topics/${topicId}/${suffix}`, headers: professorHeaders });
        }
        cy.request({
          method: 'PATCH', url: `${apiUrl}/courses/${courseId}`, headers: professorHeaders,
          body: { name: 'Nombre cambiado', description: 'Otra descripcion', category: 'Otra area', technology: 'React', academicRequirements: 'Ninguno', skills: 'Testing' },
        });
        cy.request({ url: `${apiUrl}/notifications`, headers: studentHeaders }).its('body').should('have.length', 8);
      });
    });
  });

  it('aisla alumnos, no notifica a no inscriptos y restringe el acceso por rol', () => {
    cy.seedFullScenario().then(({ student, professor, institutionId, courseId }) => {
      let professorHeaders: { Authorization: string };
      let studentHeaders: { Authorization: string };
      let otherHeaders: { Authorization: string };
      let noticeId: string;
      let topicId: string;
      cy.request('POST', `${apiUrl}/auth/login`, { email: adminEmail, password: adminPassword }).then((res) => {
        const adminHeaders = { Authorization: `Bearer ${res.body.accessToken}` };
        cy.request({ url: `${apiUrl}/notifications`, headers: adminHeaders, failOnStatusCode: false }).its('status').should('eq', 403);
        cy.request({
          method: 'POST', url: `${apiUrl}/users`, headers: adminHeaders,
          body: { name: 'Otro alumno', email: `hu17-${Date.now()}@cypress.com`, role: 'STUDENT', institutionId },
        }).then((res) => cy.request('POST', `${apiUrl}/auth/login`, {
          email: res.body.user.email, password: res.body.temporaryPassword,
        })).then((res) => { otherHeaders = { Authorization: `Bearer ${res.body.accessToken}` }; });
      });
      cy.apiLogin(professor.email, professor.password).then(({ token }) => {
        professorHeaders = { Authorization: `Bearer ${token}` };
        cy.request({ url: `${apiUrl}/notifications`, headers: professorHeaders, failOnStatusCode: false }).its('status').should('eq', 403);
      });
      cy.visit('/profesor/cursos');
      cy.get('[data-testid="notification-bell"]').should('not.exist');
      cy.apiLogin(student.email, student.password).then(({ token }) => {
        studentHeaders = { Authorization: `Bearer ${token}` };
        cy.request({ method: 'POST', url: `${apiUrl}/courses/${courseId}/enroll`, headers: studentHeaders });
      });
      cy.then(() => cy.request({
        method: 'POST', url: `${apiUrl}/courses/${courseId}/topics`, headers: professorHeaders,
        body: { title: 'Tema privado', order: 1 },
      })).then((res) => { topicId = res.body.id; });
      cy.then(() => cy.request({ url: `${apiUrl}/notifications`, headers: studentHeaders })).then((res) => {
        expect(res.body).to.have.length(1);
        noticeId = res.body[0].id;
      });
      cy.then(() => {
        cy.request({ url: `${apiUrl}/notifications`, headers: otherHeaders }).its('body').should('have.length', 0);
        cy.request({ method: 'PATCH', url: `${apiUrl}/notifications/${noticeId}/read`, headers: otherHeaders, failOnStatusCode: false }).its('status').should('eq', 404);
        cy.request({ method: 'POST', url: `${apiUrl}/courses/${courseId}/enroll`, headers: otherHeaders });
        cy.request({ url: `${apiUrl}/notifications`, headers: otherHeaders }).its('body').should('have.length', 0);
        cy.request({ method: 'PATCH', url: `${apiUrl}/topics/${topicId}`, headers: professorHeaders, body: { title: 'Tema compartido' } });
        cy.request({ url: `${apiUrl}/notifications`, headers: otherHeaders }).then((res) => {
          expect(res.body).to.have.length(1);
          cy.request({ method: 'PATCH', url: `${apiUrl}/notifications/${res.body[0].id}/read`, headers: otherHeaders });
        });
        cy.request({ url: `${apiUrl}/notifications`, headers: studentHeaders }).then((res) => {
          expect(res.body).to.have.length(2);
          expect(res.body.every((item: any) => item.readAt === null)).to.eq(true);
        });
        cy.request({ url: `${apiUrl}/notifications`, failOnStatusCode: false }).its('status').should('eq', 401);
      });
    });
  });
});