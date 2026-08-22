import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentModule } from '@/agent/agent.module';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { ClientModule } from '@/clients/client.module';
import { createTypeOrmOptions } from '@/database/typeorm.config';
import { DocumentModule } from '@/documents/document.module';
import { EntityMentionModule } from '@/entity-mentions/entity-mention.module';
import { EntityModule } from '@/entities/entity.module';
import { KeywordMentionModule } from '@/keyword-mentions/keyword-mention.module';
import { KeywordModule } from '@/keywords/keyword.module';
import { SessionModule } from '@/sessions/session.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createTypeOrmOptions,
    }),
    AgentModule,
    ClientModule,
    SessionModule,
    DocumentModule,
    KeywordModule,
    KeywordMentionModule,
    EntityModule,
    EntityMentionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
