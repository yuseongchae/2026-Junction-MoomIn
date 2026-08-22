import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntityMention } from '@/entity-mentions/entities/entity-mention.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EntityMention])],
  exports: [TypeOrmModule],
})
export class EntityMentionModule {}
