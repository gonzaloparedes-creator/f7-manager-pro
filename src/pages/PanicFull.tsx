import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Navigate } from "react-router-dom";
import { usePlan } from "@/hooks/usePlan";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DISCLAIMER,
  analyzePanicText,
  buildReport,
  categoryLabel,
  summarizePatterns,
  type AnalyzeResult,
  type Confidence,
  type FaultCategory,
  type Finding,
  type PanicAnalysis,
} from "@/lib/panicAnalyzer";
import { Cpu, UploadCloud, ClipboardPaste, Copy, Trash2, AlertTriangle, ShieldCheck, Smartphone, Repeat } from "lucide-react";

const MAX_FILES = 10;
const MAX_BYTES = 3 * 1024 * 1024;

const CATEGORY_STYLE: Record<FaultCategory, string> = {
  hardware: "border-primary/40 bg-primary/10 text-primary",
  software: "border-secondary/50 bg-secondary/15 text-secondary-foreground",
  mixto: "border-border bg-muted text-muted-foreground",
};

const CONFIDENCE_VARIANT: Record<Confidence, "default" | "secondary" | "outline"> = {
  alta: "default",
  media: "secondary",
  baja: "outline",
};

function FindingBlock({ finding, primary }: { finding: Finding; primary?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className={cn("font-semibold text-foreground", primary ? "text-lg" : "text-sm")}>{finding.title}</h3>
        <Badge variant="outline" className={CATEGORY_STYLE[finding.category]}>{categoryLabel(finding.category)}</Badge>
        <Badge variant={CONFIDENCE_VARIANT[finding.confidence]}>Confianza {finding.confidence}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{finding.explanation}</p>
      {finding.evidence && (
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs text-foreground">{finding.evidence}</pre>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Componentes a revisar</div>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {finding.components.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Qué verificar</div>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {finding.checks.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: AnalyzeResult }) {
  if (result.ok === false) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex items-start gap-3 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{result.fileName ?? "Texto pegado"}</div>
            <p className="text-sm text-muted-foreground">{result.error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const a: PanicAnalysis = result.analysis;
  const [main, ...others] = a.findings;
  const deviceLine = [
    a.device.name ? `${a.device.name}${a.device.id ? ` (${a.device.id})` : ""}` : a.device.id,
    a.device.osVersion,
    a.device.date,
  ].filter(Boolean).join(" · ");

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{a.fileName ?? "Texto pegado"}</div>
            <div className="text-sm text-muted-foreground">{deviceLine || "Equipo no identificado en el archivo"}</div>
          </div>
        </div>

        <FindingBlock finding={main} primary />

        {a.kextHints.length > 0 && (
          <div className="text-sm">
            <span className="font-medium">Drivers en el backtrace: </span>
            <span className="text-muted-foreground">{a.kextHints.map((k) => k.component).join(", ")}</span>
          </div>
        )}

        {others.length > 0 && (
          <div className="space-y-3 border-t pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Otras posibilidades</div>
            {others.map((f) => (
              <details key={f.ruleId} className="rounded-md border p-3">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium">
                  {f.title}
                  <Badge variant="outline" className={CATEGORY_STYLE[f.category]}>{categoryLabel(f.category)}</Badge>
                  <Badge variant={CONFIDENCE_VARIANT[f.confidence]}>Confianza {f.confidence}</Badge>
                </summary>
                <div className="mt-3"><FindingBlock finding={f} /></div>
              </details>
            ))}
          </div>
        )}

        {a.headline && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Ver línea principal del panic</summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">{a.headline}</pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

export default function PanicFull() {
  const { isStarter, loading: planLoading } = usePlan();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<AnalyzeResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasted, setPasted] = useState("");

  const analyzeFiles = async (incoming: File[]) => {
    if (incoming.length === 0) return;
    const files = incoming.slice(0, MAX_FILES);
    if (incoming.length > MAX_FILES) {
      toast({ title: `Máximo ${MAX_FILES} archivos por vez`, description: `Se analizaron los primeros ${MAX_FILES}.` });
    }
    setBusy(true);
    const out: AnalyzeResult[] = [];
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        out.push({ ok: false, fileName: file.name, error: "El archivo es demasiado grande para ser un panic-full (máximo 3 MB)." });
        continue;
      }
      try {
        out.push(analyzePanicText(await file.text(), file.name));
      } catch {
        out.push({ ok: false, fileName: file.name, error: "No se pudo leer el archivo." });
      }
    }
    setResults(out);
    setBusy(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    analyzeFiles(Array.from(e.dataTransfer.files));
  };

  const onZoneKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const analyzePasted = () => {
    if (!pasted.trim()) return;
    setResults([analyzePanicText(pasted, null)]);
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(buildReport(results));
      toast({ title: "Informe copiado", description: "Ya podés pegarlo en WhatsApp o en una nota de la orden." });
    } catch {
      toast({ title: "No se pudo copiar", description: "Copiá el informe manualmente.", variant: "destructive" });
    }
  };

  const clearAll = () => {
    setResults([]);
    setPasted("");
    if (inputRef.current) inputRef.current.value = "";
  };

  if (!planLoading && isStarter) return <Navigate to="/dashboard" replace />;

  const analyses = results.flatMap((r) => (r.ok ? [r.analysis] : []));
  const patterns = summarizePatterns(analyses);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Cpu className="h-6 w-6 text-primary" />
          Analizador de Panic Full
        </h1>
        <p className="text-sm text-muted-foreground">
          Subí el registro de un iPhone que se reinicia solo y te mostramos la falla probable y qué revisar.
        </p>
      </div>

      <Card className="border-secondary/40 bg-secondary/10">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
          <p className="text-muted-foreground">{DISCLAIMER}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={onZoneKey}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/60 hover:bg-muted/40"
            )}
          >
            <UploadCloud className="h-8 w-8 text-primary" />
            <div className="font-medium">{busy ? "Analizando..." : "Arrastrá el archivo acá o hacé clic para elegirlo"}</div>
            <div className="text-xs text-muted-foreground">
              Archivo panic-full-….ips (hasta {MAX_FILES} a la vez). Si subís varios del mismo equipo, detectamos los patrones repetidos.
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".ips,.txt,.log,.json"
              className="hidden"
              onChange={(e) => {
                analyzeFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </div>

          <div>
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => setShowPaste((v) => !v)}>
              <ClipboardPaste className="h-4 w-4" />
              {showPaste ? "Ocultar texto pegado" : "O pegá el texto del log"}
            </Button>
            {showPaste && (
              <div className="mt-2 space-y-2">
                <Textarea
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  rows={6}
                  placeholder="Pegá acá el contenido del panic-full"
                  className="font-mono text-xs"
                />
                <Button size="sm" onClick={analyzePasted} disabled={!pasted.trim()}>Analizar texto</Button>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            El archivo se analiza en tu navegador: no se sube ni se guarda en ningún servidor.
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Resultado{results.length > 1 ? `s (${results.length} logs)` : ""}</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={copyReport}>
                <Copy className="h-4 w-4" /> Copiar informe
              </Button>
              <Button variant="ghost" size="sm" className="gap-2" onClick={clearAll}>
                <Trash2 className="h-4 w-4" /> Limpiar
              </Button>
            </div>
          </div>

          {patterns.length > 0 && (
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Repeat className="h-4 w-4 text-primary" /> Patrón repetido
                </div>
                <ul className="space-y-1 text-sm">
                  {patterns.map((p) => (
                    <li key={p.ruleId}>
                      <span className="font-medium">{p.title}</span>
                      <span className="text-muted-foreground"> — en {p.count} de {p.total} logs. Si se repite en el mismo equipo, es una señal más fuerte.</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {results.map((r, i) => <ResultCard key={i} result={r} />)}
        </div>
      )}

      <Card>
        <CardContent className="space-y-2 p-5 text-sm">
          <div className="font-semibold">¿Cómo consigo el archivo?</div>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Desde la computadora: exportá el registro <span className="font-mono text-xs">panic-full-….ips</span> del iPhone con 3uTools u otra herramienta.</li>
            <li>Desde el iPhone: Ajustes → Privacidad y seguridad → Analítica y mejoras → Datos de analítica, y buscá el que empieza con <span className="font-mono text-xs">panic-full</span>. Compartilo con “Guardar en Archivos”.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
