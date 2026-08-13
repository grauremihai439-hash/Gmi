import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { JSONFilePreset } from "lowdb/node";
import { config } from "./config.js";

export type PlanId = "free" | "monthly" | "annual";
export type SubscriptionStatus = "active" | "trial" | "expired";
export type AiMode = "fast" | "advanced";

export interface User {
  id: string;
  createdAt: string;
  subscription: {
    plan: PlanId;
    status: SubscriptionStatus;
    periodStartedAt: string;
    periodEndsAt: string;
  };
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  imageDataUrl?: string;
  createdAt: string;
}

interface UsageRecord {
  userId: string;
  period: string;
  messages: number;
  inputTokens: number;
  outputTokens: number;
}

interface AppData {
  users: User[];
  conversations: Conversation[];
  messages: Message[];
  usage: UsageRecord[];
}

const defaults: AppData = {
  users: [],
  conversations: [],
  messages: [],
  usage: [],
};

await mkdir(config.dataDir, { recursive: true });
export const db = await JSONFilePreset<AppData>(
  join(config.dataDir, "app.json"),
  defaults,
);

export function currentMonth(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function usagePeriod(plan: PlanId, date = new Date()): string {
  const month = currentMonth(date);
  return plan === "free"
    ? `${month}-${String(date.getUTCDate()).padStart(2, "0")}`
    : month;
}

export async function recordUsage(
  userId: string,
  plan: PlanId,
  inputTokens = 0,
  outputTokens = 0,
): Promise<void> {
  const period = usagePeriod(plan);
  let usage = db.data.usage.find(
    (item) => item.userId === userId && item.period === period,
  );

  if (!usage) {
    usage = { userId, period, messages: 0, inputTokens: 0, outputTokens: 0 };
    db.data.usage.push(usage);
  }

  usage.messages += 1;
  usage.inputTokens += inputTokens;
  usage.outputTokens += outputTokens;
  await db.write();
}

export function getUsage(userId: string, plan: PlanId): UsageRecord {
  const period = usagePeriod(plan);
  return (
    db.data.usage.find(
      (item) => item.userId === userId && item.period === period,
    ) ?? {
      userId,
      period,
      messages: 0,
      inputTokens: 0,
      outputTokens: 0,
    }
  );
}
