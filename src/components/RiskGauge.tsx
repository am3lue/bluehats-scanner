import type { Verdict } from '@server/types';
import { VERDICT_SHORT } from '../lib/format';

interface RiskGaugeProps {
  score: number;
  verdict: Verdict;
  confidence: number;
  size?: number;
}

export function RiskGauge({ score, verdict, confidence, size = 168 }: RiskGaugeProps) {
  const radius = 64;
  const stroke = 12;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <div className={`risk-gauge is-${verdict}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 160 160" width={size} height={size} role="img" aria-label={`Risk score ${score} out of 100, ${VERDICT_SHORT[verdict]}`}>
        <circle cx="80" cy="80" r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="risk-gauge__track" />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          transform="rotate(-90 80 80)"
          className="risk-gauge__value"
        />
        <circle cx="80" cy="80" r={radius - stroke - 3} fill="none" stroke="currentColor" strokeWidth="0.8" className="risk-gauge__inner" />
      </svg>
      <div className="risk-gauge__center">
        <strong>{score}</strong>
        <span>risk / 100</span>
        <em>{confidence}% confidence</em>
      </div>
    </div>
  );
}
