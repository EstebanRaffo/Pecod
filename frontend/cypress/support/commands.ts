/// <reference types="cypress" />

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Loguea vía API y deja el token/usuario en localStorage, como haría la app real. */
      apiLogin(email: string, password: string): Chainable<{ token: string; user: any }>;
      /**
       * Crea de punta a punta: institución -> Profesor -> Alumno -> curso publicado.
       * Devuelve todas las credenciales/ids generados, para usarlos en los specs.
       */
      seedFullScenario(): Chainable<{
        institutionId: string;
        professor: { email: string; password: string };
        student: { email: string; password: string };
        courseId: string;
      }>;
    }
  }
}

Cypress.Commands.add('apiLogin', (email: string, password: string) => {
  return cy
    .request('POST', `${Cypress.env('apiUrl')}/auth/login`, { email, password })
    .then((res) => {
      window.localStorage.setItem('pecod_token', res.body.accessToken);
      window.localStorage.setItem('pecod_user', JSON.stringify(res.body.user));
      return { token: res.body.accessToken, user: res.body.user };
    });
});

Cypress.Commands.add('seedFullScenario', () => {
  const apiUrl = Cypress.env('apiUrl');
  const unique = Date.now();

  return cy
    .request('POST', `${apiUrl}/auth/login`, {
      email: Cypress.env('adminEmail'),
      password: Cypress.env('adminPassword'),
    })
    .then((loginRes) => {
      const adminToken = loginRes.body.accessToken;
      const authHeader = { Authorization: `Bearer ${adminToken}` };

      return cy
        .request({
          method: 'POST',
          url: `${apiUrl}/institutions`,
          headers: authHeader,
          body: {
            name: `Instituto Cypress ${unique}`,
            domain: `cypress-${unique}.pecod.com`,
            address: 'Calle Falsa 123',
            phone: '011-0000-0000',
            contactEmail: `contacto-${unique}@cypress.com`,
          },
        })
        .then((instRes) => {
          const institutionId = instRes.body.id;

          return cy
            .request({
              method: 'POST',
              url: `${apiUrl}/users`,
              headers: authHeader,
              body: {
                name: 'Profesor Cypress',
                email: `profesor-${unique}@cypress.com`,
                role: 'PROFESSOR',
                institutionId,
              },
            })
            .then((profRes) => {
              const professor = {
                email: profRes.body.user.email,
                password: profRes.body.temporaryPassword,
              };

              return cy
                .request({
                  method: 'POST',
                  url: `${apiUrl}/users`,
                  headers: authHeader,
                  body: {
                    name: 'Alumno Cypress',
                    email: `alumno-${unique}@cypress.com`,
                    role: 'STUDENT',
                    institutionId,
                  },
                })
                .then((studRes) => {
                  const student = {
                    email: studRes.body.user.email,
                    password: studRes.body.temporaryPassword,
                  };

                  return cy
                    .request('POST', `${apiUrl}/auth/login`, professor)
                    .then((profLoginRes) => {
                      const professorToken = profLoginRes.body.accessToken;

                      return cy
                        .request({
                          method: 'POST',
                          url: `${apiUrl}/courses`,
                          headers: { Authorization: `Bearer ${professorToken}` },
                          body: {
                            name: `Curso Cypress ${unique}`,
                            description: 'Curso de prueba generado por Cypress',
                            category: 'QA',
                            tools: 'Cypress',
                          },
                        })
                        .then((courseRes) => {
                          const courseId = courseRes.body.id;
                          return cy
                            .request({
                              method: 'PATCH',
                              url: `${apiUrl}/courses/${courseId}/publish`,
                              headers: { Authorization: `Bearer ${professorToken}` },
                            })
                            .then(() => ({ institutionId, professor, student, courseId }));
                        });
                    });
                });
            });
        });
    });
});

export {};
