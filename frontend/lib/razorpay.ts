import type { BillingCheckout, RazorpayPaymentResponse } from "./api";

interface RazorpayFailure {
  error?: {
    description?: string;
    reason?: string;
  };
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", handler: (response: RazorpayFailure) => void): void;
}

interface RazorpayOptions {
  key: string;
  amount?: number;
  currency: string;
  name: string;
  description: string;
  order_id?: string;
  subscription_id?: string;
  prefill?: { name?: string; email?: string };
  handler(response: RazorpayPaymentResponse): void;
  modal: { ondismiss(): void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

function loadRazorpay(): Promise<void> {
  if (typeof window.Razorpay === "function") return Promise.resolve();
  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );
    if (!script) {
      script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
    script.addEventListener("load", () => {
      if (typeof window.Razorpay === "function") resolve();
      else reject(new Error("Razorpay checkout did not initialize."));
    }, { once: true });
    script.addEventListener("error", () => {
      reject(new Error("Could not load Razorpay checkout."));
    }, { once: true });
  });
}

export async function openRazorpayCheckout(
  checkout: BillingCheckout,
  description: string,
  prefill: { name?: string; email?: string } = {},
): Promise<RazorpayPaymentResponse> {
  await loadRazorpay();
  const Razorpay = window.Razorpay;
  if (typeof Razorpay !== "function") {
    throw new Error("Razorpay checkout is unavailable in this browser.");
  }

  return new Promise((resolve, reject) => {
    let completed = false;
    const instance = new Razorpay({
      key: checkout.keyId,
      ...(checkout.orderId ? { amount: checkout.amountPaise } : {}),
      currency: checkout.currency,
      name: "HexaWave",
      description,
      ...(checkout.orderId ? { order_id: checkout.orderId } : {}),
      ...(checkout.subscriptionId ? { subscription_id: checkout.subscriptionId } : {}),
      prefill,
      handler(response) {
        completed = true;
        resolve(response);
      },
      modal: {
        ondismiss() {
          if (!completed) reject(new Error("Payment checkout was closed before completion."));
        },
      },
    });
    instance.on("payment.failed", (response) => {
      completed = true;
      reject(
        new Error(
          response.error?.description ??
            response.error?.reason ??
            "Razorpay reported that the payment failed.",
        ),
      );
    });
    instance.open();
  });
}
