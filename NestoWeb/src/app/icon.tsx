import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1A1D23",
          borderRadius: 8,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 40 40">
          <path
            d="M12 27V13L28 27V13"
            fill="none"
            stroke="#B8863C"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
