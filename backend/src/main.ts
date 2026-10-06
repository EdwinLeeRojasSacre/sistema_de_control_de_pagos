import 'dotenv/config';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import {
  AppModule,
  ObserveInstrument,
  isObserveConfigured,
} from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    isObserveConfigured()
      ? { instrument: ObserveInstrument }
      : undefined,
  );

  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(
    process.env.PORT ?? 3001,
  );
}

await bootstrap();
