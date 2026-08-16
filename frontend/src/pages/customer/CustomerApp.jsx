import React, { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import PhoneFrame from "../../components/PhoneFrame.jsx";
import StatusTimeline from "../../components/StatusTimeline.jsx";
import ChatPanel from "../../components/ChatPanel.jsx";
import { api, formatRupiah, formatDate, formatTime } from "../../api.js";

const STATUS_LABEL = {
  menunggu: "Menunggu",
  diproses: "Diproses",
  siap_diambil: "Siap Diambil",
  diambil_kurir: "Kurir Menuju Merchant",
  diantar: "Diantar",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
};

export default function CustomerApp() {
  const [tab, setTab] = useState("beranda"); // beranda | pesanan | chat
  const [merchant, setMerchant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [note, setNote] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [showSuccess, setShowSuccess] = useState(null);
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [chatOrder, setChatOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getMerchant().then(({ merchant, menu }) => {
      setMerchant(merchant);
      setMenu(menu);
    });
  }, []);

  // Poll customer's own orders (demo: everything belongs to the single seeded customer)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.listOrders();
        if (!cancelled) setOrders(data);
      } catch (e) {
        // ignore transient errors
      }
    }
    load();
    const t = setInterval(load, 2500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Keep the currently-open tracking order in sync with the poll
  useEffect(() => {
    if (!activeOrder) return;
    const fresh = orders.find((o) => o.id === activeOrder.id);
    if (fresh) setActiveOrder(fresh);
  }, [orders]); // eslint-disable-line react-hooks/exhaustive-deps

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({ ...menu.find((m) => m.id === id), qty })),
    [cart, menu]
  );
  const cartCount = cartItems.reduce((n, it) => n + it.qty, 0);
  const cartSubtotal = cartItems.reduce((n, it) => n + it.qty * it.price, 0);

  function addToCart(id) {
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  }
  function removeFromCart(id) {
    setCart((c) => {
      const next = { ...c, [id]: Math.max(0, (c[id] || 0) - 1) };
      return next;
    });
  }

  async function placeOrder() {
    setError("");
    try {
      const order = await api.createOrder({
        items: cartItems.map((it) => ({ id: it.id, qty: it.qty })),
        note,
      });
      setCart({});
      setNote("");
      setShowCheckout(false);
      setShowSuccess(order);
    } catch (e) {
      setError(e.message);
    }
  }

  function openTracking(order) {
    setActiveOrder(order);
    setTab("tracking");
  }

  async function cancelOrder(order) {
    await api.cancelOrder(order.id);
    const fresh = await api.getOrder(order.id);
    setActiveOrder(fresh);
  }

  async function rate(order, stars) {
    await api.rateOrder(order.id, stars);
    const fresh = await api.getOrder(order.id);
    setActiveOrder(fresh);
  }

  const today = orders.filter((o) => isToday(o.createdAt));
  const earlier = orders.filter((o) => !isToday(o.createdAt));

  return (
    <PhoneFrame accent="#7C3AED" statusLabel="Blanjain">
      {tab === "chat" && activeOrder ? (
        <ChatPanel
          orderId={activeOrder.id}
          self="customer"
          otherName={activeOrder.driver ? `${activeOrder.driver.name} · Driver` : "Driver"}
          onClose={() => setTab("tracking")}
        />
      ) : tab === "tracking" && activeOrder ? (
        <TrackingScreen
          order={activeOrder}
          onBack={() => setTab("pesanan")}
          onChat={() => setTab("chat")}
          onCancel={() => cancelOrder(activeOrder)}
          onShowPin={() => setShowPinModal(true)}
          onRate={(stars) => rate(activeOrder, stars)}
        />
      ) : tab === "pesanan" ? (
        <OrdersScreen
          today={today}
          earlier={earlier}
          onOpen={openTracking}
        />
      ) : (
        <HomeScreen
          merchant={merchant}
          menu={menu}
          cart={cart}
          onAdd={addToCart}
          onRemove={removeFromCart}
          cartCount={cartCount}
          cartSubtotal={cartSubtotal}
          onOpenCheckout={() => setShowCheckout(true)}
        />
      )}

      {/* Bottom nav (hidden inside chat) */}
      {tab !== "chat" && (
        <nav className="bottom-nav">
          <NavBtn active={tab === "beranda"} label="Beranda" icon="🏠" onClick={() => setTab("beranda")} />
          <NavBtn
            active={tab === "pesanan" || tab === "tracking"}
            label="Pesanan"
            icon="🧾"
            onClick={() => setTab("pesanan")}
          />
          <NavBtn label="Chat" icon="💬" onClick={() => setTab("pesanan")} disabled />
          <NavBtn label="Dompet" icon="👛" disabled />
          <NavBtn label="Akun" icon="👤" disabled />
        </nav>
      )}

      {showCheckout && (
        <CheckoutSheet
          merchant={merchant}
          items={cartItems}
          note={note}
          setNote={setNote}
          subtotal={cartSubtotal}
          error={error}
          onClose={() => setShowCheckout(false)}
          onConfirm={placeOrder}
        />
      )}

      {showSuccess && (
        <SuccessSheet
          order={showSuccess}
          onClose={() => {
            openTracking(showSuccess);
            setShowSuccess(null);
          }}
        />
      )}

      {showPinModal && activeOrder && (
        <PinQrSheet order={activeOrder} onClose={() => setShowPinModal(false)} />
      )}
    </PhoneFrame>
  );
}

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function NavBtn({ active, label, icon, onClick, disabled }) {
  return (
    <button className={`nav-btn ${active ? "active" : ""}`} onClick={onClick} disabled={disabled}>
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function HomeScreen({ merchant, menu, cart, onAdd, onRemove, cartCount, cartSubtotal, onOpenCheckout }) {
  return (
    <div className="screen">
      <div className="home-top">
        <div className="home-location">
          <span className="pin">📍</span>
          <div>
            <div className="home-location-label">Lokasi Anda</div>
            <div className="home-location-value">Rumah ▾</div>
          </div>
        </div>
        <div className="bell">🔔</div>
      </div>
      <div className="search-bar">🔍 Mau cari layanan apa hari ini?</div>

      <div className="promo-card">
        <span className="promo-tag">PROMO HARI INI</span>
        <div className="promo-title">Diskon hingga 50% untuk orderan pertamamu!</div>
      </div>

      {merchant && (
        <div className="merchant-card">
          <div className="merchant-card-head">
            <div className="merchant-icon">🏪</div>
            <div>
              <div className="merchant-name">{merchant.name}</div>
              <div className="merchant-meta">
                ⭐ {merchant.rating} · ⏱ {merchant.etaMinutes} min · 📍 {merchant.distanceKm} km
              </div>
              <div className="merchant-address">{merchant.address}</div>
            </div>
          </div>

          <div className="menu-list">
            {menu.map((item) => (
              <div className="menu-item" key={item.id}>
                <div className="menu-item-thumb" aria-hidden>
                  🍽
                </div>
                <div className="menu-item-info">
                  <div className="menu-item-name">{item.name}</div>
                  <div className="menu-item-cat">{item.category}</div>
                  <div className="menu-item-price">{formatRupiah(item.price)}</div>
                </div>
                {cart[item.id] > 0 ? (
                  <div className="qty-stepper">
                    <button onClick={() => onRemove(item.id)}>−</button>
                    <span>{cart[item.id]}</span>
                    <button onClick={() => onAdd(item.id)}>+</button>
                  </div>
                ) : (
                  <button className="add-btn" onClick={() => onAdd(item.id)}>
                    +
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {cartCount > 0 && (
        <button className="cart-bar" onClick={onOpenCheckout}>
          <span>
            {cartCount} item · {formatRupiah(cartSubtotal)}
          </span>
          <span>Lihat Keranjang →</span>
        </button>
      )}
    </div>
  );
}

function CheckoutSheet({ merchant, items, note, setNote, subtotal, error, onClose, onConfirm }) {
  const ongkir = 8160;
  const biayaLayanan = Math.round(subtotal * 0.01);
  const biayaPlatform = 2000;
  const total = subtotal + ongkir + biayaLayanan + biayaPlatform;

  return (
    <div className="sheet-overlay">
      <div className="sheet">
        <div className="sheet-header purple">
          <button className="icon-btn light" onClick={onClose}>
            ←
          </button>
          <div className="sheet-title light">Detail Pembelian</div>
        </div>
        <div className="sheet-body">
          <div className="card">
            <div className="card-title">🏪 {merchant?.name}</div>
            {items.map((it) => (
              <div className="line-item" key={it.id}>
                <div>
                  <div className="line-item-name">{it.name}</div>
                  <div className="line-item-price">{formatRupiah(it.price)}</div>
                </div>
                <div className="line-item-qty">{it.qty}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">📝 Catatan untuk Penjual</div>
            <textarea
              placeholder="Contoh: Jangan terlalu pedas, tanpa bawang, dll."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="card">
            <div className="card-title">Rincian Pembayaran</div>
            <Row label="Subtotal Produk" value={formatRupiah(subtotal)} />
            <Row label="Ongkir (2.6 km)" value={formatRupiah(ongkir)} />
            <Row label="Biaya Layanan (1%)" value={formatRupiah(biayaLayanan)} />
            <Row label="Biaya Platform" value={formatRupiah(biayaPlatform)} />
          </div>

          {error && <div className="error-text">{error}</div>}
        </div>
        <div className="sheet-footer">
          <div>
            <div className="footer-label">Total Pembayaran</div>
            <div className="footer-value">{formatRupiah(total)}</div>
          </div>
          <button className="btn purple" onClick={onConfirm} disabled={items.length === 0}>
            Proses
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <span className="row-value">{value}</span>
    </div>
  );
}

function SuccessSheet({ order, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal success">
        <div className="success-check">✓</div>
        <div className="success-title">🎉 Pesanan Berhasil!</div>
        <div className="order-number-box">
          <div className="order-number-label">Nomor Pesanan</div>
          <div className="order-number-value">{order.orderNumber}</div>
        </div>
        <div className="success-total">Total Pembayaran: {formatRupiah(order.total)}</div>
        <div className="info-box">Pesanan Anda sedang diproses. Anda akan menerima notifikasi segera.</div>
        <button className="btn purple full" onClick={onClose}>
          Lihat Pesanan
        </button>
      </div>
    </div>
  );
}

function OrdersScreen({ today, earlier, onOpen }) {
  return (
    <div className="screen">
      <div className="screen-header">
        <div>
          <div className="screen-title">Pesanan</div>
          <div className="screen-sub">Riwayat pesanan kamu</div>
        </div>
      </div>
      {today.length > 0 && <div className="section-label">Hari Ini</div>}
      {today.map((o) => (
        <OrderCard key={o.id} order={o} onOpen={onOpen} />
      ))}
      {earlier.length > 0 && <div className="section-label">Sebelumnya</div>}
      {earlier.map((o) => (
        <OrderCard key={o.id} order={o} onOpen={onOpen} />
      ))}
    </div>
  );
}

function OrderCard({ order, onOpen }) {
  return (
    <button className="order-card" onClick={() => onOpen(order)}>
      <div className="order-card-row">
        <div className="order-card-merchant">
          <span className="order-card-icon">🍽</span>
          <div>
            <div className="order-card-name">{order.merchant.name}</div>
            <div className={`order-card-status status-${order.status}`}>
              {STATUS_LABEL[order.status]}
            </div>
          </div>
        </div>
        <div className="order-card-price">{formatRupiah(order.total)}</div>
      </div>
      <div className="order-card-meta">
        {order.orderNumber} · {formatDate(order.createdAt)} {formatTime(order.createdAt)}
      </div>
      <div className="order-card-items">
        {order.items.map((it) => it.name).join(", ")} · {order.items.length} Item
      </div>
    </button>
  );
}

function TrackingScreen({ order, onBack, onChat, onCancel, onShowPin, onRate }) {
  return (
    <div className="screen">
      <div className="screen-header">
        <button className="icon-btn" onClick={onBack}>
          ←
        </button>
        <div>
          <div className="screen-title">Tracking Pesanan</div>
          <div className="screen-sub">{order.orderNumber}</div>
        </div>
        {order.driver && (
          <button className="icon-btn" onClick={onChat} title="Chat driver">
            💬
          </button>
        )}
      </div>

      <div className="card highlight">
        <div className="row">
          <span className="row-label">Estimasi Tiba</span>
          <span className={`pill status-${order.status}`}>{STATUS_LABEL[order.status]}</span>
        </div>
        <div className="eta-time">{estimateWindow(order)}</div>
      </div>

      <div className="card">
        <StatusTimeline status={order.status} />
      </div>

      {order.status === "diantar" && (
        <button className="btn green full" onClick={onShowPin}>
          🔒 Lihat QR / PIN untuk Driver
        </button>
      )}

      {order.status === "menunggu" && (
        <button className="btn danger full" onClick={onCancel}>
          Batalkan Pesanan
        </button>
      )}

      {order.status === "selesai" && (
        <div className="card">
          <div className="card-title">Beri Nilai Pesanan</div>
          <div className="stars">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                className={`star ${order.rating >= s ? "filled" : ""}`}
                onClick={() => onRate(s)}
              >
                ★
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">🍽 {order.merchant.name}</div>
        {order.items.map((it) => (
          <Row key={it.id} label={`${it.qty}x ${it.name}`} value={formatRupiah(it.price * it.qty)} />
        ))}
        <div className="divider" />
        <Row label="Total" value={formatRupiah(order.total)} />
      </div>
    </div>
  );
}

function estimateWindow(order) {
  const start = new Date(order.createdAt);
  const lo = new Date(start.getTime() + 30 * 60000);
  const hi = new Date(start.getTime() + 45 * 60000);
  const fmt = (d) => d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(lo)} - ${fmt(hi)}`;
}

function PinQrSheet({ order, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Pesanan Tiba</div>
            <div className="modal-sub">Order {order.orderNumber}</div>
          </div>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="callout green">
          🛵 Tunjukkan QR atau PIN di bawah untuk menyelesaikan pengantaran.
        </div>
        <div className="qr-card">
          <div className="qr-card-title">
            <span className="qr-icon">▦</span> Verifikasi Pengantaran
          </div>
          <div className="qr-card-sub">Tunjukkan ke driver saat pesanan tiba</div>
          <div className="qr-wrap">
            <QRCodeSVG value={order.pin} size={180} />
          </div>
          <div className="qr-order-number">Order #{order.orderNumber}</div>
        </div>
        <div className="or-divider">atau</div>
        <div className="pin-card">
          <div className="pin-card-title">🔢 Jika QR tidak bisa discan</div>
          <div className="pin-card-sub">Berikan kode PIN ini ke driver:</div>
          <div className="pin-value">{order.pin.split("").join(" ")}</div>
        </div>
      </div>
    </div>
  );
}
