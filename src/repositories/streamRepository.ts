import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../db/index";
import { streams, Stream } from "../db/schema";

export interface FindAllParams {
  payer?: string;
  recipient?: string;
  status?: "active" | "paused" | "cancelled" | "completed";
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
}

export class StreamRepository {
  async findById(id: string, includeDeleted = false): Promise<(Stream & { accruedEstimate: string }) | null> {
    const conditions = [eq(streams.id, id)];
    if (!includeDeleted) conditions.push(sql`${streams.deletedAt} IS NULL`);

    const [result] = await db
      .select()
      .from(streams)
      .where(and(...conditions))
      .limit(1);

    if (!result) return null;

    const accruedEstimate = this.calculateAccruedEstimate(result);

    return {
      ...result,
      accruedEstimate: accruedEstimate.toString(),
    };
  }

  async findAll(params: FindAllParams) {
    const limit = Math.min(params.limit ?? 20, 100);
    const offset = params.offset ?? 0;

    const conditions = [];
    if (params.payer) conditions.push(eq(streams.payer, params.payer));
    if (params.recipient) conditions.push(eq(streams.recipient, params.recipient));
    if (params.status) conditions.push(eq(streams.status, params.status));

    if (!params.includeDeleted) {
      conditions.push(sql`${streams.deletedAt} IS NULL`);
    }

    const query = db
      .select()
      .from(streams)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(streams.createdAt))
      .limit(limit)
      .offset(offset);

    const data = await query;
    
    // For total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(streams)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      streams: data,
      total: Number(countResult.count),
      limit,
      offset,
    };
  }

  async softDeleteById(id: string): Promise<boolean> {
    const result = await db
      .update(streams)
      .set({ deletedAt: new Date() })
      .where(eq(streams.id, id));

    if (typeof result === "number") {
      return result > 0;
    }

    return (result as { rowCount?: number }).rowCount ? (result as { rowCount: number }).rowCount > 0 : false;
  }

  private calculateAccruedEstimate(stream: Stream): number {
    if (stream.status !== "active") return 0;

    const now = new Date();
    const startTime = new Date(stream.lastSettledAt);
    const endTime = stream.endTime ? new Date(stream.endTime) : null;
    
    const effectiveNow = endTime && now > endTime ? endTime : now;
    
    const elapsedSeconds = Math.max(0, (effectiveNow.getTime() - startTime.getTime()) / 1000);
    const rate = parseFloat(stream.ratePerSecond);
    
    return elapsedSeconds * rate;
  }
}
