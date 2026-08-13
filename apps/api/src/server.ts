import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";
import { createSessionToken, newUserId, userIdFromRequest } from "./auth.js";
import { config, plans } from "./config.js";
import { db, getUsage, recordUsage, type AiMode, type Conversation, type User } from "./data.js";
import { streamAssistantResponse } from "./openai.js";
import {
  getCollectionsServiceTicket,
  verifyStoreSubscription,
} from "./microsoft-store.js";

const app = Fastify({ logger: true, bodyLimit: 8 * 1024 * 1024 });
await app.register(cors, { origin: config.origins });

function requireUser(request: Parameters<typeof userIdFromRequest>[0]): User | null {
  const id = userIdFromRequest(request);
  return id ? db.data.users.find((user) => user.id === id) ?? null : null;
}

function subscriptionIsValid(user: User): boolean {
  if (user.subscription.plan === "free") return true;
  return (
    (user.subscription.status === "trial" || user.subscription.status === "active") &&
    new Date(user.subscription.periodEndsAt).getTime() > Date.now()
  );
}

app.get("/health", async () => ({
  ok: true,
  models: {
    fast: config.fastModel,
    advanced: config.advancedModel,
    image: config.imageModel,
  },
}));

app.post("/v1/auth/guest", async () => {
  const id = newUserId();
  const now = new Date();
  const user: User = {
    id,
    createdAt: now.toISOString(),
    subscription: {
      plan: "free",
      status: "active",
      periodStartedAt: now.toISOString(),
      periodEndsAt: "9999-12-31T23:59:59.999Z",
    },
  };
  db.data.users.push(user);
  await db.write();
  return { token: createSessionToken(id), user };
});

app.get("/v1/me", async (request, reply) => {
  const user = requireUser(request);
  if (!user) return reply.code(401).send({ error: "Unauthorized" });
  const usage = getUsage(user.id, user.subscription.plan);
  const plan = plans[user.subscription.plan];
  return { user, usage, plan };
});

app.get("/v1/plans", async () => ({ plans: Object.values(plans) }));

app.get("/v1/store/collections-ticket", async (request, reply) => {
  const user = requireUser(request);
  if (!user) return reply.code(401).send({ error: "Unauthorized" });
  try {
    return {
      serviceTicket: await getCollectionsServiceTicket(),
      publisherUserId: user.id,
    };
  } catch (error) {
    request.log.error(error);
    return reply.code(503).send({ error: "Microsoft Store verification is unavailable." });
  }
});

app.post("/v1/store/verify", async (request, reply) => {
  const user = requireUser(request);
  if (!user) return reply.code(401).send({ error: "Unauthorized" });
  const parsed = z
    .object({ storeIdKey: z.string().trim().min(100).max(20_000) })
    .safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid Store identity key." });

  try {
    const subscription = await verifyStoreSubscription(parsed.data.storeIdKey, user.id);
    user.subscription = subscription ?? {
      plan: "free",
      status: "active",
      periodStartedAt: new Date().toISOString(),
      periodEndsAt: "9999-12-31T23:59:59.999Z",
    };
    await db.write();
    return {
      user,
      usage: getUsage(user.id, user.subscription.plan),
      plan: plans[user.subscription.plan],
    };
  } catch (error) {
    request.log.error(error);
    return reply.code(503).send({ error: "Microsoft Store verification is unavailable." });
  }
});

app.get("/v1/conversations", async (request, reply) => {
  const user = requireUser(request);
  if (!user) return reply.code(401).send({ error: "Unauthorized" });
  return {
    conversations: db.data.conversations
      .filter((conversation) => conversation.userId === user.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  };
});

app.post("/v1/conversations", async (request, reply) => {
  const user = requireUser(request);
  if (!user) return reply.code(401).send({ error: "Unauthorized" });
  const now = new Date().toISOString();
  const conversation: Conversation = {
    id: randomUUID(),
    userId: user.id,
    title: "New conversation",
    createdAt: now,
    updatedAt: now,
  };
  db.data.conversations.push(conversation);
  await db.write();
  return reply.code(201).send({ conversation });
});

app.get("/v1/conversations/:id/messages", async (request, reply) => {
  const user = requireUser(request);
  if (!user) return reply.code(401).send({ error: "Unauthorized" });
  const id = (request.params as { id: string }).id;
  const conversation = db.data.conversations.find(
    (item) => item.id === id && item.userId === user.id,
  );
  if (!conversation) return reply.code(404).send({ error: "Not found" });
  return {
    messages: db.data.messages.filter((message) => message.conversationId === id),
  };
});

app.delete("/v1/conversations/:id", async (request, reply) => {
  const user = requireUser(request);
  if (!user) return reply.code(401).send({ error: "Unauthorized" });
  const id = (request.params as { id: string }).id;
  const index = db.data.conversations.findIndex(
    (item) => item.id === id && item.userId === user.id,
  );
  if (index < 0) return reply.code(404).send({ error: "Not found" });
  db.data.conversations.splice(index, 1);
  db.data.messages = db.data.messages.filter(
    (message) => message.conversationId !== id,
  );
  await db.write();
  return reply.code(204).send();
});

const messageBody = z.object({
  content: z.string().trim().max(30_000),
  mode: z.enum(["fast", "advanced"]).default("fast"),
  attachment: z.object({
    name: z.string().trim().min(1).max(160),
    mimeType: z.enum([
      "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf",
      "text/plain", "text/markdown", "text/csv",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]),
    dataUrl: z.string().max(7_500_000).refine(
      (value) => /^data:[^;]+;base64,[A-Za-z0-9+/=]+$/.test(value),
    ),
    purpose: z.enum(["analyze", "edit"]).default("analyze"),
  }).optional(),
}).refine((value) => value.content.length > 0 || value.attachment, {
  message: "A message or attachment is required",
});

app.post("/v1/conversations/:id/messages", async (request, reply) => {
  const user = requireUser(request);
  if (!user) return reply.code(401).send({ error: "Unauthorized" });
  if (!subscriptionIsValid(user)) {
    return reply.code(402).send({ error: "An active subscription is required" });
  }
  const plan = plans[user.subscription.plan];
  const usage = getUsage(user.id, user.subscription.plan);
  if (usage.messages >= plan.messageLimit) {
    return reply.code(429).send({
      error: user.subscription.plan === "free"
        ? "Daily free question limit reached. Upgrade to continue."
        : "Monthly message limit reached",
    });
  }

  const parsed = messageBody.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid message" });
  if (!(plan.allowedModes as readonly string[]).includes(parsed.data.mode)) {
    return reply.code(403).send({ error: "Upgrade to use Advanced mode." });
  }
  if (parsed.data.attachment && user.subscription.plan === "free") {
    return reply.code(403).send({ error: "Upgrade to attach images and documents." });
  }
  if (parsed.data.attachment?.purpose === "edit" && !parsed.data.attachment.mimeType.startsWith("image/")) {
    return reply.code(400).send({ error: "Only images can use image editing mode." });
  }
  const id = (request.params as { id: string }).id;
  const conversation = db.data.conversations.find(
    (item) => item.id === id && item.userId === user.id,
  );
  if (!conversation) return reply.code(404).send({ error: "Not found" });

  const now = new Date().toISOString();
  const storedContent = parsed.data.attachment
    ? `${parsed.data.content || "Please analyze this attachment."}\n\n📎 ${parsed.data.attachment.name}`
    : parsed.data.content;
  const userMessage = {
    id: randomUUID(),
    conversationId: id,
    role: "user" as const,
    content: storedContent,
    createdAt: now,
  };
  db.data.messages.push(userMessage);
  conversation.updatedAt = now;
  if (conversation.title === "New conversation") {
    conversation.title = (parsed.data.content || parsed.data.attachment?.name || "New conversation").slice(0, 52);
  }
  await db.write();

  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": request.headers.origin && config.origins.includes(request.headers.origin)
      ? request.headers.origin
      : config.origins[0],
    Vary: "Origin",
  });

  try {
    const history = db.data.messages.filter((message) => message.conversationId === id);
    const result = await streamAssistantResponse(
      history,
      parsed.data.mode as AiMode,
      (delta) => {
        reply.raw.write(`event: delta\ndata: ${JSON.stringify({ text: delta })}\n\n`);
      },
      parsed.data.attachment,
    );
    const assistantMessage = {
      id: randomUUID(),
      conversationId: id,
      role: "assistant" as const,
      content: result.text,
      imageDataUrl: result.imageDataUrl,
      createdAt: new Date().toISOString(),
    };
    db.data.messages.push(assistantMessage);
    conversation.updatedAt = assistantMessage.createdAt;
    await db.write();
    await recordUsage(user.id, user.subscription.plan, result.inputTokens, result.outputTokens);
    if (result.imageDataUrl) {
      reply.raw.write(`event: image\ndata: ${JSON.stringify({ imageDataUrl: result.imageDataUrl })}\n\n`);
    }
    reply.raw.write(`event: done\ndata: ${JSON.stringify({ message: assistantMessage })}\n\n`);
  } catch (error) {
    request.log.error(error);
    reply.raw.write(
      `event: error\ndata: ${JSON.stringify({ error: "The AI service could not complete this request." })}\n\n`,
    );
  } finally {
    reply.raw.end();
  }
});

app.post("/v1/reports", async (request, reply) => {
  const user = requireUser(request);
  if (!user) return reply.code(401).send({ error: "Unauthorized" });
  const body = z
    .object({ messageId: z.string().uuid(), reason: z.string().min(3).max(1000) })
    .safeParse(request.body);
  if (!body.success) return reply.code(400).send({ error: "Invalid report" });
  request.log.warn({ userId: user.id, ...body.data }, "Content report received");
  return reply.code(202).send({ accepted: true });
});

await app.listen({ port: config.port, host: config.host });
