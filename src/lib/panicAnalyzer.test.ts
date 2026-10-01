import { describe, it, expect } from "vitest";
import { analyzePanicText, buildReport, summarizePatterns, type AnalyzeResult, type PanicAnalysis } from "./panicAnalyzer";

const KEXT_TAIL = [
  "",
  "Kernel Extensions in backtrace:",
  "  com.apple.driver.AppleBCMWLAN(1.0.0)[AAAA-BBBB]@0xfffffff0098c0000->0xfffffff0098c9fff",
  "    dependency: com.apple.driver.AppleANS2NVMeController(1.0)[CCCC]@0xfffffff009000000",
  "",
  "last started kext at 55555: com.apple.driver.AppleANS2NVMe 1.0 (addr 0x1, size 0x2)",
  "loaded kexts:",
  "com.apple.driver.AppleANS2NVMeController 1.0",
  "com.apple.driver.AppleS5L8920XI2C2 1.0",
].join("\n");

function ips(panicString: string, product = "iPhone12,1", osVersion = "iPhone OS 17.1 (21B74)") {
  const header = JSON.stringify({ bug_type: "210", timestamp: "2026-09-01 10:02:03.00 -0300", os_version: osVersion, incident_id: "X" });
  const body = JSON.stringify({ build: osVersion, product, panicString });
  return `${header}\n${body}`;
}

function analyze(text: string): PanicAnalysis {
  const r = analyzePanicText(text, "panic-full-test.ips");
  if (r.ok === false) throw new Error(r.error);
  return r.analysis;
}

describe("parser", () => {
  it("lee el formato .ips de iOS 15+ (header + body JSON)", () => {
    const a = analyze(ips('panic(cpu 1 caller 0x1): "thermalmonitord: Missing sensor(s): TG0B"\nDebugger message: panic'));
    expect(a.device.id).toBe("iPhone12,1");
    expect(a.device.name).toBe("iPhone 11");
    expect(a.device.osVersion).toBe("iOS 17.1 (21B74)");
    expect(a.device.date).toBe("2026-09-01 10:02:03");
  });

  it("lee el formato de texto plano de iOS viejo", () => {
    const text = [
      "Incident Identifier: 1234",
      "Hardware Model: iPhone9,1",
      "OS Version: iPhone OS 13.3 (17D50)",
      'panic(cpu 0 caller 0xfffffff0): "userspace watchdog timeout: no successful checkins from com.apple.logd in 120 seconds"',
    ].join("\n");
    const a = analyze(text);
    expect(a.device.id).toBe("iPhone9,1");
    expect(a.device.name).toBe("iPhone 7");
    expect(a.findings[0].ruleId).toBe("userspace-watchdog");
  });

  it("muestra el id crudo si el modelo no está en el mapa", () => {
    const a = analyze(ips('panic(cpu 1 caller 0x1): "Missing sensor(s): TG0B"', "iPhone99,9"));
    expect(a.device.id).toBe("iPhone99,9");
    expect(a.device.name).toBeNull();
  });

  it("rechaza un .ips que no es un panic (crash de app)", () => {
    const header = JSON.stringify({ bug_type: "109", timestamp: "2026-09-01 10:00:00.00 -0300" });
    const body = JSON.stringify({ app_name: "Safari", exception: { type: "EXC_CRASH" } });
    const r = analyzePanicText(`${header}\n${body}`, "Safari.ips");
    expect(r.ok).toBe(false);
  });

  it("rechaza texto vacío o ajeno", () => {
    expect(analyzePanicText("").ok).toBe(false);
    expect(analyzePanicText("hola, esto no es un log").ok).toBe(false);
  });

  it("recupera el panicString con regex si el JSON está roto", () => {
    const broken = '{"bug_type":"210"}\n{"product":"iPhone13,2","panicString":"panic(cpu 1): \\"AOP NMI POWER\\"\\nmore"  <<<corrupto';
    const a = analyze(broken);
    expect(a.device.id).toBe("iPhone13,2");
    expect(a.findings[0].ruleId).toBe("aop-nmi-power");
  });
});

describe("reglas", () => {
  it("missing sensors: nombra el sensor y el componente", () => {
    const a = analyze(ips('panic(cpu 1 caller 0x1): "thermalmonitord: Missing sensor(s): TG0B, Mic1"'));
    const f = a.findings[0];
    expect(f.ruleId).toBe("missing-sensors");
    expect(f.category).toBe("hardware");
    expect(f.confidence).toBe("alta");
    expect(f.title).toContain("TG0B");
    expect(f.title).toContain("MIC1");
    expect(f.components.join(" ")).toMatch(/Batería/);
    expect(f.components.join(" ")).toMatch(/Micrófono inferior/);
  });

  it("missing sensors: sensor desconocido cae a descripción genérica", () => {
    const f = analyze(ips('panic(cpu 1): "Missing sensor(s): Ts7X"')).findings[0];
    expect(f.components[0]).toMatch(/TS7X/);
  });

  it("userspace watchdog: servicio de software", () => {
    const f = analyze(
      ips('panic(cpu 2 caller 0x1): "userspace watchdog timeout: no successful checkins from com.apple.SpringBoard in 120 seconds\nservice: com.apple.thermalmonitord, total successful checkins in 900 seconds: 12"')
    ).findings[0];
    expect(f.ruleId).toBe("userspace-watchdog");
    expect(f.category).toBe("software");
    expect(f.title).toContain("SpringBoard");
  });

  it("userspace watchdog: thermalmonitord es mixto", () => {
    const f = analyze(ips('panic(cpu 2): "userspace watchdog timeout: no successful checkins from thermalmonitord (2 induced crashes) in 130 seconds"')).findings[0];
    expect(f.category).toBe("mixto");
  });

  it("userspace watchdog NO dispara la regla WDT de hardware", () => {
    const a = analyze(ips('panic(cpu 2): "userspace watchdog timeout: no successful checkins from logd in 120 seconds"'));
    expect(a.findings.map((f) => f.ruleId)).not.toContain("wdt");
  });

  it("WDT de kernel sí dispara la regla de hardware", () => {
    const f = analyze(ips('panic(cpu 0 caller 0x1): "WDT timeout on cpu 0"')).findings[0];
    expect(f.ruleId).toBe("wdt");
    expect(f.category).toBe("hardware");
  });

  it("ANS2 -> NAND", () => {
    const f = analyze(ips('panic(cpu 0 caller 0x1): "ANS2 Recoverable Panic: error 0x5"')).findings[0];
    expect(f.ruleId).toBe("ans-nand");
    expect(f.components[0]).toMatch(/NAND/);
  });

  it("SEP ROM boot panic", () => {
    expect(analyze(ips('panic(cpu 0): "SEP ROM Boot Panic"')).findings[0].ruleId).toBe("sep-rom");
  });

  describe("SEP monitor error", () => {
    const line =
      'panic(cpu 0 caller 0xfffffff03154aaa0): "SEP monitor error: INACCESSIBLE SEP REGISTERS SOC_PERF_STATE_CTL 0x00000333 VOLMAN_SOC_VOLTAGE 0x015f655f" @AppleT8110PlatformErrorHandler.cpp:948\nDebugger message: panic';

    it("iPhone 13: placas apiladas + Face ID", () => {
      const f = analyze(ips(line, "iPhone14,5", "iPhone OS 26.5 (23F77)")).findings[0];
      expect(f.ruleId).toBe("sep-monitor-error");
      expect(f.category).toBe("hardware");
      const comps = f.components.join(" | ");
      expect(comps).toMatch(/interposer/);
      expect(comps).toMatch(/NFC/);
      expect(comps).toMatch(/Wi-Fi/);
      expect(comps).toMatch(/Face ID/);
      expect(f.checks.join(" ")).toMatch(/interposer/);
    });

    it("iPhone 11: tiene Face ID pero no placas apiladas", () => {
      const f = analyze(ips(line, "iPhone12,1")).findings[0];
      const comps = f.components.join(" | ");
      expect(comps).not.toMatch(/interposer/);
      expect(comps).toMatch(/Face ID/);
    });

    it("iPhone 8: ni placas apiladas ni Face ID", () => {
      const f = analyze(ips(line, "iPhone10,1")).findings[0];
      const comps = f.components.join(" | ");
      expect(comps).not.toMatch(/interposer|Face ID/);
      expect(comps).toMatch(/NFC/);
    });

    it("no se confunde con el SEP ROM boot panic", () => {
      const ids = analyze(ips(line)).findings.map((x) => x.ruleId);
      expect(ids).not.toContain("sep-rom");
    });
  });

  it("i2c: bus 3 apunta a flex de carga", () => {
    const f = analyze(ips('panic(cpu 0): "AppleARMIIC i2c3 timeout"')).findings[0];
    expect(f.ruleId).toBe("i2c-bus");
    expect(f.title).toBe("Error en el bus I2C3");
    expect(f.components.join(" ")).toMatch(/carga/);
  });

  it("i2c: bus desconocido baja la confianza", () => {
    const f = analyze(ips('panic(cpu 0): "i2c0 nack"')).findings[0];
    expect(f.confidence).toBe("baja");
  });

  it("AOP: las reglas específicas reemplazan a la genérica", () => {
    const a = analyze(ips('panic(cpu 0): "AOP PANIC - AOP K2 Bosch control channel write failure"'));
    const ids = a.findings.map((f) => f.ruleId);
    expect(ids).toContain("aop-k2-bosch");
    expect(ids).not.toContain("aop-panic");
  });

  it("AOP PANIC genérico", () => {
    expect(analyze(ips('panic(cpu 0): "AOP PANIC: something"')).findings[0].ruleId).toBe("aop-panic");
  });

  it("No pulse on", () => {
    expect(analyze(ips('panic(cpu 0): "No pulse on vibrator"')).findings[0].ruleId).toBe("no-pulse");
  });

  it("Hot Hot Hot", () => {
    expect(analyze(ips('panic(cpu 0): "AppleSocHot Hot Hot Hot"')).findings[0].ruleId).toBe("soc-hot");
  });

  it("undefined kernel instruction es software", () => {
    const f = analyze(ips('panic(cpu 0): "Undefined Kernel Instruction: pc=0x1"')).findings[0];
    expect(f.category).toBe("software");
  });

  it("kernel data abort genérico solo aparece si no hay otra falla", () => {
    const solo = analyze(ips('panic(cpu 0 caller 0x1): "Kernel data abort. at pc 0x1"'));
    expect(solo.findings[0].ruleId).toBe("kernel-abort");
    const conOtra = analyze(ips('panic(cpu 0 caller 0x1): "Kernel data abort. SEP ROM Boot Panic"'));
    expect(conOtra.findings.map((f) => f.ruleId)).not.toContain("kernel-abort");
  });

  it("sin patrón conocido devuelve el hallazgo de respaldo", () => {
    const a = analyze(ips('panic(cpu 0 caller 0x1): "some brand new thing"'));
    expect(a.findings).toHaveLength(1);
    expect(a.findings[0].ruleId).toBe("unknown");
  });

  it("ignora la lista de loaded kexts y las dependencias (evita falsos positivos)", () => {
    // "ANS2NVMeController" e "i2c2" sólo aparecen en kexts cargados / dependencias: no deben disparar reglas
    const a = analyze(ips('panic(cpu 0 caller 0x1): "some brand new thing"' + KEXT_TAIL));
    expect(a.findings.map((f) => f.ruleId)).toEqual(["wlan-bt"]);
  });

  it("extrae pistas de drivers del backtrace", () => {
    const a = analyze(ips('panic(cpu 0 caller 0x1): "Kernel data abort"' + KEXT_TAIL));
    expect(a.kextHints).toEqual([{ kext: "com.apple.driver.AppleBCMWLAN", component: "Módulo Wi-Fi / Bluetooth" }]);
  });

  it("ordena por confianza: alta antes que baja", () => {
    const a = analyze(ips('panic(cpu 0): "Missing sensor(s): TG0B" "i2c0 nack"'));
    expect(a.findings[0].ruleId).toBe("missing-sensors");
    expect(a.findings[1].ruleId).toBe("i2c-bus");
  });
});

describe("resumen y reporte", () => {
  const log = (s: string) => analyze(ips(s));

  it("detecta patrones repetidos entre varios logs", () => {
    const list = [
      log('panic(cpu 0): "Missing sensor(s): TG0B"'),
      log('panic(cpu 1): "Missing sensor(s): TG0V"'),
      log('panic(cpu 2): "SEP ROM Boot Panic"'),
    ];
    const p = summarizePatterns(list);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ ruleId: "missing-sensors", count: 2, total: 3 });
  });

  it("no resume con un solo log", () => {
    expect(summarizePatterns([log('panic(cpu 0): "Missing sensor(s): TG0B"')])).toEqual([]);
  });

  it("el reporte incluye equipo, falla, componentes y aviso", () => {
    const results: AnalyzeResult[] = [
      analyzePanicText(ips('panic(cpu 1): "Missing sensor(s): TG0B"'), "panic-full-1.ips"),
      analyzePanicText("basura", "raro.txt"),
    ];
    const report = buildReport(results);
    expect(report).toContain("iPhone 11 (iPhone12,1)");
    expect(report).toContain("Sensor sin respuesta: TG0B");
    expect(report).toContain("Batería");
    expect(report).toContain("orientativo");
    expect(report).toContain("No se pudo analizar");
  });
});
