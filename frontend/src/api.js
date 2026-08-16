// Resolution order:
// 1. window.__API_URL__ - injected at container startup (see docker/entrypoint.sh),
//    lets platforms like Back4App Containers set the backend URL at *runtime*
//    instead of baking it in at build time.
// 2. VITE_API_URL - baked in at build time (works for Vercel/Netlify/Zeabur).
// 3. localhost fallback for local development.
const BASE_URL =
  (typeof window !== "undefined" && window.__API_URL__) ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    throw new Error(data?.error || `Request gagal (${res.status})`);
  }
  return data;
}

export const api = {
  getMerchant: () => request("/merchant"),
  getCustomer: () => request("/customer"),

  createOrder: (payload) =>
    request("/orders", { method: "POST", body: JSON.stringify(payload) }),
  listOrders: (status) =>
    request(`/orders${status ? `?status=${status}` : ""}`),
  getOrder: (id) => request(`/orders/${id}`),

  acceptOrder: (id) => request(`/orders/${id}/accept`, { method: "POST" }),
  rejectOrder: (id) => request(`/orders/${id}/reject`, { method: "POST" }),
  cancelOrder: (id) => request(`/orders/${id}/cancel`, { method: "POST" }),
  readyOrder: (id) => request(`/orders/${id}/ready`, { method: "POST" }),
  takeOrder: (id) => request(`/orders/${id}/take`, { method: "POST" }),
  pickupOrder: (id) => request(`/orders/${id}/pickup`, { method: "POST" }),
  completeOrder: (id, pin) =>
    request(`/orders/${id}/complete`, {
      method: "POST",
      body: JSON.stringify({ pin }),
    }),
  rateOrder: (id, rating) =>
    request(`/orders/${id}/rate`, {
      method: "POST",
      body: JSON.stringify({ rating }),
    }),

  getChat: (id) => request(`/orders/${id}/chat`),
  sendChat: (id, sender, message) =>
    request(`/orders/${id}/chat`, {
      method: "POST",
      body: JSON.stringify({ sender, message }),
    }),
};

export function formatRupiah(n) {
  return `Rp ${Number(n || 0).toLocaleString("id-ID")}`;
}

export function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}
