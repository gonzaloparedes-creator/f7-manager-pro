-- generate_order_number(uuid) quedó con EXECUTE abierto a PUBLIC por
-- default de Postgres (ninguna función nueva revoca eso automáticamente).
-- Solo lo llaman NewOrderDialog/NewQuoteDialog desde una sesión ya
-- autenticada, así que no hace falta que un visitante anónimo pueda
-- incrementar el contador de una empresa.
REVOKE EXECUTE ON FUNCTION public.generate_order_number(uuid) FROM PUBLIC;
