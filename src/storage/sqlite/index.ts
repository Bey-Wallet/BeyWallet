import type {
  Repositories,
  MintRepository,
  KeysetRepository,
  KeyRingRepository,
  CounterRepository,
  ProofRepository,
  MintQuoteRepository,
  MeltQuoteRepository,
  SendOperationRepository,
  MeltOperationRepository,
  RepositoryTransactionScope,
} from 'coco-cashu-core';
import { ExpoSqliteDb, type ExpoSqliteDbOptions } from '~/storage/sqlite/db';
import { ensureSchema, ensureSchemaUpTo, MIGRATIONS, seedMockData, type Migration } from '~/storage/sqlite/schema';
import { ExpoMintRepository } from '~/storage/sqlite/repositories/MintRepository';
import { ExpoKeysetRepository } from '~/storage/sqlite/repositories/KeysetRepository';
import { ExpoKeyRingRepository } from '~/storage/sqlite/repositories/KeyRingRepository';
import { ExpoCounterRepository } from '~/storage/sqlite/repositories/CounterRepository';
import { ExpoProofRepository } from '~/storage/sqlite/repositories/ProofRepository';
import { ExpoMintQuoteRepository } from '~/storage/sqlite/repositories/MintQuoteRepository';
import { ExpoMeltQuoteRepository } from '~/storage/sqlite/repositories/MeltQuoteRepository';
import { ExpoHistoryRepository } from '~/storage/sqlite/repositories/HistoryRepository';
import { ExpoSendOperationRepository } from '~/storage/sqlite/repositories/SendOperationRepository';
import { ExpoMeltOperationRepository } from '~/storage/sqlite/repositories/MeltOperationRepository';
import { ExpoSettingsRepository } from '~/storage/sqlite/repositories/SettingsRepository';
import { ExpoMintRecommendationRepository } from '~/storage/sqlite/repositories/MintRecommendationRepository';

export interface ExpoSqliteRepositoriesOptions extends ExpoSqliteDbOptions {}

export class ExpoSqliteRepositories implements Repositories {
  readonly mintRepository: MintRepository;
  readonly keyRingRepository: KeyRingRepository;
  readonly counterRepository: CounterRepository;
  readonly keysetRepository: KeysetRepository;
  readonly proofRepository: ProofRepository;
  readonly mintQuoteRepository: MintQuoteRepository;
  readonly meltQuoteRepository: MeltQuoteRepository;
  readonly historyRepository: ExpoHistoryRepository;
  readonly sendOperationRepository: SendOperationRepository;
  readonly meltOperationRepository: MeltOperationRepository;
  readonly settingsRepository: ExpoSettingsRepository;
  readonly mintRecommendationRepository: ExpoMintRecommendationRepository;
  readonly db: ExpoSqliteDb;

  constructor(options: ExpoSqliteRepositoriesOptions) {
    this.db = new ExpoSqliteDb(options);
    this.mintRepository = new ExpoMintRepository(this.db);
    this.keyRingRepository = new ExpoKeyRingRepository(this.db);
    this.counterRepository = new ExpoCounterRepository(this.db);
    this.keysetRepository = new ExpoKeysetRepository(this.db);
    this.proofRepository = new ExpoProofRepository(this.db);
    this.mintQuoteRepository = new ExpoMintQuoteRepository(this.db);
    this.meltQuoteRepository = new ExpoMeltQuoteRepository(this.db);
    this.historyRepository = new ExpoHistoryRepository(this.db);
    this.sendOperationRepository = new ExpoSendOperationRepository(this.db);
    this.meltOperationRepository = new ExpoMeltOperationRepository(this.db);
    this.settingsRepository = new ExpoSettingsRepository(this.db);
    this.mintRecommendationRepository = new ExpoMintRecommendationRepository(this.db);
  }

  async init(): Promise<void> {
    // Ensure schema is up to date
    await ensureSchema(this.db);
    console.log('[Database] Schema initialized and verified');
  }

  async seedMockData(): Promise<void> {
    await seedMockData(this.db);
  }

  async withTransaction<T>(fn: (repos: RepositoryTransactionScope) => Promise<T>): Promise<T> {
    return this.db.transaction(async (txDb) => {
      const scopedRepositories: RepositoryTransactionScope = {
        mintRepository: new ExpoMintRepository(txDb),
        keyRingRepository: new ExpoKeyRingRepository(txDb),
        counterRepository: new ExpoCounterRepository(txDb),
        keysetRepository: new ExpoKeysetRepository(txDb),
        proofRepository: new ExpoProofRepository(txDb),
        mintQuoteRepository: new ExpoMintQuoteRepository(txDb),
        meltQuoteRepository: new ExpoMeltQuoteRepository(txDb),
        historyRepository: new ExpoHistoryRepository(txDb),
        sendOperationRepository: new ExpoSendOperationRepository(txDb),
        meltOperationRepository: new ExpoMeltOperationRepository(txDb),
      };

      return fn(scopedRepositories);
    });
  }
}

export {
  ExpoSqliteDb,
  ensureSchema,
  ensureSchemaUpTo,
  MIGRATIONS,
  ExpoMintRepository,
  ExpoKeyRingRepository,
  ExpoKeysetRepository,
  ExpoCounterRepository,
  ExpoProofRepository,
  ExpoMintQuoteRepository,
  ExpoMeltQuoteRepository,
  ExpoHistoryRepository,
  ExpoSendOperationRepository,
  ExpoMeltOperationRepository,
};

export type { Migration };
