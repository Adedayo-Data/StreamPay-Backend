import crypto from "crypto";

export type IndexerEventPayload = {
  eventId: string;
  eventType: string;
  streamId: string;
  occurredAt: string;
  chainId?: string;
  transactionHash?: string;
  data?: Record<string, unknown>;
};

export type IngestionSuccessResult = {
  accepted: true;
  duplicate: boolean;
  event: IndexerEventPayload;
};

export type IngestionFailureCode =
  | "missing_secret"
  | "invalid_signature"
  | "invalid_json"
  | "invalid_payload";

export type IngestionFailureResult = {
  accepted: false;
  code: IngestionFailureCode;
  message: string;
};

export type IngestionResult = IngestionSuccessResult | IngestionFailureResult;

const SIGNATURE_PREFIX = "sha256=";

export class EventIngestionService {
  private readonly processedEventIds = new Set<string>();

  ingest(rawBody: Buffer, signatureHeader: string | undefined): IngestionResult {
    const secret = process.env.INDEXER_WEBHOOK_SECRET;

    if (!secret) {
      return {
        accepted: false,
        code: "missing_secret",
        message: "Indexer webhook secret is not configured.",
      };
    }

    if (!signatureHeader || !this.isValidSignature(rawBody, signatureHeader, secret)) {
      return {
        accepted: false,
        code: "invalid_signature",
        message: "Webhook signature verification failed.",
      };
    }

    let payload: unknown;

    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return {
        accepted: false,
        code: "invalid_json",
        message: "Webhook payload must be valid JSON.",
      };
    }

    const event = this.parsePayload(payload);
    if (!event) {
      return {
        accepted: false,
        code: "invalid_payload",
        message: "Webhook payload is missing one or more required fields.",
      };
    }

    if (this.processedEventIds.has(event.eventId)) {
      return {
        accepted: true,
        duplicate: true,
        event,
      };
    }

    this.processedEventIds.add(event.eventId);

    return {
      accepted: true,
      duplicate: false,
      event,
    };
  }

  reset(): void {
    this.processedEventIds.clear();
  }

  private isValidSignature(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
    const incomingSignature = signatureHeader.startsWith(SIGNATURE_PREFIX)
      ? signatureHeader.slice(SIGNATURE_PREFIX.length)
      : signatureHeader;

    const expectedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const expected = Buffer.from(expectedSignature, "hex");
    const received = Buffer.from(incomingSignature, "hex");

    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
  }

  private parsePayload(payload: unknown): IndexerEventPayload | null {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const candidate = payload as Record<string, unknown>;
    const requiredKeys = ["eventId", "eventType", "streamId", "occurredAt"] as const;
    const hasRequiredStrings = requiredKeys.every((key) => typeof candidate[key] === "string" && candidate[key]);

    if (!hasRequiredStrings) {
      return null;
    }

    return {
      eventId: candidate.eventId as string,
      eventType: candidate.eventType as string,
      streamId: candidate.streamId as string,
      occurredAt: candidate.occurredAt as string,
      chainId: typeof candidate.chainId === "string" ? candidate.chainId : undefined,
      transactionHash: typeof candidate.transactionHash === "string" ? candidate.transactionHash : undefined,
      data: this.isRecord(candidate.data) ? candidate.data : undefined,
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}

export const eventIngestionService = new EventIngestionService();
