import { CryptoService } from "./cryptoService.ts";
import type { OpenRouterService } from "./openrouterService.ts";

const createService = (): CryptoService => {
  return new CryptoService({} as OpenRouterService);
};

describe("CryptoService validation", () => {
  it("does not access the database when a write has no cryptocurrencies", async () => {
    const result = await createService().execute(
      "insert",
      "Adicione uma criptomoeda",
    );

    expect(result).toMatchObject({
      operation: "insert",
      template: "crypto_insert",
      affected: 0,
      records: [],
    });
  });

  it("requires symbol and name before inserting", async () => {
    const result = await createService().execute("insert", "Adicione BTC", [
      {
        symbol: "BTC",
        name: null,
        investmentAmount: 200,
        currency: "USDT",
      },
    ]);

    expect(result.missingCryptoFields).toEqual({
      BTC: ["name"],
    });
    expect(result.affected).toBe(0);
  });

  it("requires a symbol before updating or deleting", async () => {
    const crypto = {
      symbol: null,
      name: "Bitcoin",
      investmentAmount: 200,
      currency: "USDT",
    };

    const updateResult = await createService().execute(
      "update",
      "Atualize Bitcoin",
      [crypto],
    );
    const deleteResult = await createService().execute(
      "delete",
      "Remova Bitcoin",
      [crypto],
    );

    expect(updateResult.missingCryptoFields).toEqual({ Bitcoin: ["symbol"] });
    expect(deleteResult.missingCryptoFields).toEqual({ Bitcoin: ["symbol"] });
  });
});
