// /pages/api/generate-feed.ts
import { Client } from "basic-ftp";
import { XMLBuilder } from "fast-xml-parser";
import { Writable } from "stream";
import * as XLSX from "xlsx";

// export async function getDatafeed(name: string) {
//   const ftpClient = new Client();
//   let xmlString = "";

//   try {
//     await ftpClient.access({
//       host: "vh34.seohost.pl",
//       user: "xml@stockconnect.pl",
//       password: "6MqGvuMLVmzXVYMnQ4Bu",
//       secure: false,
//     });

//     // Pobierz plik do bufora za pomocą Writable
//     const chunks: Buffer[] = [];
//     const writable = new Writable({
//       write(chunk, encoding, callback) {
//         chunks.push(Buffer.from(chunk));
//         callback();
//       },
//     });

//     await ftpClient.downloadTo(writable, "stany.xml");
//     xmlString = Buffer.concat(chunks).toString("utf-8");

//     // Przetwarzanie XML
//     const builder = new XMLBuilder({
//       ignoreAttributes: false,
//       format: true,
//     });

//     const responseXml = builder.build({
//       feed: {
//         updatedAt: new Date().toISOString(),
//         message: "XML przetworzony przez API",
//         // Możesz tu dodać inne dane, ale nie wstawiaj całego XML jako string
//       },
//     });

//     return new Response(responseXml, {
//       status: 200,
//       headers: { "Content-Type": "application/xml" },
//     });
//   } catch (err) {
//     console.error("Błąd FTP lub XML:", err);
//     return new Response(
//       JSON.stringify({ error: "Wystąpił błąd przy pobieraniu pliku FTP" }),
//       { status: 500, headers: { "Content-Type": "application/json" } }
//     );
//   } finally {
//     ftpClient.close();
//   }
// }

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
