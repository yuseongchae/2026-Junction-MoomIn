import {
  Column,
  Entity as OrmEntity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Document } from '@/documents/entities/document.entity';
import { Keyword } from '@/keywords/entities/keyword.entity';
import { Session } from '@/sessions/entities/session.entity';

@Index(['keywordId'])
@Index(['sessionId'])
@Index(['documentId'])
@OrmEntity({ name: 'keyword_mentions' })
export class KeywordMention extends BaseEntity {
  @Column({ type: 'uuid' })
  keywordId: string;

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

  @ManyToOne(() => Keyword, (keyword) => keyword.keywordMentions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'keywordId' })
  keyword: Keyword;

  @ManyToOne(() => Session, (session) => session.keywordMentions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sessionId' })
  session: Session;

  @ManyToOne(() => Document, (document) => document.keywordMentions, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'documentId' })
  document: Document | null;
}
