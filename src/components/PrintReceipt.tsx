import { QRCodeCanvas } from "qrcode.react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DEFAULT_SERVICE_TERMS, formatPYG, STATUS_LABELS, type OrderStatus } from "@/lib/orders";

interface PrintOrder {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  device_type: string;
  imei: string | null;
  problems: string[];
  problem_other: string | null;
  problem_description: string | null;
  status: string;
  quote_amount: number;
  deposit_amount: number;
  estimated_delivery_date: string | null;
  device_pin: string | null;
  device_pattern: number[] | null;
  client_signature: string | null;
  created_at: string;
  customer_cedula?: string | null;
  has_sim?: boolean;
  has_sd?: boolean;
  has_esim?: boolean;
  has_case?: boolean;
  received_by_name?: string | null;
}

interface PrintReceiptProps {
  order: PrintOrder;
  businessName?: string | null;
}

function PatternPreview({ pattern }: { pattern: number[] | null }) {
  const dots = Array.from({ length: 9 }, (_, i) => i + 1);
  const positions: Record<number, { x: number; y: number }> = {};
  dots.forEach((d) => {
    const idx = d - 1;
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    positions[d] = { x: 8 + col * 24, y: 8 + row * 24 };
  });

  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="border border-black/30">
      {pattern && pattern.length > 1 && (
        <polyline
          points={pattern.map((d) => `${positions[d].x},${positions[d].y}`).join(" ")}
          fill="none"
          stroke="#000"
          strokeWidth="1.5"
        />
      )}
      {dots.map((d) => {
        const active = pattern?.includes(d);
        const order = pattern?.indexOf(d) ?? -1;
        return (
          <g key={d}>
            <circle
              cx={positions[d].x}
              cy={positions[d].y}
              r={active ? 3.5 : 2}
              fill={active ? "#000" : "#666"}
            />
            {active && order >= 0 && (
              <text
                x={positions[d].x + 4}
                y={positions[d].y - 4}
                fontSize="6"
                fill="#000"
              >
                {order + 1}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function HalfHeader({ businessName, copyLabel }: { businessName: string; copyLabel: string }) {
  return (
    <div className="flex items-start justify-between border-b border-black pb-2">
      <div>
        <div className="text-lg font-bold tracking-tight">{businessName}</div>
        <div className="text-[10px] text-black/60">Comprobante de recepción</div>
      </div>
      <div className="text-right">
        <div className="inline-block rounded border border-black px-2 py-0.5 text-[10px] font-semibold uppercase">
          {copyLabel}
        </div>
      </div>
    </div>
  );
}

function InfoGrid({ order }: { order: PrintOrder }) {
  const balance = Math.max(0, (order.quote_amount ?? 0) - (order.deposit_amount ?? 0));
  return (
    <>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <div>
          <div className="text-black/60">Orden</div>
          <div className="font-mono font-bold">{order.order_number}</div>
        </div>
        <div>
          <div className="text-black/60">Fecha ingreso</div>
          <div>{format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: es })}</div>
        </div>
        <div>
          <div className="text-black/60">Cliente</div>
          <div className="font-semibold">{order.customer_name}</div>
        </div>
        <div>
          <div className="text-black/60">Teléfono</div>
          <div>{order.customer_phone}</div>
        </div>
        <div>
          <div className="text-black/60">Cédula de Identidad</div>
          <div className="font-mono">{order.customer_cedula || "—"}</div>
        </div>
        <div>
          <div className="text-black/60">Equipo</div>
          <div className="font-semibold">{order.device_type}</div>
        </div>
        <div>
          <div className="text-black/60">IMEI / Serie</div>
          <div className="font-mono">{order.imei || "—"}</div>
        </div>
        <div>
          <div className="text-black/60">Estado</div>
          <div>{STATUS_LABELS[order.status as OrderStatus] ?? order.status}</div>
        </div>
        <div>
          <div className="text-black/60">Entrega estimada</div>
          <div>
            {order.estimated_delivery_date
              ? format(new Date(order.estimated_delivery_date + "T00:00:00"), "dd/MM/yyyy", { locale: es })
              : "—"}
          </div>
        </div>
      </div>

      {(() => {
        const accs: string[] = [];
        if (order.has_sim) accs.push("SIM");
        if (order.has_sd) accs.push("Micro SD");
        if (order.has_esim) accs.push("eSIM");
        if (order.has_case) accs.push("Funda");
        return (
          <div className="grid grid-cols-2 gap-x-3 text-[11px]">
            <div>
              <div className="text-black/60">Recepcionado por</div>
              <div className="font-semibold">{order.received_by_name || "—"}</div>
            </div>
            <div>
              <div className="text-black/60">Accesorios</div>
              <div>{accs.length > 0 ? accs.join(" · ") : "Ninguno"}</div>
            </div>
          </div>
        );
      })()}

      {order.problems?.length > 0 && (
        <div className="text-[11px]">
          <div className="text-black/60">Problemas</div>
          <div>
            {order.problems
              .map((p) => (p === "Otro" && order.problem_other ? `Otro: ${order.problem_other}` : p))
              .join(" · ")}
          </div>
        </div>
      )}

      {order.problem_description && (
        <div className="text-[11px]">
          <div className="text-black/60">Observaciones</div>
          <div className="whitespace-pre-wrap">{order.problem_description}</div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 border-t border-black/30 pt-1 text-[11px]">
        <div>
          <div className="text-black/60">Presupuesto</div>
          <div className="font-semibold">{formatPYG(order.quote_amount)}</div>
        </div>
        <div>
          <div className="text-black/60">Seña</div>
          <div className="font-semibold">{formatPYG(order.deposit_amount)}</div>
        </div>
        <div>
          <div className="text-black/60">Saldo</div>
          <div className="font-bold">{formatPYG(balance)}</div>
        </div>
      </div>
    </>
  );
}

export function PrintReceipt({ order, businessName }: PrintReceiptProps) {
  const shopName = businessName?.trim() || "F7 Manager Pro";
  const trackingUrl = `${window.location.origin}/tracking/${order.order_number}`;

  return (
    <div className="print-receipt">
      {/* Top half — Shop copy */}
      <section className="print-half">
        <HalfHeader businessName={shopName} copyLabel="Copia Taller" />
        <div className="mt-2 space-y-2">
          <InfoGrid order={order} />

          <div className="grid grid-cols-2 gap-3 border-t border-black/30 pt-2 text-[11px]">
            <div>
              <div className="text-black/60">Seguridad del equipo</div>
              <div className="mt-1 space-y-1">
                <div>
                  <span className="text-black/60">PIN: </span>
                  <span className="font-mono font-semibold">{order.device_pin || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-black/60">Patrón:</span>
                  {order.device_pattern && order.device_pattern.length > 0 ? (
                    <>
                      <PatternPreview pattern={order.device_pattern} />
                      <span className="font-mono text-[10px]">{order.device_pattern.join("-")}</span>
                    </>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>
            </div>
            <div>
              <div className="text-black/60">Firma del cliente</div>
              <div className="mt-1 flex h-20 items-center justify-center border border-black/30 bg-white">
                {order.client_signature ? (
                  <img
                    src={order.client_signature}
                    alt="Firma"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] text-black/40">Sin firma</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cut line */}
      <div className="print-cut" aria-hidden>
        <span>✂  Cortar por aquí  ✂</span>
      </div>

      {/* Bottom half — Client copy */}
      <section className="print-half">
        <HalfHeader businessName={shopName} copyLabel="Copia Cliente" />
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-3">
          <div className="space-y-2">
            <InfoGrid order={order} />
          </div>
          <div className="flex flex-col items-center justify-start">
            <div className="border border-black/30 bg-white p-1">
              <QRCodeCanvas value={trackingUrl} size={96} level="M" includeMargin={false} />
            </div>
            <div className="mt-1 text-center text-[9px] text-black/70">
              Escaneá para seguir el estado
            </div>
            <div className="mt-0.5 break-all text-center font-mono text-[8px] text-black/60">
              {trackingUrl}
            </div>
          </div>
        </div>

        <div className="mt-2 border-t border-black/30 pt-1">
          <div className="text-[10px] font-semibold">Términos y condiciones</div>
          <div className="mt-0.5 whitespace-pre-wrap text-[8px] leading-tight text-black/80">
            {DEFAULT_SERVICE_TERMS}
          </div>
        </div>
      </section>
    </div>
  );
}
