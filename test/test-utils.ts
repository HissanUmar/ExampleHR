export const createRepositoryMock = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  save: jest.fn(),
  create: jest.fn((entity) => entity),
  createQueryBuilder: jest.fn()
});
