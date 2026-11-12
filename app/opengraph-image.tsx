import { ImageResponse } from 'next/og';

// The link preview for every page (Open Graph, and Twitter/X falls back to it).
export const alt = "Lastly. Nobody should keep paying after they're gone.";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#fbf8f3',
          color: '#001c64',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 64, height: 64, display: 'flex', background: '#001c64', borderRadius: 14, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 20, top: 13, width: 8, height: 35, background: '#fbf8f3', borderRadius: 4 }} />
            <div style={{ position: 'absolute', left: 20, top: 40, width: 25, height: 8, background: '#fbf8f3', borderRadius: 4 }} />
            <div style={{ position: 'absolute', left: 42, top: 16, width: 8, height: 8, background: '#e0895f', borderRadius: 4 }} />
          </div>
          <div style={{ fontSize: 40, fontWeight: 600 }}>Lastly</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ fontSize: 80, lineHeight: 1.05, letterSpacing: '-0.02em', maxWidth: 980 }}>
            Nobody should keep paying after they’re gone.
          </div>
          <div style={{ fontSize: 30, lineHeight: 1.4, color: '#3d4656', maxWidth: 960 }}>
            One calm place to settle a loved one’s PayPal payments: stop the charges, return what was taken after the death, and pay the heirs.
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: '#b4532a' }}>PayPal Sandbox demo · fictional estate</div>
      </div>
    ),
    size,
  );
}
