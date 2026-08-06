import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatPYG } from "@/lib/orders";

interface TicketLineItem {
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface TicketSale {
  id: string;
  created_at: string;
  payment_method: string | null;
  items: TicketLineItem[];
}

interface SaleTicketProps {
  sale: TicketSale;
  businessName?: string | null;
  branchName?: string | null;
}

export function SaleTicket({ sale, businessName, branchName }: SaleTicketProps) {
  const shopName = businessName?.trim() || "F7 Manager Pro";
  const total = sale.items.reduce((s, i) => s + i.quantity * Number(i.unit_price || 0), 0);
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

      <div className="space-y-1.5 text-[11px]">
        {sale.items.map((item, i) => (
          <div key={i}>
            <div className="font-semibold">{item.product_name}</div>
            <div className="flex justify-between">
              <span>{item.quantity} x {formatPYG(item.unit_price)}</span>
              <span>{formatPYG(item.quantity * Number(item.unit_price || 0))}</span>
            </div>
          </div>
        ))}
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
