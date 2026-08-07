import type { OnlinePaymentOrderDto } from "@tenantease/types";

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  handler: (response: { razorpay_payment_id: string }) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

let loader: Promise<void> | null = null;

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (loader) return loader;

  loader = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load the secure payment window."));
    document.head.appendChild(script);
  });
  return loader;
}

export async function openRazorpayCheckout(order: OnlinePaymentOrderDto) {
  if (!order.keyId || !order.providerOrderId) {
    throw new Error("Online payment provider is not configured.");
  }
  if (order.keyId.startsWith("mock_") || order.providerOrderId.startsWith("order_mock_")) {
    throw new Error("Online payments require Razorpay test or live credentials.");
  }

  await loadRazorpay();
  if (!window.Razorpay) throw new Error("Unable to initialize the secure payment window.");

  return new Promise<string | null>((resolve) => {
    const checkout = new window.Razorpay!({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.providerOrderId,
      name: "TenantEase",
      description: "Rent payment",
      handler: (response) => resolve(response.razorpay_payment_id),
      modal: { ondismiss: () => resolve(null) },
      theme: { color: "#ea580c" }
    });
    checkout.open();
  });
}
