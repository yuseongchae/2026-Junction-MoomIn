import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

function getNumberConfig(configService: ConfigService, key: string): number {
  const value = configService.getOrThrow<string>(key);
  const parsedValue = Number(value);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`${key} must be a valid number`);
  }

  return parsedValue;
}

export function createTypeOrmOptions(
  configService: ConfigService,
): TypeOrmModuleOptions {
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';

  return {
    type: 'postgres',
    host: configService.getOrThrow<string>('DATABASE_HOST'),
    port: getNumberConfig(configService, 'DATABASE_PORT'),
    username: configService.getOrThrow<string>('DATABASE_USERNAME'),
    password: configService.getOrThrow<string>('DATABASE_PASSWORD'),
    database: configService.getOrThrow<string>('DATABASE_NAME'),
    autoLoadEntities: true,
    synchronize: nodeEnv === 'development',
    logging: nodeEnv !== 'production',
  };
}
