export interface Conversation {
  id: string;
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

export interface MeResponse {
  user: {
    id: string;
    subscription: {
      plan: "free" | "monthly" | "annual";
      status: "trial" | "active" | "expired";
      periodEndsAt: string;
    };
  };
  usage: { messages: number };
  plan: {
    id: "free" | "monthly" | "annual";
    name: string;
    priceUsd: number;
    messageLimit: number;
    limitPeriod: "day" | "month";
    allowedModes: Array<"fast" | "advanced">;
  };
}
