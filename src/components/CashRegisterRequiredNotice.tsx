import { Link } from "react-router-dom";
import { Lock } from "lucide-react";

export default function CashRegisterRequiredNotice({ what }: { what: string }) {
  return (
    <div
      role="alert"
      data-testid="cash-required-notice"
      className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p>
        La caja de hoy todavía no está abierta, así que no se puede {what}. Abrila desde{" "}
        <Link to="/cierre-caja" className="font-semibold underline underline-offset-2">Caja</Link>{" "}
        y volvé a intentar.
      </p>
    </div>
  );
}
