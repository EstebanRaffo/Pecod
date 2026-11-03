// Mock genérico de PrismaService: cada modelo expone los métodos usados por
// los services, como jest.fn(), para poder testear la lógica de negocio sin
// necesitar una base de datos real.
type ModelMock = {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  groupBy: jest.Mock;
  create: jest.Mock;
  createMany: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock; // HU22
  delete: jest.Mock;
  upsert: jest.Mock;
  deleteMany: jest.Mock;
};

function createModelMock(): ModelMock {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(), // HU22
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
    courseReview: createModelMock(),
    passwordResetToken: createModelMock(), // HU22
    $transaction: jest.fn(),
  };
  prisma.enrollment.findMany.mockResolvedValue([]);
  prisma.$transaction.mockImplementation((callback) => callback(prisma));
  return prisma;
}

export type MockPrismaService = ReturnType<typeof createMockPrismaService>;
