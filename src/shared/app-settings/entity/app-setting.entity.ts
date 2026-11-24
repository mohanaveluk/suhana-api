import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Site-wide runtime switches that admins can flip without a deploy (key → string value).
 * Not for secrets — credentials stay in Secret Manager / environment.
 */
@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn({ name: 'setting_key', type: 'varchar', length: 64 })
  key: string;

  @Column({ name: 'setting_value', type: 'varchar', length: 255 })
  value: string;

  @Column({ name: 'updated_by', type: 'varchar', length: 36, nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
