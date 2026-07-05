import { ImageResponse } from "next/og";

export const alt = "ProofArena · 高中数学解法竞技场";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#09090b",
          backgroundImage:
            "radial-gradient(circle at 82% 22%, rgba(34,211,238,0.22), transparent 42%), radial-gradient(circle at 12% 82%, rgba(245,158,11,0.14), transparent 36%)",
          color: "#f4f4f5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#22d3ee",
              color: "#09090b",
              fontSize: 30,
              fontWeight: 900,
            }}
          >
            P
          </div>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, color: "#67e8f9", textTransform: "uppercase" }}>
            2026 Math Season
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 44, fontSize: 104, fontWeight: 900, lineHeight: 1 }}>
          Proof
          <span style={{ color: "#22d3ee" }}>Arena</span>
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 36, fontWeight: 700, color: "#e4e4e7" }}>
          Same problem. Different solutions. Head to head.
        </div>
      </div>
    ),
    { ...size },
  );
}
