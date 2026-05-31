import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const CryptoNews = ({ title, price, change, ticker, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  const slideUp = interpolate(frame, [0, 20], [60, 0], { extrapolateRight: 'clamp' });

  const scale = spring({ frame, fps, config: { damping: 12, stiffness: 80 } });

  const tickerOpacity = interpolate(frame, [10, 25], [0, 1], { extrapolateRight: 'clamp' });

  const isPositive = parseFloat(change) >= 0;
  const changeColor = isPositive ? '#00ff88' : '#ff4455';
  const arrow = isPositive ? '▲' : '▼';

  return (
    <AbsoluteFill style={{
      background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1b2a 50%, #0a0a1a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }} />

      {/* Main card */}
      <div style={{
        opacity,
        transform: `translateY(${slideUp}px)`,
        background: 'rgba(255,255,255,0.05)',
        border: `1px solid ${color}44`,
        borderRadius: 24,
        padding: '48px 64px',
        textAlign: 'center',
        backdropFilter: 'blur(10px)',
        minWidth: 520,
      }}>
        {/* Ticker */}
        <div style={{
          opacity: tickerOpacity,
          fontSize: 18,
          color: color,
          letterSpacing: 6,
          fontWeight: 700,
          marginBottom: 16,
          textTransform: 'uppercase',
        }}>
          {ticker}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 28,
          color: '#ffffff',
          fontWeight: 600,
          marginBottom: 32,
          lineHeight: 1.3,
          maxWidth: 480,
        }}>
          {title}
        </div>

        {/* Price */}
        <div style={{
          fontSize: 56,
          fontWeight: 800,
          color: '#ffffff',
          transform: `scale(${scale})`,
          marginBottom: 16,
        }}>
          ${price}
        </div>

        {/* Change */}
        <div style={{
          fontSize: 28,
          fontWeight: 700,
          color: changeColor,
        }}>
          {arrow} {change}%
        </div>
      </div>

      {/* Bottom label */}
      <div style={{
        position: 'absolute',
        bottom: 32,
        fontSize: 14,
        color: 'rgba(255,255,255,0.3)',
        letterSpacing: 3,
      }}>
        CRYPTO NEWS
      </div>
    </AbsoluteFill>
  );
};
