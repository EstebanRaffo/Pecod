describe('HU10 - Login y autenticación', () => {
  it('CA: redirige a la vista de Administrador tras un login válido', () => {
    cy.visit('/login');
    cy.get('input[type="email"]').type(Cypress.env('adminEmail'));
    cy.get('input[type="password"]').type(Cypress.env('adminPassword'));
    cy.contains('button', 'Ingresar').click();

    cy.url().should('include', '/admin/instituciones');
    cy.contains('Instituciones').should('be.visible');
  });

  it('CA: credenciales inválidas muestran un mensaje genérico y no autentican', () => {
    cy.visit('/login');
    cy.get('input[type="email"]').type('no-existe@pecod.com');
    cy.get('input[type="password"]').type('cualquiera');
    cy.contains('button', 'Ingresar').click();

    cy.contains('Email o contraseña incorrectos.').should('be.visible');
    cy.url().should('include', '/login');
  });

  it('CA: un Alumno no puede acceder a una vista reservada al Administrador', () => {
    cy.seedFullScenario().then(({ student }) => {
      cy.visit('/login');
      cy.get('input[type="email"]').type(student.email);
      cy.get('input[type="password"]').type(student.password);
      cy.contains('button', 'Ingresar').click();

      cy.url().should('include', '/catalogo');

      // Intenta navegar directamente a una vista de Admin -> debe ser redirigido.
      cy.visit('/admin/instituciones');
      cy.url().should('not.include', '/admin/instituciones');
    });
  });
});
