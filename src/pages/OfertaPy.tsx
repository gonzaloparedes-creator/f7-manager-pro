import { VslLanding } from "@/components/VslLanding";
import { VSL_DURATION_LABEL, VSL_YOUTUBE_ID } from "@/lib/vsl";
import { PY } from "@/pages/ofertaPy.copy";

// /py: la landing del VSL para talleres de Paraguay, en guaraníes.
export default function OfertaPy() {
  return (
    <VslLanding
      copy={PY}
      page="py"
      videoId={VSL_YOUTUBE_ID}
      durationLabel={VSL_DURATION_LABEL}
      poster="/py/vsl-portada.webp"
    />
  );
}
