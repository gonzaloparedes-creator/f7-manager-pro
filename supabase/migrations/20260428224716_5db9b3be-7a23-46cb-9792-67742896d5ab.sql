REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_company(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_branch(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_branch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

DROP POLICY IF EXISTS "Profiles select same company" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert same company" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update same company" ON public.profiles;

CREATE POLICY "Profiles select same company"
ON public.profiles
FOR SELECT
TO authenticated
USING (company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Profiles insert self or company admin"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND (auth.uid() = id OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Profiles update self or company admin"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  company_id = public.get_user_company(auth.uid())
  AND (auth.uid() = id OR public.has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND (auth.uid() = id OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS "Technicians view own order history" ON public.order_status_history;
DROP POLICY IF EXISTS "Technicians insert own order history" ON public.order_status_history;

CREATE POLICY "Order history select tenant scoped"
ON public.order_status_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_status_history.order_id
      AND o.company_id = public.get_user_company(auth.uid())
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR auth.uid() = o.technician_id
        OR auth.uid() = o.assigned_technician_id
        OR (o.current_branch_id IS NOT NULL AND o.current_branch_id = public.get_user_branch(auth.uid()))
      )
  )
);

CREATE POLICY "Order history insert tenant scoped"
ON public.order_status_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_status_history.order_id
      AND o.company_id = public.get_user_company(auth.uid())
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR auth.uid() = o.technician_id
        OR auth.uid() = o.assigned_technician_id
        OR (o.current_branch_id IS NOT NULL AND o.current_branch_id = public.get_user_branch(auth.uid()))
      )
  )
);

DROP POLICY IF EXISTS "Technicians view own order technical notes" ON public.order_technical_notes;
DROP POLICY IF EXISTS "Technicians insert own order technical notes" ON public.order_technical_notes;
DROP POLICY IF EXISTS "Technicians delete own order technical notes" ON public.order_technical_notes;

CREATE POLICY "Technical notes select tenant scoped"
ON public.order_technical_notes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_technical_notes.order_id
      AND o.company_id = public.get_user_company(auth.uid())
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR auth.uid() = o.technician_id
        OR auth.uid() = o.assigned_technician_id
        OR (o.current_branch_id IS NOT NULL AND o.current_branch_id = public.get_user_branch(auth.uid()))
      )
  )
);

CREATE POLICY "Technical notes insert tenant scoped"
ON public.order_technical_notes
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = technician_id
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_technical_notes.order_id
      AND o.company_id = public.get_user_company(auth.uid())
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR auth.uid() = o.technician_id
        OR auth.uid() = o.assigned_technician_id
        OR (o.current_branch_id IS NOT NULL AND o.current_branch_id = public.get_user_branch(auth.uid()))
      )
  )
);

CREATE POLICY "Technical notes delete own tenant scoped"
ON public.order_technical_notes
FOR DELETE
TO authenticated
USING (
  auth.uid() = technician_id
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_technical_notes.order_id
      AND o.company_id = public.get_user_company(auth.uid())
  )
);