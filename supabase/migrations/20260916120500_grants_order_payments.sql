-- La tabla quedó creada sin los privilegios base de Postgres para el rol
-- authenticated (RLS solo filtra FILAS; sin el GRANT de por medio, Postgres
-- rechaza la operación antes de siquiera evaluar las políticas). No se
-- otorga UPDATE/DELETE: el registro es append-only, ya reforzado además por
-- las políticas RESTRICTIVE "no update"/"no delete" de la migración anterior.
GRANT SELECT, INSERT ON public.order_payments TO authenticated;
