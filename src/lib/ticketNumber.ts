// Número de ticket de una venta: los últimos 6 caracteres del identificador de
// la venta (su `sale_group_id`), en mayúsculas. Es el mismo que se imprime en el
// ticket, va en el comprobante por WhatsApp y aparece en Garantías, así que se
// calcula en un solo lugar para que los tres coincidan siempre.
export function ticketNumber(saleId: string): string {
  return saleId.slice(-6).toUpperCase();
}

const MARCAS_DE_TILDE = new RegExp("[\\u0300-\\u036f]", "g");
const plegar = (texto: string) => texto.normalize("NFD").replace(MARCAS_DE_TILDE, "").toLowerCase().trim();

/**
 * ¿Una venta responde a lo que se escribió en el buscador? Sirve para encontrarla por
 * el número que figura en el ticket (con o sin "#", completo o solo el comienzo/una parte)
 * o por el nombre de alguno de sus productos (sin distinguir mayúsculas ni tildes).
 * Un buscador vacío deja pasar todo.
 */
export function saleMatchesQuery(saleId: string, productNames: string[], query: string): boolean {
  const q = plegar(query.replace(/^#/, ""));
  if (!q) return true;
  if (ticketNumber(saleId).toLowerCase().includes(q)) return true;
  return productNames.some((name) => plegar(name).includes(q));
}
