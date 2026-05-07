import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './common/config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // enable cors
  app.enableCors();

  // setup swagger
  setupSwagger(app);

  // start server
  await app.listen(process.env.PORT ?? 3000);

  // console.log(`Application is running on: ${await app.getUrl()}`);
  // console.log(`Webhook URL: ${await app.getUrl()}/api/v1/worker/webhook`);
  console.log(`Application is running on: http://localhost:3000`);
  console.log(`Webhook URL: http://localhost:3000/wa/webhook`);
}
bootstrap();
