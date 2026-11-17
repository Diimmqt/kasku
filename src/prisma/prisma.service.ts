import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const databaseUrl =
      configService.get<string>('DATABASE_URL') ??
      (configService.get<string>('NODE_ENV') !== 'production'
        ? 'mysql://root:@127.0.0.1:3306/kasku'
        : undefined);
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL environment variable is not set. Please configure it in .env.',
      );
    }
    const adapter = new PrismaMariaDb(databaseUrl);
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

