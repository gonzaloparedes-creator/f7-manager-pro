import { useWarrantyPresets } from "@/hooks/useWarrantyPresets";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const CUSTOM = "__custom__";

interface Props {
  value: number;
  onChange: (days: number) => void;
  className?: string;
}

/**
 * Dynamic warranty selector backed by the company's warranty_presets table.
 * Always appends an "Otro (Personalizado)" option that reveals a numeric input.
 */
export default function WarrantySelector({ value, onChange, className }: Props) {
  const { presets, loading } = useWarrantyPresets();
  const isCustom = !loading && !presets.some((p) => p.days === value);

  const selectValue = isCustom ? CUSTOM : String(value);

  return (
    <div className="space-y-2">
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v === CUSTOM) {
            if (!isCustom) onChange(value || 0);
          } else {
            onChange(Number(v));
          }
        }}
      >
        <SelectTrigger className={className ?? "sm:w-[280px]"}>
          <SelectValue placeholder={loading ? "Cargando..." : "Elegí garantía"} />
        </SelectTrigger>
        <SelectContent>
          {presets.map((p) => (
            <SelectItem key={p.id} value={String(p.days)}>
              {p.label} {p.days > 0 ? `(${p.days} días)` : ""}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM}>Otro (Personalizado)</SelectItem>
        </SelectContent>
      </Select>

      {isCustom && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={value}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              onChange(Number.isFinite(n) && n >= 0 ? n : 0);
            }}
            className="sm:w-[140px]"
            placeholder="Días"
          />
          <span className="text-xs text-muted-foreground">días personalizados</span>
        </div>
      )}
    </div>
  );
}
