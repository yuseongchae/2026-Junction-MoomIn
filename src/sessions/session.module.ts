import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentModule } from '@/agent/agent.module';
import { Client } from '@/clients/entities/client.entity';
import { ClientSessionsController } from '@/sessions/client-sessions.controller';
import { Session } from '@/sessions/entities/session.entity';
import { SessionsController } from '@/sessions/sessions.controller';
import { SessionsService } from '@/sessions/sessions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Session, Client]), AgentModule],
  controllers: [ClientSessionsController, SessionsController],
  providers: [SessionsService],
  exports: [TypeOrmModule, SessionsService],
})
export class SessionModule {}
