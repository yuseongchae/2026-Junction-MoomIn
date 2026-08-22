import {
  Column,
  Entity as OrmEntity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { EntityMention } from '@/entity-mentions/entities/entity-mention.entity';
import { KeywordMention } from '@/keyword-mentions/entities/keyword-mention.entity';
import { Session } from '@/sessions/entities/session.entity';

export enum DocumentStatus {
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Index(['sessionId'])
@OrmEntity({ name: 'documents' })
export class Document extends BaseEntity {
  @Column({ type: 'uuid' })
  sessionId: string;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mimeType: string | null;

  @Column({ type: 'text', nullable: true })
  fileUrl: string | null;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.UPLOADED,
  })
  status: DocumentStatus;

  @ManyToOne(() => Session, (session) => session.documents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sessionId' })
  session: Session;

  @OneToMany(() => KeywordMention, (keywordMention) => keywordMention.document)
  keywordMentions: KeywordMention[];

  @OneToMany(() => EntityMention, (entityMention) => entityMention.document)
  entityMentions: EntityMention[];
}
