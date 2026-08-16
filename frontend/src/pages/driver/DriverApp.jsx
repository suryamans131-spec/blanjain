import React, { useEffect, useState } from "react";
import PhoneFrame from "../../components/PhoneFrame.jsx";
import ChatPanel from "../../components/ChatPanel.jsx";
import { api, formatRupiah } from "../../api.js";

const TABS = [
  { id: "tersedia", label: "Tersedia", statuses: ["siap_diambil"] },
  { id: "diproses", label: "Diproses", statuses: ["diambil_kurir"] },
  { id: "diantar", label: "Diantar", statuses: ["diantar"] },
  { id: "selesai", label: "Selesai", statuses: ["selesai"] },
];

export default function DriverApp() {
  const [tab, setTab] = useState("tersedia");
  const [orders, setOrders] = useState([]);
  const [detailOrder, setDetailOrder] = useState(null);
  const [pinOrder, setPinOrder] = useState(null);
  const [chatOrder, setChatOrder] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.listOrders();
        if (!cancelled) setOrders(data);
      } catch (e) {
        // ignore
      }
    }
    load();
    const t = setInterval(load, 2500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  async function take(id) {
    await refreshAfter(() => api.takeOrder(id));
    setTab("diproses");
  }
  async function pickup(id) {
    await refreshAfter(() => api.pickupOrder(id));
    setTab("diantar");
  }
  async function complete(id, pin) {
    await api.completeOrder(id, pin);
    const data = await api.listOrders();
    setOrders(data);
    setPinOrder(null);
    setTab("selesai");
  }
  async function refreshAfter(fn) {
    try {
      await fn();
      const data = await api.listOrders();
      setOrders(data);
    } catch (e) {
      alert(e.message);
    }
  }

  const def = TABS.find((t) => t.id === tab);
  const list = orders
    .filter((o) => def.statuses.includes(o.status))
    .filter((o) => (tab === "tersedia" ? true : !!o.driver))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const activeCount = orders.filter((o) => ["diambil_kurir", "diantar"].includes(o.status) && o.driver).length;

  return (
    <PhoneFrame accent="#4F46E5" statusLabel="Mitra Kurir">
      {chatOrder ? (
        <ChatPanel
          orderId={chatOrder.id}
          self="driver"
          otherName={`${chatOrder.customer.name || chatOrder.customer.id} · Customer`}
          onClose={() => setChatOrder(null)}
        />
      ) : (
        <div className="screen">
          <div className="screen-header">
            <div>
              <div className="screen-title">Order</div>
              <div className="screen-sub">
                {activeCount > 0 ? `${activeCount} order sedang berjalan` : "Tidak ada order aktif"}
              </div>
            </div>
          </div>

          <div className="tabbar">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tabbar-btn ${tab === t.id ? "active indigo" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {list.length === 0 && <div className="empty-state">Belum ada order di tab ini.</div>}

          {list.map((order) => (
            <DriverOrderCard
              key={order.id}
              order={order}
              tab={tab}
              onTake={() => take(order.id)}
              onDetail={() => setDetailOrder(order)}
              onPickup={() => pickup(order.id)}
              onComplete={() => setPinOrder(order)}
              onChat={() => setChatOrder(order)}
            />
          ))}
        </div>
      )}

      {!chatOrder && (
        <nav className="bottom-nav">
          <NavBtn label="Beranda" icon="🏠" disabled />
          <NavBtn active label="Trip" icon="🏍" />
          <NavBtn label="Chat" icon="💬" disabled />
          <NavBtn label="Aktivitas" icon="🕓" disabled />
          <NavBtn label="Profil" icon="👤" disabled />
        </nav>
      )}

      {detailOrder && <DetailSheet order={detailOrder} onClose={() => setDetailOrder(null)} />}
      {pinOrder && (
        <PinEntrySheet order={pinOrder} onClose={() => setPinOrder(null)} onSubmit={(pin) => complete(pinOrder.id, pin)} />
      )}
    </PhoneFrame>
  );
}

function NavBtn({ active, label, icon, onClick, disabled }) {
  return (
    <button className={`nav-btn ${active ? "active indigo" : ""}`} onClick={onClick} disabled={disabled}>
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function DriverOrderCard({ order, tab, onTake, onDetail, onPickup, onComplete, onChat }) {
  return (
    <div className="order-card static">
      <div className="order-card-row">
        <div className="order-card-name">{order.orderNumber}</div>
        <span className="pill green">
          {tab === "tersedia" && "Siap diambil"}
          {tab === "diproses" && "Diambil Kurir"}
          {tab === "diantar" && "Sedang Diantar"}
          {tab === "selesai" && "Selesai"}
        </span>
      </div>

      <Row icon="👤" label="Pelanggan" value={order.customer.id} />
      {tab !== "tersedia" && <Row icon="📞" label="Telepon" value={order.customer.phone} />}
      <Row icon="📍" label="Alamat pengiriman" value={order.customer.address} />
      <Row icon="🏪" label="Merchant" value={`${order.merchant.name}`} />

      <div className="total-box">
        <span>Total pembayaran</span>
        <b>{formatRupiah(order.total)}</b>
      </div>

      {tab === "tersedia" && (
        <div className="btn-row">
          <button className="btn indigo" onClick={onTake}>
            ✓ Ambil
          </button>
          <button className="btn outline" onClick={onDetail}>
            Detail
          </button>
        </div>
      )}

      {tab === "diproses" && (
        <>
          <button className="btn light-indigo full">↗ Petunjuk Arah ke Merchant</button>
          <button className="btn light-green full" onClick={onDetail}>
            📄 Detail Pesanan
          </button>
          <button className="btn green full" onClick={onPickup}>
            🛍 Ambil dari Merchant
          </button>
        </>
      )}

      {tab === "diantar" && (
        <>
          <div className="btn-row">
            <button className="btn light-indigo">↗ Petunjuk Arah</button>
            <button className="btn light-indigo square" onClick={onChat}>
              💬
            </button>
          </div>
          <button className="btn light-danger full">⚠ Laporkan Pesanan Bermasalah</button>
          <button className="btn green full" onClick={onComplete}>
            ✓ Selesaikan Pengantaran
          </button>
        </>
      )}
    </div>
  );
}

function Row({ icon, label, value }) {
  return (
    <div className="driver-row">
      <span className="driver-row-icon">{icon}</span>
      <div>
        <div className="driver-row-label">{label}</div>
        <div className="driver-row-value">{value}</div>
      </div>
    </div>
  );
}

function DetailSheet({ order, onClose }) {
  return (
    <div className="sheet-overlay">
      <div className="sheet">
        <div className="sheet-header indigo">
          <button className="icon-btn light" onClick={onClose}>
            ←
          </button>
          <div className="sheet-title light">{order.orderNumber}</div>
        </div>
        <div className="sheet-body">
          <div className="card">
            <div className="card-title">Pelanggan</div>
            <Row2 label="Nama" value={order.customer.id} />
            <Row2 label="Alamat" value={order.customer.address} />
          </div>
          <div className="card">
            <div className="card-title">Merchant</div>
            <Row2 label="Nama" value={order.merchant.name} />
            <Row2 label="Alamat" value={order.merchant.address} />
          </div>
          <div className="card">
            <div className="card-title">Item Pesanan</div>
            {order.items.map((it) => (
              <Row2 key={it.id} label={`${it.qty}x ${it.name}`} value={formatRupiah(it.price * it.qty)} />
            ))}
          </div>
          <div className="card">
            <div className="card-title">Pembayaran</div>
            <Row2 label="Subtotal" value={formatRupiah(order.subtotal)} />
            <Row2 label="Ongkir" value={formatRupiah(order.ongkir)} />
            <Row2 label="Biaya Layanan" value={formatRupiah(order.biayaLayanan)} />
            <div className="divider" />
            <Row2 label="Total" value={formatRupiah(order.total)} strong />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row2({ label, value, strong }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <span className={strong ? "row-value strong" : "row-value"}>{value}</span>
    </div>
  );
}

function PinEntrySheet({ order, onClose, onSubmit }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    try {
      await onSubmit(pin);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Input PIN Manual</div>
            <div className="modal-sub">Masukkan 6-digit PIN dari customer</div>
          </div>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <input
          className="pin-input"
          value={pin}
          maxLength={6}
          inputMode="numeric"
          placeholder="••••••"
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
        {error && <div className="error-text center">{error}</div>}
        <button className="btn green full" onClick={submit} disabled={pin.length !== 6}>
          ✓ Verifikasi
        </button>
      </div>
    </div>
  );
}
