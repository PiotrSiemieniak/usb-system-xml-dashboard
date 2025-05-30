// /pages/api/generate-feed.ts
import { Client } from 'basic-ftp';
import { XMLBuilder } from 'fast-xml-parser';
import { NextRequest } from 'next/server';
import { Writable } from 'stream';

export async function GET(req: NextRequest) {
  const ftpClient = new Client();
  let xmlString = '';

  try {
    await ftpClient.access({
      host: 'vh34.seohost.pl',
      user: 'xml@stockconnect.pl',
      password: '6MqGvuMLVmzXVYMnQ4Bu',
      secure: false,
    });

    // Pobierz plik do bufora za pomocą Writable
    const chunks: Buffer[] = [];
    const writable = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });

    await ftpClient.downloadTo(writable, 'stany.xml');
    xmlString = Buffer.concat(chunks).toString('utf-8');

    // Przetwarzanie XML
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
    });

    const responseXml = builder.build({
      feed: {
        updatedAt: new Date().toISOString(),
        message: 'XML przetworzony przez API',
        // Możesz tu dodać inne dane, ale nie wstawiaj całego XML jako string
      },
    });

    return new Response(responseXml, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' },
    });
  } catch (err) {
    console.error('Błąd FTP lub XML:', err);
    return new Response(
      JSON.stringify({ error: 'Wystąpił błąd przy pobieraniu pliku FTP' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    ftpClient.close();
  }
}
