/**
 * Blanjain demo backend
 * ----------------------
 * A tiny in-memory REST API that powers three "apps" in the frontend:
 *   - Customer app  (browses a merchant, checks out, tracks the order)
 *   - Merchant app  (accepts/rejects orders, marks them ready)
 *   - Driver app    (picks up ready orders, delivers, verifies with PIN/QR)
 *
 * There's no real auth/database here on purpose - it's a self-contained
 * demo you can run locally to see the full order lifecycle end to end,
 * exactly like the reference screenshots (Indonesian labels included).
 */

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const MERCHANT = {
  id: "merchant-1",
  name: "RM. Jangkar",
  category: "Food",
  rating: 3.8,
  etaMinutes: 5,
  distanceKm: 2.6,
  address: "Jl. Raya Trans Halmahera Desa Wosia, Kec. Tobelo Tengah, Kab. Halmahera Utara (Depan Kantor Desa Wosia)",
};

const MENU = [
  { id: "item-1", name: "Nasi Udang Krispi", category: "Makanan Utama", price: 35000, stock: 999 },
  { id: "item-2", name: "Es Teh Manis", category: "Minuman", price: 5000, stock: 998 },
  { id: "item-3", name: "Ayam Lalapan", category: "Makanan Utama", price: 35000, stock: 997 },
  { id: "item-4", name: "Pecel Lele", category: "Makanan Utama", price: 40000, stock: 998 },
  { id: "item-5", name: "Nasi Goreng", category: "Makanan Utama", price: 20000, stock: 992 },
  { id: "item-6", name: "Es Nutrisari", category: "Minuman", price: 5000, stock: 950 },
];

const CUSTOMER = {
  id: "cust_1786550353892",
  name: "Kak Wulan",
  phone: "6282151970776",
  address: "P256+MWV, Wosia, Tobelo Tengah, North Maluku",
  label: "Rumah",
};

const DRIVER = {
  id: "driver-1",
  name: "Panji Manusia Milenium",
  vehicle: "DG 1234 NE",
  type: "Kurir",
};

const STATUS = {
  MENUNGGU: "menunggu", // waiting for merchant response
  DIPROSES: "diproses", // merchant is preparing
  SIAP_DIAMBIL: "siap_diambil", // ready for courier pickup
  DIAMBIL_KURIR: "diambil_kurir", // courier assigned, heading to merchant
  DIANTAR: "diantar", // courier picked it up, en route to customer
  SELESAI: "selesai", // delivered & verified
  DIBATALKAN: "dibatalkan", // cancelled/rejected
};

let orderCounter = 0;
let messageCounter = 0;
const orders = [];
const chats = {}; // orderId -> [ {id, sender, message, createdAt} ]

function genOrderNumber() {
  orderCounter += 1;
  const ts = Date.now() - orderCounter; // keep them roughly increasing/unique
  const suffix = String(100 + orderCounter).padStart(3, "0");
  return `ORD-${ts}-${suffix}`;
}

function genPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function computeTotals(items) {
  const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  const ongkir = 8160;
  const biayaLayanan = Math.round(subtotal * 0.01);
  const biayaPlatform = 2000;
  const total = subtotal + ongkir + biayaLayanan + biayaPlatform;
  return { subtotal, ongkir, biayaLayanan, biayaPlatform, total };
}

function findOrder(id) {
  return orders.find((o) => o.id === id);
}

function pushStatusHistory(order, status, label, description) {
  order.statusHistory.push({
    status,
    label,
    description,
    at: new Date().toISOString(),
  });
}

function publicOrder(order) {
  // Sorted history, newest last (timeline order)
  return order;
}

// Seed a bit of order history so the "Kemarin" / riwayat lists aren't empty.
function seedHistory() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const completedItems = [
    { id: "item-5", name: "Nasi Goreng", price: 20000, qty: 1 },
    { id: "item-6", name: "Es Nutrisari", price: 5000, qty: 1 },
  ];
  const totals1 = computeTotals(completedItems);
  const o1 = {
    id: "seed-order-1",
    orderNumber: "ORD-1786794177918-401",
    customer: CUSTOMER,
    merchant: MERCHANT,
    driver: DRIVER,
    items: completedItems,
    note: "",
    ...totals1,
    status: STATUS.SELESAI,
    pin: genPin(),
    rating: null,
    createdAt: new Date(yesterday.getTime()).toISOString(),
    statusHistory: [],
  };
  pushStatusHistory(o1, STATUS.SELESAI, "Pesanan Selesai", "Pesanan sudah diterima pelanggan");
  orders.push(o1);

  const cancelledItems = [
    { id: "item-5", name: "Nasi Goreng", price: 20000, qty: 1 },
    { id: "item-6", name: "Es Nutrisari", price: 5000, qty: 1 },
  ];
  const totals2 = computeTotals(cancelledItems);
  const o2 = {
    id: "seed-order-2",
    orderNumber: "ORD-1786789072820-971",
    customer: CUSTOMER,
    merchant: MERCHANT,
    driver: null,
    items: cancelledItems,
    note: "",
    ...totals2,
    status: STATUS.DIBATALKAN,
    pin: genPin(),
    rating: null,
    createdAt: new Date(yesterday.getTime() - 3 * 60 * 60 * 1000).toISOString(),
    statusHistory: [],
  };
  pushStatusHistory(o2, STATUS.DIBATALKAN, "Pesanan Dibatalkan", "Pesanan dibatalkan");
  orders.push(o2);
}

seedHistory();

// ---------------------------------------------------------------------------
// Merchant / menu
// ---------------------------------------------------------------------------

app.get("/api/merchant", (req, res) => {
  res.json({ merchant: MERCHANT, menu: MENU });
});

app.get("/api/customer", (req, res) => {
  res.json(CUSTOMER);
});

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

// Create a new order (customer checkout)
app.post("/api/orders", (req, res) => {
  const { items, note } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Keranjang kosong" });
  }

  const resolvedItems = items.map((it) => {
    const menuItem = MENU.find((m) => m.id === it.id);
    if (!menuItem) throw new Error("Item tidak ditemukan");
    return { id: menuItem.id, name: menuItem.name, price: menuItem.price, qty: it.qty };
  });

  const totals = computeTotals(resolvedItems);
  const order = {
    id: `order-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    orderNumber: genOrderNumber(),
    customer: CUSTOMER,
    merchant: MERCHANT,
    driver: null,
    items: resolvedItems,
    note: note || "",
    ...totals,
    status: STATUS.MENUNGGU,
    pin: genPin(),
    rating: null,
    createdAt: new Date().toISOString(),
    statusHistory: [],
  };
  pushStatusHistory(order, STATUS.MENUNGGU, "Pesanan Dibuat", "Menunggu konfirmasi merchant");
  orders.unshift(order);
  chats[order.id] = [];

  res.status(201).json(publicOrder(order));
});

// List orders - optionally filter by status (comma separated) or "active" only
app.get("/api/orders", (req, res) => {
  let list = [...orders];
  const { status, driverAssigned } = req.query;

  if (status) {
    const wanted = status.split(",");
    list = list.filter((o) => wanted.includes(o.status));
  }
  if (driverAssigned === "true") {
    list = list.filter((o) => o.driver !== null);
  }

  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list.map(publicOrder));
});

app.get("/api/orders/:id", (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });
  res.json(publicOrder(order));
});

// Merchant accepts the order -> starts preparing
app.post("/api/orders/:id/accept", (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });
  if (order.status !== STATUS.MENUNGGU) {
    return res.status(409).json({ error: "Pesanan tidak dalam status menunggu" });
  }
  order.status = STATUS.DIPROSES;
  pushStatusHistory(order, STATUS.DIPROSES, "Pesanan Diproses", "Merchant sedang menyiapkan pesananmu");
  res.json(publicOrder(order));
});

// Merchant rejects the order
app.post("/api/orders/:id/reject", (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });
  if (order.status !== STATUS.MENUNGGU) {
    return res.status(409).json({ error: "Pesanan tidak dalam status menunggu" });
  }
  order.status = STATUS.DIBATALKAN;
  pushStatusHistory(order, STATUS.DIBATALKAN, "Pesanan Ditolak", "Merchant menolak pesanan ini");
  res.json(publicOrder(order));
});

// Customer cancels while still waiting
app.post("/api/orders/:id/cancel", (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });
  if (order.status !== STATUS.MENUNGGU) {
    return res.status(409).json({ error: "Pesanan sudah diproses, tidak bisa dibatalkan" });
  }
  order.status = STATUS.DIBATALKAN;
  pushStatusHistory(order, STATUS.DIBATALKAN, "Pesanan Dibatalkan", "Dibatalkan oleh pelanggan");
  res.json(publicOrder(order));
});

// Merchant marks the order ready for courier pickup
app.post("/api/orders/:id/ready", (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });
  if (order.status !== STATUS.DIPROSES) {
    return res.status(409).json({ error: "Pesanan belum diproses" });
  }
  order.status = STATUS.SIAP_DIAMBIL;
  pushStatusHistory(order, STATUS.SIAP_DIAMBIL, "Pesanan Siap Diambil", "Pesanan sudah siap dan akan segera diambil kurir");
  res.json(publicOrder(order));
});

// Driver takes the order (assigns themselves)
app.post("/api/orders/:id/take", (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });
  if (order.status !== STATUS.SIAP_DIAMBIL) {
    return res.status(409).json({ error: "Pesanan belum siap diambil" });
  }
  order.driver = DRIVER;
  order.status = STATUS.DIAMBIL_KURIR;
  pushStatusHistory(order, STATUS.DIAMBIL_KURIR, "Kurir Menuju Lokasi", "Kurir sedang menuju merchant untuk mengambil pesanan");
  res.json(publicOrder(order));
});

// Driver has picked up the order from the merchant -> heading to customer
app.post("/api/orders/:id/pickup", (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });
  if (order.status !== STATUS.DIAMBIL_KURIR) {
    return res.status(409).json({ error: "Pesanan belum diambil kurir" });
  }
  order.status = STATUS.DIANTAR;
  pushStatusHistory(order, STATUS.DIANTAR, "Pesanan Diantar", "Kurir sedang dalam perjalanan ke alamatmu");
  res.json(publicOrder(order));
});

// Driver completes the delivery by verifying the customer's PIN (or QR, same PIN underneath)
app.post("/api/orders/:id/complete", (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });
  if (order.status !== STATUS.DIANTAR) {
    return res.status(409).json({ error: "Pesanan belum dalam pengantaran" });
  }
  const { pin } = req.body;
  if (!pin || pin !== order.pin) {
    return res.status(400).json({ error: "PIN salah, coba lagi" });
  }
  order.status = STATUS.SELESAI;
  pushStatusHistory(order, STATUS.SELESAI, "Pesanan Tiba", "Pesanan sudah sampai di tanganmu");
  res.json(publicOrder(order));
});

// Customer rates a completed order
app.post("/api/orders/:id/rate", (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });
  if (order.status !== STATUS.SELESAI) {
    return res.status(409).json({ error: "Pesanan belum selesai" });
  }
  const { rating } = req.body;
  order.rating = rating;
  res.json(publicOrder(order));
});

// ---------------------------------------------------------------------------
// Chat (per order, between driver and customer)
// ---------------------------------------------------------------------------

app.get("/api/orders/:id/chat", (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });
  res.json(chats[order.id] || []);
});

app.post("/api/orders/:id/chat", (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });
  const { sender, message } = req.body;
  if (!sender || !message) return res.status(400).json({ error: "sender dan message wajib diisi" });

  messageCounter += 1;
  const msg = {
    id: `msg-${messageCounter}`,
    sender, // 'customer' | 'driver'
    message,
    createdAt: new Date().toISOString(),
  };
  if (!chats[order.id]) chats[order.id] = [];
  chats[order.id].push(msg);
  res.status(201).json(msg);
});

// ---------------------------------------------------------------------------

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Blanjain backend jalan di http://localhost:${PORT}`);
});
