export {};

declare global {
  interface Window {
    microsoftStore?: {
      openPlan(plan: "monthly" | "annual"): Promise<boolean>;
      getCollectionsId(serviceTicket: string, publisherUserId: string): Promise<string>;
    };
  }
}
