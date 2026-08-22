import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { configureApp, getPort } from '@/configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  configureApp(app);

  const port = getPort(app);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();