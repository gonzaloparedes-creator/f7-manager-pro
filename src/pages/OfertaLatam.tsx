import { VslLanding } from "@/components/VslLanding";
import { VSL_DURATION_LABEL, VSL_LATAM_YOUTUBE_ID } from "@/lib/vsl";
import { LATAM } from "@/pages/ofertaLatam.copy";

// /latam: la landing del VSL para talleres del resto de Latinoamérica, en dólares.
export default function OfertaLatam() {
  return (
    <VslLanding
      copy={LATAM}
      page="latam"
      videoId={VSL_LATAM_YOUTUBE_ID}
      durationLabel={VSL_DURATION_LABEL}
      poster="/latam/vsl-portada.webp"
      currency="usd"
    />
  );
}
