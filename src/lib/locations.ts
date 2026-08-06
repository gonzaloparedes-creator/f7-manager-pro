export const COUNTRIES = [
  { code: "PY", label: "Paraguay" },
  { code: "AR", label: "Argentina" },
  { code: "BR", label: "Brasil" },
  { code: "BO", label: "Bolivia" },
  { code: "UY", label: "Uruguay" },
  { code: "CL", label: "Chile" },
  { code: "OTHER", label: "Otro país" },
];

export const PY_DEPARTMENTS = [
  "Asunción (Capital)", "Central", "Alto Paraná", "Itapúa", "Caaguazú",
  "San Pedro", "Cordillera", "Guairá", "Caazapá", "Misiones", "Paraguarí",
  "Ñeembucú", "Amambay", "Canindeyú", "Presidente Hayes", "Concepción",
  "Boquerón", "Alto Paraguay",
];

export function countryLabel(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.label ?? code;
}
