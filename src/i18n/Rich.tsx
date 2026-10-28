import { Fragment } from "react";
import { parseRich } from "@/i18n/parseRich";

interface RichProps {
  text: string;
  strongClass?: string;
  accentClass?: string;
}

export function Rich({ text, strongClass = "font-semibold text-foreground", accentClass = "text-primary" }: RichProps) {
  return (
    <>
      {parseRich(text).map((part, i) => {
        if (part.kind === "br") return <br key={i} />;
        if (part.kind === "text") return <Fragment key={i}>{part.text}</Fragment>;
        return (
          <span key={i} className={part.kind === "strong" ? strongClass : accentClass}>
            {part.text}
          </span>
        );
      })}
    </>
  );
}
