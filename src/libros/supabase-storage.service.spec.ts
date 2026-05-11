import { ConfigService } from '@nestjs/config';
import { SupabaseStorageService } from './supabase-storage.service';
import { InternalServerErrorException } from '@nestjs/common';

const uploadMock = jest.fn();
const createSignedUrlMock = jest.fn();
const removeMock = jest.fn();
const getBucketMock = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    storage: {
      from: jest.fn(() => ({
        upload: uploadMock,
        createSignedUrl: createSignedUrlMock,
        remove: removeMock,
      })),
      getBucket: getBucketMock,
    },
  })),
}));

describe('SupabaseStorageService', () => {
  let service: SupabaseStorageService;

  beforeEach(() => {
    uploadMock.mockReset();
    createSignedUrlMock.mockReset();
    removeMock.mockReset();
    getBucketMock.mockReset();
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'SUPABASE_URL') return 'http://localhost:54321';
        if (key === 'SUPABASE_KEY') return 'service-role-key';
        if (key === 'SUPABASE_BUCKET') return 'api-lector-pdfs';
        if (key === 'SUPABASE_SIGNED_URL_TTL_SECONDS') return '300';
        return defaultValue;
      }),
    } as unknown as ConfigService;

    service = new SupabaseStorageService(configService);
  });

  it('sube el buffer y retorna la key', async () => {
    uploadMock.mockResolvedValue({
      data: { path: 'LIB_1.pdf' },
      error: null,
    });

    const key = await service.guardar(Buffer.from('pdf'), 1, 'LIB');

    expect(key).toBe('LIB_1.pdf');
    expect(uploadMock).toHaveBeenCalled();
  });

  it('lanza error al fallar subida', async () => {
    uploadMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(service.guardar(Buffer.from('pdf'), 1, 'LIB')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('retorna signed url temporal cuando existe archivo', async () => {
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: 'https://signed.example.com/file.pdf' },
      error: null,
    });

    const url = await service.obtenerUrl('LIB_1.pdf');
    expect(url).toContain('signed.example.com');
  });

  it('retorna null si no puede firmar url', async () => {
    createSignedUrlMock.mockResolvedValue({
      data: null,
      error: { message: 'forbidden' },
    });

    const url = await service.obtenerUrl('LIB_1.pdf');
    expect(url).toBeNull();
  });
});
