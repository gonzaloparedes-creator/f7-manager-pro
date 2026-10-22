import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, HelpCircle, Pencil, Plus, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  formatGs,
  formatPct,
  shortcutDraft,
  suggestSettlements,
  type F7Partner,
  type PartnerPosition,
  type Snapshot,
  type Transfer,
} from "@/lib/f7Finance";
import type { FinanceActions } from "./helpers";
import { EmptyState, SectionTitle, Stat } from "./shared";

interface Props {
  snapshot: Snapshot;
  partners: F7Partner[];
  today: string;
  actions: FinanceActions;
}

export function PartnersTab({ snapshot, partners, today, actions }: Props) {
  const positions = snapshot.partners;
  const settlements = useMemo(() => suggestSettlements(positions), [positions]);
  const anyOwed = positions.some((p) => p.saldoTotal > 0);
  const nameOf = (id: string) => positions.find((p) => p.partnerId === id)?.name ?? "Socio";

  if (partners.length === 0) {
    return (
      <div className="space-y-4" data-testid="partners-tab">
        <EmptyState>
          Todavía no cargaste a los socios. Agregá a cada uno con su porcentaje de las ganancias y vas a ver cuánto le toca, qué puso y qué le falta
          retirar.
        </EmptyState>
        <div className="flex justify-center">
          <Button onClick={actions.newPartner} data-testid="partners-new">
            <UserPlus className="mr-1.5 h-4 w-4" />
            Agregar socio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="partners-tab">
      <Card className="border-l-4 border-l-primary p-4" data-testid="cash-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Caja F7</div>
            <div
              className={cn("text-2xl font-bold tabular-nums", snapshot.caja < 0 && "text-destructive")}
              data-testid="cash-value"
            >
              {formatGs(snapshot.caja)}
            </div>
            <div className="text-xs text-muted-foreground">Plata de F7 que no está en el bolsillo de ningún socio.</div>
          </div>
          <Button size="sm" variant="outline" onClick={actions.newPartner} data-testid="partners-new">
            <Plus className="mr-1.5 h-4 w-4" />
            Agregar socio
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Stat label="Resultado acumulado" value={formatGs(snapshot.resultadoAcumulado)} hint="Ingresos cobrados menos gastos pagados, desde el inicio" tone={snapshot.resultadoAcumulado < 0 ? "bad" : undefined} />
          <Stat label="Retiros de utilidad" value={formatGs(snapshot.totalDistribuido)} hint="Lo que ya se llevaron los socios" />
          <Stat label="Cuentas de los socios" value={formatGs(snapshot.sumaCuentas)} hint="Lo que F7 les debe (más) o tienen de F7 (menos)" />
        </div>
      </Card>

      <section className="space-y-3">
        <SectionTitle>Socios</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2" data-testid="partners-list">
          {positions.map((position) => {
            const partner = partners.find((p) => p.id === position.partnerId);
            return partner ? (
              <PartnerCard key={position.partnerId} position={position} partner={partner} today={today} actions={actions} />
            ) : null;
          })}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Para dejar las cuentas al día</SectionTitle>
        <Card className="p-4" data-testid="settlements">
          {settlements.length > 0 ? (
            <div className="space-y-3">
              <ul className="space-y-2">
                {settlements.map((transfer) => (
                  <SettlementRow
                    key={`${transfer.fromId}-${transfer.toId}`}
                    transfer={transfer}
                    from={nameOf(transfer.fromId)}
                    to={nameOf(transfer.toId)}
                    onSettle={actions.settle}
                  />
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Con esa transferencia las cuentas entre ustedes quedan en cero; lo que sobre sigue en la Caja F7.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="settlements-empty">
              No hace falta ninguna transferencia entre socios.
              {anyOwed ? " Lo que le corresponde a cada uno sale de la Caja F7: registralo con “Retiro” en su tarjeta." : ""}
            </p>
          )}
        </Card>
      </section>

      <HowItWorks />
    </div>
  );
}

function SettlementRow({
  transfer,
  from,
  to,
  onSettle,
}: {
  transfer: Transfer;
  from: string;
  to: string;
  onSettle: (transfer: Transfer) => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2.5" data-testid="settlement-row">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-medium">{from}</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
        <span className="font-medium">{to}</span>
        <span className="font-semibold tabular-nums text-primary">{formatGs(transfer.amount)}</span>
      </div>
      <Button size="sm" onClick={() => onSettle(transfer)} data-testid="settlement-register">
        Registrar liquidación
      </Button>
    </li>
  );
}

function cuentaHint(cuenta: number): string {
  if (cuenta > 0) return "F7 le debe";
  if (cuenta < 0) return "Tiene plata de F7";
  return "Al día";
}

function PartnerCard({
  position,
  partner,
  today,
  actions,
}: {
  position: PartnerPosition;
  partner: F7Partner;
  today: string;
  actions: FinanceActions;
}) {
  const [open, setOpen] = useState(false);
  const owed = position.saldoTotal;
  const overWithdrawn = position.pendienteRetiro < 0;
  const newShortcut = (kind: "aporte" | "reembolso" | "distribucion") => actions.newEntry(shortcutDraft(kind, position, today));

  return (
    <Card className={cn("space-y-3 p-4", !position.active && "opacity-80")} data-testid="partner-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h3 className="break-words text-base font-semibold">{position.name}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              {formatPct(position.sharePct)} de las ganancias
            </Badge>
            {position.active ? null : (
              <Badge variant="outline" className="border-border bg-muted/40 text-muted-foreground">
                Inactivo
              </Badge>
            )}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => actions.editPartner(partner)} data-testid="partner-edit">
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Editar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Cuenta" value={formatGs(position.cuenta)} hint={cuentaHint(position.cuenta)} />
        <Stat label="Utilidad acumulada" value={formatGs(position.utilidad)} hint={`${formatPct(position.sharePct)} del resultado`} />
        <Stat label="Ya retiró" value={formatGs(position.retirado)} />
        <Stat
          label="Le falta retirar"
          value={formatGs(position.pendienteRetiro)}
          hint={overWithdrawn ? "Retiró de más" : undefined}
          tone={overWithdrawn ? "bad" : undefined}
        />
        <div className="col-span-2">
          <Stat
            label="Saldo total"
            value={formatGs(owed)}
            hint={owed > 0 ? "Le corresponde cobrar esto en total" : owed < 0 ? "Tiene esto de más respecto de lo que le corresponde" : "Al día"}
            tone={owed < 0 ? "warn" : undefined}
          />
        </div>
      </div>

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground" data-testid="partner-detail-toggle">
            <ChevronDown className={cn("mr-1 h-4 w-4 transition-transform", open && "rotate-180")} />
            {open ? "Ocultar detalle" : "Ver de dónde sale la cuenta"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <dl className="mt-1 space-y-1 rounded-md border border-border px-3 py-2 text-sm" data-testid="partner-detail">
            <DetailRow label="Aportes (puso en la caja)" value={position.aportes} />
            <DetailRow label="Gastos que adelantó" value={position.adelantos} />
            <DetailRow label="Reembolsos o retiros que pagó de su bolsillo" value={position.pagadoDeSuBolsillo} />
            <DetailRow label="Ingresos que cobró en su cuenta" value={-position.cobrado} />
            <DetailRow label="Reembolsos que recibió" value={-position.reembolsosRecibidos} />
            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-1.5 font-semibold">
              <dt>Cuenta</dt>
              <dd className="tabular-nums">{formatGs(position.cuenta)}</dd>
            </div>
          </dl>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!position.active} onClick={() => newShortcut("aporte")} data-testid="partner-aporte">
          Aporte
        </Button>
        <Button size="sm" variant="outline" disabled={!position.active} onClick={() => newShortcut("reembolso")} data-testid="partner-reembolso">
          Reembolso
        </Button>
        <Button size="sm" variant="outline" disabled={!position.active} onClick={() => newShortcut("distribucion")} data-testid="partner-retiro">
          Retiro
        </Button>
      </div>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 text-muted-foreground">{label}</dt>
      <dd className={cn("shrink-0 tabular-nums", value < 0 && "text-destructive")}>{formatGs(value)}</dd>
    </div>
  );
}

function HowItWorks() {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="p-0">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              data-testid="how-it-works-toggle"
            >
              <CardTitle className="flex items-center gap-2 text-sm">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                ¿Cómo se calcula?
              </CardTitle>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-2 border-t border-border pt-3 text-sm text-muted-foreground" data-testid="how-it-works">
            <p>
              <strong className="text-foreground">Resultado:</strong> ingresos cobrados menos gastos pagados. Lo pendiente y lo anulado no cuenta.
              Los aportes, reembolsos y retiros mueven plata entre ustedes y la caja, pero no son ingresos ni gastos.
            </p>
            <p>
              <strong className="text-foreground">Utilidad de cada socio:</strong> su porcentaje por el resultado acumulado.
            </p>
            <p>
              <strong className="text-foreground">Cuenta:</strong> lo que el socio puso (aportes), más los gastos que adelantó y lo que pagó de su
              bolsillo a otro socio, menos lo que cobró en su cuenta y los reembolsos que recibió. Positivo: F7 le debe. Negativo: tiene plata de
              F7.
            </p>
            <p>
              <strong className="text-foreground">Saldo total:</strong> la cuenta más la utilidad que todavía no retiró. La suma de los saldos de
              todos los socios es igual a la Caja F7.
            </p>
            <p>
              <strong className="text-foreground">Caja F7:</strong> ingresos que entraron directo a la caja y aportes, menos los gastos, reembolsos
              y retiros que salieron de la caja.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
