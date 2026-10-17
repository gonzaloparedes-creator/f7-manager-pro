import { createContext, useContext } from "react";

export type CreationOfferEvent = "orden_creada" | "presupuesto_creado";

export interface WhatsAppOfferApi {
  /**
   * Ofrece avisarle al cliente por WhatsApp que se creó su orden/presupuesto.
   * Carga todo desde la base por id, así que se puede llamar apenas se crea
   * la orden aunque el diálogo que la creó se cierre enseguida.
   * Con `manual` (el usuario tocó el botón) se abre siempre: ignora el modo
   * Evolution, las preferencias de aviso y que el cliente haya pedido no
   * recibirlos, igual que "Avisar al cliente" en el detalle de la orden.
   */
  offerCreation: (orderIds: string[], event: CreationOfferEvent, opts?: { manual?: boolean }) => void;
}

export const WhatsAppOfferContext = createContext<WhatsAppOfferApi>({
  offerCreation: () => {},
});

export function useWhatsAppOffer() {
  return useContext(WhatsAppOfferContext);
}
