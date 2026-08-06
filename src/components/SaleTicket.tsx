import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatPYG } from "@/lib/orders";

interface TicketSale {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  payment_method: string | null;
  created_at: string;
}

interface SaleTicketProps {
  sale: TicketSale;
  businessName?: string | null;
  branchName?: string | null;
}

export function SaleTicket({ sale, businessName, branchName }: SaleTicketProps) {
  const shopName = businessName?.trim() || "F7 Manager Pro";
  const total = sale.quantity * Number(sale.unit_price || 0);
  const ticketNumber = sale.id.slice(-6).toUpperCase();

  return (
    <div className="print-ticket">
      <div className="text-center">
        <div className="text-sm font-bold">{shopName}</div>
        {branchName && <div className="text-[10px]">{branchName}</div>}
        <div className="text-[10px]">Comprobante de venta</div>
      </div>

      <div className="ticket-dashed" />

      <div className="flex justify-between text-[10px]">
        <span>Ticket #{ticketNumber}</span>
        <span>{format(new Date(sale.created_at), "dd/MM/yy HH:mm", { locale: es })}</span>
      </div>

      <div className="ticket-dashed" />

      <div className="text-[11px]">
        <div className="font-semibold">{sale.product_name}</div>
        <div className="flex justify-between">
          <span>{sale.quantity} x {formatPYG(sale.unit_price)}</span>
          <span>{formatPYG(total)}</span>
        </div>
      </div>

      <div className="ticket-dashed" />

      <div className="flex justify-between text-xs font-bold">
        <span>TOTAL</span>
        <span>{formatPYG(total)}</span>
      </div>
      <div className="flex justify-between text-[10px]">
        <span>Pago</span>
        <span>{sale.payment_method || "—"}</span>
      </div>

      <div className="ticket-dashed" />

      <div className="text-center text-[10px]">¡Gracias por su compra!</div>
    </div>
  );
}
