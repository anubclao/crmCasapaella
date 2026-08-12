/**
 * Drizzle ORM schema — Casa Paella CRM.
 * Source of truth for the MySQL schema. Run `npm run db:generate` to produce
 * the SQL migration in drizzle/0000_*.sql.
 *
 * For the MySQL dialect, drizzle-kit will emit `--> statement-breakpoint`
 * comments between statements. Those BREAK plain `mysql` CLI imports because
 * `-->` isn't a valid MySQL comment (needs `-- ` with a space). Strip them
 * with `npm run db:strip` before importing via phpMyAdmin or `mysql` CLI.
 */
import {
  mysqlTable,
  int,
  varchar,
  datetime,
  decimal,
  json,
  text,
  mysqlEnum,
  primaryKey,
  index,
  uniqueIndex,
  timestamp,
} from "drizzle-orm/mysql-core";
import { relations, sql } from "drizzle-orm";

// ── Users (CRM staff) ────────────────────────────────────────────────────
export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    role: mysqlEnum("role", ["admin", "manager", "staff"])
      .notNull()
      .default("staff"),
    isActive: int("is_active").notNull().default(1), // 1 = active, 0 = disabled
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  }),
);

// ── Customers (leads + active clients) ────────────────────────────────────
export const customers = mysqlTable(
  "customers",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 30 }).notNull(), // E.164: +57XXXXXXXXXX
    email: varchar("email", { length: 255 }),
    source: mysqlEnum("source", [
      "web_reservation",
      "web_order",
      "manual",
      "import",
      "whatsapp_inbound",
    ])
      .notNull()
      .default("manual"),
    totalReservations: int("total_reservations").notNull().default(0),
    totalOrders: int("total_orders").notNull().default(0),
    totalSpent: decimal("total_spent", { precision: 10, scale: 2 })
      .notNull()
      .default("0.00"),
    lastActivityAt: datetime("last_activity_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    phoneIdx: uniqueIndex("customers_phone_idx").on(t.phone),
    emailIdx: index("customers_email_idx").on(t.email),
    lastActivityIdx: index("customers_last_activity_idx").on(t.lastActivityAt),
  }),
);

// ── Tags (master list) ───────────────────────────────────────────────────
export const tags = mysqlTable(
  "tags",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    color: varchar("color", { length: 7 }).default("#C1272D"), // granate by default
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    nameIdx: uniqueIndex("tags_name_idx").on(t.name),
  }),
);

// ── Customer ↔ Tag (M2M) ──────────────────────────────────────────────────
export const customerTags = mysqlTable(
  "customer_tags",
  {
    customerId: int("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    tagId: int("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.customerId, t.tagId] }),
    tagIdx: index("customer_tags_tag_idx").on(t.tagId),
  }),
);

// ── Reservations ──────────────────────────────────────────────────────────
export const reservations = mysqlTable(
  "reservations",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    reservationDate: datetime("reservation_date").notNull(),
    guests: int("guests").notNull().default(2),
    status: mysqlEnum("status", [
      "pending",
      "confirmed",
      "cancelled",
      "completed",
      "no_show",
    ])
      .notNull()
      .default("pending"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    dateIdx: index("reservations_date_idx").on(t.reservationDate),
    customerIdx: index("reservations_customer_idx").on(t.customerId),
    statusIdx: index("reservations_status_idx").on(t.status),
  }),
);

// ── Orders ────────────────────────────────────────────────────────────────
export const orders = mysqlTable(
  "orders",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    orderType: mysqlEnum("order_type", ["delivery", "pickup", "dine_in"])
      .notNull()
      .default("delivery"),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 })
      .notNull()
      .default("0.00"),
    status: mysqlEnum("status", [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "delivered",
      "cancelled",
    ])
      .notNull()
      .default("pending"),
    items:
      json("items").$type<
        Array<{ name: string; qty: number; price: number }>
      >(),
    deliveryAddress: text("delivery_address"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    customerIdx: index("orders_customer_idx").on(t.customerId),
    statusIdx: index("orders_status_idx").on(t.status),
    createdIdx: index("orders_created_idx").on(t.createdAt),
  }),
);

// ── Campaigns ─────────────────────────────────────────────────────────────
export const campaigns = mysqlTable(
  "campaigns",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    targetType: mysqlEnum("target_type", ["all", "tag", "inactive_days"])
      .notNull()
      .default("all"),
    targetValue: varchar("target_value", { length: 255 }), // tag name OR days number
    templateName: varchar("template_name", { length: 100 }),
    status: mysqlEnum("status", [
      "draft",
      "scheduled",
      "sending",
      "sent",
      "cancelled",
    ])
      .notNull()
      .default("draft"),
    scheduledAt: datetime("scheduled_at"),
    sentAt: datetime("sent_at"),
    recipientsCount: int("recipients_count").notNull().default(0),
    deliveredCount: int("delivered_count").notNull().default(0),
    failedCount: int("failed_count").notNull().default(0),
    createdBy: int("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    statusIdx: index("campaigns_status_idx").on(t.status),
    scheduledIdx: index("campaigns_scheduled_idx").on(t.scheduledAt),
  }),
);

// ── Message templates (versioned, with Meta Cloud mapping) ────────────────
export const messageTemplates = mysqlTable(
  "message_templates",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    category: mysqlEnum("category", ["transactional", "marketing", "utility"])
      .notNull()
      .default("transactional"),
    language: varchar("language", { length: 10 }).notNull().default("es"),
    body: text("body").notNull(),
    variables: json("variables").$type<string[]>(),
    metaTemplateId: varchar("meta_template_id", { length: 255 }),
    metaStatus: mysqlEnum("meta_status", [
      "draft",
      "pending",
      "approved",
      "rejected",
    ])
      .notNull()
      .default("draft"),
    isActive: int("is_active").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    nameIdx: uniqueIndex("message_templates_name_idx").on(t.name),
  }),
);

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type NewMessageTemplate = typeof messageTemplates.$inferInsert;

// ── Messages log ──────────────────────────────────────────────────────────
export const messages = mysqlTable(
  "messages",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    campaignId: int("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    direction: mysqlEnum("direction", ["outbound", "inbound"]).notNull(),
    channel: mysqlEnum("channel", ["whatsapp", "sms", "email"])
      .notNull()
      .default("whatsapp"),
    templateName: varchar("template_name", { length: 100 }),
    body: text("body").notNull(),
    status: mysqlEnum("status", [
      "queued",
      "sent",
      "delivered",
      "read",
      "failed",
    ])
      .notNull()
      .default("queued"),
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    error: text("error"),
    sentAt: datetime("sent_at"),
    deliveredAt: datetime("delivered_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    customerIdx: index("messages_customer_idx").on(t.customerId),
    campaignIdx: index("messages_campaign_idx").on(t.campaignId),
    statusIdx: index("messages_status_idx").on(t.status),
    createdIdx: index("messages_created_idx").on(t.createdAt),
  }),
);

// ── Relations (Drizzle query API) ─────────────────────────────────────────
export const customersRelations = relations(customers, ({ many }) => ({
  reservations: many(reservations),
  orders: many(orders),
  tags: many(customerTags),
  messages: many(messages),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  customers: many(customerTags),
}));

export const customerTagsRelations = relations(customerTags, ({ one }) => ({
  customer: one(customers, {
    fields: [customerTags.customerId],
    references: [customers.id],
  }),
  tag: one(tags, {
    fields: [customerTags.tagId],
    references: [tags.id],
  }),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  customer: one(customers, {
    fields: [reservations.customerId],
    references: [customers.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  creator: one(users, {
    fields: [campaigns.createdBy],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  customer: one(customers, {
    fields: [messages.customerId],
    references: [customers.id],
  }),
  campaign: one(campaigns, {
    fields: [messages.campaignId],
    references: [campaigns.id],
  }),
}));

// ── Convenience types ─────────────────────────────────────────────────────
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type User = typeof users.$inferSelect;
export type Tag = typeof tags.$inferSelect;
