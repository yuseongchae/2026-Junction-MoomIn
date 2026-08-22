import { Module } from '@nestjs/common';
import { AgentController } from '@/agent/agent.controller';
import { AgentService } from '@/agent/agent.service';

@Module({
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
