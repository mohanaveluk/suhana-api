import {
  Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn,
  BeforeInsert, Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SearchIntent } from '../models/search-intent.model';

/**
 * A search a member chose to keep and re-run later.
 *
 * Stores the parsed intent alongside the raw query so replaying is free — no
 * re-parse, and crucially no repeat LLM call for a query that originally needed
 * the fallback.
 */
@Entity('saved_search')
@Index('IDX_SAVED_SEARCH_USER', ['userId', 'isDeleted'])
export class SavedSearch {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  guid: string;

  @BeforeInsert()
  generateIds() {
    if (!this.id) this.id = uuidv4();
    if (!this.guid) this.guid = uuidv4();
  }

  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId: string;

  /** Member-supplied label, e.g. "Doctors in Texas". Defaults to the query text. */
  @Column({ type: 'varchar', length: 200, name: 'name' })
  name: string;

  @Column({ type: 'varchar', length: 500, name: 'query' })
  query: string;

  @Column({ type: 'json', name: 'parsed_intent', nullable: true })
  parsedIntent: SearchIntent | null;

  /** Result count at save time — lets the UI show "3 new since you saved this". */
  @Column({ type: 'int', name: 'result_count_at_save', default: 0 })
  resultCountAtSave: number;

  @Column({ type: 'datetime', name: 'last_run_at', nullable: true })
  lastRunAt: Date | null;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
