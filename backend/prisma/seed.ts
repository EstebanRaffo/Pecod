// Sin auto-registro en V1 (HU9), hace falta un Administrador de Sistema inicial
// para poder empezar a dar de alta instituciones y usuarios. Este seed lo crea.
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@pecod.com';
  const plainPassword = 'Admin123!';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('El Administrador de Sistema ya existe, no se crea de nuevo.');
    return;
  }

  const passwordHash = await bcrypt.hash(plainPassword, 10);
  await prisma.user.create({
    data: {
      name: 'Administrador PECOD',
      email,
      passwordHash,
      role: Role.ADMIN,
      institutionId: null, // el Admin de Sistema tiene alcance global (HU10)
    },
  });

  console.log('Administrador de Sistema creado:');
  console.log(`  email:    ${email}`);
  console.log(`  password: ${plainPassword}`);
  console.log('Cambiar esta contraseña antes de usar en un entorno real.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
