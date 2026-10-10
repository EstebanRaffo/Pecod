describe('HU1, HU2, HU3 - Catálogo, inscripción y Mis cursos', () => {
  it('CA: filtra el catálogo, se inscribe y el curso aparece en Mis cursos', () => {
    cy.seedFullScenario().then(({ student, courseId }) => {
      cy.apiLogin(student.email, student.password);
      cy.visit('/catalogo');

      // HU1: el curso creado por el seed debe aparecer en el catálogo (está publicado)
      cy.contains('Curso Cypress').should('be.visible');

      // HU1: filtro por categoría
      cy.get('input[placeholder="Área / categoría"]').type('QA');
      cy.contains('button', 'Filtrar').click();
      cy.contains('Curso Cypress').should('be.visible');

      // HU1: filtro sin resultados
      cy.get('input[placeholder="Área / categoría"]').clear().type('CategoriaInexistente');
      cy.contains('button', 'Filtrar').click();
      cy.contains('Sin resultados.').should('be.visible');

      // HU1: filtro por tecnología
      cy.get('input[placeholder="Área / categoría"]').clear();
      cy.get('input[placeholder="Tecnología"]').type('Cypress');
      cy.contains('button', 'Filtrar').click();
      cy.contains('Curso Cypress').should('be.visible');

      // HU1: filtro por tecnología sin resultados
      cy.get('input[placeholder="Tecnología"]').clear().type('TecnologiaInexistente');
      cy.contains('button', 'Filtrar').click();
      cy.contains('Sin resultados.').should('be.visible');

      // Limpiar filtro y entrar al detalle
      cy.contains('button', 'Limpiar').click();
      cy.contains('Curso Cypress').click();

      // HU2: inscripción
      cy.contains('button', 'Inscribirme').click();
      cy.url().should('include', '/mis-cursos');

      // HU3: aparece en Mis cursos
      cy.contains('Curso Cypress').should('be.visible');

      // HU2: no permite doble inscripción (falla vía API si se reintenta)
      cy.window().then((win) => {
        const token = win.localStorage.getItem('pecod_token');
        cy.request({
          method: 'POST',
          url: `${Cypress.env('apiUrl')}/courses/${courseId}/enroll`,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status).to.eq(409);
        });
      });
    });
  });

  it('CA: sin inscripciones, "Mis cursos" muestra mensaje y acceso al catálogo', () => {
    cy.seedFullScenario().then(({ student }) => {
      cy.apiLogin(student.email, student.password);
      cy.visit('/mis-cursos');

      cy.contains('Sin cursos en progreso.').should('be.visible');
      cy.contains('Ir al catálogo').click();
      cy.url().should('include', '/catalogo');
    });
  });

  it('CA: un Profesor puede crear un curso con el campo tecnología (HU5)', () => {
    cy.seedFullScenario().then(({ professor }) => {
      cy.apiLogin(professor.email, professor.password);
      cy.visit('/profesor/cursos');

      const courseName = `Curso NestJS ${Date.now()}`;
      cy.get('input[placeholder="Nombre del curso"]').type(courseName);
      cy.get('textarea[placeholder="Descripción"]').type('Curso backend con NestJS');
      cy.get('input[placeholder="Área / categoría"]').type('Backend');
      cy.get('input[placeholder="Tecnología"]').type('NestJS');
      cy.contains('button', 'Crear curso').click();

      cy.contains(courseName).should('be.visible');
    });
  });

  it('CA: un Profesor puede despublicar un curso con popup de confirmación (HU8)', () => {
    cy.seedFullScenario().then(({ professor, courseId }) => {
      cy.apiLogin(professor.email, professor.password);
      cy.visit(`/profesor/cursos/${courseId}`);

      cy.contains('button', 'Despublicar').click();
      cy.contains('Confirmar despublicación del curso').should('be.visible');
      cy.contains('button', 'Cancelar').click();
      cy.contains('Confirmar despublicación del curso').should('not.exist');
      cy.contains('button', 'Despublicar').should('be.visible');

      cy.contains('button', 'Despublicar').click();
      cy.contains('Confirmar despublicación del curso').should('be.visible');
      cy.contains('button', 'Confirmar').click();
      cy.contains('Confirmar despublicación del curso').should('not.exist');
      cy.contains('button', 'Publicar').should('be.visible');
    });
  });
});
