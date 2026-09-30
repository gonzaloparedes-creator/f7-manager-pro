export type FaultCategory = "hardware" | "software" | "mixto";
export type Confidence = "alta" | "media" | "baja";

export interface DeviceInfo {
  id: string | null;
  name: string | null;
  osVersion: string | null;
  date: string | null;
}

export interface Finding {
  ruleId: string;
  title: string;
  category: FaultCategory;
  confidence: Confidence;
  evidence: string;
  explanation: string;
  components: string[];
  checks: string[];
}

export interface KextHint {
  kext: string;
  component: string;
}

export interface PanicAnalysis {
  fileName: string | null;
  device: DeviceInfo;
  headline: string;
  findings: Finding[];
  kextHints: KextHint[];
}

export type AnalyzeResult =
  | { ok: true; analysis: PanicAnalysis }
  | { ok: false; fileName: string | null; error: string };

export interface PatternSummary {
  ruleId: string;
  title: string;
  category: FaultCategory;
  count: number;
  total: number;
}

export const DISCLAIMER =
  "Diagnóstico orientativo basado en patrones conocidos de fallas. Sirve para saber por dónde empezar, no reemplaza la revisión del equipo: confirmá siempre con pruebas en el dispositivo.";

const IPHONE_MODELS: Record<string, string> = {
  "iPhone7,1": "iPhone 6 Plus",
  "iPhone7,2": "iPhone 6",
  "iPhone8,1": "iPhone 6s",
  "iPhone8,2": "iPhone 6s Plus",
  "iPhone8,4": "iPhone SE (1.ª gen)",
  "iPhone9,1": "iPhone 7",
  "iPhone9,3": "iPhone 7",
  "iPhone9,2": "iPhone 7 Plus",
  "iPhone9,4": "iPhone 7 Plus",
  "iPhone10,1": "iPhone 8",
  "iPhone10,4": "iPhone 8",
  "iPhone10,2": "iPhone 8 Plus",
  "iPhone10,5": "iPhone 8 Plus",
  "iPhone10,3": "iPhone X",
  "iPhone10,6": "iPhone X",
  "iPhone11,2": "iPhone XS",
  "iPhone11,4": "iPhone XS Max",
  "iPhone11,6": "iPhone XS Max",
  "iPhone11,8": "iPhone XR",
  "iPhone12,1": "iPhone 11",
  "iPhone12,3": "iPhone 11 Pro",
  "iPhone12,5": "iPhone 11 Pro Max",
  "iPhone12,8": "iPhone SE (2.ª gen)",
  "iPhone13,1": "iPhone 12 mini",
  "iPhone13,2": "iPhone 12",
  "iPhone13,3": "iPhone 12 Pro",
  "iPhone13,4": "iPhone 12 Pro Max",
  "iPhone14,2": "iPhone 13 Pro",
  "iPhone14,3": "iPhone 13 Pro Max",
  "iPhone14,4": "iPhone 13 mini",
  "iPhone14,5": "iPhone 13",
  "iPhone14,6": "iPhone SE (3.ª gen)",
  "iPhone14,7": "iPhone 14",
  "iPhone14,8": "iPhone 14 Plus",
  "iPhone15,2": "iPhone 14 Pro",
  "iPhone15,3": "iPhone 14 Pro Max",
  "iPhone15,4": "iPhone 15",
  "iPhone15,5": "iPhone 15 Plus",
  "iPhone16,1": "iPhone 15 Pro",
  "iPhone16,2": "iPhone 15 Pro Max",
  "iPhone17,1": "iPhone 16 Pro",
  "iPhone17,2": "iPhone 16 Pro Max",
  "iPhone17,3": "iPhone 16",
  "iPhone17,4": "iPhone 16 Plus",
  "iPhone17,5": "iPhone 16e",
};

// ---------------------------------------------------------------------------
// Parseo
// ---------------------------------------------------------------------------

function parseJsonObject(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

const PANIC_MARKERS = /panic\(cpu|panicked task|panic string|kernel data abort|kernel trap|userspace watchdog|missing sensor|kernel_task/i;

function parsePanicLog(raw: string): { panicText: string; device: DeviceInfo } | null {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return null;

  let header: Record<string, unknown> | null = null;
  let body: Record<string, unknown> | null = null;
  if (text.startsWith("{")) {
    body = parseJsonObject(text);
    if (!body) {
      const nl = text.indexOf("\n");
      if (nl > 0) {
        header = parseJsonObject(text.slice(0, nl));
        body = header ? parseJsonObject(text.slice(nl + 1)) : null;
      }
    }
  }
  const meta: Record<string, unknown> = { ...(header ?? {}), ...(body ?? {}) };

  let panicText = str(meta.panicString);
  if (!panicText) {
    const m = /"panicString"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text);
    if (m) {
      try {
        panicText = JSON.parse(`"${m[1]}"`) as string;
      } catch {
        panicText = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
      }
    }
  }
  if (!panicText) {
    // Un .ips JSON válido sin panicString es otro tipo de reporte (crash de app, stackshot…), no un panic.
    if (body) return null;
    if (!PANIC_MARKERS.test(text)) return null;
    panicText = text;
  }

  const id =
    str(meta.product) ??
    /"product"\s*:\s*"([^"]+)"/.exec(text)?.[1] ??
    /Hardware Model:\s*([A-Za-z0-9,]+)/i.exec(text)?.[1] ??
    /\b(iPhone\d+,\d+)\b/.exec(text)?.[1] ??
    null;

  const osRaw =
    str(meta.os_version) ??
    str(meta.build) ??
    /OS Version:\s*([^\n]+)/i.exec(text)?.[1]?.trim() ??
    /OS version:\s*([0-9A-Za-z]+)/.exec(panicText)?.[1] ??
    null;

  const dateRaw =
    str(meta.timestamp) ??
    str(meta.date) ??
    /Date\/Time:\s*([^\n]+)/i.exec(text)?.[1]?.trim() ??
    null;

  return {
    panicText,
    device: {
      id,
      name: id ? IPHONE_MODELS[id] ?? null : null,
      osVersion: osRaw ? osRaw.replace(/^iPhone OS /i, "iOS ") : null,
      date: dateRaw ? dateRaw.slice(0, 19) : null,
    },
  };
}

// Los "loaded kexts" y las dependencias nombran decenas de drivers que no tienen nada que ver
// con la falla; dejarlos en el texto dispara reglas por error.
function sanitizeForRules(panic: string): string {
  let t = panic.replace(/\r/g, "");
  const cut = t.search(/^\s*loaded kexts:/im);
  if (cut !== -1) t = t.slice(0, cut);
  return t
    .split("\n")
    .filter((l) => !/^\s*(?:dependency:|last (?:started|stopped) kext)/i.test(l))
    .join("\n");
}

function extractBacktraceKexts(text: string): string[] {
  const m = /Kernel Extensions in backtrace:\s*\n([\s\S]*?)(?:\n\s*\n|$)/i.exec(text);
  if (!m) return [];
  const names = new Set<string>();
  for (const line of m[1].split("\n")) {
    const k = /^\s*((?:com|org)\.[\w.-]+)/i.exec(line);
    if (k) names.add(k[1]);
  }
  return [...names];
}

const KEXT_COMPONENTS: Array<[RegExp, string]> = [
  [/BCMWLAN|WLAN|Wi-?Fi|Bluetooth/i, "Módulo Wi-Fi / Bluetooth"],
  [/ANS2?\b|NVMe|NAND|Storage/i, "Almacenamiento (NAND)"],
  [/Mesa|Biometric|TouchID/i, "Touch ID"],
  [/Multitouch|MTouch|Touch/i, "Táctil (touch)"],
  [/CLCD|DCP|Display|MIPI|Backlight/i, "Pantalla / retroiluminación"],
  [/Cam(?:In)?|ISP/i, "Cámara / ISP"],
  [/Tristar|Hydra|USBC|Charger/i, "Puerto de carga / Tristar"],
  [/Batt|GasGauge|BMS/i, "Batería"],
  [/SMC/i, "SMC (energía y sensores)"],
  [/Audio|Codec|Speaker|CS35L|CS42L/i, "Audio (codec / altavoz / micrófono)"],
  [/Baseband|Modem|CommCenter/i, "Baseband / módem"],
  [/AOP|SPU|ALS|Proximity|Ambient/i, "AOP / sensores"],
  [/Vibrator|Haptic|Taptic/i, "Vibrador / Taptic Engine"],
  [/NFC|Stockholm/i, "NFC"],
  [/PMU|PMIC|PMGR|PMP/i, "PMIC / administración de energía"],
  [/AGX|GPU/i, "GPU"],
];

function componentForKext(kext: string): string | null {
  for (const [re, label] of KEXT_COMPONENTS) if (re.test(kext)) return label;
  return null;
}

// ---------------------------------------------------------------------------
// Reglas
// ---------------------------------------------------------------------------

interface Refinement {
  title?: string;
  explanation?: string;
  category?: FaultCategory;
  confidence?: Confidence;
  components?: string[];
  checks?: string[];
}

interface Rule {
  id: string;
  title: string;
  category: FaultCategory;
  confidence: Confidence;
  pattern: RegExp;
  strip?: RegExp;
  explanation: string;
  components: string[];
  checks: string[];
  supersededBy?: string[];
  onlyIfNoOther?: boolean;
  refine?: (match: RegExpExecArray) => Refinement;
}

const SENSOR_COMPONENTS: Record<string, string> = {
  TG0B: "Batería (conector o flex de batería)",
  TG0V: "Batería (conector o flex de batería)",
  PRS0: "Barómetro / flex de carga",
  MIC1: "Micrófono inferior (flex de carga)",
  MIC2: "Micrófono trasero (zona de la cámara trasera)",
};

const I2C_BUSES: Record<number, { components: string[]; confidence: Confidence }> = {
  2: { components: ["Flex de cámara frontal / sensores frontales"], confidence: "media" },
  3: { components: ["Flex del puerto de carga", "Pantalla", "Retroiluminación"], confidence: "media" },
  4: { components: ["EEPROM de la placa lógica (micro-soldadura)"], confidence: "media" },
  5: { components: ["EEPROM de la placa lógica (micro-soldadura)"], confidence: "media" },
};

const SOFTWARE_CHECKS = [
  "Restaurar iOS desde cero (sin restaurar backup) para descartar software.",
  "Verificar que el almacenamiento no esté casi lleno.",
  "Si la falla vuelve tras una restauración limpia, tratarla como hardware.",
];

const RULES: Rule[] = [
  {
    id: "missing-sensors",
    title: "Sensores sin respuesta (thermalmonitord)",
    category: "hardware",
    confidence: "alta",
    pattern: /missing sensor\(?s?\)?[^\n]*|sensor\(?s?\)? missing[^\n]*/i,
    explanation:
      "El monitor térmico del sistema no recibe lectura de uno o más sensores y reinicia el equipo por seguridad. Es de las fallas de hardware más fáciles de ubicar porque el log nombra el sensor.",
    components: ["Componente que aloja el sensor indicado"],
    checks: [
      "Probar o reemplazar el componente asociado al sensor nombrado.",
      "Revisar los conectores BTB y sus pines por suciedad, humedad o corrosión.",
      "Probar con una batería o flex de carga de prueba.",
    ],
    refine: (m) => {
      const after = m[0].includes(":") ? m[0].replace(/^[^:=]*[:=]/, "") : m[0];
      const tokens = after.match(/\b(?:[A-Za-z]{1,3}\d[A-Za-z0-9]{0,3}|TCAL)\b/g) ?? [];
      const sensors = [...new Set(tokens.map((t) => t.toUpperCase()))];
      if (sensors.length === 0) return {};
      const components = [
        ...new Set(sensors.map((s) => SENSOR_COMPONENTS[s] ?? `Sensor ${s} (revisar el flex o componente que lo aloja)`)),
      ];
      return { title: `Sensor sin respuesta: ${sensors.join(", ")}`, components };
    },
  },
  {
    id: "userspace-watchdog",
    title: "Un servicio de iOS dejó de responder (userspace watchdog)",
    category: "software",
    confidence: "media",
    pattern: /userspace watchdog timeout[^\n]*/i,
    explanation:
      "Un servicio de iOS no respondió durante unos 120 segundos y el sistema se reinició. En la mayoría de los casos es un problema de software (iOS dañado, almacenamiento lleno, tweaks), aunque a veces lo provoca un hardware inestable.",
    components: ["Sistema iOS"],
    checks: SOFTWARE_CHECKS,
    refine: (m) => {
      const raw = /no successful checkins from ([\w.-]+)/i.exec(m[0])?.[1];
      if (!raw) return {};
      const svc = raw.replace(/^com\.apple\./i, "");
      const title = `Servicio sin respuesta: ${svc}`;
      const lower = svc.toLowerCase();
      if (lower.startsWith("thermalmonitord")) {
        return {
          title,
          category: "mixto",
          explanation:
            "El monitor térmico dejó de responder. Suele ser un sensor de temperatura faltante o dañado (batería, flex de carga), aunque si el log no nombra un sensor también puede ser software.",
          components: ["Batería / flex de batería", "Flex del puerto de carga"],
          checks: [
            "Probar con una batería y un flex de carga de prueba.",
            "Restaurar iOS para descartar software; si persiste, es hardware.",
          ],
        };
      }
      if (lower.startsWith("wifid")) {
        return {
          title,
          category: "mixto",
          confidence: "baja",
          explanation:
            "El servicio de Wi-Fi no respondió. Puede ser software, o un módulo Wi-Fi/Bluetooth defectuoso.",
          components: ["Módulo Wi-Fi / Bluetooth", "Sistema iOS"],
          checks: ["Verificar si Wi-Fi o Bluetooth aparecen grisados en Ajustes.", ...SOFTWARE_CHECKS],
        };
      }
      if (lower.startsWith("mediaserverd")) {
        return {
          title,
          category: "mixto",
          confidence: "baja",
          explanation:
            "El servicio multimedia no respondió. Puede ser software, o un componente de cámara o audio que falla.",
          components: ["Cámara", "Audio (micrófonos / codec)", "Sistema iOS"],
          checks: ["Probar cámaras y micrófonos.", ...SOFTWARE_CHECKS],
        };
      }
      return { title };
    },
  },
  {
    id: "ans-nand",
    title: "Falla de almacenamiento (NAND / controlador ANS2)",
    category: "hardware",
    confidence: "alta",
    pattern:
      /\bans2?\b[^\n]{0,60}(?:panic|assert|fault|error|fail)|nvme[^\n]{0,80}(?:timeout|fail|error|panic|assert|abort)|\bememory\b|\bnand\b[^\n]{0,40}(?:error|fail|panic)/i,
    explanation:
      "El controlador de almacenamiento reportó un error. Es el patrón típico de una NAND dañada o con problemas de comunicación, aunque un iOS corrupto o el almacenamiento lleno también pueden provocarlo.",
    components: ["NAND (chip de almacenamiento)", "Líneas de la NAND en la placa lógica"],
    checks: [
      "Hacer una restauración en modo DFU para descartar software.",
      "Errores de restauración como 4013, 4014 o 9 refuerzan la sospecha de NAND.",
      "Si se confirma: reemplazo o reballing de la NAND y reprogramación.",
    ],
  },
  {
    id: "sep-rom",
    title: "Falla del procesador seguro (SEP ROM boot panic)",
    category: "hardware",
    confidence: "media",
    pattern: /sep rom boot panic|\bsep\b[^\n]{0,30}(?:panic|rom boot|boot (?:panic|failure|fail))|\bsep\b[^\n]{0,10}fatal/i,
    explanation:
      "El procesador seguro (SEP) no pudo arrancar. Según guías de reparación, suele apuntar a la EEPROM o memoria asociada en la placa lógica, y en menor medida a la NAND.",
    components: ["EEPROM / memoria de la placa lógica", "NAND (menos frecuente)"],
    checks: [
      "Probar restauración en modo DFU.",
      "Si falla con errores de hardware, revisar EEPROM y NAND con micro-soldadura.",
    ],
  },
  {
    id: "i2c-bus",
    title: "Error en un bus I2C",
    category: "hardware",
    confidence: "baja",
    pattern: /\bi2c\s*[_\- ]?\s*([0-9])\b/i,
    explanation:
      "Un periférico conectado por el bus I2C dejó de responder. Qué componente cuelga de cada bus varía entre modelos, así que tomá este resultado como punto de partida.",
    components: ["Periférico del bus I2C (varía según el modelo)"],
    checks: [
      "Desconectar uno por uno los flexes del bus indicado y probar el arranque.",
      "Revisar conectores y pines por suciedad o humedad.",
    ],
    refine: (m) => {
      const bus = Number(m[1]);
      const known = I2C_BUSES[bus];
      return {
        title: `Error en el bus I2C${bus}`,
        components: known ? known.components : [`Periférico del bus I2C${bus} (varía según el modelo)`],
        confidence: known ? known.confidence : "baja",
      };
    },
  },
  {
    id: "aop-k2-bosch",
    title: "AOP: falla de canal de control (K2 Bosch)",
    category: "hardware",
    confidence: "media",
    pattern: /aop k2 bosch|bosch[^\n]{0,60}control channel|control channel write fail/i,
    explanation:
      "El procesador de sensores siempre activo (AOP) falló al escribir en el canal de control de un sensor Bosch. Las guías de reparación asocian este error con el flex del puerto de carga.",
    components: ["Flex del puerto de carga"],
    checks: ["Reemplazar o probar con un flex de carga de prueba.", "Revisar el conector del flex por suciedad o humedad."],
  },
  {
    id: "aop-nmi-power",
    title: "AOP: NMI POWER",
    category: "hardware",
    confidence: "media",
    pattern: /aop nmi power/i,
    explanation:
      "El procesador de sensores siempre activo (AOP) reportó una interrupción de energía. Se asocia con el flex del botón de encendido o con el flex de la cámara frontal.",
    components: ["Flex del botón de encendido", "Flex de cámara frontal"],
    checks: ["Desconectar el flex de cámara frontal y probar.", "Probar con un flex de botón de encendido de prueba."],
  },
  {
    id: "aop-data-abort",
    title: "AOP: DATA ABORT",
    category: "hardware",
    confidence: "media",
    pattern: /aop data abort/i,
    explanation:
      "El procesador de sensores siempre activo (AOP) sufrió un acceso a memoria inválido. Según guías de reparación, suele requerir reflow o micro-soldadura del CPU.",
    components: ["CPU / placa lógica"],
    checks: [
      "Descartar primero flex de carga y sensores.",
      "Si persiste, evaluar reflow del CPU (micro-soldadura).",
    ],
  },
  {
    id: "aop-panic",
    title: "AOP PANIC (sensores siempre activos)",
    category: "hardware",
    confidence: "media",
    pattern: /aop panic|\baop\b[^\n]{0,20}(?:assert|watchdog)/i,
    supersededBy: ["aop-k2-bosch", "aop-nmi-power", "aop-data-abort"],
    explanation:
      "El procesador de sensores siempre activo (AOP) entró en pánico. Suele relacionarse con el sensor de luz ambiental, los micrófonos o el flex frontal.",
    components: ["Sensor de luz ambiental (ALS)", "Micrófonos", "Flex frontal"],
    checks: [
      "Desconectar el flex frontal y los micrófonos y probar el arranque.",
      "Probar con un flex de carga de prueba (micrófono inferior).",
    ],
  },
  {
    id: "no-pulse",
    title: "\"No pulse on\" (vibrador / audio)",
    category: "hardware",
    confidence: "media",
    pattern: /no pulse on/i,
    explanation:
      "Un componente dejó de dar señal. Según guías de reparación, se asocia con el vibrador (Taptic Engine) o con el codec de audio.",
    components: ["Vibrador / Taptic Engine", "Codec de audio"],
    checks: ["Desconectar el vibrador y probar.", "Si persiste, revisar el codec de audio en la placa."],
  },
  {
    id: "amcc",
    title: "Error AMCC (controlador de memoria)",
    category: "hardware",
    confidence: "baja",
    pattern: /\bamcc\b[^\n]{0,30}(?:error|fault|panic)|amcc (?:error|fault)/i,
    explanation:
      "Error del controlador de caché de memoria. Las guías de reparación lo relacionan a menudo con el sensor de luz ambiental o el flex frontal; si eso no lo resuelve, apunta a CPU o RAM.",
    components: ["Sensor de luz ambiental / flex frontal", "CPU / RAM (si persiste)"],
    checks: ["Desconectar el flex frontal y probar.", "Si persiste, evaluar reflow del CPU."],
  },
  {
    id: "wdt",
    title: "Watchdog del sistema (WDT)",
    category: "hardware",
    confidence: "media",
    pattern: /\bwdt\b|watchdog timeout|watchdog (?:reset|expired|triggered)/i,
    strip: /userspace watchdog timeout/gi,
    explanation:
      "El watchdog del sistema detectó que el equipo dejó de responder. En hardware se asocia con el flex de carga, la batería o el puerto de carga.",
    components: ["Flex de carga / puerto de carga", "Batería"],
    checks: [
      "Probar con un flex de carga y una batería de prueba.",
      "Revisar cortos o consumo anormal en la línea de alimentación.",
    ],
  },
  {
    id: "pmp-nmi-fiq",
    title: "PMP NMI / FIQ (alimentación del CPU)",
    category: "hardware",
    confidence: "media",
    pattern: /pmp nmi|pmp[^\n]{0,30}fiq|nmi fiq/i,
    explanation:
      "El procesador de administración de energía reportó una interrupción crítica. Suele apuntar a la alimentación del CPU: PMIC, condensadores o cortos en sus líneas.",
    components: ["PMIC / alimentación del CPU", "Condensadores y líneas del CPU"],
    checks: ["Medir consumo en fuente regulada.", "Buscar cortos en las líneas del CPU."],
  },
  {
    id: "smc",
    title: "Falla del SMC (administrador de energía y sensores)",
    category: "hardware",
    confidence: "baja",
    pattern: /smc (?:panic|data abort|assertion failed)|smc panic|bsc failure/i,
    explanation:
      "El SMC, que gestiona batería, carga y sensores, reportó un error. La causa exacta varía según el modelo; es un punto de partida, no un veredicto.",
    components: ["Batería / flex de carga", "Sensores gestionados por el SMC", "Placa lógica (si persiste)"],
    checks: ["Probar con batería y flex de carga de prueba.", "Si persiste, revisar la placa lógica."],
  },
  {
    id: "undefined-instruction",
    title: "Instrucción indefinida del kernel",
    category: "software",
    confidence: "media",
    pattern: /undefined kernel instruction/i,
    explanation:
      "El kernel ejecutó una instrucción inválida. Suele ser un problema de software, aunque la memoria defectuosa también puede producirlo.",
    components: ["Sistema iOS"],
    checks: SOFTWARE_CHECKS,
  },
  {
    id: "wlan-bt",
    title: "Falla del módulo Wi-Fi / Bluetooth",
    category: "hardware",
    confidence: "media",
    pattern: /applebcmwlan|bcmwlan|wlan[^\n]{0,40}(?:panic|assert|fail|crash|timeout)|wifi[^\n]{0,40}(?:panic|assert|crash|firmware)/i,
    explanation:
      "El log apunta al driver del módulo Wi-Fi / Bluetooth. Es común cuando el módulo está dañado o mal soldado.",
    components: ["Módulo Wi-Fi / Bluetooth"],
    checks: [
      "Verificar si Wi-Fi o Bluetooth aparecen grisados en Ajustes.",
      "Evaluar reflow o reemplazo del módulo.",
    ],
  },
  {
    id: "soc-hot",
    title: "Sobretemperatura del SoC (Hot Hot Hot)",
    category: "hardware",
    confidence: "media",
    pattern: /hot\s+hot\s+hot|apple\s?soc\s?hot|sochot/i,
    explanation:
      "El procesador reportó sobretemperatura. Las guías de reparación lo asocian con la línea entre el PMIC y el CPU, y con el codec de audio o el módulo Wi-Fi sobrecalentándose.",
    components: ["Línea PMIC–CPU", "Codec de audio", "Módulo Wi-Fi"],
    checks: [
      "Buscar componentes que calienten con cámara térmica o alcohol.",
      "Descartar cortos en las líneas del codec y del módulo Wi-Fi.",
    ],
  },
  {
    id: "baseband",
    title: "Falla del baseband (módem)",
    category: "hardware",
    confidence: "baja",
    pattern: /baseband[^\n]{0,40}(?:panic|crash|fail|timeout|assert)|basebandpcie[^\n]{0,40}(?:timeout|error)/i,
    explanation:
      "El módem (baseband) dejó de responder. Puede deberse al chip de baseband, su memoria o las líneas de antena y SIM.",
    components: ["Baseband / módem", "Flex o líneas de antena", "Bandeja SIM"],
    checks: [
      "Probar sin SIM y con otra bandeja SIM.",
      "Revisar IMEI y señal; evaluar el chip de baseband si persiste.",
    ],
  },
  {
    id: "audio-codec",
    title: "Falla del codec de audio",
    category: "hardware",
    confidence: "media",
    pattern: /audio codec|cs42l\d*|cs35l\d*|codec[^\n]{0,40}(?:panic|timeout|fail|abort)/i,
    explanation:
      "El log apunta al codec de audio. Es común con el chip dañado o con cortos en sus líneas; los flexes de micrófono y altavoz también pueden intervenir.",
    components: ["Codec de audio", "Altavoz / micrófonos"],
    checks: ["Desconectar altavoz y micrófonos y probar.", "Si persiste, revisar el codec en la placa."],
  },
  {
    id: "camera",
    title: "Falla de cámara / ISP",
    category: "hardware",
    confidence: "media",
    pattern: /(?:h\d{1,2}ispdrv|appleh\d+cam\w*|camera|\bisp\b)[^\n]{0,60}(?:panic|timeout|fail|abort|assert|hang)/i,
    explanation:
      "El log apunta al subsistema de cámara o procesador de imagen. Suele ser un flex de cámara defectuoso, aunque también el ISP de la placa.",
    components: ["Cámara trasera", "Cámara frontal", "Conectores de cámara"],
    checks: [
      "Desconectar las cámaras de a una y probar el arranque.",
      "Revisar los conectores de cámara por humedad o corrosión.",
    ],
  },
  {
    id: "thermal-generic",
    title: "Apagado por temperatura",
    category: "mixto",
    confidence: "baja",
    pattern: /thermal[^\n]{0,40}(?:panic|shutdown|emergency|critical|exceed)/i,
    supersededBy: ["missing-sensors", "soc-hot"],
    explanation:
      "El log habla de un apagado térmico sin detallar el origen. Puede ser un sensor defectuoso, sobrecalentamiento real o software.",
    components: ["Batería", "Sensores de temperatura", "Sistema iOS"],
    checks: ["Verificar si el equipo calienta de verdad.", ...SOFTWARE_CHECKS],
  },
  {
    id: "zone-exhausted",
    title: "Memoria del kernel agotada",
    category: "software",
    confidence: "media",
    pattern: /zone_map_exhausted|zone map exhausted|zone_require|zone[^\n]{0,20}exceed/i,
    explanation:
      "El kernel se quedó sin memoria en una zona. Suele deberse a una fuga de memoria de una app, tweak o versión de iOS.",
    components: ["Sistema iOS", "Apps o tweaks instalados"],
    checks: SOFTWARE_CHECKS,
  },
  {
    id: "kernel-abort",
    title: "Error de acceso a memoria del kernel",
    category: "mixto",
    confidence: "baja",
    pattern: /kernel (?:data|instruction fetch) abort|kernel trap|synchronous exception|pac (?:failure|fail|exception)|ptrauth/i,
    onlyIfNoOther: true,
    explanation:
      "Error genérico del kernel sin un patrón de hardware más específico. Puede ser software (iOS dañado, jailbreak, tweaks) o hardware (RAM, NAND, CPU). Fijate en los drivers detectados en el backtrace.",
    components: ["Sistema iOS", "RAM / NAND / CPU (si persiste tras restaurar)"],
    checks: SOFTWARE_CHECKS,
  },
];

const FALLBACK_FINDING: Omit<Finding, "evidence"> = {
  ruleId: "unknown",
  title: "Sin patrón conocido",
  category: "mixto",
  confidence: "baja",
  explanation:
    "El log no coincide con ninguno de los patrones de la base de reglas. No significa que no haya falla: hace falta más información.",
  components: ["Sin componente identificado"],
  checks: [
    "Restaurar iOS desde cero para descartar software.",
    "Si se repite, exportar más logs del mismo equipo: un patrón repetido da pistas.",
    "Probar desconectando periféricos (cámaras, flex de carga) uno por uno.",
  ],
};

const CONFIDENCE_RANK: Record<Confidence, number> = { alta: 0, media: 1, baja: 2 };

function evidenceAround(text: string, index: number): string {
  const start = text.lastIndexOf("\n", index) + 1;
  let end = text.indexOf("\n", index);
  if (end === -1) end = text.length;
  let from = start;
  let to = end;
  if (to - from > 260) {
    from = Math.max(start, index - 80);
    to = Math.min(end, from + 260);
  }
  const line = text.slice(from, to).trim();
  return `${from > start ? "…" : ""}${line}${to < end ? "…" : ""}`;
}

function runRules(text: string): Finding[] {
  const hits = new Map<string, { order: number; finding: Finding }>();

  RULES.forEach((rule, order) => {
    const haystack = rule.strip ? text.replace(rule.strip, " ") : text;
    const m = rule.pattern.exec(haystack);
    if (!m) return;
    const r = rule.refine?.(m) ?? {};
    hits.set(rule.id, {
      order,
      finding: {
        ruleId: rule.id,
        title: r.title ?? rule.title,
        category: r.category ?? rule.category,
        confidence: r.confidence ?? rule.confidence,
        evidence: evidenceAround(haystack, m.index),
        explanation: r.explanation ?? rule.explanation,
        components: r.components ?? rule.components,
        checks: r.checks ?? rule.checks,
      },
    });
  });

  for (const rule of RULES) {
    if (rule.supersededBy?.some((id) => hits.has(id))) hits.delete(rule.id);
  }
  const hasOther = (id: string) => [...hits.keys()].some((k) => k !== id);
  for (const rule of RULES) {
    if (rule.onlyIfNoOther && hasOther(rule.id)) hits.delete(rule.id);
  }

  return [...hits.values()]
    .sort((a, b) => CONFIDENCE_RANK[a.finding.confidence] - CONFIDENCE_RANK[b.finding.confidence] || a.order - b.order)
    .map((h) => h.finding);
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export function analyzePanicText(raw: string, fileName: string | null = null): AnalyzeResult {
  const parsed = parsePanicLog(raw);
  if (!parsed) {
    return {
      ok: false,
      fileName,
      error:
        "No parece un archivo panic-full. Buscá el que empieza con \"panic-full-\" (extensión .ips) en los registros del iPhone.",
    };
  }

  const text = sanitizeForRules(parsed.panicText);
  const findings = runRules(text);

  const kextHints: KextHint[] = [];
  for (const kext of extractBacktraceKexts(text)) {
    const component = componentForKext(kext);
    if (component) kextHints.push({ kext, component });
  }

  if (findings.length === 0) {
    findings.push({ ...FALLBACK_FINDING, evidence: evidenceAround(text, 0) });
  }

  const headline = (text.split("\n").find((l) => l.trim()) ?? "").trim();
  return {
    ok: true,
    analysis: {
      fileName,
      device: parsed.device,
      headline: headline.length > 400 ? `${headline.slice(0, 397)}…` : headline,
      findings,
      kextHints,
    },
  };
}

export function summarizePatterns(analyses: PanicAnalysis[]): PatternSummary[] {
  const total = analyses.length;
  if (total < 2) return [];
  const counts = new Map<string, PatternSummary>();
  for (const a of analyses) {
    for (const f of a.findings) {
      if (f.ruleId === "unknown") continue;
      const prev = counts.get(f.ruleId);
      if (prev) prev.count += 1;
      else counts.set(f.ruleId, { ruleId: f.ruleId, title: f.title, category: f.category, count: 1, total });
    }
  }
  return [...counts.values()].filter((p) => p.count >= 2).sort((a, b) => b.count - a.count);
}

const CATEGORY_LABEL: Record<FaultCategory, string> = {
  hardware: "Hardware",
  software: "Software",
  mixto: "Hardware o software",
};

export function categoryLabel(c: FaultCategory): string {
  return CATEGORY_LABEL[c];
}

export function buildReport(results: AnalyzeResult[]): string {
  const lines: string[] = ["ANÁLISIS DE PANIC FULL - F7 Manager Pro", DISCLAIMER, ""];
  const analyses = results.filter((r): r is Extract<AnalyzeResult, { ok: true }> => r.ok).map((r) => r.analysis);

  const patterns = summarizePatterns(analyses);
  if (patterns.length > 0) {
    lines.push("PATRONES REPETIDOS");
    for (const p of patterns) lines.push(`- ${p.title}: en ${p.count} de ${p.total} logs`);
    lines.push("");
  }

  results.forEach((r, i) => {
    if (results.length > 1) lines.push(`--- Log ${i + 1} ---`);
    if (r.ok === false) {
      lines.push(`Archivo: ${r.fileName ?? "(pegado)"}`, `No se pudo analizar: ${r.error}`, "");
      return;
    }
    const a = r.analysis;
    const dev = [
      a.device.name ? `${a.device.name}${a.device.id ? ` (${a.device.id})` : ""}` : a.device.id,
      a.device.osVersion,
      a.device.date,
    ].filter(Boolean);
    if (a.fileName) lines.push(`Archivo: ${a.fileName}`);
    if (dev.length) lines.push(`Equipo: ${dev.join(" · ")}`);
    const [main, ...others] = a.findings;
    lines.push(`Falla probable: ${main.title} - ${categoryLabel(main.category)}, confianza ${main.confidence}`);
    lines.push(`Evidencia: ${main.evidence}`);
    lines.push("Componentes a revisar:", ...main.components.map((c) => `  - ${c}`));
    lines.push("Qué verificar:", ...main.checks.map((c) => `  - ${c}`));
    if (others.length) lines.push(`Otras posibilidades: ${others.map((f) => f.title).join("; ")}`);
    if (a.kextHints.length) lines.push(`Drivers en el backtrace: ${a.kextHints.map((k) => k.component).join(", ")}`);
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}
