-- Celu Técnicos VIP: grupo propio de Gonzalo (~70 técnicos, sin aliado
-- externo de por medio) que arranca el "Reto 45 días" hacia el Programa
-- Fundadores. Se agrega como referral_partner igual que Kike (mismo
-- mecanismo de ?ref=<slug> en Register.tsx y de atribución en el Panel de
-- Fundadores), pero con comisión en 0 porque acá no hay revenue-share con
-- un tercero — es solo para poder separar el origen/cohorte.
INSERT INTO public.referral_partners (name, slug, commission_rate)
VALUES ('Celu Técnicos VIP', 'celutecnicos', 0);
