import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { IndexModule } from '../../api/index.module';

export function setupSwagger(app: INestApplication) {
  const configService = app.get(ConfigService);

  // SWAGGER BASIC AUTH MIDDLEWARE
  app.use(
    ['/documentation', '/documentation-json'],
    (req: Request, res: Response, next: NextFunction) => {
      const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
      const [login, password] = Buffer.from(b64auth, 'base64')
        .toString()
        .split(':');

      const swaggerUser = configService.get<string>('SWAGGER_USER');
      const swaggerPassword = configService.get<string>('SWAGGER_PASS');

      if (
        login &&
        password &&
        login === swaggerUser &&
        password === swaggerPassword
      ) {
        return next();
      }

      res.set('WWW-Authenticate', 'Basic realm="401"');
      res.status(401).send('Authentication required.');
    },
  );

  // CONFIG SWAGGER
  const mainConfig = new DocumentBuilder()
    .setTitle('Reminder Me Bro API')
    .setDescription('API Documentation khusus untuk Reminder Me Bro')
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'Masukkan API Key',
      },
      'api-key',
    )
    .build();

  const options = {
    include: [IndexModule],
  };

  const document = SwaggerModule.createDocument(app, mainConfig, options);
  SwaggerModule.setup('documentation', app, document);
}
