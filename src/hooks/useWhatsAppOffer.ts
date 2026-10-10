import { createContext, useContext } from "react";

export type CreationOfferEvent = "orden_creada" | "presupuesto_creado";

export interface WhatsAppOfferApi {
  /**
   * Ofrece avisarle al cliente por WhatsApp que se creó su orden/presupuesto.
   * Carga todo desde la base por id, así que se puede llamar apenas se crea
   * la orden aunque el diálogo que la creó se cierre enseguida.
   */
  offerCreation: (orderIds: string[], event: CreationOfferEvent) => void;
}

export const WhatsAppOfferContext = createContext<WhatsAppOfferApi>({
  offerCreation: () => {},
});

export function useWhatsAppOffer() {
  return useContext(WhatsAppOfferContext);
}
