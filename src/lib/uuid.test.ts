import { afterEach, describe, expect, it, vi } from "vitest";
import { uuid } from "./uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuid", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("devuelve un UUID v4 con la API nativa", () => {
    expect(uuid()).toMatch(V4);
  });

  // El caso real: la API .NET sirve el front por HTTP y se entra por IP, así que en toda máquina
  // que no sea el servidor el contexto NO es seguro y `randomUUID` no existe. Sin el respaldo,
  // abrir la solapa Otorgar reventaba en render y cualquier escritura fallaba con un TypeError.
  it("funciona en un contexto no seguro, sin randomUUID", () => {
    vi.stubGlobal("crypto", { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
    expect(globalThis.crypto.randomUUID).toBeUndefined();
    const generados = new Set(Array.from({ length: 200 }, () => uuid()));
    for (const valor of generados) expect(valor).toMatch(V4);
    expect(generados.size).toBe(200);
  });

  it("funciona sin WebCrypto", () => {
    vi.stubGlobal("crypto", undefined);
    const generados = new Set(Array.from({ length: 200 }, () => uuid()));
    for (const valor of generados) expect(valor).toMatch(V4);
    expect(generados.size).toBe(200);
  });
});
