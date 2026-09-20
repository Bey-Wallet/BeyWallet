import type { MintRepository, Mint } from 'coco-cashu-core';
import { ExpoSqliteDb } from '~/storage/sqlite/db';

export class ExpoMintRepository implements MintRepository {
  private readonly db: ExpoSqliteDb;

  constructor(db: ExpoSqliteDb) {
    this.db = db;
  }

  async isTrustedMint(mintUrl: string): Promise<boolean> {
    const row = await this.db.get<{ trusted: number }>(
      'SELECT trusted FROM coco_cashu_mints WHERE mintUrl = ? LIMIT 1',
      [mintUrl],
    );
    return row?.trusted === 1;
  }

  async getMintByUrl(mintUrl: string): Promise<Mint> {
    const row = await this.db.get<{
      mintUrl: string;
      name: string;
      nickname: string | null;
      mintInfo: string;
      trusted: number;
      createdAt: number;
      updatedAt: number;
    }>(
      'SELECT mintUrl, name, nickname, mintInfo, trusted, createdAt, updatedAt FROM coco_cashu_mints WHERE mintUrl = ? LIMIT 1',
      [mintUrl],
    );
    if (!row) {
      throw new Error(`Mint not found: ${mintUrl}`);
    }
    return {
      mintUrl: row.mintUrl,
      name: row.name,
      nickname: row.nickname,
      mintInfo: JSON.parse(row.mintInfo),
      trusted: row.trusted === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } as any;
  }

  async getAllMints(): Promise<Mint[]> {
    const rows = await this.db.all<{
      mintUrl: string;
      name: string;
      nickname: string | null;
      mintInfo: string;
      trusted: number;
      createdAt: number;
      updatedAt: number;
    }>(
      'SELECT mintUrl, name, nickname, mintInfo, trusted, createdAt, updatedAt FROM coco_cashu_mints',
    );
    return rows.map(
      (r) =>
        ({
          mintUrl: r.mintUrl,
          name: r.name,
          nickname: r.nickname,
          mintInfo: JSON.parse(r.mintInfo),
          trusted: r.trusted === 1,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }) as any,
    );
  }

  async getAllTrustedMints(): Promise<Mint[]> {
    const rows = await this.db.all<{
      mintUrl: string;
      name: string;
      nickname: string | null;
      mintInfo: string;
      trusted: number;
      createdAt: number;
      updatedAt: number;
    }>(
      'SELECT mintUrl, name, nickname, mintInfo, trusted, createdAt, updatedAt FROM coco_cashu_mints WHERE trusted = 1',
    );
    return rows.map(
      (r) =>
        ({
          mintUrl: r.mintUrl,
          name: r.name,
          nickname: r.nickname,
          mintInfo: JSON.parse(r.mintInfo),
          trusted: r.trusted === 1,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }) as any,
    );
  }

  async addNewMint(mint: Mint): Promise<void> {
    await this.db.run(
      `INSERT INTO coco_cashu_mints (mintUrl, name, mintInfo, trusted, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(mintUrl) DO UPDATE SET
         name=excluded.name,
         mintInfo=excluded.mintInfo,
         trusted=excluded.trusted,
         createdAt=excluded.createdAt,
         updatedAt=excluded.updatedAt`,
      [
        mint.mintUrl,
        mint.name,
        JSON.stringify(mint.mintInfo),
        mint.trusted ? 1 : 0,
        mint.createdAt,
        mint.updatedAt,
      ],
    );
  }

  async addOrUpdateMint(mint: Mint): Promise<void> {
    await this.db.run(
      `INSERT INTO coco_cashu_mints (mintUrl, name, mintInfo, trusted, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(mintUrl) DO UPDATE SET
         name=excluded.name,
         mintInfo=excluded.mintInfo,
         trusted=excluded.trusted,
         updatedAt=excluded.updatedAt`,
      [
        mint.mintUrl,
        mint.name,
        JSON.stringify(mint.mintInfo),
        mint.trusted ? 1 : 0,
        mint.createdAt,
        mint.updatedAt,
      ],
    );
  }

  async updateMint(mint: Mint): Promise<void> {
    await this.addNewMint(mint);
  }

  async setMintTrusted(mintUrl: string, trusted: boolean): Promise<void> {
    await this.db.run('UPDATE coco_cashu_mints SET trusted = ? WHERE mintUrl = ?', [
      trusted ? 1 : 0,
      mintUrl,
    ]);
  }

  async setMintNickname(mintUrl: string, nickname: string | null): Promise<void> {
    await this.db.run('UPDATE coco_cashu_mints SET nickname = ? WHERE mintUrl = ?', [
      nickname,
      mintUrl,
    ]);
  }

  async deleteMint(mintUrl: string): Promise<void> {
    await this.db.run('DELETE FROM coco_cashu_mints WHERE mintUrl = ?', [mintUrl]);
  }
}
