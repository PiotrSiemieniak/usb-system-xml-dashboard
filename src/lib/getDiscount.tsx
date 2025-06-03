// /pages/api/generate-feed.ts
import { Client } from "basic-ftp";
import { Writable } from "stream";
import * as XLSX from "xlsx";

export async function getDiscount(email: string): Promise<string | null> {
  const ftpClient = new Client();
  let discount: string | null = null;

  try {
    await ftpClient.access({
      host: "vh34.seohost.pl",
      user: "xml@stockconnect.pl",
      password: "6MqGvuMLVmzXVYMnQ4Bu",
      secure: false,
    });

    // Pobierz plik users.xlsx do bufora
    const chunks: Buffer[] = [];
    const writable = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });

    await ftpClient.downloadTo(writable, "users.xlsx");
    const fileBuffer = Buffer.concat(chunks);

    // Parsuj plik Excel
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<{ email?: string; rabat?: string }>(
      worksheet
    );

    // Znajdź rekord po emailu
    const user = data.find((row) => row.email === email);
    discount = user?.rabat ?? null;

    return discount;
  } catch (err) {
    console.error("Błąd FTP lub Excel:", err);
    return null;
  } finally {
    ftpClient.close();
  }
}
