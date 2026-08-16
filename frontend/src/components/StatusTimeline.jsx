import React from "react";

const STEPS = [
  { status: "menunggu", label: "Pesanan Dibuat", desc: "Menunggu konfirmasi merchant" },
  { status: "diproses", label: "Pesanan Diproses", desc: "Merchant sedang menyiapkan pesananmu" },
  { status: "siap_diambil", label: "Pesanan Siap Diambil", desc: "Pesanan sudah siap dan akan segera diambil kurir" },
  { status: "diambil_kurir", label: "Kurir Menuju Lokasi", desc: "Kurir sedang dalam perjalanan ke merchant" },
  { status: "diantar", label: "Pesanan Diantar", desc: "Kurir sedang dalam perjalanan ke alamatmu" },
  { status: "selesai", label: "Pesanan Tiba", desc: "Pesanan sudah sampai di tanganmu" },
];

export default function StatusTimeline({ status }) {
  if (status === "dibatalkan") {
    return (
      <div className="timeline">
        <div className="timeline-row done cancelled">
          <div className="timeline-dot">✕</div>
          <div>
            <div className="timeline-label">Pesanan Dibatalkan</div>
            <div className="timeline-desc">Pesanan ini tidak dilanjutkan</div>
          </div>
        </div>
      </div>
    );
  }

  const currentIdx = STEPS.findIndex((s) => s.status === status);

  return (
    <div className="timeline">
      {STEPS.map((s, i) => {
        const state = i < currentIdx ? "done" : i === currentIdx ? "current" : "pending";
        return (
          <div className={`timeline-row ${state}`} key={s.status}>
            <div className="timeline-dot">{state === "done" ? "✓" : i + 1}</div>
            <div>
              <div className="timeline-label">
                {s.label}
                {state === "current" && <span className="timeline-badge">Sedang Berlangsung</span>}
              </div>
              <div className="timeline-desc">{s.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
