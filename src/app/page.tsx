"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleButton = () => {
    const email = inputRef.current?.value?.trim();
    if (!email) {
      alert("Podaj adres email!");
      return;
    }
    // Zakoduj email do url
    const encodedEmail = encodeURIComponent(email);
    router.push(`/${encodedEmail}`);
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <h1 className="text-4xl font-bold text-center sm:text-left ml-6">
          USB System XML Datafeed
        </h1>
        <Card>
          <CardHeader>Wygeneruj swój plik datafeed</CardHeader>
          <CardDescription className="max-w-96 px-6">
            Podaj swój adres email. Jeśli jesteś zapisany w bazie kontrahentów,
            zostaniesz przekierowany do pobrania pliku .xml zawierający
            produkty.
          </CardDescription>
          <CardContent className="space-y-6">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="picture">Adres email</Label>
              <Input id="picture" type="email" ref={inputRef} />
              <p className="text-xs text-muted-foreground">
                Podaj swój adres email
              </p>
            </div>
            <div className="h-px bg-muted" />
            <Button onClick={handleButton}>Generuj</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
