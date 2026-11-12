import { ImageResponse } from 'next/og';

// Home-screen icon: the same mark as app/icon.svg, drawn at 180px.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#001c64', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 56, top: 38, width: 22, height: 98, background: '#fbf8f3', borderRadius: 11 }} />
        <div style={{ position: 'absolute', left: 56, top: 114, width: 70, height: 22, background: '#fbf8f3', borderRadius: 11 }} />
        <div style={{ position: 'absolute', left: 117, top: 45, width: 24, height: 24, background: '#e0895f', borderRadius: 12 }} />
      </div>
    ),
    size,
  );
}
