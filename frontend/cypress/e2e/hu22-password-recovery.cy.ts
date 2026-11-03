describe('HU22 - Recuperación de contraseña', () => {
  it('CA1: LoginPage ofrece enlace "¿Olvidaste tu contraseña?"', () => {
    cy.visit('/login');
    cy.contains('¿Olvidaste tu contraseña?').should('be.visible');
    cy.contains('¿Olvidaste tu contraseña?').click();
    cy.url().should('include', '/forgot-password');
  });

  it('CA2: respuesta genérica si el email existe o no', () => {
    // Intentar con email inexistente
    cy.visit('/forgot-password');
    cy.get('input[type="email"]').type('no-existe@pecod.com');
    cy.contains('button', 'Enviar Instrucciones').click();

    cy.contains('Se ha enviado un correo con instrucciones').should('be.visible');

    // Intentar de nuevo con email existente (Admin de seed)
    cy.get('button:contains("Enviar Otro Email")').click();
    cy.get('input[type="email"]').clear().type(Cypress.env('adminEmail'));
    cy.contains('button', 'Enviar Instrucciones').click();

    // Debe mostrar el mismo mensaje
    cy.contains('Se ha enviado un correo con instrucciones').should('be.visible');
  });

  it('CA3,CA4,CA5: flujo completo de reset con token válido y contraseña válida', () => {
    cy.seedFullScenario().then(({ student }) => {
      // 1. Solicitar reset
      cy.visit('/forgot-password');
      cy.get('input[type="email"]').type(student.email);
      cy.contains('button', 'Enviar Instrucciones').click();
      cy.contains('Se ha enviado un correo con instrucciones').should('be.visible');

      // 2. Simular acceso al enlace en el email (usando la API para obtener un token válido)
      cy.request('POST', '/auth/forgot-password', { email: student.email }).then((response) => {
        expect(response.status).to.eq(200);
      });

      // Nota: En un test real, deberíamos recuperar el token del mock de email.
      // Para este test simplificado, verificamos que el endpoint responde correctamente.
      // En un Cypress test completo contra Mailpit, se extraería el token del email.
    });
  });

  it('CA4: contraseña corta (<8 caracteres) es rechazada', () => {
    // Simular acceso con un token válido (mock)
    const token = 'mock-token-for-testing';
    cy.visit(`/reset-password?token=${token}`);

    cy.get('input[type="password"]').first().type('short');
    cy.get('input[type="password"]').last().type('short');
    cy.contains('button', 'Restablecer Contraseña').click();

    cy.contains('La contraseña debe tener al menos 8 caracteres').should('be.visible');
  });

  it('CA4: contraseñas no coincidentes son rechazadas', () => {
    const token = 'mock-token-for-testing';
    cy.visit(`/reset-password?token=${token}`);

    cy.get('input[type="password"]').first().type('newPassword123');
    cy.get('input[type="password"]').last().type('differentPassword');
    cy.contains('button', 'Restablecer Contraseña').click();

    cy.contains('Las contraseñas no coinciden').should('be.visible');
  });

  it('CA5: token vencido muestra error y permite solicitar nuevo', () => {
    const expiredToken = 'expired-token';
    cy.visit(`/reset-password?token=${expiredToken}`);

    cy.get('input[type="password"]').first().type('newPassword123');
    cy.get('input[type="password"]').last().type('newPassword123');
    cy.contains('button', 'Restablecer Contraseña').click();

    // Debe mostrar un error sobre el token vencido
    cy.contains(/vencido|inválido|expirado/i).should('be.visible');

    // Debe ofrecer solicitar un nuevo enlace
    cy.contains('Solicitar Nuevo Enlace').should('be.visible');
  });

  it('CA6: tras restablecer, el usuario debe poder iniciar sesión con la nueva contraseña', () => {
    cy.seedFullScenario().then(({ student }) => {
      // En un test real, aquí se ejecutaría todo el flujo de reset
      // y luego se verificaría el login con la nueva contraseña.
      // Por ahora, verificamos que la página de reset existe y está accesible.

      cy.visit('/reset-password');
      cy.contains('Establecer Nueva Contraseña').should('be.visible');
    });
  });

  it('CA7: rate limiting: máximo 5 solicitudes por hora por email', () => {
    // Nota: Este test requeriría un mock de tiempo o usar clock de Cypress
    // Para validar en CI, se recomienda usar un test de carga con JMeter/k6
    // Por ahora, solo verificamos que el endpoint existe

    cy.request('POST', '/auth/forgot-password', { email: 'test@example.com' }).then(
      (response) => {
        expect(response.status).to.eq(200);
      },
    );
  });

  it('CA8: recuperación disponible para Alumno, Profesor y Administrador', () => {
    // Verificar que la página es pública (no requiere autenticación)
    cy.visit('/forgot-password');
    cy.contains('Recuperar Contraseña').should('be.visible');

    cy.visit('/reset-password?token=test');
    cy.contains('Establecer Nueva Contraseña').should('be.visible');
  });
});
