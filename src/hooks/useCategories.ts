import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

export type InventoryCategory = { id: string; name: string };
export type InventorySubcategory = { id: string; category_id: string; name: string };

export function useCategories() {
  const { companyId } = useCompany();
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [subcategories, setSubcategories] = useState<InventorySubcategory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    const [{ data: cats }, { data: subs }] = await Promise.all([
      supabase.from("inventory_categories").select("id, name").eq("company_id", companyId).order("name"),
      supabase.from("inventory_subcategories").select("id, category_id, name").eq("company_id", companyId).order("name"),
    ]);
    setCategories((cats ?? []) as InventoryCategory[]);
    setSubcategories((subs ?? []) as InventorySubcategory[]);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const subcategoriesFor = (categoryId: string | null) =>
    categoryId ? subcategories.filter((s) => s.category_id === categoryId) : [];

  return { categories, subcategories, subcategoriesFor, loading, reload: load };
}
