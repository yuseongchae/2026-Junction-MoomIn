import {
  Column,
  Entity as OrmEntity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Document } from '@/documents/entities/document.entity';
import { Entity } from '@/entities/entities/entity.entity';
import { Session } from '@/sessions/entities/session.entity';

@Index(['entityId'])
@Index(['sessionId'])
@Index(['documentId'])
@OrmEntity({ name: 'entity_mentions' })
export class EntityMention extends BaseEntity {
  @Column({ type: 'uuid' })
  entityId: string;

  @Column({ type: 'uuid' })
  sessionId: string;

  @Column({ type: 'uuid', nullable: true })
  documentId: string | null;

  @Column({ type: 'text' })
  originalText: string;

  @Column({ type: 'text', nullable: true })
  context: string | null;

  @Column({ type: 'double precision', nullable: true })
  confidence: number | null;

  @ManyToOne(() => Entity, (entity) => entity.entityMentions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'entityId' })
  entity: Entity;

  @ManyToOne(() => Session, (session) => session.entityMentions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sessionId' })
  session: Session;

  @ManyToOne(() => Document, (document) => document.entityMentions, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'documentId' })
  document: Document | null;
}
