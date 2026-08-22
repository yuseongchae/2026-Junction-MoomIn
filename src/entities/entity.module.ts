import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entity } from '@/entities/entities/entity.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Entity])],
  exports: [TypeOrmModule],
})
export class EntityModule {}
