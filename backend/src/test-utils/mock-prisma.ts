// Mock genérico de PrismaService: cada modelo expone los métodos usados por
// los services, como jest.fn(), para poder testear la lógica de negocio sin
// necesitar una base de datos real.
type ModelMock = {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  createMany: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  upsert: jest.Mock;
  deleteMany: jest.Mock;
};

function createModelMock(): ModelMock {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  };
}

export function createMockPrismaService() {
  const prisma = {
    institution: createModelMock(),
    user: createModelMock(),
    course: createModelMock(),
    topic: createModelMock(),
    material: createModelMock(),
    enrollment: createModelMock(),
    notification: createModelMock(),
    topicProgress: createModelMock(),
    evaluation: createModelMock(),
    question: createModelMock(),
    questionOption: createModelMock(),
    evaluationAttempt: createModelMock(),
    certificate: createModelMock(),
    $transaction: jest.fn(),
  };
  prisma.enrollment.findMany.mockResolvedValue([]);
  prisma.$transaction.mockImplementation((callback) => callback(prisma));
  return prisma;
}

export type MockPrismaService = ReturnType<typeof createMockPrismaService>;
