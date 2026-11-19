// El carrito reparte el descuento dentro del precio de cada línea: `unit_price` ya viene
// rebajado (es lo que se cobró y lo que suman Reportes y Caja) y el precio que tenía antes
// se guarda en `unit_price_before_discount`. De ahí salen el precio de lista y el descuento
// que muestran el ticket, el comprobante por WhatsApp y la lista de ventas.
//
// Las ventas anteriores a esa columna, y las que no tuvieron descuento, no lo tienen: para
// ellas el precio "de lista" es el cobrado y no hay descuento que mostrar.

export interface DiscountableLine {
  quantity: number;
  unit_price: number | string | null;
  unit_price_before_discount?: number | string | null;
}

/** Precio por unidad antes del descuento; si no se guardó (o no es mayor al cobrado), el cobrado. */
export function lineListPrice(line: Pick<DiscountableLine, "unit_price" | "unit_price_before_discount">): number {
  const charged = Number(line.unit_price || 0);
  const before = Number(line.unit_price_before_discount);
  return before > charged ? before : charged;
}

/** Total de las líneas a precio de lista, antes del descuento. Sin descuento es igual a lo cobrado. */
export function listTotalOf(lines: DiscountableLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity * lineListPrice(l), 0);
}

/** Cuánto se rebajó en total respecto del precio de lista (0 si no hubo descuento). */
export function discountOf(lines: DiscountableLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity * (lineListPrice(l) - Number(l.unit_price || 0)), 0);
}
