import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
  },
  env: {
    apiUrl: 'http://localhost:3000/api',
    // Credenciales del seed inicial (ver backend/prisma/seed.ts) y de datos
    // de prueba creados en cypress/support/e2e.ts (before all).
    adminEmail: 'admin@pecod.com',
    adminPassword: 'Admin123!',
  },
});
