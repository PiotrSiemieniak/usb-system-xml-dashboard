import { getDatafeed } from "@/lib/getDatafeed";
import ClientPage from "@/views/ClientPage/ClientPage";
import { notFound } from "next/navigation";

export default async function Page({ params }: { params: { name: string } }) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const response = await getDatafeed(decodedName);

  // console.log("resp", response);

  if (!response) notFound();

  // Funkcja do pobierania pliku XML po stronie klienta

  return <ClientPage email={decodedName} xml={response} />;
}
// ...existing code...
