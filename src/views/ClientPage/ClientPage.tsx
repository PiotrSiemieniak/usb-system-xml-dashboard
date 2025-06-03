"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { DownloadButton } from "@/views/ClientPage/partials/DownloadButton";
import { useState } from "react";

export default function ClientPage({
  xml,
  email,
}: {
  xml: string;
  email: string;
}) {
  const [isClicked, setIsClicked] = useState(false);

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <h1 className="text-4xl font-bold text-center sm:text-left ml-6">
          Plik wygenerowany
        </h1>
        <Card className="max-w-96">
          <CardHeader>Adres: {email}</CardHeader>
          <CardDescription className="px-6">
            Plik produktowy datafeed został wygenerowany. Możesz go pobrać za
            pomocą przycisku poniżej.
          </CardDescription>
          <CardContent className="space-y-6">
            <div className="h-px bg-muted" />
            <DownloadButton onClick={() => setIsClicked(true)} xml={xml} />
            {isClicked && (
              <div className="bg-slate-50 p-6 rounded border text-green-950">
                Rozpoczęto pobieranie datafeed.xml. Sprawdź folder z pobranymi
                plikami.
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
// ...existing code...
