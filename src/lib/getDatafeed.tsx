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

function normalizeKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(normalizeKeys);
  } else if (typeof obj === "object" && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        key.replace(/\s+/g, "_"),
        normalizeKeys(value),
      ])
    );
  }
  return obj;
}

export async function getDatafeed(email: string): Promise<string | null> {
  const ftpClient = new Client();

  try {
    const discount = getDiscount(email); // np. 15 (%)

    await ftpClient.access({
      host: "vh34.seohost.pl",
      user: "xml@stockconnect.pl",
      password: "6MqGvuMLVmzXVYMnQ4Bu",
      secure: false,
    });

    // Pobierz plik name.xlsx
    const nameChunks: Buffer[] = [];
    const nameWritable = new Writable({
      write(chunk, encoding, callback) {
        nameChunks.push(Buffer.from(chunk));
        callback();
      },
    });
    await ftpClient.downloadTo(nameWritable, "name.xlsx");
    const nameBuffer = Buffer.concat(nameChunks);
    const nameWorkbook = XLSX.read(nameBuffer, { type: "buffer" });
    const nameSheet = nameWorkbook.Sheets[nameWorkbook.SheetNames[0]];
    const nameData = XLSX.utils.sheet_to_json<any>(nameSheet);

    // Pobierz plik data.xlsx
    const dataChunks: Buffer[] = [];
    const dataWritable = new Writable({
      write(chunk, encoding, callback) {
        dataChunks.push(Buffer.from(chunk));
        callback();
      },
    });
    await ftpClient.downloadTo(dataWritable, "data.xlsx");
    const dataBuffer = Buffer.concat(dataChunks);
    const dataWorkbook = XLSX.read(dataBuffer, { type: "buffer" });
    const dataSheet = dataWorkbook.Sheets[dataWorkbook.SheetNames[0]];
    const dataData = XLSX.utils.sheet_to_json<any>(dataSheet);

    // Stwórz mapę dla szybkiego łączenia po name/model_name
    const dataMap = new Map<string, any>();
    for (const d of dataData) {
      if (d.name) dataMap.set(d.name, d);
    }

    // Mapowanie i łączenie rekordów
    const products = nameData
      .map((n: any) => {
        const match = dataMap.get(n.model_name);
        if (!match) return null;

        // Skopiuj wszystkie dane z name.xlsx i połącz z data.xlsx
        const merged = { ...n, ...match };

        // Zmodyfikuj wszystkie kolumny cenowe o rabat
        for (const col of PRICE_COLUMNS) {
          if (merged[col] !== undefined && !isNaN(Number(merged[col]))) {
            const base = parseFloat(merged[col]);
            merged[col] = (base * (1 - discount / 100)).toFixed(2);
          }
        }

        return normalizeKeys(merged); // <-- tutaj normalizujemy klucze
      })
      .filter(Boolean);

    const builder = new XMLBuilder({ ignoreAttributes: false, format: true });
    const xml = builder.build({
      catalog: {
        updatedAt: new Date().toISOString(),
        products: { product: products },
      },
    });

    return xml;
  } catch (err) {
    console.error("Błąd FTP lub Excel:", err);
    return null;
  } finally {
    ftpClient.close();
  }
}
