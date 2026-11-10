/**
 * Script de Backup de Base de Datos
 * 
 * Realiza un backup de la base de datos actual usando pg_dump.
 * Los backups se guardan en backend/backups/ con timestamp.
 * 
 * Uso:
 *   ts-node scripts/backup-db.ts
 *   npm run db:backup
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  try {
    // Parse DATABASE_URL para obtener credenciales
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL no está definida en .env');
    }

    // Crear directorio de backups si no existe
    const backupsDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    // Generar nombre del archivo con timestamp
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = path.join(backupsDir, `pecod_backup_${timestamp}.sql`);

    console.log(`🔄 Realizando backup de base de datos...`);
    console.log(`📁 Destino: ${filename}\n`);

    // Ejecutar pg_dump
    // Nota: pg_dump necesita acceso al cliente PostgreSQL
    // Si estás usando Docker, asegúrate de tener psql/pg_dump disponibles
    // O usa docker exec: docker exec <container-name> pg_dump [options] > backup.sql

    // Para este ejemplo, usamos la conexión via Docker exec
    // (ajusta según tu setup)
    
    const command = `docker exec pecod-postgres pg_dump -U pecod -d pecod > "${filename}"`;
    
    console.log(`Ejecutando: ${command}`);
    execSync(command, { stdio: 'inherit' });

    // Verificar que el archivo se creó
    if (fs.existsSync(filename)) {
      const stats = fs.statSync(filename);
      const sizeKb = (stats.size / 1024).toFixed(2);
      console.log(`\n✅ Backup completado exitosamente`);
      console.log(`📊 Tamaño: ${sizeKb} KB`);
      console.log(`📝 Archivo: ${filename}`);
    } else {
      throw new Error('El archivo de backup no se creó');
    }

  } catch (error) {
    console.error('❌ Error durante el backup:', error);
    process.exit(1);
  }
}

main();
