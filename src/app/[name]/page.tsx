import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDatafeed } from "@/lib/getDatafeed";
import ClientPage from "@/views/ClientPage/ClientPage";
import { DownloadButton } from "@/views/ClientPage/partials/DownloadButton";
import { notFound } from "next/navigation";

export default async function Page({ params }: { params: { name: string } }) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const response = await getDatafeed(decodedName);

  if (!response) notFound();

  // Funkcja do pobierania pliku XML po stronie klienta

  return <ClientPage email={decodedName} xml={response} />;
}
// ...existing code...
