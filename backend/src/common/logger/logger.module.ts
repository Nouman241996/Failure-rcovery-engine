import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';
import { env } from '../config/env';

const REQUEST_ID_HEADER = 'x-request-id';

export const loggerModuleOptions = () => {
  const isProd = env().NODE_ENV === 'production';
  return LoggerModule.forRoot({
    pinoHttp: {
      level: env().LOG_LEVEL,
      genReqId: (req, res) => {
        const incoming = (req.headers[REQUEST_ID_HEADER] as string | undefined) ?? randomUUID();
        res.setHeader(REQUEST_ID_HEADER, incoming);
        return incoming;
      },
      autoLogging: {
        ignore: (req) => req.url === '/healthz' || req.url === '/readyz' || req.url === '/metrics',
      },
      customProps: (req) => ({
        tenantId: (req as unknown as { tenantId?: string }).tenantId,
      }),
      redact: {
        paths: ['req.headers.authorization', 'req.headers["x-api-key"]', 'req.headers.cookie'],
        censor: '[REDACTED]',
      },
      transport: isProd
        ? undefined
        : {
            target: 'pino-pretty',
            options: { singleLine: true, colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
          },
    },
  });
};

export const REQUEST_ID_HEADER_NAME = REQUEST_ID_HEADER;
