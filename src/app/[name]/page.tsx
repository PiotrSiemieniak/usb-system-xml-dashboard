import { getDatafeed } from "@/lib/getDatafeed";
import ClientPage from "@/views/ClientPage/ClientPage";
import { notFound } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const response = await getDatafeed(decodedName);

  if (!response) notFound();

  return <ClientPage email={decodedName} xml={response} />;
}

export const revalidate = 86400; // 24 godziny w sekundach
