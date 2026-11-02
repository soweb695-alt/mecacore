"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/** Zone de signature tactile (souris, doigt ou stylet). Exporte un PNG en data URL. */
export function SignaturePad({ onSave, pending }: { onSave: (dataUrl: string) => void; pending?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dessin = useRef(false);
  const [vide, setVide] = useState(true);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#14181f";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }

  function debut(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ref.current!.setPointerCapture(e.pointerId);
    dessin.current = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setVide(false);
  }

  function trace(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dessin.current) return;
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function effacer() {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    setVide(true);
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={ref}
        width={640}
        height={240}
        aria-label="Zone de signature du client"
        className="w-full touch-none rounded-lg border bg-white"
        onPointerDown={debut}
        onPointerMove={trace}
        onPointerUp={() => (dessin.current = false)}
        onPointerLeave={() => (dessin.current = false)}
      />
      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" onClick={effacer}>
          Effacer
        </Button>
        <Button type="button" disabled={vide || pending} onClick={() => onSave(ref.current!.toDataURL("image/png"))}>
          Valider la signature
        </Button>
      </div>
    </div>
  );
}
