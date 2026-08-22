import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KeywordMention } from '@/keyword-mentions/entities/keyword-mention.entity';

@Module({
  imports: [TypeOrmModule.forFeature([KeywordMention])],
  exports: [TypeOrmModule],
})
export class KeywordMentionModule {}
