"use client";

import { Button } from "@/components/ui/button";

export function DownloadButton({
  xml,
  onClick,
}: {
  xml: string;
  onClick: () => void;
}) {
  function handleDownload() {
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "datafeed.xml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onClick();
  }

  return <Button onClick={handleDownload}>Pobierz XML</Button>;
}
