import React, { useState } from "react";
import CustomerApp from "./pages/customer/CustomerApp.jsx";
import MerchantApp from "./pages/merchant/MerchantApp.jsx";
import DriverApp from "./pages/driver/DriverApp.jsx";

const ROLES = [
  { id: "customer", label: "Customer", sub: "Blanjain", dot: "#7C3AED" },
  { id: "merchant", label: "Merchant", sub: "Mitra Food", dot: "#F97316" },
  { id: "driver", label: "Driver", sub: "Mitra Kurir", dot: "#4F46E5" },
];

export default function App() {
  const [role, setRole] = useState("customer");

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="brand">
          <span className="brand-mark">B</span>
          <div>
            <div className="brand-title">Blanjain — Alur Pesanan</div>
            <div className="brand-sub">
              Demo 3 aplikasi berjalan bersamaan: pelanggan, merchant, dan kurir
            </div>
          </div>
        </div>
        <nav className="role-switch">
          {ROLES.map((r) => (
            <button
              key={r.id}
              className={`role-btn ${role === r.id ? "active" : ""}`}
              style={{ "--dot": r.dot }}
              onClick={() => setRole(r.id)}
            >
              <span className="role-dot" />
              <span>
                <span className="role-label">{r.label}</span>
                <span className="role-app">{r.sub}</span>
              </span>
            </button>
          ))}
        </nav>
      </header>

      <main className="shell-main">
        <p className="hint">
          Ikuti alur: pesan sebagai <b>Customer</b> → terima &amp; siapkan sebagai{" "}
          <b>Merchant</b> → ambil &amp; antar sebagai <b>Driver</b> → selesaikan dengan
          PIN/QR yang muncul di layar Customer.
        </p>
        <div className="phone-stage">
          {role === "customer" && <CustomerApp />}
          {role === "merchant" && <MerchantApp />}
          {role === "driver" && <DriverApp />}
        </div>
      </main>

      <footer className="shell-footer">
        Backend mock berjalan di <code>http://localhost:4000</code> — semua data disimpan
        di memori server (reset saat server direstart).
      </footer>
    </div>
  );
}
