/**
 * Smoke e2e — boots the full Nest application against an ephemeral Postgres
 * & Redis (provided by the docker-compose / GH Actions services).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Health endpoints', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.enableVersioning({ type: 1 as any, defaultVersion: '1' } as any);
    prisma = app.get(PrismaService);
    await app.init();

    // Ensure the default tenant exists for AuthGuard's dev-mode lookup.
    await prisma.tenant.upsert({
      where: { slug: process.env.DEFAULT_TENANT_SLUG ?? 'default' },
      update: {},
      create: { slug: process.env.DEFAULT_TENANT_SLUG ?? 'default', name: 'Default' },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /healthz returns 200', async () => {
    const res = await request(app.getHttpServer()).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /readyz checks database + redis', async () => {
    const res = await request(app.getHttpServer()).get('/readyz');
    expect([200, 503]).toContain(res.status);
    expect(res.body.info ?? res.body.error).toBeTruthy();
  });
});
