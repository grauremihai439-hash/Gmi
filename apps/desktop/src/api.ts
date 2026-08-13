import type { Conversation, MeResponse, Message } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8787";
const tokenKey = "aifc.session";
let pendingToken: Promise<string> | undefined;

async function token(): Promise<string> {
  const existing = localStorage.getItem(tokenKey);
  if (existing) return existing;
  pendingToken ??= (async () => {
    const response = await fetch(`${API_BASE}/v1/auth/guest`, { method: "POST" });
    if (!response.ok) throw new Error("Could not start a secure session.");
    const data = (await response.json()) as { token: string };
    localStorage.setItem(tokenKey, data.token);
    return data.token;
  })();
  try {
    return await pendingToken;
  } finally {
    pendingToken = undefined;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  retryOnUnauthorized = true,
): Promise<T> {
  const session = await token();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${session}`);
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  if (response.status === 401 && retryOnUnauthorized) {
    localStorage.removeItem(tokenKey);
    return request<T>(path, init, false);
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "The service is temporarily unavailable.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function streamMessage(
  id: string,
  content: string,
  mode: "fast" | "advanced",
  attachment: { name: string; mimeType: string; dataUrl: string; purpose: "analyze" | "edit" } | undefined,
  callbacks: {
    onDelta: (text: string) => void;
    onImage: (imageDataUrl: string) => void;
    onDone: (message: Message) => void;
  },
  retryOnUnauthorized = true,
): Promise<void> {
  const session = await token();
  const response = await fetch(`${API_BASE}/v1/conversations/${id}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session}`,
    },
    body: JSON.stringify({ content, mode, attachment }),
  });
  if (response.status === 401 && retryOnUnauthorized) {
    localStorage.removeItem(tokenKey);
    return streamMessage(id, content, mode, attachment, callbacks, false);
  }
  if (!response.ok || !response.body) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Could not send the message.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const eventName = event.match(/^event: (.+)$/m)?.[1];
      const dataLine = event.match(/^data: (.+)$/m)?.[1];
      if (!eventName || !dataLine) continue;
      const data = JSON.parse(dataLine) as { text?: string; imageDataUrl?: string; message?: Message; error?: string };
      if (eventName === "delta" && data.text) callbacks.onDelta(data.text);
      if (eventName === "image" && data.imageDataUrl) callbacks.onImage(data.imageDataUrl);
      if (eventName === "done" && data.message) callbacks.onDone(data.message);
      if (eventName === "error") throw new Error(data.error ?? "Generation failed.");
    }
    if (done) break;
  }
}

export const api = {
  me: () => request<MeResponse>("/v1/me"),
  storeCollectionsTicket: () =>
    request<{ serviceTicket: string; publisherUserId: string }>(
      "/v1/store/collections-ticket",
    ),
  verifyStoreSubscription: (storeIdKey: string) =>
    request<MeResponse>("/v1/store/verify", {
      method: "POST",
      body: JSON.stringify({ storeIdKey }),
    }),
  conversations: () =>
    request<{ conversations: Conversation[] }>("/v1/conversations"),
  createConversation: () =>
    request<{ conversation: Conversation }>("/v1/conversations", { method: "POST" }),
  messages: (id: string) =>
    request<{ messages: Message[] }>(`/v1/conversations/${id}/messages`),
  deleteConversation: (id: string) =>
    request<void>(`/v1/conversations/${id}`, { method: "DELETE" }),
  reportMessage: (messageId: string, reason: string) =>
    request<{ accepted: boolean }>("/v1/reports", {
      method: "POST",
      body: JSON.stringify({ messageId, reason }),
    }),
  streamMessage,
};
