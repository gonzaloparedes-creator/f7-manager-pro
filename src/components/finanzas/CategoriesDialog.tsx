import { useMemo, useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { validateCategoryName, type F7Category, type F7Entry, type F7Recurring } from "@/lib/f7Finance";
import { createCategory, deleteCategory, updateCategory } from "@/lib/f7FinanceApi";
import { FieldError, SectionTitle } from "./shared";

interface Props {
  open: boolean;
  categories: F7Category[];
  entries: F7Entry[];
  recurring: F7Recurring[];
  onClose: () => void;
  onSaved: (category: F7Category) => void;
  onDeleted: (id: string) => void;
}

export function CategoriesDialog({ open, onClose, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto" data-testid="categories-dialog">
        <DialogHeader>
          <DialogTitle>Categorías</DialogTitle>
          <DialogDescription>
            Ordenan los ingresos y gastos en los reportes. Una categoría con movimientos no se puede borrar: desactivala y deja de ofrecerse.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <div className="space-y-5">
            <KindSection kind="ingreso" title="Ingresos" {...rest} />
            <KindSection kind="gasto" title="Gastos" {...rest} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function KindSection({
  kind,
  title,
  categories,
  entries,
  recurring,
  onSaved,
  onDeleted,
}: Omit<Props, "open" | "onClose"> & { kind: "ingreso" | "gasto"; title: string }) {
  const [newName, setNewName] = useState("");
  const [newError, setNewError] = useState<string>();
  const [adding, setAdding] = useState(false);

  const list = useMemo(
    () => categories.filter((c) => c.kind === kind).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "es")),
    [categories, kind]
  );

  const usage = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) if (e.category_id) map.set(e.category_id, (map.get(e.category_id) ?? 0) + 1);
    for (const r of recurring) map.set(r.category_id, (map.get(r.category_id) ?? 0) + 1);
    return map;
  }, [entries, recurring]);

  const add = async () => {
    const check = validateCategoryName(newName, kind, categories);
    if (!check.ok) {
      setNewError(check.message);
      return;
    }
    setAdding(true);
    try {
      onSaved(await createCategory(kind, check.name));
      setNewName("");
      setNewError(undefined);
      toast.success("Categoría creada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la categoría.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="space-y-2" data-testid={`categories-${kind}`}>
      <SectionTitle>{title}</SectionTitle>
      <ul className="divide-y divide-border rounded-md border border-border">
        {list.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            siblings={categories}
            uses={usage.get(category.id) ?? 0}
            onSaved={onSaved}
            onDeleted={onDeleted}
          />
        ))}
        {list.length === 0 ? <li className="px-3 py-3 text-sm text-muted-foreground">Todavía no hay categorías.</li> : null}
      </ul>
      <form
        className="flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!adding) void add();
        }}
      >
        <div className="min-w-0 flex-1">
          <Input
            value={newName}
            maxLength={60}
            onChange={(e) => {
              setNewName(e.target.value);
              setNewError(undefined);
            }}
            placeholder={kind === "ingreso" ? "Nueva categoría de ingreso" : "Nueva categoría de gasto"}
            aria-label={`Nueva categoría de ${kind === "ingreso" ? "ingresos" : "gastos"}`}
            data-testid={`category-new-${kind}`}
            disabled={adding}
            aria-invalid={!!newError}
          />
          <FieldError message={newError} />
        </div>
        <Button type="submit" size="sm" variant="outline" className="h-10" disabled={adding || !newName.trim()} data-testid={`category-add-${kind}`}>
          {adding ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
          Agregar
        </Button>
      </form>
    </section>
  );
}

function CategoryRow({
  category,
  siblings,
  uses,
  onSaved,
  onDeleted,
}: {
  category: F7Category;
  siblings: F7Category[];
  uses: number;
  onSaved: (category: F7Category) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (work: () => Promise<void>, fallback: string) => {
    setBusy(true);
    try {
      await work();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const rename = () => {
    const others = siblings.filter((c) => c.id !== category.id);
    const check = validateCategoryName(name, category.kind, others);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    if (check.name === category.name) {
      setEditing(false);
      return;
    }
    void run(async () => {
      onSaved(await updateCategory(category.id, { name: check.name }));
      setEditing(false);
      setError(undefined);
      toast.success("Categoría renombrada");
    }, "No se pudo guardar la categoría.");
  };

  const toggle = (active: boolean) =>
    void run(async () => {
      onSaved(await updateCategory(category.id, { active }));
    }, "No se pudo cambiar el estado de la categoría.");

  const remove = () =>
    void run(async () => {
      await deleteCategory(category.id);
      onDeleted(category.id);
      toast.success("Categoría borrada");
    }, "No se pudo borrar la categoría.");

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5" data-testid="category-row">
      <div className="min-w-0 flex-1 basis-40">
        {editing ? (
          <form
            className="flex items-start gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) rename();
            }}
          >
            <div className="min-w-0 flex-1">
              <Input
                value={name}
                maxLength={60}
                autoFocus
                onChange={(e) => {
                  setName(e.target.value);
                  setError(undefined);
                }}
                className="h-9"
                aria-label="Nombre de la categoría"
                aria-invalid={!!error}
                disabled={busy}
              />
              <FieldError message={error} />
            </div>
            <Button type="submit" size="icon" variant="ghost" className="h-9 w-9 shrink-0" disabled={busy} aria-label="Guardar nombre">
              <Check className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0"
              disabled={busy}
              aria-label="Cancelar"
              onClick={() => {
                setEditing(false);
                setName(category.name);
                setError(undefined);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className={category.active ? "truncate text-sm font-medium" : "truncate text-sm font-medium text-muted-foreground line-through"}>
              {category.name}
            </span>
            {!category.active ? <Badge variant="outline">Inactiva</Badge> : null}
            <span className="text-xs text-muted-foreground">{uses === 0 ? "Sin uso" : uses === 1 ? "1 movimiento" : `${uses} movimientos`}</span>
          </div>
        )}
      </div>

      {!editing ? (
        <div className="flex shrink-0 items-center gap-1">
          <Switch checked={category.active} onCheckedChange={toggle} disabled={busy} aria-label={category.active ? "Desactivar categoría" : "Activar categoría"} />
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(true)} disabled={busy} aria-label="Renombrar">
            <Pencil className="h-4 w-4" />
          </Button>
          {uses === 0 ? (
            confirmDelete ? (
              <>
                <Button type="button" size="sm" variant="destructive" className="h-8" onClick={remove} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Borrar"}
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setConfirmDelete(false)} disabled={busy} aria-label="Cancelar">
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                aria-label="Borrar categoría"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
