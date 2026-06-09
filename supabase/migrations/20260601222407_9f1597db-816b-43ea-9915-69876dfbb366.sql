-- Restore EXECUTE on public tracking RPCs (SECURITY DEFINER, scoped to a tracking code/token).
-- These are the ONLY entry point for unauthenticated customers to view their repair status,
-- and they only return non-sensitive fields needed for tracking. RLS on orders / history
-- remains strict and is bypassed only through these narrow functions.

GRANT EXECUTE ON FUNCTION public.get_order_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_history_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_technical_notes_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_history_by_tracking(uuid) TO anon, authenticated;