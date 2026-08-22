import {
  Column,
  Entity as OrmEntity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Client } from '@/clients/entities/client.entity';
import { BaseEntity } from '@/common/entities/base.entity';
import { EntityMention } from '@/entity-mentions/entities/entity-mention.entity';

export enum EntityRelationship {
  CLIENT_MOTHER = 'CLIENT_MOTHER',
  SPOUSE_MOTHER = 'SPOUSE_MOTHER',
  FATHER = 'FATHER',
  SPOUSE = 'SPOUSE',
  SIBLING = 'SIBLING',
  FRIEND = 'FRIEND',
  OTHER = 'OTHER',
  UNKNOWN = 'UNKNOWN',
}

export enum EntityStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
}

@Index(['clientId'])
@OrmEntity({ name: 'entities' })
export class Entity extends BaseEntity {
  @Column({ type: 'uuid' })
  clientId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: EntityRelationship,
    default: EntityRelationship.UNKNOWN,
  })
  relationship: EntityRelationship;

  @Column({
    type: 'enum',
    enum: EntityStatus,
    default: EntityStatus.PENDING,
  })
  status: EntityStatus;

  @ManyToOne(() => Client, (client) => client.entities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @OneToMany(() => EntityMention, (entityMention) => entityMention.entity)
  entityMentions: EntityMention[];
}
