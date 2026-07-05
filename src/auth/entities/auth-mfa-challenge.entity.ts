import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

@Entity('auth_mfa_challenges')
export class AuthMfaChallenge extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  token_jti_hash: string;

  @Index()
  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  used_at: Date | null;

  @Column({ type: 'integer', default: 0 })
  failed_attempts: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  user_agent: string | null;
}
