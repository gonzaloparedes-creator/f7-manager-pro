// Vercel inyecta la geolocalización por IP en cada request que pasa por su
// red edge — no hace falta ningún servicio externo ni permiso del navegador.
// Se usa solo para PRE-seleccionar el país en el registro; el usuario
// siempre puede corregirlo a mano.
export default function handler(req: any, res: any) {
  const country = req.headers["x-vercel-ip-country"];
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ country: typeof country === "string" && country !== "XX" ? country : null });
}
