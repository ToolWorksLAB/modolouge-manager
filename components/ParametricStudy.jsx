"use client";
import { useId, useMemo, useState } from "react";
function point(u, v, amount) {
  const r = 35 + 7 * Math.sin(u * 3 + amount * 0.025);
  const radius = 99 + amount * 0.22 * Math.cos(u * 3);
  const x = (radius + r * Math.cos(v)) * Math.cos(u);
  const y = (radius + r * Math.cos(v)) * Math.sin(u);
  const z = r * Math.sin(v) + amount * 0.46 * Math.sin(u * 3);
  const rotatedX = x * 0.91 - y * 0.41,
    rotatedY = x * 0.41 + y * 0.91;
  return [210 + rotatedX * 1.22, 167 + rotatedY * 0.62 - z * 1.05];
}
function pathFor(fixed, cross, amount) {
  return (
    Array.from({ length: 97 }, (_, i) => {
      const angle = (i / 96) * Math.PI * 2;
      const p = point(cross ? fixed : angle, cross ? angle : fixed, amount);
      return `${i ? "L" : "M"}${p[0].toFixed(2)},${p[1].toFixed(2)}`;
    }).join(" ") + "Z"
  );
}
export default function ParametricStudy() {
  const [amount, setAmount] = useState(38);
  const id = useId();
  const lines = useMemo(
    () => [
      ...Array.from({ length: 32 }, (_, i) => ({
        d: pathFor((i / 32) * Math.PI * 2, true, amount),
        cross: true,
      })),
      ...Array.from({ length: 17 }, (_, i) => ({
        d: pathFor((i / 17) * Math.PI * 2, false, amount),
        cross: false,
      })),
    ],
    [amount],
  );
  return (
    <div className="parametric-study">
      <div className="study-caption">
        <span>
          <i /> FORM STUDY — 001
        </span>
        <span>LIVE</span>
      </div>
      <svg
        className="study-drawing"
        viewBox="0 0 420 340"
        role="img"
        aria-label="A sculptural wireframe ring that changes as you move the deformation slider"
      >
        <path
          d="M35 290H385 M210 274V306 M194 290H226"
          className="study-axis"
        />
        {lines.map((line, i) => (
          <path
            key={i}
            d={line.d}
            fill="none"
            stroke={line.cross ? "#E91B8C" : "#fffff8"}
            strokeWidth={line.cross ? 0.85 : 0.55}
            opacity={line.cross ? 0.88 : 0.36}
          />
        ))}
      </svg>
      <div className="study-control">
        <label htmlFor={id}>A little change. A new possibility.</label>
        <output htmlFor={id}>{String(amount).padStart(2, "0")}</output>
      </div>
      <input
        id={id}
        type="range"
        min="0"
        max="100"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        aria-label="Deform the sample sculpture"
      />
      <div className="study-scale">
        <span>MOVE THE SLIDER</span>
        <span>SEE WHAT HAPPENS ↗</span>
      </div>
    </div>
  );
}
