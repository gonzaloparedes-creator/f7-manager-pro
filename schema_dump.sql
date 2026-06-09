--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'SQL_ASCII';
SET standard_conforming_strings = off;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET escape_string_warning = off;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

-- COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'staff'
);


--
-- Name: inventory_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.inventory_category AS ENUM (
    'Repuesto',
    'Accesorio',
    'Herramienta'
);


--
-- Name: auto_promote_super_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_promote_super_admin() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF lower(NEW.email) = 'ojvenialgo1@gmail.com' THEN
    UPDATE public.profiles SET is_super_admin = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: generate_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_order_number() RETURNS text
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  SELECT 'ORD-' || lpad(nextval('public.orders_friendly_seq')::text, 4, '0');
$$;


--
-- Name: get_history_by_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_history_by_code(_code text) RETURNS TABLE(id uuid, status text, note text, created_at timestamp with time zone, image_urls text[])
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT h.id, h.status, h.note, h.created_at, h.image_urls
  FROM public.order_status_history h
  JOIN public.orders o ON o.id = h.order_id
  WHERE upper(o.order_number) = upper(_code)
    AND h.is_internal = false
  ORDER BY h.created_at ASC;
$$;


--
-- Name: get_order_by_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_order_by_code(_code text) RETURNS TABLE(id uuid, order_number text, device_type text, status text, technician_notes text, estimated_delivery_date date, created_at timestamp with time zone, updated_at timestamp with time zone, quote_amount bigint, deposit_amount bigint, cargos_adicionales jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT id, order_number, device_type, status, technician_notes,
         estimated_delivery_date, created_at, updated_at,
         quote_amount, deposit_amount, cargos_adicionales
  FROM public.orders
  WHERE upper(order_number) = upper(_code)
  LIMIT 1;
$$;


--
-- Name: get_order_by_tracking(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_order_by_tracking(_token uuid) RETURNS TABLE(id uuid, order_number text, device_type text, status text, technician_notes text, estimated_delivery_date date, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT id, order_number, device_type, status, technician_notes, estimated_delivery_date, created_at, updated_at
  FROM public.orders
  WHERE tracking_token = _token
  LIMIT 1;
$$;


--
-- Name: get_order_history_by_tracking(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_order_history_by_tracking(_token uuid) RETURNS TABLE(id uuid, status text, note text, created_at timestamp with time zone, image_urls text[])
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT h.id, h.status, h.note, h.created_at, h.image_urls
  FROM public.order_status_history h
  JOIN public.orders o ON o.id = h.order_id
  WHERE o.tracking_token = _token
    AND h.is_internal = false
  ORDER BY h.created_at ASC;
$$;


--
-- Name: get_technical_notes_by_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_technical_notes_by_code(_code text) RETURNS TABLE(id uuid, note text, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT t.id, t.note, t.created_at
  FROM public.order_technical_notes t
  JOIN public.orders o ON o.id = t.order_id
  WHERE upper(o.order_number) = upper(_code)
  ORDER BY t.created_at DESC;
$$;


--
-- Name: get_user_branch(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_branch(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT branch_id FROM public.profiles WHERE id = _user_id
$$;


--
-- Name: get_user_company(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_company(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  meta_company uuid;
  new_company uuid;
BEGIN
  meta_company := NULLIF(NEW.raw_user_meta_data->>'company_id', '')::uuid;

  IF meta_company IS NULL THEN
    -- Self-signup: create a new tenant for this user
    INSERT INTO public.companies (name)
    VALUES (COALESCE(NULLIF(NEW.raw_user_meta_data->>'business_name', ''), 'Mi Empresa'))
    RETURNING id INTO new_company;
    meta_company := new_company;

    -- First user of a brand-new tenant becomes its admin
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.profiles (id, full_name, business_name, phone, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'business_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    meta_company
  );
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;


--
-- Name: is_company_active(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_company_active(_company_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE((SELECT is_active FROM public.companies WHERE id = _company_id), true);
$$;


--
-- Name: is_super_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE((SELECT is_super_admin FROM public.profiles WHERE id = _user_id), false);
$$;


--
-- Name: maintain_delivered_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_delivered_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'entregado' AND (OLD.status IS DISTINCT FROM 'entregado') AND NEW.delivered_at IS NULL THEN
    NEW.delivered_at := now();
  END IF;
  -- Do NOT clear delivered_at when leaving 'entregado'; preserve warranty start
  RETURN NEW;
END;
$$;


--
-- Name: maintain_delivered_at_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_delivered_at_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'entregado' AND NEW.delivered_at IS NULL THEN
    NEW.delivered_at := now();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: maintain_order_payment_dates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_order_payment_dates() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  cargos_total numeric := 0;
  total_amount numeric := 0;
BEGIN
  -- First deposit timestamp + lock the original seña amount
  IF COALESCE(OLD.deposit_amount, 0) = 0
     AND COALESCE(NEW.deposit_amount, 0) > 0 THEN
    IF NEW.deposit_date IS NULL THEN
      NEW.deposit_date := now();
    END IF;
    IF COALESCE(NEW.senia_amount, 0) = 0 THEN
      NEW.senia_amount := NEW.deposit_amount;
    END IF;
  END IF;

  -- Compute total including additional charges
  SELECT COALESCE(SUM((elem->>'monto')::numeric), 0)
    INTO cargos_total
  FROM jsonb_array_elements(COALESCE(NEW.cargos_adicionales, '[]'::jsonb)) elem;

  total_amount := COALESCE(NEW.quote_amount, 0) + cargos_total;

  IF total_amount > 0 AND COALESCE(NEW.deposit_amount, 0) >= total_amount THEN
    IF NEW.final_payment_date IS NULL THEN
      NEW.final_payment_date := now();
    END IF;
  ELSE
    NEW.final_payment_date := NULL;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: prevent_super_admin_self_escalation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_super_admin_self_escalation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
    IF NOT public.is_super_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Only super admins can modify is_super_admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: seed_warranty_presets_for_company(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_warranty_presets_for_company() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.warranty_presets (company_id, label, days) VALUES
    (NEW.id, 'Sin garantía', 0),
    (NEW.id, '15 días', 15),
    (NEW.id, '30 días', 30),
    (NEW.id, '90 días', 90);
  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


--
-- Name: validate_order_amounts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_order_amounts() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  cargos_total numeric := 0;
  total_amount numeric := 0;
BEGIN
  IF NEW.quote_amount < 0 THEN
    RAISE EXCEPTION 'El presupuesto no puede ser negativo';
  END IF;
  IF NEW.deposit_amount < 0 THEN
    RAISE EXCEPTION 'La seña no puede ser negativa';
  END IF;

  SELECT COALESCE(SUM((elem->>'monto')::numeric), 0)
    INTO cargos_total
  FROM jsonb_array_elements(COALESCE(NEW.cargos_adicionales, '[]'::jsonb)) elem;

  total_amount := COALESCE(NEW.quote_amount, 0) + cargos_total;

  IF NEW.deposit_amount > total_amount THEN
    RAISE EXCEPTION 'La seña no puede superar al total (presupuesto + cargos adicionales)';
  END IF;

  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    company_id uuid NOT NULL
);

ALTER TABLE ONLY public.branches FORCE ROW LEVEL SECURITY;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    technician_id uuid NOT NULL,
    name text NOT NULL,
    phone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cedula text,
    company_id uuid NOT NULL
);

ALTER TABLE ONLY public.clients FORCE ROW LEVEL SECURITY;


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    plan_type text DEFAULT 'starter'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);

ALTER TABLE ONLY public.companies FORCE ROW LEVEL SECURITY;


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    branch_id uuid,
    name text NOT NULL,
    category public.inventory_category DEFAULT 'Repuesto'::public.inventory_category NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    min_stock_alert integer DEFAULT 0 NOT NULL,
    cost_price numeric DEFAULT 0 NOT NULL,
    selling_price numeric DEFAULT 0 NOT NULL,
    image_url text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_parts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    inventory_item_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    historical_cost numeric DEFAULT 0 NOT NULL,
    historical_selling_price numeric DEFAULT 0 NOT NULL,
    supplier_name text,
    part_details text,
    CONSTRAINT order_parts_quantity_check CHECK ((quantity > 0))
);


--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    status text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    image_urls text[] DEFAULT '{}'::text[] NOT NULL
);

ALTER TABLE ONLY public.order_status_history FORCE ROW LEVEL SECURITY;


--
-- Name: order_technical_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_technical_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    technician_id uuid NOT NULL,
    note text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.order_technical_notes FORCE ROW LEVEL SECURITY;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    technician_id uuid NOT NULL,
    order_number text NOT NULL,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    device_type text NOT NULL,
    problem_description text DEFAULT ''::text,
    photos text[] DEFAULT '{}'::text[] NOT NULL,
    status text DEFAULT 'recibido'::text NOT NULL,
    technician_notes text,
    tracking_token uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    imei text,
    problems text[] DEFAULT '{}'::text[] NOT NULL,
    problem_other text,
    quote_amount bigint DEFAULT 0 NOT NULL,
    deposit_amount bigint DEFAULT 0 NOT NULL,
    estimated_delivery_date date,
    device_pin text,
    device_pattern integer[] DEFAULT '{}'::integer[],
    terms_accepted boolean DEFAULT false NOT NULL,
    client_signature text,
    cargos_adicionales jsonb DEFAULT '[]'::jsonb NOT NULL,
    client_id uuid,
    deposit_date timestamp with time zone,
    final_payment_date timestamp with time zone,
    senia_amount bigint DEFAULT 0 NOT NULL,
    received_branch_id uuid,
    current_branch_id uuid,
    assigned_technician_id uuid,
    company_id uuid NOT NULL,
    has_sim boolean DEFAULT false NOT NULL,
    has_sd boolean DEFAULT false NOT NULL,
    has_esim boolean DEFAULT false NOT NULL,
    has_case boolean DEFAULT false NOT NULL,
    received_by_id uuid,
    warranty_days integer DEFAULT 30 NOT NULL,
    delivered_at timestamp with time zone,
    alternative_phone text
);

ALTER TABLE ONLY public.orders FORCE ROW LEVEL SECURITY;


--
-- Name: orders_friendly_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_friendly_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    business_name text,
    phone text,
    evolution_instance_name text,
    whatsapp_connected boolean DEFAULT false NOT NULL,
    whatsapp_phone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    notification_preferences jsonb DEFAULT '{"listo": true, "recibido": true, "entregado": false, "en_reparacion": false, "en_diagnostico": false}'::jsonb NOT NULL,
    branch_id uuid,
    company_id uuid NOT NULL,
    is_super_admin boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY public.profiles FORCE ROW LEVEL SECURITY;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.user_roles FORCE ROW LEVEL SECURITY;


--
-- Name: warranty_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warranty_presets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    label text NOT NULL,
    days integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT warranty_presets_days_check CHECK ((days >= 0))
);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: order_parts order_parts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_parts
    ADD CONSTRAINT order_parts_pkey PRIMARY KEY (id);


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);


--
-- Name: order_technical_notes order_technical_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_technical_notes
    ADD CONSTRAINT order_technical_notes_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: orders orders_tracking_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_tracking_token_key UNIQUE (tracking_token);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: warranty_presets warranty_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warranty_presets
    ADD CONSTRAINT warranty_presets_pkey PRIMARY KEY (id);


--
-- Name: clients_tech_phone_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clients_tech_phone_unique ON public.clients USING btree (technician_id, phone) WHERE ((phone IS NOT NULL) AND (phone <> ''::text));


--
-- Name: clients_technician_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clients_technician_id_idx ON public.clients USING btree (technician_id);


--
-- Name: idx_branches_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_branches_company ON public.branches USING btree (company_id);


--
-- Name: idx_clients_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_company ON public.clients USING btree (company_id);


--
-- Name: idx_inventory_items_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_branch ON public.inventory_items USING btree (branch_id);


--
-- Name: idx_inventory_items_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_company ON public.inventory_items USING btree (company_id);


--
-- Name: idx_order_parts_inventory_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_parts_inventory_item_id ON public.order_parts USING btree (inventory_item_id);


--
-- Name: idx_order_parts_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_parts_order_id ON public.order_parts USING btree (order_id);


--
-- Name: idx_order_technical_notes_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_technical_notes_order_id ON public.order_technical_notes USING btree (order_id, created_at DESC);


--
-- Name: idx_orders_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_company ON public.orders USING btree (company_id);


--
-- Name: idx_profiles_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_company ON public.profiles USING btree (company_id);


--
-- Name: idx_warranty_presets_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warranty_presets_company ON public.warranty_presets USING btree (company_id);


--
-- Name: order_status_history_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_status_history_order_idx ON public.order_status_history USING btree (order_id);


--
-- Name: orders_client_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_client_id_idx ON public.orders USING btree (client_id);


--
-- Name: orders_technician_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_technician_idx ON public.orders USING btree (technician_id);


--
-- Name: orders_tracking_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_tracking_token_idx ON public.orders USING btree (tracking_token);


--
-- Name: clients clients_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER clients_set_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: companies companies_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER companies_set_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: inventory_items inventory_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: orders orders_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles profiles_prevent_super_admin_escalation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_prevent_super_admin_escalation BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_super_admin_self_escalation();


--
-- Name: branches trg_branches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: orders trg_maintain_order_payment_dates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_maintain_order_payment_dates BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.maintain_order_payment_dates();


--
-- Name: orders trg_orders_maintain_delivered_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_orders_maintain_delivered_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.maintain_delivered_at();


--
-- Name: orders trg_orders_maintain_delivered_at_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_orders_maintain_delivered_at_insert BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.maintain_delivered_at_insert();


--
-- Name: companies trg_seed_warranty_presets; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_seed_warranty_presets AFTER INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION public.seed_warranty_presets_for_company();


--
-- Name: orders validate_order_amounts_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_order_amounts_trigger BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.validate_order_amounts();


--
-- Name: branches branches_company_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: clients clients_company_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: inventory_items inventory_items_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;


--
-- Name: order_parts order_parts_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_parts
    ADD CONSTRAINT order_parts_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE RESTRICT;


--
-- Name: order_parts order_parts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_parts
    ADD CONSTRAINT order_parts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_status_history order_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_technical_notes order_technical_notes_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_technical_notes
    ADD CONSTRAINT order_technical_notes_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: orders orders_company_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: orders orders_current_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_current_branch_id_fkey FOREIGN KEY (current_branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;


--
-- Name: orders orders_received_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_received_branch_id_fkey FOREIGN KEY (received_branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;


--
-- Name: orders orders_received_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_received_by_id_fkey FOREIGN KEY (received_by_id) REFERENCES public.profiles(id);


--
-- Name: orders orders_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_company_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: companies Admins update own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update own company" ON public.companies FOR UPDATE TO authenticated USING ((((id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role)) OR public.is_super_admin(auth.uid())));


--
-- Name: branches Branches delete company admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Branches delete company admin" ON public.branches FOR DELETE TO authenticated USING (((public.has_role(auth.uid(), 'admin'::public.app_role) AND (company_id = public.get_user_company(auth.uid()))) OR public.is_super_admin(auth.uid())));


--
-- Name: branches Branches insert company admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Branches insert company admin" ON public.branches FOR INSERT TO authenticated WITH CHECK (((public.has_role(auth.uid(), 'admin'::public.app_role) AND (company_id = public.get_user_company(auth.uid())) AND public.is_company_active(company_id)) OR public.is_super_admin(auth.uid())));


--
-- Name: branches Branches select same company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Branches select same company" ON public.branches FOR SELECT TO authenticated USING (((company_id = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid())));


--
-- Name: branches Branches update company admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Branches update company admin" ON public.branches FOR UPDATE TO authenticated USING (((public.has_role(auth.uid(), 'admin'::public.app_role) AND (company_id = public.get_user_company(auth.uid()))) OR public.is_super_admin(auth.uid()))) WITH CHECK (((public.has_role(auth.uid(), 'admin'::public.app_role) AND (company_id = public.get_user_company(auth.uid()))) OR public.is_super_admin(auth.uid())));


--
-- Name: clients Clients delete same company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients delete same company" ON public.clients FOR DELETE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR (auth.uid() = technician_id)))));


--
-- Name: clients Clients insert same company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients insert same company" ON public.clients FOR INSERT TO authenticated WITH CHECK ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND (auth.uid() = technician_id) AND public.is_company_active(company_id))));


--
-- Name: clients Clients select same company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients select same company" ON public.clients FOR SELECT TO authenticated USING (((company_id = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid())));


--
-- Name: clients Clients update same company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients update same company" ON public.clients FOR UPDATE TO authenticated USING (((company_id = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid()))) WITH CHECK (((company_id = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid())));


--
-- Name: inventory_items Inventory delete admin same company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Inventory delete admin same company" ON public.inventory_items FOR DELETE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: inventory_items Inventory insert same company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Inventory insert same company" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.is_company_active(company_id))));


--
-- Name: inventory_items Inventory select same company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Inventory select same company" ON public.inventory_items FOR SELECT TO authenticated USING (((company_id = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid())));


--
-- Name: inventory_items Inventory update same company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Inventory update same company" ON public.inventory_items FOR UPDATE TO authenticated USING (((company_id = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid()))) WITH CHECK (((company_id = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid())));


--
-- Name: companies Members view own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view own company" ON public.companies FOR SELECT TO authenticated USING (((id = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid())));


--
-- Name: order_status_history Order history insert tenant scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Order history insert tenant scoped" ON public.order_status_history FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_status_history.order_id) AND (o.company_id = public.get_user_company(auth.uid())) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR (auth.uid() = o.technician_id) OR (auth.uid() = o.assigned_technician_id) OR ((o.current_branch_id IS NOT NULL) AND (o.current_branch_id = public.get_user_branch(auth.uid()))))))));


--
-- Name: order_status_history Order history no delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Order history no delete" ON public.order_status_history AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);


--
-- Name: order_status_history Order history no update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Order history no update" ON public.order_status_history AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);


--
-- Name: order_status_history Order history select tenant scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Order history select tenant scoped" ON public.order_status_history FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_status_history.order_id) AND (o.company_id = public.get_user_company(auth.uid())) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR (auth.uid() = o.technician_id) OR (auth.uid() = o.assigned_technician_id) OR ((o.current_branch_id IS NOT NULL) AND (o.current_branch_id = public.get_user_branch(auth.uid()))))))));


--
-- Name: order_parts Order parts delete tenant scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Order parts delete tenant scoped" ON public.order_parts FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_parts.order_id) AND (o.company_id = public.get_user_company(auth.uid()))))));


--
-- Name: order_parts Order parts insert tenant scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Order parts insert tenant scoped" ON public.order_parts FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_parts.order_id) AND (o.company_id = public.get_user_company(auth.uid()))))));


--
-- Name: order_parts Order parts select super admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Order parts select super admin" ON public.order_parts FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));


--
-- Name: order_parts Order parts select tenant scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Order parts select tenant scoped" ON public.order_parts FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_parts.order_id) AND (o.company_id = public.get_user_company(auth.uid()))))));


--
-- Name: orders Orders delete tenant scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Orders delete tenant scoped" ON public.orders FOR DELETE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR (auth.uid() = technician_id)))));


--
-- Name: orders Orders insert tenant scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Orders insert tenant scoped" ON public.orders FOR INSERT TO authenticated WITH CHECK ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND (auth.uid() = technician_id) AND public.is_company_active(company_id))));


--
-- Name: orders Orders select tenant scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Orders select tenant scoped" ON public.orders FOR SELECT TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR (auth.uid() = technician_id) OR (auth.uid() = assigned_technician_id) OR ((current_branch_id IS NOT NULL) AND (current_branch_id = public.get_user_branch(auth.uid())))))));


--
-- Name: orders Orders update tenant scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Orders update tenant scoped" ON public.orders FOR UPDATE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR (auth.uid() = technician_id) OR (auth.uid() = assigned_technician_id) OR ((current_branch_id IS NOT NULL) AND (current_branch_id = public.get_user_branch(auth.uid()))))))) WITH CHECK ((public.is_super_admin(auth.uid()) OR (company_id = public.get_user_company(auth.uid()))));


--
-- Name: profiles Profiles insert self or company admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles insert self or company admin" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((((company_id = public.get_user_company(auth.uid())) AND ((auth.uid() = id) OR public.has_role(auth.uid(), 'admin'::public.app_role))) OR public.is_super_admin(auth.uid())));


--
-- Name: profiles Profiles select same company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles select same company" ON public.profiles FOR SELECT TO authenticated USING (((company_id = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid())));


--
-- Name: profiles Profiles update self or company admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles update self or company admin" ON public.profiles FOR UPDATE TO authenticated USING ((((company_id = public.get_user_company(auth.uid())) AND ((auth.uid() = id) OR public.has_role(auth.uid(), 'admin'::public.app_role))) OR public.is_super_admin(auth.uid()))) WITH CHECK ((((company_id = public.get_user_company(auth.uid())) AND ((auth.uid() = id) OR public.has_role(auth.uid(), 'admin'::public.app_role))) OR public.is_super_admin(auth.uid())));


--
-- Name: user_roles Roles delete company admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Roles delete company admin" ON public.user_roles FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) AND (public.get_user_company(user_id) = public.get_user_company(auth.uid()))));


--
-- Name: user_roles Roles insert company admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Roles insert company admin" ON public.user_roles FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) AND (public.get_user_company(user_id) = public.get_user_company(auth.uid()))));


--
-- Name: user_roles Roles select same company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Roles select same company" ON public.user_roles FOR SELECT TO authenticated USING (((public.get_user_company(user_id) = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid())));


--
-- Name: user_roles Roles update company admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Roles update company admin" ON public.user_roles FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) AND (public.get_user_company(user_id) = public.get_user_company(auth.uid())))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) AND (public.get_user_company(user_id) = public.get_user_company(auth.uid()))));


--
-- Name: order_technical_notes Technical notes delete own tenant scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Technical notes delete own tenant scoped" ON public.order_technical_notes FOR DELETE TO authenticated USING (((auth.uid() = technician_id) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_technical_notes.order_id) AND (o.company_id = public.get_user_company(auth.uid())))))));


--
-- Name: order_technical_notes Technical notes insert tenant scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Technical notes insert tenant scoped" ON public.order_technical_notes FOR INSERT TO authenticated WITH CHECK (((auth.uid() = technician_id) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_technical_notes.order_id) AND (o.company_id = public.get_user_company(auth.uid())) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR (auth.uid() = o.technician_id) OR (auth.uid() = o.assigned_technician_id) OR ((o.current_branch_id IS NOT NULL) AND (o.current_branch_id = public.get_user_branch(auth.uid())))))))));


--
-- Name: order_technical_notes Technical notes select tenant scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Technical notes select tenant scoped" ON public.order_technical_notes FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_technical_notes.order_id) AND (o.company_id = public.get_user_company(auth.uid())) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR (auth.uid() = o.technician_id) OR (auth.uid() = o.assigned_technician_id) OR ((o.current_branch_id IS NOT NULL) AND (o.current_branch_id = public.get_user_branch(auth.uid()))))))));


--
-- Name: warranty_presets Warranty presets delete admin same company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Warranty presets delete admin same company" ON public.warranty_presets FOR DELETE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: warranty_presets Warranty presets insert admin same company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Warranty presets insert admin same company" ON public.warranty_presets FOR INSERT TO authenticated WITH CHECK ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role) AND public.is_company_active(company_id))));


--
-- Name: warranty_presets Warranty presets select same company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Warranty presets select same company" ON public.warranty_presets FOR SELECT TO authenticated USING (((company_id = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid())));


--
-- Name: warranty_presets Warranty presets update admin same company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Warranty presets update admin same company" ON public.warranty_presets FOR UPDATE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role)))) WITH CHECK ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: branches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

--
-- Name: order_parts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: order_status_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

--
-- Name: order_technical_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_technical_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: warranty_presets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.warranty_presets ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION auto_promote_super_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.auto_promote_super_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.auto_promote_super_admin() TO service_role;


--
-- Name: FUNCTION generate_order_number(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_order_number() TO anon;
GRANT ALL ON FUNCTION public.generate_order_number() TO authenticated;
GRANT ALL ON FUNCTION public.generate_order_number() TO service_role;


--
-- Name: FUNCTION get_history_by_code(_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_history_by_code(_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_history_by_code(_code text) TO service_role;
GRANT ALL ON FUNCTION public.get_history_by_code(_code text) TO anon;
GRANT ALL ON FUNCTION public.get_history_by_code(_code text) TO authenticated;


--
-- Name: FUNCTION get_order_by_code(_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_order_by_code(_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_order_by_code(_code text) TO service_role;
GRANT ALL ON FUNCTION public.get_order_by_code(_code text) TO anon;
GRANT ALL ON FUNCTION public.get_order_by_code(_code text) TO authenticated;


--
-- Name: FUNCTION get_order_by_tracking(_token uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_order_by_tracking(_token uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_order_by_tracking(_token uuid) TO service_role;
GRANT ALL ON FUNCTION public.get_order_by_tracking(_token uuid) TO anon;
GRANT ALL ON FUNCTION public.get_order_by_tracking(_token uuid) TO authenticated;


--
-- Name: FUNCTION get_order_history_by_tracking(_token uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_order_history_by_tracking(_token uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_order_history_by_tracking(_token uuid) TO service_role;
GRANT ALL ON FUNCTION public.get_order_history_by_tracking(_token uuid) TO anon;
GRANT ALL ON FUNCTION public.get_order_history_by_tracking(_token uuid) TO authenticated;


--
-- Name: FUNCTION get_technical_notes_by_code(_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_technical_notes_by_code(_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_technical_notes_by_code(_code text) TO service_role;
GRANT ALL ON FUNCTION public.get_technical_notes_by_code(_code text) TO anon;
GRANT ALL ON FUNCTION public.get_technical_notes_by_code(_code text) TO authenticated;


--
-- Name: FUNCTION get_user_branch(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_branch(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_branch(_user_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.get_user_branch(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_branch(_user_id uuid) TO anon;


--
-- Name: FUNCTION get_user_company(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_company(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_company(_user_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.get_user_company(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_company(_user_id uuid) TO anon;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION has_role(_user_id uuid, _role public.app_role); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO service_role;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO anon;


--
-- Name: FUNCTION is_company_active(_company_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_company_active(_company_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_company_active(_company_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.is_company_active(_company_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_company_active(_company_id uuid) TO anon;


--
-- Name: FUNCTION is_super_admin(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_super_admin(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_super_admin(_user_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.is_super_admin(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_super_admin(_user_id uuid) TO anon;


--
-- Name: FUNCTION maintain_delivered_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.maintain_delivered_at() TO anon;
GRANT ALL ON FUNCTION public.maintain_delivered_at() TO authenticated;
GRANT ALL ON FUNCTION public.maintain_delivered_at() TO service_role;


--
-- Name: FUNCTION maintain_delivered_at_insert(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.maintain_delivered_at_insert() TO anon;
GRANT ALL ON FUNCTION public.maintain_delivered_at_insert() TO authenticated;
GRANT ALL ON FUNCTION public.maintain_delivered_at_insert() TO service_role;


--
-- Name: FUNCTION maintain_order_payment_dates(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.maintain_order_payment_dates() TO anon;
GRANT ALL ON FUNCTION public.maintain_order_payment_dates() TO authenticated;
GRANT ALL ON FUNCTION public.maintain_order_payment_dates() TO service_role;


--
-- Name: FUNCTION prevent_super_admin_self_escalation(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prevent_super_admin_self_escalation() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prevent_super_admin_self_escalation() TO service_role;


--
-- Name: FUNCTION seed_warranty_presets_for_company(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.seed_warranty_presets_for_company() FROM PUBLIC;
GRANT ALL ON FUNCTION public.seed_warranty_presets_for_company() TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION validate_order_amounts(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_order_amounts() TO anon;
GRANT ALL ON FUNCTION public.validate_order_amounts() TO authenticated;
GRANT ALL ON FUNCTION public.validate_order_amounts() TO service_role;


--
-- Name: TABLE branches; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.branches TO anon;
GRANT ALL ON TABLE public.branches TO authenticated;
GRANT ALL ON TABLE public.branches TO service_role;


--
-- Name: TABLE clients; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.clients TO anon;
GRANT ALL ON TABLE public.clients TO authenticated;
GRANT ALL ON TABLE public.clients TO service_role;


--
-- Name: TABLE companies; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.companies TO anon;
GRANT ALL ON TABLE public.companies TO authenticated;
GRANT ALL ON TABLE public.companies TO service_role;


--
-- Name: TABLE inventory_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.inventory_items TO anon;
GRANT ALL ON TABLE public.inventory_items TO authenticated;
GRANT ALL ON TABLE public.inventory_items TO service_role;


--
-- Name: TABLE order_parts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.order_parts TO anon;
GRANT ALL ON TABLE public.order_parts TO authenticated;
GRANT ALL ON TABLE public.order_parts TO service_role;


--
-- Name: TABLE order_status_history; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.order_status_history TO anon;
GRANT ALL ON TABLE public.order_status_history TO authenticated;
GRANT ALL ON TABLE public.order_status_history TO service_role;


--
-- Name: TABLE order_technical_notes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.order_technical_notes TO anon;
GRANT ALL ON TABLE public.order_technical_notes TO authenticated;
GRANT ALL ON TABLE public.order_technical_notes TO service_role;


--
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.orders TO anon;
GRANT ALL ON TABLE public.orders TO authenticated;
GRANT ALL ON TABLE public.orders TO service_role;


--
-- Name: SEQUENCE orders_friendly_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.orders_friendly_seq TO anon;
GRANT ALL ON SEQUENCE public.orders_friendly_seq TO authenticated;
GRANT ALL ON SEQUENCE public.orders_friendly_seq TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;


--
-- Name: TABLE warranty_presets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.warranty_presets TO anon;
GRANT ALL ON TABLE public.warranty_presets TO authenticated;
GRANT ALL ON TABLE public.warranty_presets TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--


