-- Bug real, encontrado por un test end-to-end antes de publicar: las dos
-- tablas nuevas de esta sesión (notification_send_log y product_sales) se
-- crearon con RLS pero SIN los GRANT de tabla que todas las demás tablas
-- de este esquema tienen (ver ej. `GRANT ... ON orders TO anon,
-- authenticated, service_role`). En Postgres, sin el GRANT de tabla no
-- importa qué digan las políticas de RLS — el motor rechaza el acceso antes
-- de llegar a evaluarlas ("permission denied for table ..."). RLS sigue
-- siendo la que de verdad restringe filas/columnas; esto solo empareja el
-- nivel de acceso de tabla con el resto del esquema.
--
-- Efecto real de este bug mientras estuvo sin corregir:
--   - product_sales: la función de venta rápida no funcionaba en absoluto.
--   - notification_send_log: el rate-limit de las edge functions de
--     WhatsApp fallaba en silencio (el insert de log y el select de conteo
--     tiraban error, pero el código no revisaba ese error puntual, así que
--     el envío de la notificación seguía funcionando normal — solo el
--     límite de tasa quedaba inactivo, sin bloquear nada).

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_sales TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_send_log TO anon, authenticated, service_role;
