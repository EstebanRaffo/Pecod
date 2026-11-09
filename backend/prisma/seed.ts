// Sin auto-registro en V1 (HU9), hace falta un Administrador de Sistema inicial
// para poder empezar a dar de alta instituciones y usuarios. Este seed lo crea.
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Crear o obtener la institución por defecto (UADE)
  let institution = await prisma.institution.findUnique({
    where: { domain: 'uade.edu.ar' },
  });

  if (!institution) {
    institution = await prisma.institution.create({
      data: {
        name: 'Universidad Argentina de la Empresa',
        domain: 'uade.edu.ar',
        address: 'Lima 717, C1073AAO CABA, Argentina',
        phone: '+54 11 5199-8000',
        contactEmail: 'info@uade.edu.ar',
      },
    });
    console.log('Institución UADE creada.');
  }

  // Crear Administrador de Sistema
  const adminEmail = 'admin@pecod.com';
  const adminPassword = 'Admin123!';
  const adminExisting = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!adminExisting) {
    const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        name: 'Administrador PECOD',
        email: adminEmail,
        passwordHash: adminPasswordHash,
        role: Role.ADMIN,
        institutionId: null, // el Admin de Sistema tiene alcance global (HU10)
        emailVerifiedAt: new Date(), // Email verificado
      },
    });
    console.log('✓ Administrador de Sistema creado.');
  } else {
    console.log('✓ Administrador de Sistema ya existe.');
  }

  // Crear Usuario Alumno - Esteban Fernández Raffo
  const studentEmail = 'efernandezraffo@uade.edu.ar';
  const studentPassword = 'Alumno123!';
  const studentExisting = await prisma.user.findUnique({ where: { email: studentEmail } });
  if (!studentExisting) {
    const studentPasswordHash = await bcrypt.hash(studentPassword, 10);
    await prisma.user.create({
      data: {
        name: 'Esteban Fernández Raffo',
        email: studentEmail,
        passwordHash: studentPasswordHash,
        role: Role.STUDENT,
        institutionId: institution.id,
        emailVerifiedAt: new Date(), // Email verificado
      },
    });
    console.log('✓ Usuario Alumno (Esteban Fernández Raffo) creado.');
  } else {
    console.log('✓ Usuario Alumno (Esteban Fernández Raffo) ya existe.');
  }

  // Crear Usuario Profesor - Franco L. Martínez
  const professorEmail = 'francolmartinez@uade.edu.ar';
  const professorPassword = 'Profesor123!';
  const professorExisting = await prisma.user.findUnique({ where: { email: professorEmail } });
  if (!professorExisting) {
    const professorPasswordHash = await bcrypt.hash(professorPassword, 10);
    await prisma.user.create({
      data: {
        name: 'Franco L. Martínez',
        email: professorEmail,
        passwordHash: professorPasswordHash,
        role: Role.PROFESSOR,
        institutionId: institution.id,
        emailVerifiedAt: new Date(), // Email verificado
      },
    });
    console.log('✓ Usuario Profesor (Franco L. Martínez) creado.');
  } else {
    console.log('✓ Usuario Profesor (Franco L. Martínez) ya existe.');
  }

  // Crear Usuario Profesor Adicional - Alejandra Potente
  const professorAEmail = 'apotente@uade.edu.ar';
  const professorAPassword = 'Profesor456!';
  const professorAExisting = await prisma.user.findUnique({ where: { email: professorAEmail } });
  if (!professorAExisting) {
    const professorAPasswordHash = await bcrypt.hash(professorAPassword, 10);
    await prisma.user.create({
      data: {
        name: 'Alejandra Potente',
        email: professorAEmail,
        passwordHash: professorAPasswordHash,
        role: Role.PROFESSOR,
        institutionId: institution.id,
        emailVerifiedAt: new Date(), // Email verificado
      },
    });
    console.log('✓ Usuario Profesor (Alejandra Potente) creado.');
  } else {
    console.log('✓ Usuario Profesor (Alejandra Potente) ya existe.');
  }

  // Crear Usuario Alumno Adicional - Franco Radorno
  const studentBEmail = 'fradorno@uade.edu.ar';
  const studentBPassword = 'Alumno456!';
  const studentBExisting = await prisma.user.findUnique({ where: { email: studentBEmail } });
  if (!studentBExisting) {
    const studentBPasswordHash = await bcrypt.hash(studentBPassword, 10);
    await prisma.user.create({
      data: {
        name: 'Franco Radorno',
        email: studentBEmail,
        passwordHash: studentBPasswordHash,
        role: Role.STUDENT,
        institutionId: institution.id,
        emailVerifiedAt: new Date(), // Email verificado
      },
    });
    console.log('✓ Usuario Alumno (Franco Radorno) creado.');
  } else {
    console.log('✓ Usuario Alumno (Franco Radorno) ya existe.');
  }

  // Crear Usuario Alumno Externo - Esteban Raffo (Gmail)
  const externalStudentEmail = 'e.fraffo@gmail.com';
  const externalStudentPassword = 'External123!';
  const externalStudentExisting = await prisma.user.findUnique({ where: { email: externalStudentEmail } });
  if (!externalStudentExisting) {
    const externalStudentPasswordHash = await bcrypt.hash(externalStudentPassword, 10);
    await prisma.user.create({
      data: {
        name: 'Esteban Raffo',
        email: externalStudentEmail,
        passwordHash: externalStudentPasswordHash,
        role: Role.STUDENT,
        institutionId: null, // Usuario externo sin institución específica
        emailVerifiedAt: new Date(), // Email verificado
      },
    });
    console.log('✓ Usuario Alumno Externo (Esteban Raffo) creado.');
  } else {
    console.log('✓ Usuario Alumno Externo (Esteban Raffo) ya existe.');
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('CREDENCIALES DE ACCESO PARA TESTING:');
  console.log('═══════════════════════════════════════════════════');
  console.log('\n📋 ADMINISTRADOR:');
  console.log(`  Email:    ${adminEmail}`);
  console.log(`  Password: ${adminPassword}`);
  console.log('\n👤 ALUMNOS (UADE):');
  console.log(`  Email:    ${studentEmail}`);
  console.log(`  Password: ${studentPassword}`);
  console.log(`  Email:    ${studentBEmail}`);
  console.log(`  Password: ${studentBPassword}`);
  console.log('\n👤 ALUMNOS (Externos):');
  console.log(`  Email:    ${externalStudentEmail}`);
  console.log(`  Password: ${externalStudentPassword}`);
  console.log('\n👨‍🏫 PROFESORES:');
  console.log(`  Email:    ${professorEmail}`);
  console.log(`  Password: ${professorPassword}`);
  console.log(`  Email:    ${professorAEmail}`);
  console.log(`  Password: ${professorAPassword}`);
  console.log('═══════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
