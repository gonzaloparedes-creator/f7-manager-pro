-- Bug fix: la migración de "Equipo configurable" (20260829120000) hizo
-- CREATE OR REPLACE de seed_accessory_and_checklist_presets_for_company()
-- copiando el body desde una versión vieja de la función, y se perdió el
-- INSERT de order_status_presets que había agregado la migración anterior
-- (20260828120000) — CREATE OR REPLACE pisa el body entero, no lo extiende.
-- Se verificó contra producción que ninguna empresa se creó en la ventana
-- entre ambas migraciones, así que no hay datos que reparar — pero de acá
-- en más cualquier empresa nueva se hubiera quedado sin los estados
-- default. Se reconstruye la función completa (los 5 INSERT: accesorios,
-- checklist, problemas, tipos de equipo, estados) y de paso se agrega el
-- estado nuevo "Enviado".

CREATE OR REPLACE FUNCTION public.seed_accessory_and_checklist_presets_for_company() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.accessory_presets (company_id, label) VALUES
    (NEW.id, 'SIM Card'),
    (NEW.id, 'Micro SD'),
    (NEW.id, 'eSIM'),
    (NEW.id, 'Funda/Carcasa');
  INSERT INTO public.checklist_presets (company_id, label) VALUES
    (NEW.id, 'Enciende y carga'),
    (NEW.id, 'Pantalla sin daños visibles'),
    (NEW.id, 'Táctil responde correctamente'),
    (NEW.id, 'Cámaras funcionan'),
    (NEW.id, 'Botones físicos funcionan'),
    (NEW.id, 'Altavoz y micrófono funcionan');
  INSERT INTO public.problem_presets (company_id, label) VALUES
    (NEW.id, 'Display'),
    (NEW.id, 'Glass'),
    (NEW.id, 'Batería'),
    (NEW.id, 'Face ID'),
    (NEW.id, 'No enciende'),
    (NEW.id, 'No carga'),
    (NEW.id, 'Mojado'),
    (NEW.id, 'Sin señal'),
    (NEW.id, 'WiFi / Bluetooth'),
    (NEW.id, 'Cámaras'),
    (NEW.id, 'Audio'),
    (NEW.id, 'Tapa'),
    (NEW.id, 'Watch'),
    (NEW.id, 'Flex'),
    (NEW.id, 'Otro');
  INSERT INTO public.device_type_presets (company_id, label) VALUES
    (NEW.id, 'Celular'),
    (NEW.id, 'Tablet'),
    (NEW.id, 'Notebook / Laptop'),
    (NEW.id, 'Smartwatch'),
    (NEW.id, 'Otro');
  INSERT INTO public.order_status_presets (company_id, key, label, sort_order, is_locked) VALUES
    (NEW.id, 'recibido', 'Recibido', 1, true),
    (NEW.id, 'en_diagnostico', 'En diagnóstico', 2, false),
    (NEW.id, 'en_reparacion', 'En reparación', 3, false),
    (NEW.id, 'listo', 'Listo para retirar', 4, false),
    (NEW.id, 'enviado', 'Enviado', 5, false),
    (NEW.id, 'entregado', 'Entregado', 6, true),
    (NEW.id, 'garantia', 'Garantía', 7, false);
  RETURN NEW;
END;
$$;

-- Empresas ya existentes: se inserta "Enviado" justo antes de "Entregado"
-- para cada empresa individualmente (según su sort_order actual, no un
-- valor fijo global) para no pisar reordenamientos que un admin ya haya
-- hecho desde Configuración > Estados. No se toca is_locked de nada.
WITH shifted AS (
  UPDATE public.order_status_presets sp
  SET sort_order = sp.sort_order + 1
  FROM (SELECT company_id, sort_order FROM public.order_status_presets WHERE key = 'entregado') e
  WHERE sp.company_id = e.company_id AND sp.sort_order >= e.sort_order
  RETURNING sp.company_id, sp.key, sp.sort_order
)
INSERT INTO public.order_status_presets (company_id, key, label, sort_order, is_locked)
SELECT company_id, 'enviado', 'Enviado', sort_order - 1, false
FROM shifted
WHERE key = 'entregado'
ON CONFLICT (company_id, key) DO NOTHING;

-- Notificación automática de WhatsApp: "Enviado" es una clave nueva en el
-- objeto de preferencias (antes 5 claves fijas, ahora 6) — true por defecto
-- porque lo que se pidió es justamente que este estado avise al cliente.
-- Mismo aviso ya dejado para este objeto: si más adelante se permiten
-- claves dinámicas acá, hay que revisar este default también.
ALTER TABLE public.profiles
  ALTER COLUMN notification_preferences
  SET DEFAULT '{"recibido": true, "en_diagnostico": false, "en_reparacion": false, "listo": true, "enviado": true, "entregado": false}'::jsonb;

UPDATE public.profiles
SET notification_preferences = notification_preferences || '{"enviado": true}'::jsonb
WHERE NOT (notification_preferences ? 'enviado');
