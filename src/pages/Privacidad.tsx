import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/i18n/usePageMeta";
import { UPGRADE_PHONE } from "@/lib/upgrade";

// /privacidad: política de privacidad pública (la piden Meta y quien usa el píxel).
// Describe solo lo que F7 hace de verdad; si cambia un servicio o un dato que se guarda, actualizar acá.

export const PRIVACY_UPDATED = "1 de noviembre de 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function Privacidad() {
  usePageMeta(
    "Política de privacidad · F7 Manager",
    "Qué datos guarda F7 Manager, para qué los usa, con quién los comparte y cómo pedir que los borremos."
  );
  const whatsapp = `https://wa.me/${UPGRADE_PHONE}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-[11px] font-bold text-primary-foreground">F7</span>
            F7 Manager
          </Link>
          <Link to="/login" className="text-sm text-muted-foreground hover:text-primary">
            Ingresar
          </Link>
        </div>
      </header>

      <main className="container max-w-3xl py-10 md:py-14">
        <h1 className="text-3xl font-bold tracking-tight">Política de privacidad</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última actualización: {PRIVACY_UPDATED}</p>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          F7 Manager es un sistema para talleres de reparación de celulares, hecho en Paraguay. Esta página explica qué datos
          guardamos, para qué los usamos y qué podés pedirnos. Si algo no queda claro, escribinos.
        </p>

        <Section title="Quiénes somos">
          <p>
            F7 Manager (f7manager.com) es el responsable de los datos de las cuentas de los talleres. Nos podés contactar por
            WhatsApp al{" "}
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              +{UPGRADE_PHONE}
            </a>
            .
          </p>
        </Section>

        <Section title="Qué datos guardamos">
          <p>
            <strong className="text-foreground">De los talleres que usan F7:</strong> el nombre y el correo de quien crea la
            cuenta, los datos del negocio (nombre, país, sucursales, usuarios del equipo) y el plan contratado.
          </p>
          <p>
            <strong className="text-foreground">Lo que cada taller carga en el sistema:</strong> sus clientes (nombre y
            teléfono), las órdenes de reparación (equipo, falla, fotos, presupuesto, pagos y garantía), el inventario, las
            ventas y los gastos. Esos datos son del taller: F7 los guarda para que el taller los use, y no los usa para otra
            cosa.
          </p>
          <p>
            <strong className="text-foreground">De quien visita nuestras páginas:</strong> datos técnicos de la visita (qué
            página se abrió, desde qué tipo de dispositivo) a través del píxel de Meta, que se explica más abajo.
          </p>
        </Section>

        <Section title="Para qué los usamos">
          <p>Para que el sistema funcione: guardar las órdenes, mostrar los reportes y dejar que el cliente del taller siga su equipo.</p>
          <p>Para dar soporte y avisarte cosas importantes de tu cuenta, como el vencimiento de tu plan.</p>
          <p>Para medir qué anuncios y páginas funcionan y mostrar anuncios a quien ya nos visitó.</p>
          <p>No vendemos datos a nadie.</p>
        </Section>

        <Section title="Seguimiento del cliente y mensajes de WhatsApp">
          <p>
            Cada orden tiene un enlace o código QR de seguimiento. Quien lo tiene puede ver el estado de ese equipo, sin
            iniciar sesión. Por eso el taller solo debería compartirlo con su cliente.
          </p>
          <p>
            Los avisos por WhatsApp los manda el taller desde su propio WhatsApp: F7 deja el mensaje escrito y el taller lo
            envía. Si el taller conecta su número para enviar mensajes desde el sistema, esos mensajes pasan por el servicio
            que usamos para esa conexión.
          </p>
        </Section>

        <Section title="Cookies y píxel de Meta">
          <p>
            En nuestras páginas públicas usamos el píxel de Meta (Facebook e Instagram). Guarda cookies en tu navegador y le
            avisa a Meta cuándo abrís una página, mirás el video o tocás un botón de WhatsApp. Lo usamos para medir nuestros
            anuncios y mostrárselos a personas a las que les pueden servir.
          </p>
          <p>
            Podés borrar o bloquear las cookies desde tu navegador, y elegir qué anuncios ves desde la configuración de
            anuncios de tu cuenta de Facebook o Instagram.
          </p>
        </Section>

        <Section title="Con quién se comparten">
          <p>Usamos proveedores para que el sistema funcione. Solo reciben lo necesario para dar su servicio:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Supabase: base de datos, inicio de sesión y almacenamiento de fotos.</li>
            <li>Vercel: aloja el sitio web.</li>
            <li>Meta: píxel de medición y anuncios.</li>
            <li>YouTube: muestra los videos de nuestras páginas cuando tocás reproducir.</li>
          </ul>
          <p>También podemos entregar datos si una autoridad competente lo exige por ley.</p>
        </Section>

        <Section title="Cuánto tiempo los guardamos">
          <p>
            Mientras la cuenta del taller exista. Si un taller pide cerrar su cuenta, borramos sus datos, salvo lo que debamos
            conservar por obligación legal o contable.
          </p>
        </Section>

        <Section title="Tus derechos">
          <p>
            Podés pedirnos ver, corregir o borrar tus datos, o dejar de recibir mensajes. Escribinos por WhatsApp al{" "}
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              +{UPGRADE_PHONE}
            </a>
            . Si sos cliente de un taller y querés que borren tus datos, pedíselo al taller, que es quien los cargó; nosotros
            lo ayudamos a hacerlo.
          </p>
        </Section>

        <Section title="Seguridad">
          <p>
            Cada taller solo ve sus propios datos y la conexión al sitio es cifrada. Ningún sistema es 100 % infalible: si
            detectamos un problema que afecte tus datos, te vamos a avisar.
          </p>
        </Section>

        <Section title="Cambios en esta política">
          <p>Si cambiamos algo importante, lo publicamos en esta página con una nueva fecha de actualización.</p>
        </Section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="container text-center text-xs text-muted-foreground">F7 Manager · Hecho en Paraguay</div>
      </footer>
    </div>
  );
}
