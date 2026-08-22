import { Column, Entity as OrmEntity, OneToMany } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Entity } from '@/entities/entities/entity.entity';
import { Keyword } from '@/keywords/entities/keyword.entity';
import { Session } from '@/sessions/entities/session.entity';

@OrmEntity({ name: 'clients' })
export class Client extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @OneToMany(() => Session, (session) => session.client)
  sessions: Session[];

  @OneToMany(() => Keyword, (keyword) => keyword.client)
  keywords: Keyword[];

  @OneToMany(() => Entity, (entity) => entity.client)
  entities: Entity[];
}
