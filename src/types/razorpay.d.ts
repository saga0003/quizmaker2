type RazorpaySuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayOptions = {
  key: string; amount: number; currency: string; name: string; description: string; order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccess) => void | Promise<void>;
  modal?: { ondismiss?: () => void };
};
declare global {
  interface Window { Razorpay: new (options: RazorpayOptions) => { open: () => void; on: (event: string, cb: (response: unknown) => void) => void } }
}
export {};
