import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadsService } from './uploads.service';
import { UploadKind } from './dto/request-upload-url.dto';

// Mockeamos el SDK de AWS: estos tests validan las reglas de negocio
// (formato/tamaño), no la integración real con S3.
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn().mockImplementation((input) => input),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.amazonaws.com/fake-presigned-url'),
}));

describe('UploadsService (HU5, HU6, HU7)', () => {
  let service: UploadsService;

  beforeEach(() => {
    const config = { get: jest.fn().mockReturnValue('us-east-1') } as unknown as ConfigService;
    service = new UploadsService(config);
  });

  it('CA: acepta un video MP4 dentro del límite de 500 MB', async () => {
    const result = await service.requestUploadUrl({
      fileName: 'clase1.mp4',
      contentType: 'video/mp4',
      sizeBytes: 100 * 1024 * 1024,
      kind: UploadKind.VIDEO,
    });
    expect(result.uploadUrl).toBeDefined();
  });

  it('CA: rechaza un formato de video no soportado (ej. AVI)', async () => {
    await expect(
      service.requestUploadUrl({
        fileName: 'clase1.avi',
        contentType: 'video/x-msvideo',
        sizeBytes: 1024,
        kind: UploadKind.VIDEO,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('CA: rechaza un video que supera los 500 MB', async () => {
    await expect(
      service.requestUploadUrl({
        fileName: 'clase1.mp4',
        contentType: 'video/mp4',
        sizeBytes: 501 * 1024 * 1024,
        kind: UploadKind.VIDEO,
      }),
    ).rejects.toThrow('El video supera el tamaño máximo de 500 MB.');
  });

  it('CA: acepta un material PDF dentro del límite de 10 MB', async () => {
    const result = await service.requestUploadUrl({
      fileName: 'apunte.pdf',
      contentType: 'application/pdf',
      sizeBytes: 5 * 1024 * 1024,
      kind: UploadKind.MATERIAL,
    });
    expect(result.fileUrl).toContain('apunte.pdf');
  });

  it('CA: rechaza un material con formato no soportado', async () => {
    await expect(
      service.requestUploadUrl({
        fileName: 'imagen.png',
        contentType: 'image/png',
        sizeBytes: 1024,
        kind: UploadKind.MATERIAL,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('CA: rechaza un material que supera los 10 MB', async () => {
    await expect(
      service.requestUploadUrl({
        fileName: 'apunte.pdf',
        contentType: 'application/pdf',
        sizeBytes: 11 * 1024 * 1024,
        kind: UploadKind.MATERIAL,
      }),
    ).rejects.toThrow('El archivo supera el tamaño máximo de 10 MB.');
  });
});
