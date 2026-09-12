import { ExpoSqliteDb, getUnixTimeSeconds } from '../db';
import { MintRecommendation } from '../../../services/mintRecommendationService';

export class ExpoMintRecommendationRepository {
  private readonly db: ExpoSqliteDb;

  constructor(db: ExpoSqliteDb) {
    this.db = db;
  }

  async getAll(): Promise<MintRecommendation[]> {
    const rows = await this.db.all<any>(
      'SELECT * FROM coco_cashu_mint_recommendations ORDER BY reviewsCount DESC',
    );
    return rows.map((row) => ({
      url: row.url,
      name: row.name,
      description: row.description,
      icon: row.icon,
      reviewsCount: row.reviewsCount,
      averageRating: row.averageRating,
    }));
  }

  async saveAll(recommendations: MintRecommendation[]): Promise<void> {
    const now = getUnixTimeSeconds();
    await this.db.transaction(async (tx) => {
      // For discovery, we usually refresh the whole list
      // Optionally clear old ones or just upsert
      for (const rec of recommendations) {
        await tx.run(
          `INSERT OR REPLACE INTO coco_cashu_mint_recommendations 
                    (url, name, description, icon, reviewsCount, averageRating, updatedAt) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            rec.url,
            rec.name || null,
            rec.description || null,
            rec.icon || null,
            rec.reviewsCount,
            rec.averageRating || null,
            now,
          ],
        );
      }
    });
  }

  async deleteAll(): Promise<void> {
    await this.db.run('DELETE FROM coco_cashu_mint_recommendations');
  }
}
