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
import { KeywordMention } from '@/keyword-mentions/entities/keyword-mention.entity';

@Index(['clientId'])
@Index(['clientId', 'name'], { unique: true })
@OrmEntity({ name: 'keywords' })
export class Keyword extends BaseEntity {
  @Column({ type: 'uuid' })
  clientId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ManyToOne(() => Client, (client) => client.keywords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @OneToMany(() => KeywordMention, (keywordMention) => keywordMention.keyword)
  keywordMentions: KeywordMention[];
}
