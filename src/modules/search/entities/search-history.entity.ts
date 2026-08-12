import {
  Entity, PrimaryColumn, Column, CreateDateColumn, BeforeInsert, Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SearchIntent } from '../models/search-intent.model';
import { IntentSource } from '../enums/search.enums';

/**
 * One row per executed AI search. Append-only.
 *
 * Powers popular/recent searches and, more importantly, parser tuning: a query
 * with `resultCount = 0` or `intentSource = AI_FALLBACK` is a concrete signal
 * that a dictionary needs extending, which removes an inference cost permanently.
 */
@Entity('search_history')
@Index('IDX_SEARCH_HIST_USER_CREATED', ['userId', 'createdAt'])
@Index('IDX_SEARCH_HIST_CREATED', ['createdAt'])
@Index('IDX_SEARCH_HIST_NORMALISED', ['normalisedQuery'])
export class SearchHistory {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }

  // Nullable: anonymous/guest searches still inform popular-search reporting.
  @Column({ type: 'varchar', length: 36, name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 500, name: 'query' })
  query: string;

  // Lower-cased, whitespace-collapsed. Grouping key for "top searches" — without
  // it, "Doctor in Texas" and "doctor  in texas" would count as different queries.
  @Column({ type: 'varchar', length: 500, name: 'normalised_query' })
  normalisedQuery: string;

  @Column({ type: 'json', name: 'parsed_intent', nullable: true })
  parsedIntent: SearchIntent | null;

  @Column({ type: 'int', name: 'confidence', default: 0 })
  confidence: number;

  @Column({ type: 'varchar', length: 20, name: 'intent_source', default: IntentSource.LOCAL })
  intentSource: IntentSource;

  @Column({ type: 'int', name: 'result_count', default: 0 })
  resultCount: number;

  /** End-to-end wall time in milliseconds, for latency monitoring. */
  @Column({ type: 'int', name: 'search_time_ms', default: 0 })
  searchTimeMs: number;

  @Column({ type: 'varchar', length: 64, name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
