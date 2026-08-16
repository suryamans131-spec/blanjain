import React from "react";

export default function PhoneFrame({ accent, statusLabel, children }) {
  return (
    <div className="phone" style={{ "--accent": accent }}>
      <div className="phone-notch" />
      <div className="phone-statusbar">
        <span>9:4{Math.floor(Math.random() * 9)}</span>
        <span className="phone-statusbar-right">{statusLabel}</span>
      </div>
      <div className="phone-screen">{children}</div>
    </div>
  );
}
