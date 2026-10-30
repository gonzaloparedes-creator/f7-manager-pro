-- En una empresa con UNA sola sucursal, los artículos pertenecen a esa sucursal.
--
-- Bug de Servi Smart (una sola sucursal, "Central"): sus empleados de Recepción
-- y Staff, con "Solo ve su sucursal" activado, entraban a Inventario y a
-- Productos pero las listas salían vacías.
--
-- Causa: con una sola sucursal la app guardaba los artículos sin sucursal
-- ("no hace falta atribuir"), y la política RESTRICTIVE "Branch restricted
-- inventory" (20261006120000) deja a un usuario restringido ver solo lo que es
-- de su sucursal. Un artículo sin sucursal no es de ninguna, así que
-- desaparecía para él (y vender uno también fallaba: product_sales copia la
-- sucursal del artículo). Con varias sucursales ya se atribuía; el hueco era la
-- empresa de una sola.
--
-- Arreglo en dos partes:
--  1. Trigger BEFORE INSERT: un artículo nuevo sin sucursal, en una empresa que
--     tiene exactamente una, queda en esa. Va en la base y no solo en los
--     diálogos para cubrir todas las vías de alta (Inventario, Productos,
--     compra de equipos y lo que se sume). Con 0 o con varias sucursales no
--     hace nada: ahí "sin sucursal" sigue siendo "general", a propósito. Corre
--     antes del WITH CHECK de la política restrictiva, así que un restringido
--     que cargue un artículo tampoco queda rechazado.
--  2. Reparación de los existentes: los artículos sin sucursal de las empresas
--     de una sola sucursal pasan a esa sucursal. Para quien no está restringido
--     no cambia nada visible (sin varias sucursales la app no muestra columna
--     ni filtro de sucursal); para el restringido, los artículos reaparecen.
--
-- No se toca product_sales ni las cajas/gastos: son libros de solo agregar y su
-- historial "general" queda como está (un restringido arranca con ese
-- historial vacío, igual que en Seven Store).
--
-- Reversible: antes de esto ningún artículo de esas empresas tenía sucursal, así
-- que volver atrás es DROP TRIGGER + UPDATE ... SET branch_id = NULL por empresa.

CREATE OR REPLACE FUNCTION public.set_inventory_item_sole_branch()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.branch_id IS NULL THEN
    SELECT b.id INTO NEW.branch_id
    FROM public.branches b
    WHERE b.company_id = NEW.company_id
      AND (SELECT count(*) FROM public.branches x WHERE x.company_id = NEW.company_id) = 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER inventory_items_set_sole_branch
BEFORE INSERT ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.set_inventory_item_sole_branch();

UPDATE public.inventory_items i
SET branch_id = b.id
FROM public.branches b
WHERE i.branch_id IS NULL
  AND b.company_id = i.company_id
  AND (SELECT count(*) FROM public.branches x WHERE x.company_id = i.company_id) = 1;
