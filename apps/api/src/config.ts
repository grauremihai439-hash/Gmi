import "dotenv/config";
import { resolve } from "node:path";

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  port: positiveInt(process.env.PORT, 8787),
  host: process.env.HOST ?? "127.0.0.1",
  origins: (process.env.APP_ORIGIN ?? "http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  dataDir: resolve(process.env.DATA_DIR ?? "./data"),
  jwtSecret:
    process.env.JWT_SECRET ?? "local-development-secret-change-before-deploying",
  openAiKey: process.env.OPENAI_API_KEY,
  fastModel: process.env.OPENAI_FAST_MODEL ?? "gpt-5.6-luna",
  advancedModel: process.env.OPENAI_ADVANCED_MODEL ?? "gpt-5.6-terra",
  imageModel: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
  freeDailyMessageLimit: positiveInt(process.env.FREE_DAILY_MESSAGE_LIMIT, 5),
  monthlyMessageLimit: positiveInt(process.env.MONTHLY_MESSAGE_LIMIT, 1000),
  annualMessageLimit: positiveInt(process.env.ANNUAL_MESSAGE_LIMIT, 1000),
} as const;

if (process.env.NODE_ENV === "production") {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required in production.");
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters in production.");
  }
}

export const plans = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    trialDays: 0,
    messageLimit: config.freeDailyMessageLimit,
    limitPeriod: "day",
    allowedModes: ["fast"],
  },
  monthly: {
    id: "monthly",
    name: "Monthly",
    priceUsd: 14.99,
    trialDays: 7,
    messageLimit: config.monthlyMessageLimit,
    limitPeriod: "month",
    allowedModes: ["fast", "advanced"],
  },
  annual: {
    id: "annual",
    name: "Annual",
    priceUsd: 79.99,
    trialDays: 0,
    messageLimit: config.annualMessageLimit,
    limitPeriod: "month",
    allowedModes: ["fast", "advanced"],
  },
} as const;
