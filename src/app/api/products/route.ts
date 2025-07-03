/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { Client } from "basic-ftp";
import { XMLParser } from "fast-xml-parser";
import { Writable } from "stream";
import * as XLSX from "xlsx";
import { getDiscount } from '@/lib/getDiscount';

const PRICE_COLUMNS = [
  "PLN_10",
  "PLN_50", 
  "PLN_100",
  "PLN_250",
  "PLN_500",
  "PLN_1000",
  "EUR_10",
  "EUR_50",
  "EUR_100", 
  "EUR_250",
  "EUR_500",
  "EUR_1000",
];

const SUPPORTED_LANGUAGES = ['PL', 'EN', 'DE', 'FR', 'ES']; // only two letters
const stockConnectUrl = "https://stockconnect.pl/www/xml/stany.xml";

// ========================
// Helper functions
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
  if (typeof raw === "number") return raw;
  
  if (typeof raw === "string") {
    const cleaned = raw.replace(/[^\d,\.]/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  
  return null;
}

function applyDiscountToPrices(row: any, discount: number): void {
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = key.trim();
    if (PRICE_COLUMNS.includes(normalizedKey)) {
      const price = parsePrice(value);

      if (price === null) {
        row[key] = "";
        continue;
      }

      const discounted = price * (1 - discount / 100);
      const formatted = discounted.toFixed(2).replace(".", ",");

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

async function fetchXmlFromUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Nie udało się pobrać XMLa");
  return res.text();
}

function getStanFromXml(xml: string, symbol: string): number | null {
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);

  const produkty = parsed?.Stany?.Lista?.Produkt;
  if (!produkty) return null;

  const targetSymbol = typeof symbol === "string" ? parseInt(symbol, 10) : symbol;

  if (!Array.isArray(produkty)) {
    const produkt = produkty;
    return produkt.Symbol === targetSymbol ? parseInt(produkt.Stan, 10) : null;
  }

  const found = produkty.find(
    (produkt: any) => produkt.Symbol === targetSymbol
  );
  return found ? parseInt(found.Stan, 10) : null;
}

function filterColumnsByLanguage(obj: any, language: string): any {
  const filtered: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Check if column has language suffix
    const langMatch = key.match(/_([A-Z]{2})$/);
    
    if (langMatch) {
      const columnLang = langMatch[1];
      // Only include if language matches requested language
      if (columnLang === language) {
        const formatedKey = key.endsWith('_' + language) ? key.slice(0, -3) : key;
        filtered[formatedKey] = value;
      }
    } else {
      // Include columns without language suffix
      filtered[key] = value;
    }
  }
  
  return filtered;
}

function groupProductsByModelSymbol(products: any[]): any[] {
  const grouped = new Map<string, any>();
  
  for (const product of products) {
    const modelSymbol = product.model_symbol;
    
    if (!grouped.has(modelSymbol)) {
      // Create base product
      const baseProduct = { ...product };
      baseProduct.variants = [];
      grouped.set(modelSymbol, baseProduct);
    }
    
    const baseProduct = grouped.get(modelSymbol);
    
    // Add variant info
    const variant = {
      name: product.name,
      modelcap_symbol: product.modelcap_symbol,
      symbol: product.symbol,
      stan: product.stan,
      // capacity: product.capacity
      // Add other variant-specific fields as needed
    };
    
    baseProduct.variants.push(variant);
  }
  
  return Array.from(grouped.values());
}

// ========================
// Main API handler
// ========================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '100');
  const language = searchParams.get('language') || 'EN';
  const email = searchParams.get('email');

  // Validate language
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    return NextResponse.json(
      { error: 'Unsupported language. Supported: ' + String(SUPPORTED_LANGUAGES) },
      { status: 400 }
    );
  }

  // Validate email
  if (!email) {
    return NextResponse.json(
      { error: 'Email parameter is required' },
      { status: 400 }
    );
  }

  const ftpClient = new Client();

  try {
    // Get stock data
    const stockXml = await fetchXmlFromUrl(stockConnectUrl);

    // Get discount
    const discountStr = await getDiscount(email);
    if (discountStr === null) {
      return NextResponse.json(
        { error: 'Invalid email or discount not found' },
        { status: 404 }
      );
    }
    
    const discount = parseFloat(discountStr);
    if (isNaN(discount)) {
      return NextResponse.json(
        { error: 'Invalid discount value' },
        { status: 500 }
      );
    }

    // Connect to FTP
    await ftpClient.access({
      host: "vh34.seohost.pl",
      user: "xml@stockconnect.pl",
      password: "6MqGvuMLVmzXVYMnQ4Bu",
      secure: false,
    });

    // Download and parse Excel files
    const nameData = await downloadAndParseXLSX(ftpClient, "name.xlsx");
    const dataData = await downloadAndParseXLSX(ftpClient, "data.xlsx");

    // Create data map
    const dataMap = new Map<string, any>();
    for (const d of dataData) {
      if (d.model_symbol) dataMap.set(d.model_symbol, d);
    }

    // Process products
    const mergedProducts = nameData
      .map((item: any) => {
        const modelSymbol = item.model_symbol;
        const symbol = item.symbol;
        const match = dataMap.get(modelSymbol);
        const stan = getStanFromXml(stockXml, symbol);
        
        if (!match) return null;

        // Extract ver_ fields and remove prefix
        const verFields = Object.entries(item)
          .filter(([key]) => key.startsWith("ver_"))
          .reduce((acc, [key, value]) => {
            acc[key.replace(/^ver_/, "")] = value;
            return acc;
          }, {} as Record<string, any>);

        // Remove ver_ fields from item
        const itemWithoutVer = Object.fromEntries(
          Object.entries(item).filter(([key]) => !key.startsWith("ver_"))
        );

        const combined = {
          ...itemWithoutVer,
          ...match,
          ...verFields,
          stan: stan,
        };

        // Set name to ver_name if exists and not empty
        if (verFields.name !== undefined && verFields.name !== "") {
          combined.name = verFields.name;
        }

        // Apply discount to prices
        applyDiscountToPrices(combined, discount);
        
        // Filter by language
        const normalizedKeys = normalizeKeys(combined)
        const languageFiltered = filterColumnsByLanguage(normalizedKeys, language);
        
        return languageFiltered
      })
      .filter(Boolean);

    // Group products by model_symbol
    const groupedProducts = groupProductsByModelSymbol(mergedProducts);

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProducts = groupedProducts.slice(startIndex, endIndex);

    // Prepare response
    const response = {
      data: paginatedProducts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(groupedProducts.length / limit),
        totalItems: groupedProducts.length,
        itemsPerPage: limit,
        hasNextPage: endIndex < groupedProducts.length,
        hasPreviousPage: page > 1,
      },
      language: language,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Error generating product feed:", error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    ftpClient.close();
  }
}

export const revalidate = 43200; // 12h w sekundach