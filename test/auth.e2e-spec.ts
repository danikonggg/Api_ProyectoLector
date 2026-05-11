import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  const authServiceMock = {
    login: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login retorna token', async () => {
    authServiceMock.login.mockResolvedValue({
      message: 'Login exitoso',
      access_token: 'jwt-token',
      token_type: 'Bearer',
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: '123456' })
      .expect(200);

    expect(response.body.access_token).toBe('jwt-token');
    expect(authServiceMock.login).toHaveBeenCalledWith(
      { email: 'admin@test.com', password: '123456' },
      expect.any(String),
    );
  });
});
