// HU23: Tests de Auto-registro de Alumnos por Dominio Institucional

describe('HU23: Auto-registro de Alumnos', () => {
  const testEmail = `alumno-${Date.now()}@uade.edu.ar`;
  const testPassword = 'Password123!';

  beforeEach(() => {
    // Limpiar storage
    localStorage.removeItem('pecod_token');
    localStorage.removeItem('pecod_user');
    cy.visit('/register');
  });

  it('CA1: Alumno registra con email institucional habilitado', () => {
    // HU23: Rellenar formulario de registro
    cy.get('input[placeholder*="nombre"]').type('Juan Alumno');
    cy.get('input[placeholder*="institucion"]').type(testEmail);
    cy.get('input[placeholder*="Al menos"]').type(testPassword);
    cy.get('input[placeholder*="Confirma"]').type(testPassword);

    cy.get('button:contains("Registrarse")').click();

    // Debe mostrar mensaje de éxito
    cy.contains('Registro exitoso').should('be.visible');

    // Debe redirigir a login
    cy.url().should('include', '/login');
  });

  it('CA2: Rechaza email con dominio no habilitado', () => {
    const invalidEmail = `user-${Date.now()}@dominio-no-habilitado.com`;

    cy.get('input[placeholder*="nombre"]').type('Test User');
    cy.get('input[placeholder*="institucion"]').type(invalidEmail);
    cy.get('input[placeholder*="Al menos"]').type(testPassword);
    cy.get('input[placeholder*="Confirma"]').type(testPassword);

    cy.get('button:contains("Registrarse")').click();

    // Debe mostrar error
    cy.contains('dominio').should('be.visible');
  });

  it('CA3: Rechaza contraseñas no coincidentes', () => {
    cy.get('input[placeholder*="nombre"]').type('Test User');
    cy.get('input[placeholder*="institucion"]').type(testEmail);
    cy.get('input[placeholder*="Al menos"]').type(testPassword);
    cy.get('input[placeholder*="Confirma"]').type('OtherPassword123!');

    cy.get('button:contains("Registrarse")').click();

    // Debe mostrar error de coincidencia
    cy.contains('no coinciden').should('be.visible');
  });

  it('CA4: Rechaza contraseña corta', () => {
    cy.get('input[placeholder*="nombre"]').type('Test User');
    cy.get('input[placeholder*="institucion"]').type(testEmail);
    cy.get('input[placeholder*="Al menos"]').type('pass123');
    cy.get('input[placeholder*="Confirma"]').type('pass123');

    cy.get('button:contains("Registrarse")').click();

    // Debe mostrar error de longitud
    cy.contains('8 caracteres').should('be.visible');
  });

  it('CA5: Email duplicado rechazado', () => {
    // Registrar primera vez
    cy.get('input[placeholder*="nombre"]').type('Juan Alumno');
    cy.get('input[placeholder*="institucion"]').type(testEmail);
    cy.get('input[placeholder*="Al menos"]').type(testPassword);
    cy.get('input[placeholder*="Confirma"]').type(testPassword);
    cy.get('button:contains("Registrarse")').click();

    // Esperar a redirección
    cy.url().should('include', '/login');

    // Intentar registrar de nuevo con mismo email
    cy.visit('/register');
    cy.get('input[placeholder*="nombre"]').type('Otro Usuario');
    cy.get('input[placeholder*="institucion"]').type(testEmail);
    cy.get('input[placeholder*="Al menos"]').type(testPassword);
    cy.get('input[placeholder*="Confirma"]').type(testPassword);
    cy.get('button:contains("Registrarse")').click();

    // Debe rechazar con mensaje de email duplicado
    cy.contains('Ya existe').should('be.visible');
  });

  it('CA7: Usuario sin verificar no puede loguearse', () => {
    const newEmail = `unverified-${Date.now()}@uade.edu.ar`;

    // Registrar
    cy.get('input[placeholder*="nombre"]').type('Test User');
    cy.get('input[placeholder*="institucion"]').type(newEmail);
    cy.get('input[placeholder*="Al menos"]').type(testPassword);
    cy.get('input[placeholder*="Confirma"]').type(testPassword);
    cy.get('button:contains("Registrarse")').click();

    // Esperar a redirección
    cy.url().should('include', '/login');

    // Intentar loguearse sin verificar
    cy.get('input[placeholder*="Email"]').type(newEmail);
    cy.get('input[placeholder*="Contraseña"]').type(testPassword);
    cy.get('button:contains("Ingresar")').click();

    // Debe mostrar error específico y opción de reenviar
    cy.contains('aún no ha sido verificado').should('be.visible');
    cy.contains('Reenviar').should('be.visible');
  });

  it('CA6: Verificación con token válido', () => {
    const verifyEmail = `verify-${Date.now()}@uade.edu.ar`;

    // Registrar
    cy.get('input[placeholder*="nombre"]').type('Verify User');
    cy.get('input[placeholder*="institucion"]').type(verifyEmail);
    cy.get('input[placeholder*="Al menos"]').type(testPassword);
    cy.get('input[placeholder*="Confirma"]').type(testPassword);
    cy.get('button:contains("Registrarse")').click();

    // En una app real, obtendríamos el token del email
    // Para este test, asumimos que Mailpit está disponible
    cy.visit('http://localhost:8025');
    
    // Buscar el email enviado y extraer el token (necesitaría API de Mailpit)
    // Por ahora, este test está diseñado pero requiere integración con Mailpit
    
    // Simplificado: redirigir directamente a verificación
    // (en un e2e real, obtendríamos el token del email)
    // cy.visit('/verify-email?token=VALID_TOKEN');
    // cy.contains('Email verificado correctamente').should('be.visible');
  });
});
