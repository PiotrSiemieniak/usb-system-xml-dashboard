import { Client } from "basic-ftp";
import { XMLBuilder } from "fast-xml-parser";
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

// ========================
// Funkcje pomocnicze
// ========================

function normalizeKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(normalizeKeys);
  if (typeof obj === "object" && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        key.replace(/\s+/g, "_"),
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
  for (const col of PRICE_COLUMNS) {
    if (row[col] !== undefined) {
      const original = row[col];
      const price = parsePrice(original);

      if (price === null) {
        row[col] = "";
        continue;
      }

      const discounted = price * (1 - discount / 100);
      const formatted = discounted.toFixed(2).replace(".", ",");

      // Wykryj walutę i zastosuj odpowiedni format
      if (typeof original === "string" && original.includes("zł")) {
        row[col] = `${formatted} zł`;
      } else if (typeof original === "string" && original.includes("€")) {
        row[col] = `€ ${formatted}`;
      } else {
        // Domyślnie zł jeśli brak informacji
        row[col] = `${formatted} zł`;
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

// ========================
// Główna funkcja
// ========================

export async function getDatafeed(email: string): Promise<string | null> {
  const ftpClient = new Client();

  try {
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
      .map((item: any, i) => {
        const modelSymbol = item.model_symbol;
        const match = dataMap.get(modelSymbol);
        if (!match) return null;

        if (i === 0) console.log(match);
        const combined = { ...item, ...match };
        applyDiscountToPrices(combined, discount);
        return normalizeKeys(combined);
      })
      .filter(Boolean);

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
