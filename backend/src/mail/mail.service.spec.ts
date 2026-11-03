import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                MAIL_HOST: 'localhost',
                MAIL_PORT: 1025,
                MAIL_USER: 'dev@pecod.local',
                MAIL_PASS: 'password',
                MAIL_FROM: 'noreply@pecod.edu',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send password reset email', async () => {
    // Mock del transporter
    const sendMailMock = jest.fn().mockResolvedValue({ messageId: '123' });
    service['transporter'].sendMail = sendMailMock;

    const email = 'test@example.com';
    const resetLink = 'https://pecod.edu/reset-password?token=abc123';
    const userName = 'Test User';

    await service.sendPasswordResetEmail(email, resetLink, userName);

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: email,
        subject: expect.stringContaining('Restablecer tu contraseña'),
      }),
    );
  });

  it('should not throw if email sending fails', async () => {
    const sendMailMock = jest.fn().mockRejectedValue(new Error('SMTP error'));
    service['transporter'].sendMail = sendMailMock;

    const email = 'test@example.com';
    const resetLink = 'https://pecod.edu/reset-password?token=abc123';
    const userName = 'Test User';

    // No debería lanzar error (best-effort)
    await expect(
      service.sendPasswordResetEmail(email, resetLink, userName),
    ).resolves.not.toThrow();
  });
});
