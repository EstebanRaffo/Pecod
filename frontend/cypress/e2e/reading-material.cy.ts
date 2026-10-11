describe('Material de Lectura — flujo del Profesor', () => {
  beforeEach(() => {
    cy.seedFullScenario().then(({ professor }: { professor: { email: string; password: string } }) => {
      cy.visit('/login');
      cy.get('input[type="email"]').type(professor.email);
      cy.get('input[type="password"]').type(professor.password);
      cy.contains('button', 'Ingresar').click();
    });
  });

  it('CA: el botón "Material de Lectura" aparece en cada tema del Temario', () => {
    cy.visit('/profesor/cursos');
    cy.get('a').first().click();
    cy.contains('Material de Lectura').should('be.visible');
  });

  it('CA: al hacer clic se abre el editor con textarea y botones Guardar/Cancelar', () => {
    cy.visit('/profesor/cursos');
    cy.get('a').first().click();
    cy.contains('Material de Lectura').click();
    cy.get('textarea').should('be.visible');
    cy.contains('button', 'Guardar').should('be.visible');
    cy.contains('button', 'Cancelar').should('be.visible');
  });

  it('CA: al cancelar con cambios, aparece popup de confirmación', () => {
    cy.visit('/profesor/cursos');
    cy.get('a').first().click();
    cy.contains('Material de Lectura').click();
    cy.get('textarea').type('Texto de prueba');
    cy.contains('button', 'Cancelar').click();
    cy.contains('¿Descartás los cambios en el Material de Lectura?').should('be.visible');
  });

  it('CA: al guardar, el texto se muestra en modo display con links clickeables', () => {
    cy.visit('/profesor/cursos');
    cy.get('a').first().click();
    cy.contains('Material de Lectura').click();
    const texto = 'Documentación oficial: https://docs.example.com';
    cy.get('textarea').clear().type(texto);
    cy.contains('button', 'Guardar').click();
    cy.get('textarea').should('not.exist');
    cy.contains('https://docs.example.com')
      .should('have.attr', 'target', '_blank')
      .and('have.attr', 'rel', 'noopener noreferrer');
  });

  it('CA: el preview del Material de Lectura se expande y contrae sin entrar en edición', () => {
    cy.visit('/profesor/cursos');
    cy.get('a').first().click();
    cy.contains('Material de Lectura').click();
    cy.get('textarea').type('Texto largo para probar la vista previa. '.repeat(20));
    cy.contains('button', 'Guardar').click();

    cy.get('textarea').should('not.exist');
    cy.contains('button', 'Expandir').click();
    cy.contains('button', 'Contraer').should('be.visible');
    cy.get('textarea').should('not.exist');
    cy.contains('button', 'Contraer').click();
    cy.contains('button', 'Expandir').should('be.visible');
    cy.get('textarea').should('not.exist');
  });
});
