/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client } from "basic-ftp";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { Writable } from "stream";
import * as XLSX from "xlsx";
import { getDiscount } from "./getDiscount";

const PRICE_COLUMNS = [
  "PLN 10",
  "PLN 50",
  "PLN 100",
  "PLN 250",
  "PLN 500",
  "PLN 1000",
  "EUR 10",
  "EUR 50",
  "EUR 100",
  "EUR 250",
  "EUR 500",
  "EUR 1000",
];

const stockConnectUrl = "https://stockconnect.pl/www/xml/stany.xml";

// ========================
// Funkcje pomocnicze
// ========================

function normalizeKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(normalizeKeys);
  if (typeof obj === "object" && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        key.trim().replace(/\s+/g, "_"),
        normalizeKeys(value),
      ])
    );
  }
  return obj;
}

function parsePrice(raw: any): number | null {
  if (raw === null || raw === undefined) return null;

  // Jeśli już number, zwróć od razu
  if (typeof raw === "number") return raw;

  // Jeśli string, wyczyść i sparsuj
  if (typeof raw === "string") {
    const cleaned = raw.replace(/[^\d,\.]/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  return null; // dla innych typów
}

function applyDiscountToPrices(row: any, discount: number): void {
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = key.trim(); // usuwa spacje z końca/ początku
    if (PRICE_COLUMNS.includes(normalizedKey)) {
      const price = parsePrice(value);

      if (price === null) {
        row[key] = "";
        continue;
      }

      const discounted = price * (1 - discount / 100);
      const formatted = discounted.toFixed(2).replace(".", ",");

      // Wykryj walutę i zastosuj odpowiedni format
      if (typeof value === "string" && value.includes("zł")) {
        row[key] = `${formatted} zł`;
      } else if (typeof value === "string" && value.includes("€")) {
        row[key] = `€ ${formatted}`;
      } else {
        row[key] = `${formatted} zł`;
      }
    }
  }
}

async function downloadAndParseXLSX(
  ftpClient: Client,
  filename: string
): Promise<any[]> {
  const chunks: Buffer[] = [];
  const writable = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  await ftpClient.downloadTo(writable, filename);
  const buffer = Buffer.concat(chunks);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<any>(sheet);
}

// utils/fetchXmlAndGetStan.ts
export async function fetchXmlFromUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Nie udało się pobrać XMLa");
  return res.text();
}

export function getStanFromXml(xml: string, symbol: string): number | null {
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);

  const produkty = parsed?.Stany?.Lista?.Produkt;

  if (!produkty) return null;

  // Jeśli symbol jest stringiem, spróbuj sparsować do liczby
  const targetSymbol =
    typeof symbol === "string" ? parseInt(symbol, 10) : symbol;

  // Gdy tylko jeden produkt
  if (!Array.isArray(produkty)) {
    const produkt = produkty;
    return produkt.Symbol === targetSymbol ? parseInt(produkt.Stan, 10) : null;
  }

  // Gdy wiele produktów
  const found = produkty.find(
    (produkt: any) => produkt.Symbol === targetSymbol
  );
  return found ? parseInt(found.Stan, 10) : null;
}

// ========================
// Główna funkcja
// ========================

export async function getDatafeed(email: string): Promise<string | null> {
  const ftpClient = new Client();

  try {
    const stockXml = await fetchXmlFromUrl(stockConnectUrl);

    const discountStr = await getDiscount(email); // np. "15"
    if (discountStr === null) return null;
    const discount = parseFloat(discountStr);
    if (isNaN(discount)) return null;

    await ftpClient.access({
      host: "vh34.seohost.pl",
      user: "xml@stockconnect.pl",
      password: "6MqGvuMLVmzXVYMnQ4Bu",
      secure: false,
    });

    const nameData = await downloadAndParseXLSX(ftpClient, "name.xlsx");
    const dataData = await downloadAndParseXLSX(ftpClient, "data.xlsx");

    const dataMap = new Map<string, any>();
    for (const d of dataData) {
      if (d.model_symbol) dataMap.set(d.model_symbol, d);
    }

    const mergedProducts = nameData
      .map((item: any) => {
        const modelSymbol = item.model_symbol;
        const symbol = item.symbol;
        const match = dataMap.get(modelSymbol);
        const stan = getStanFromXml(stockXml, symbol);
        if (!match) return null;

        // Wyciągnij wszystkie pola z prefixem "ver_" i usuń prefix
        const verFields = Object.entries(item)
          .filter(([key]) => key.startsWith("ver_"))
          .reduce((acc, [key, value]) => {
            acc[key.replace(/^ver_/, "")] = value;
            return acc;
          }, {} as Record<string, any>);

        // Usuń pola z prefixem "ver_" z item
        const itemWithoutVer = Object.fromEntries(
          Object.entries(item).filter(([key]) => !key.startsWith("ver_"))
        );

        const combined = {
          ...itemWithoutVer,
          ...match,
          ...verFields,
          stan: stan,
        };

        // Ustaw name na ver_name jeśli istnieje i nie jest undefined/puste
        if (verFields.name !== undefined && verFields.name !== "") {
          combined.name = verFields.name;
        }

        applyDiscountToPrices(combined, discount);
        return normalizeKeys(combined);
      })
      .filter(Boolean);

    console.log(mergedProducts[12]);
    const builder = new XMLBuilder({ ignoreAttributes: false, format: true });
    const xml = builder.build({
      catalog: {
        updatedAt: new Date().toISOString(),
        products: { product: mergedProducts },
      },
    });

    return xml;
  } catch (err) {
    console.error("Błąd podczas generowania feeda:", err);
    return null;
  } finally {
    ftpClient.close();
  }
}
