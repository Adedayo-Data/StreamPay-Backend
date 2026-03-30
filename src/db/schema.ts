import { pgTable, uuid, varchar, timestamp, decimal, pgEnum, integer, text, boolean } from "drizzle-orm/pg-core";

export const streamStatusEnum = pgEnum("stream_status", ["active", "paused", "cancelled", "completed"]);

export const streams = pgTable("streams", {
  id: uuid("id").primaryKey().defaultRandom(),
  payer: varchar("payer", { length: 255 }).notNull(),
  recipient: varchar("recipient", { length: 255 }).notNull(),
  status: streamStatusEnum("status").notNull().default("active"),
  ratePerSecond: decimal("rate_per_second", { precision: 20, scale: 9 }).notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  totalAmount: decimal("total_amount", { precision: 20, scale: 9 }).notNull(),
  lastSettledAt: timestamp("last_settled_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Stream = typeof streams.$inferSelect;
export type NewStream = typeof streams.$inferInsert;

// ---------------------------------------------------------------------------
// Outbound webhook subscriptions
// ---------------------------------------------------------------------------

export const webhookEventTypeEnum = pgEnum("webhook_event_type", [
  "stream_created",
  "stream_cancelled",
  "stream_completed",
  "stream_paused",
  "settled",
]);

export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", [
  "pending",
  "success",
  "failed",
]);

export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Caller-supplied URL to POST events to. */
  url: varchar("url", { length: 2048 }).notNull(),
  /** HMAC-SHA256 signing secret — stored hashed, never returned in API responses. */
  secret: varchar("secret", { length: 255 }).notNull(),
  /** Comma-separated list of event types to deliver; empty = all events. */
  eventTypes: text("event_types").notNull().default(""),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => webhookSubscriptions.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  payload: text("payload").notNull(),
  status: webhookDeliveryStatusEnum("status").notNull().default("pending"),
  /** Number of delivery attempts made so far. */
  attempts: integer("attempts").notNull().default(0),
  /** Timestamp of the next scheduled attempt (null = ready immediately). */
  nextAttemptAt: timestamp("next_attempt_at").defaultNow(),
  /** HTTP status code from the last attempt, if any. */
  lastHttpStatus: integer("last_http_status"),
  /** Error message from the last attempt, if any. */
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;
export type NewWebhookSubscription = typeof webhookSubscriptions.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
