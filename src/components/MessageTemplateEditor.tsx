import { Fragment, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MESSAGE_VARIABLES, PREVIEW_VARS, renderMessage, type MessageVars } from "@/lib/customerMessages";

// Mismo tope que el CHECK de whatsapp_templates.body.
export const MAX_TEMPLATE_LENGTH = 1500;
// Pasado esto, el link de wa.me puede cortarse (ver AvisarClienteDialog).
const LONG_MESSAGE = 1000;

function unavailableVariables(text: string, allowed: Set<string>): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/\{\{(\w+)\}\}/g)) if (!allowed.has(m[1])) found.add(m[0]);
  return [...found];
}

// WhatsApp muestra *texto* en negrita; la vista previa hace lo mismo.
function WhatsAppText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
        /^\*[^*\n]+\*$/.test(part) ? <strong key={i}>{part.slice(1, -1)}</strong> : <Fragment key={i}>{part}</Fragment>
      )}
    </>
  );
}

export default function MessageTemplateEditor({
  id,
  value,
  onChange,
  previewVars,
  variables,
  rows = 6,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Datos de ejemplo que pisan a los genéricos (ej. el estado que se edita). */
  previewVars?: Partial<MessageVars>;
  /** Variables que se pueden usar; por defecto todas. */
  variables?: (keyof MessageVars)[];
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insert = (token: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    if (next.length > MAX_TEMPLATE_LENGTH) return;
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const available = MESSAGE_VARIABLES.filter((v) => !variables || variables.includes(v.key));
  const unknown = unavailableVariables(value, new Set<string>(available.map((v) => v.key)));
  const preview = renderMessage(value, { ...PREVIEW_VARS, ...previewVars });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tocá una variable para insertarla donde está el cursor</Label>
        <div className="flex flex-wrap gap-1.5" data-testid="template-chips">
          {available.map((v) => (
            <button
              key={v.key}
              type="button"
              // Evita que el botón le saque el foco (y la selección) al texto.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(`{{${v.key}}}`)}
              title={`${v.label} — ej. ${v.example}`}
              className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 font-mono text-xs text-primary transition-colors hover:bg-primary/15"
            >
              {`{{${v.key}}}`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id}>Mensaje</Label>
        <Textarea
          id={id}
          ref={ref}
          rows={rows}
          maxLength={MAX_TEMPLATE_LENGTH}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="resize-none text-sm"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Usá *asteriscos* para poner una palabra en negrita.</span>
          <span>{value.length}/{MAX_TEMPLATE_LENGTH}</span>
        </div>
        {unknown.length > 0 && (
          <p className="text-xs text-destructive" role="alert">
            {unknown.length === 1 ? "La variable" : "Las variables"} {unknown.join(", ")} no {unknown.length === 1 ? "está disponible o está mal escrita" : "están disponibles o están mal escritas"}: se enviaría tal cual.
          </p>
        )}
        {preview.length > LONG_MESSAGE && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Es un mensaje largo: WhatsApp puede cortarlo al abrirse. Conviene acortarlo.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Así lo ve tu cliente (con datos de ejemplo)</Label>
        <div className="rounded-lg bg-muted/40 p-3">
          <div
            data-testid="template-preview"
            className="ml-auto max-w-[92%] whitespace-pre-wrap break-words rounded-lg rounded-tr-none bg-emerald-100 px-3 py-2 text-sm leading-relaxed text-emerald-950 shadow-sm dark:bg-emerald-900/50 dark:text-emerald-50"
          >
            <WhatsAppText text={preview || " "} />
          </div>
        </div>
      </div>
    </div>
  );
}
