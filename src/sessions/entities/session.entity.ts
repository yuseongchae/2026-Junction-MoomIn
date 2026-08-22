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
import { Document } from '@/documents/entities/document.entity';
import { EntityMention } from '@/entity-mentions/entities/entity-mention.entity';
import { KeywordMention } from '@/keyword-mentions/entities/keyword-mention.entity';

@Index(['clientId'])
@OrmEntity({ name: 'sessions' })
export class Session extends BaseEntity {
  @Column({ type: 'uuid' })
  clientId: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  sessionDate: Date | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @ManyToOne(() => Client, (client) => client.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @OneToMany(() => Document, (document) => document.session)
  documents: Document[];

  @OneToMany(() => KeywordMention, (keywordMention) => keywordMention.session)
  keywordMentions: KeywordMention[];

  @OneToMany(() => EntityMention, (entityMention) => entityMention.session)
  entityMentions: EntityMention[];
}
