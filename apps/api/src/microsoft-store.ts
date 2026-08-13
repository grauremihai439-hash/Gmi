import { config } from "./config.js";
import type { PlanId, SubscriptionStatus } from "./data.js";

const TOKEN_ENDPOINT = `https://login.microsoftonline.com/${encodeURIComponent(
  config.microsoftTenantId ?? "",
)}/oauth2/token`;
const COLLECTIONS_TICKET_RESOURCE =
  "https://onestore.microsoft.com/b2b/keys/create/collections";
const ONESTORE_RESOURCE = "https://onestore.microsoft.com";
const COLLECTIONS_QUERY_URL =
  "https://collections.mp.microsoft.com/v6.0/collections/query";

type CachedToken = { value: string; expiresAt: number };
const tokenCache = new Map<string, CachedToken>();

type CollectionItem = {
  endDate?: string;
  inAppOfferToken?: string;
  localTicketReference?: string;
  productId?: string;
  purchaser?: { identityValue?: string };
  skuType?: string;
  startDate?: string;
  status?: string;
};

export type VerifiedStoreSubscription = {
  plan: Exclude<PlanId, "free">;
  status: Extract<SubscriptionStatus, "active" | "trial">;
  periodStartedAt: string;
  periodEndsAt: string;
};

async function getPublisherToken(resource: string): Promise<string> {
  const cached = tokenCache.get(resource);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;
  if (
    !config.microsoftTenantId ||
    !config.microsoftClientId ||
    !config.microsoftClientSecret
  ) {
    throw new Error("Microsoft Store entitlement verification is not configured.");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.microsoftClientId,
    client_secret: config.microsoftClientSecret,
    resource,
  });
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json().catch(() => null)) as
    | { access_token?: string; expires_in?: string | number }
    | null;
  if (!response.ok || !payload?.access_token) {
    throw new Error("Microsoft publisher authentication failed.");
  }

  const expiresInSeconds = Number(payload.expires_in ?? 3600);
  tokenCache.set(resource, {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(300, expiresInSeconds) * 1000,
  });
  return payload.access_token;
}

export function getCollectionsServiceTicket(): Promise<string> {
  return getPublisherToken(COLLECTIONS_TICKET_RESOURCE);
}

function planForItem(item: CollectionItem): Exclude<PlanId, "free"> | null {
  if (
    item.inAppOfferToken === config.microsoftStoreAnnualOfferToken ||
    item.productId === config.microsoftStoreAnnualProductId
  ) {
    return "annual";
  }
  if (
    item.inAppOfferToken === config.microsoftStoreMonthlyOfferToken ||
    item.productId === config.microsoftStoreMonthlyProductId
  ) {
    return "monthly";
  }
  return null;
}

export async function verifyStoreSubscription(
  storeIdKey: string,
  publisherUserId: string,
): Promise<VerifiedStoreSubscription | null> {
  const accessToken = await getPublisherToken(ONESTORE_RESOURCE);
  const response = await fetch(COLLECTIONS_QUERY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      beneficiaries: [
        {
          localTicketReference: publisherUserId,
          identityValue: storeIdKey,
          identityType: "b2b",
        },
      ],
      maxPageSize: 100,
      parentProductId: config.microsoftStoreParentProductId,
      productTypes: ["Durable"],
      validityType: "Valid",
    }),
  });
  const payload = (await response.json().catch(() => null)) as
    | { items?: CollectionItem[] }
    | null;
  if (!response.ok || !payload) {
    throw new Error("Microsoft Store entitlement lookup failed.");
  }

  const now = Date.now();
  const candidates = (payload.items ?? [])
    .map((item) => ({ item, plan: planForItem(item) }))
    .filter(({ item, plan }) => {
      const endsAt = item.endDate ? new Date(item.endDate).getTime() : 0;
      const purchaserMatches =
        !item.purchaser?.identityValue || item.purchaser.identityValue === publisherUserId;
      return Boolean(
        plan &&
          item.status === "Active" &&
          item.localTicketReference === publisherUserId &&
          purchaserMatches &&
          endsAt > now,
      );
    })
    .sort((left, right) => {
      if (left.plan !== right.plan) return left.plan === "annual" ? -1 : 1;
      return (
        new Date(right.item.endDate ?? 0).getTime() -
        new Date(left.item.endDate ?? 0).getTime()
      );
    });

  const selected = candidates[0];
  if (!selected?.plan || !selected.item.endDate) return null;
  return {
    plan: selected.plan,
    status: selected.item.skuType === "Trial" ? "trial" : "active",
    periodStartedAt: selected.item.startDate ?? new Date().toISOString(),
    periodEndsAt: selected.item.endDate,
  };
}
