export {};

declare global {
  interface Window {
    microsoftStore?: {
      openPlan(plan: "monthly" | "annual"): Promise<boolean>;
    };
  }
}
