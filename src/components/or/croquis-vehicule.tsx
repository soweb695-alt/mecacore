"use client";

import { CROQUIS_H, CROQUIS_L, FORMES_CROQUIS, REPERES_CROQUIS } from "@/lib/croquis";
import { MAX_DOMMAGES, type Dommage } from "@/lib/fiche-controle";

/** Distance (en fraction) sous laquelle un toucher sur une croix existante la retire. */
const RAYON_RETRAIT = 0.04;

/**
 * Schéma du véhicule vu de dessus : un toucher place une croix (dommage), un toucher sur une croix la retire.
 * Sans `onChange`, le schéma est en lecture seule.
 */
export function CroquisVehicule({ dommages, onChange }: { dommages: Dommage[]; onChange?: (d: Dommage[]) => void }) {
  function toucher(e: React.PointerEvent<SVGSVGElement>) {
    if (!onChange) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const proche = dommages.findIndex((d) => Math.hypot((d.x - x) * 2, d.y - y) < RAYON_RETRAIT * 2);
    if (proche >= 0) onChange(dommages.filter((_, i) => i !== proche));
    else if (dommages.length < MAX_DOMMAGES) onChange([...dommages, { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 }]);
  }

  return (
    <div className="space-y-1.5">
      <svg
        viewBox={`0 0 ${CROQUIS_L} ${CROQUIS_H}`}
        role={onChange ? "button" : "img"}
        aria-label={`Schéma du véhicule : ${dommages.length} dommage${dommages.length > 1 ? "s" : ""} signalé${dommages.length > 1 ? "s" : ""}${onChange ? ". Touchez pour placer ou retirer une croix." : ""}`}
        className={`w-full max-w-xl touch-none select-none rounded-lg border bg-white ${onChange ? "cursor-crosshair" : ""}`}
        onPointerDown={toucher}
      >
        {FORMES_CROQUIS.map((f, i) =>
          f.type === "rect" ? (
            <rect key={i} x={f.x} y={f.y} width={f.l} height={f.h} rx={f.r ?? 0} fill={f.plein ? "#d4d8de" : "none"} stroke="#5a6270" strokeWidth={1.5} />
          ) : (
            <line key={i} x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke="#5a6270" strokeWidth={1.5} />
          ),
        )}
        {REPERES_CROQUIS.map((r) => (
          <text key={r.texte} x={r.x} y={r.y} transform={`rotate(${r.rotation} ${r.x} ${r.y})`} textAnchor="middle" fontSize={10} fill="#8a919c" fontWeight={600}>
            {r.texte}
          </text>
        ))}
        {dommages.map((d, i) => {
          const x = d.x * CROQUIS_L;
          const y = d.y * CROQUIS_H;
          return (
            <g key={i} stroke="#d92d20" strokeWidth={3} strokeLinecap="round">
              <line x1={x - 7} y1={y - 7} x2={x + 7} y2={y + 7} />
              <line x1={x - 7} y1={y + 7} x2={x + 7} y2={y - 7} />
            </g>
          );
        })}
      </svg>
      {onChange && <p className="text-xs text-muted-foreground">Touchez le schéma pour placer une croix sur un endroit abîmé ; touchez une croix pour la retirer.</p>}
    </div>
  );
}
