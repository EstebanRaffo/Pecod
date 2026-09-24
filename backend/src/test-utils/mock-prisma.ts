// Mock genérico de PrismaService: cada modelo expone los métodos usados por
// los services, como jest.fn(), para poder testear la lógica de negocio sin
// necesitar una base de datos real.
type ModelMock = {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

function createModelMock(): ModelMock {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
}

export function createMockPrismaService() {
  return {
    institution: createModelMock(),
    user: createModelMock(),
    course: createModelMock(),
    topic: createModelMock(),
    material: createModelMock(),
    enrollment: createModelMock(),
    evaluation: createModelMock(),
    question: createModelMock(),
    questionOption: createModelMock(),
    evaluationAttempt: createModelMock(),
  };
}

export type MockPrismaService = ReturnType<typeof createMockPrismaService>;
