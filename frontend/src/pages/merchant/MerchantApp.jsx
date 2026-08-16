import React, { useEffect, useMemo, useState } from "react";
import PhoneFrame from "../../components/PhoneFrame.jsx";
import { api, formatRupiah, formatTime } from "../../api.js";

const SUBTABS = [
  { id: "baru", label: "Baru", statuses: ["menunggu"] },
  { id: "diproses", label: "Diproses", statuses: ["diproses", "siap_diambil", "diambil_kurir", "diantar"] },
  { id: "selesai", label: "Selesai", statuses: ["selesai", "dibatalkan"] },
  { id: "semua", label: "Semua", statuses: null },
];

export default function MerchantApp() {
  const [tab, setTab] = useState("dashboard"); // dashboard | pesanan
  const [subtab, setSubtab] = useState("baru");
  const [orders, setOrders] = useState([]);

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

  const newCount = orders.filter((o) => o.status === "menunggu").length;
  const inProgressCount = orders.filter((o) =>
    ["diproses", "siap_diambil", "diambil_kurir", "diantar"].includes(o.status)
  ).length;
  const revenueToday = orders
    .filter((o) => o.status === "selesai" && isToday(o.createdAt))
    .reduce((n, o) => n + o.total, 0);
  const successCount = orders.filter((o) => o.status === "selesai").length;
  const cancelledCount = orders.filter((o) => o.status === "dibatalkan").length;
  const totalDone = successCount + cancelledCount || 1;

  async function accept(id) {
    await refreshAfter(() => api.acceptOrder(id));
  }
  async function reject(id) {
    await refreshAfter(() => api.rejectOrder(id));
  }
  async function markReady(id) {
    await refreshAfter(() => api.readyOrder(id));
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

  const visibleOrders = useMemo(() => {
    const def = SUBTABS.find((s) => s.id === subtab);
    let list = def.statuses ? orders.filter((o) => def.statuses.includes(o.status)) : orders;
    return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, subtab]);

  return (
    <PhoneFrame accent="#F97316" statusLabel="Mitra Food">
      {tab === "dashboard" ? (
        <DashboardScreen
          newCount={newCount}
          inProgressCount={inProgressCount}
          revenueToday={revenueToday}
          successCount={successCount}
          cancelledCount={cancelledCount}
          totalDone={totalDone}
          onOpenOrders={() => {
            setTab("pesanan");
            setSubtab("baru");
          }}
        />
      ) : (
        <OrdersScreen
          subtab={subtab}
          setSubtab={setSubtab}
          orders={visibleOrders}
          newCount={newCount}
          onAccept={accept}
          onReject={reject}
          onReady={markReady}
        />
      )}

      <nav className="bottom-nav merchant">
        <MNavBtn active={tab === "dashboard"} label="Dashboard" icon="🏠" onClick={() => setTab("dashboard")} />
        <MNavBtn label="Menu" icon="🍴" disabled />
        <MNavBtn
          active={tab === "pesanan"}
          label="Pesanan"
          icon="🧾"
          badge={newCount}
          onClick={() => setTab("pesanan")}
        />
        <MNavBtn label="Profil" icon="👤" disabled />
      </nav>
    </PhoneFrame>
  );
}

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function MNavBtn({ active, label, icon, onClick, disabled, badge }) {
  return (
    <button className={`nav-btn ${active ? "active orange" : ""}`} onClick={onClick} disabled={disabled}>
      <span className="nav-icon">
        {icon}
        {badge > 0 && <span className="nav-badge">{badge}</span>}
      </span>
      <span>{label}</span>
    </button>
  );
}

function DashboardScreen({ newCount, inProgressCount, revenueToday, successCount, cancelledCount, totalDone, onOpenOrders }) {
  const successPct = Math.round((successCount / totalDone) * 100);
  const cancelPct = 100 - successPct;
  return (
    <div className="screen">
      <div className="merchant-header">
        <div className="merchant-header-icon">🏠</div>
        <div>
          <div className="merchant-header-title">Mitra Food</div>
          <div className="merchant-header-sub">Restoran &amp; kuliner</div>
        </div>
        <span className="tag">FOOD</span>
      </div>

      <div className="section-label">📊 Ringkasan hari ini</div>
      <div className="stat-card" onClick={onOpenOrders}>
        <span>📋 Pesanan baru</span>
        <b>{newCount}</b>
      </div>
      <div className="stat-card">
        <span>🍲 Diproses</span>
        <b>{inProgressCount}</b>
      </div>
      <div className="stat-card">
        <span>💰 Pendapatan</span>
        <b>{formatRupiah(revenueToday)}</b>
      </div>

      <div className="performance-card">
        <div className="performance-title">
          Performa Mitra Food <span>↗</span>
        </div>
        <div className="performance-row">
          <div>
            <div className="performance-big">{successCount}</div>
            <div className="performance-label">✓ Sukses</div>
          </div>
          <div>
            <div className="performance-big">{cancelledCount}</div>
            <div className="performance-label">✕ Batal</div>
          </div>
        </div>
        <div className="performance-row">
          <div className="performance-pct">{successPct || 0}%<div className="performance-label">Sukses</div></div>
          <div className="performance-pct">{cancelledCount ? cancelPct : 0}%<div className="performance-label">Batal</div></div>
        </div>
      </div>

      {newCount > 0 && (
        <button className="btn orange full" onClick={onOpenOrders}>
          Lihat {newCount} Pesanan Baru
        </button>
      )}
    </div>
  );
}

function OrdersScreen({ subtab, setSubtab, orders, newCount, onAccept, onReject, onReady }) {
  return (
    <div className="screen">
      <div className="screen-header">
        <div>
          <div className="screen-title">Pesanan</div>
          <div className="screen-sub">
            {newCount > 0 ? `${newCount} pesanan baru menunggu respons` : "Semua pesanan"}
          </div>
        </div>
      </div>
      <div className="tabbar">
        {SUBTABS.map((s) => (
          <button
            key={s.id}
            className={`tabbar-btn ${subtab === s.id ? "active orange" : ""}`}
            onClick={() => setSubtab(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {orders.length === 0 && <div className="empty-state">Tidak ada pesanan di sini.</div>}

      {orders.map((order) => (
        <div className={`order-card static ${order.status === "menunggu" ? "flag" : ""}`} key={order.id}>
          <div className="order-card-row">
            <div className="order-card-name">{order.orderNumber}</div>
            <span className={`pill status-${order.status}`}>{STATUS_LABEL[order.status]}</span>
          </div>
          <div className="order-card-meta">{order.customer.id} · {formatTime(order.createdAt)}</div>

          <div className="callout light">
            {order.items.length} item dipesan
            {order.items.map((it) => (
              <Row key={it.id} label={`${it.qty}x ${it.name}`} value={formatRupiah(it.price * it.qty)} />
            ))}
          </div>

          <Row label="Harga Barang" value={formatRupiah(order.subtotal)} />

          {order.status === "menunggu" && (
            <div className="btn-row">
              <button className="btn outline danger" onClick={() => onReject(order.id)}>
                ✕ Tolak
              </button>
              <button className="btn orange" onClick={() => onAccept(order.id)}>
                ✓ Terima
              </button>
            </div>
          )}

          {order.status === "diproses" && (
            <button className="btn orange full" onClick={() => onReady(order.id)}>
              ✓ Siap Diambil
            </button>
          )}

          {order.status === "siap_diambil" && (
            <div className="info-box">Menunggu kurir mengambil pesanan…</div>
          )}
          {order.status === "diambil_kurir" && (
            <div className="info-box">Kurir sedang menuju lokasimu.</div>
          )}
          {order.status === "diantar" && <div className="info-box">Pesanan sedang diantar ke pelanggan.</div>}
        </div>
      ))}
    </div>
  );
}

const STATUS_LABEL = {
  menunggu: "Baru",
  diproses: "Diproses",
  siap_diambil: "Siap Diambil",
  diambil_kurir: "Diambil Kurir",
  diantar: "Diantar",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
};

function Row({ label, value }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <span className="row-value">{value}</span>
    </div>
  );
}
