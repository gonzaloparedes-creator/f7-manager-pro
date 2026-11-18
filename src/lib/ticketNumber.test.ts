import { describe, expect, it } from "vitest";
import { saleMatchesQuery, ticketNumber } from "./ticketNumber";

// Un sale_group_id real termina en 6 caracteres hexadecimales: acá el de la venta
// del ticket "#3A2233" que mostró el cliente.
const ID = "5b1c9e20-7d44-4f1a-9a3e-9d0c0b3a2233";

describe("ticketNumber", () => {
  it("son los últimos 6 caracteres del identificador, en mayúsculas", () => {
    expect(ticketNumber("abcdef123456")).toBe("123456");
    expect(ticketNumber("5b1c9e20-7d44-4f1a-9a3e-0c2b3a2233ab")).toBe("2233AB");
    expect(ticketNumber(ID)).toBe("3A2233");
  });

  it("con un identificador corto devuelve lo que hay", () => {
    expect(ticketNumber("ab")).toBe("AB");
    expect(ticketNumber("")).toBe("");
  });
});

describe("saleMatchesQuery", () => {
  const names = ["Glass 5d A07", "Estuche Samsung A07", "Funda Note 13 Pro"];

  it("un buscador vacío o en blanco deja pasar todas las ventas", () => {
    expect(saleMatchesQuery(ID, names, "")).toBe(true);
    expect(saleMatchesQuery(ID, names, "   ")).toBe(true);
    expect(saleMatchesQuery(ID, names, "#")).toBe(true);
  });

  it("encuentra la venta por el número de ticket, con o sin #, en mayúsculas o minúsculas", () => {
    expect(saleMatchesQuery(ID, names, "3A2233")).toBe(true);
    expect(saleMatchesQuery(ID, names, "#3A2233")).toBe(true);
    expect(saleMatchesQuery(ID, names, "#3a2233")).toBe(true);
    expect(saleMatchesQuery(ID, names, " 3a2233 ")).toBe(true);
  });

  it("también por una parte del número", () => {
    expect(saleMatchesQuery(ID, names, "3A22")).toBe(true);
    expect(saleMatchesQuery(ID, names, "2233")).toBe(true);
  });

  it("no confunde un ticket con otro", () => {
    expect(saleMatchesQuery(ID, names, "3A2234")).toBe(false);
    expect(saleMatchesQuery(ID, names, "#ZZZZZZ")).toBe(false);
  });

  it("encuentra la venta por el nombre de cualquiera de sus productos", () => {
    expect(saleMatchesQuery(ID, names, "samsung")).toBe(true);
    expect(saleMatchesQuery(ID, names, "GLASS")).toBe(true);
    expect(saleMatchesQuery(ID, names, "note 13")).toBe(true);
    expect(saleMatchesQuery(ID, names, "iphone")).toBe(false);
  });

  it("no distingue tildes en los nombres", () => {
    expect(saleMatchesQuery(ID, ["Cargador rápido"], "rapido")).toBe(true);
    expect(saleMatchesQuery(ID, ["Cargador rapido"], "rápido")).toBe(true);
  });

  it("una venta sin productos solo responde por su número", () => {
    expect(saleMatchesQuery(ID, [], "3A2233")).toBe(true);
    expect(saleMatchesQuery(ID, [], "glass")).toBe(false);
  });
});
