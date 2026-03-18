import { BaseEntity } from 'src/common/entities/base.entity';
import { User } from 'src/users/entities/user.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

export type UserAccessTokenType = 'TENANT_ADMIN_INVITATION' | 'PASSWORD_RESET';

@Entity('user_access_tokens')
export class UserAccessToken extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ type: 'varchar', length: 40 })
  type: UserAccessTokenType;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  token_hash: string;

  @Column({ type: 'varchar', length: 255 })
  email_snapshot: string;

  @Column({ type: 'uuid', nullable: true })
  requested_by_user_id: string | null;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  consumed_at: Date | null;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  invalidated_at: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
