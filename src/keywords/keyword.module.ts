import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Keyword } from '@/keywords/entities/keyword.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Keyword])],
  exports: [TypeOrmModule],
})
export class KeywordModule {}
