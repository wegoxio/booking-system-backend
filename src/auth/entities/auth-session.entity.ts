import { BaseEntity } from 'src/common/entities/base.entity';
import { User } from 'src/users/entities/user.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

@Entity('auth_sessions')
export class AuthSession extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  token_jti: string;

  @Column({ type: 'text' })
  refresh_token_hash: string;

  @Column({ type: 'varchar', length: 64 })
  csrf_token_hash: string;

  @Index()
  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  revoked_at: Date | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  revocation_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  replaced_by_session_id: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  user_agent: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_used_at: Date | null;
}
