export default async function Page() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <h1 className="text-4xl font-bold text-center sm:text-left ml-6">
          ⏳ Generuję plik...
        </h1>
        <div className="max-w-96 w-96 h-20 bg-gray-300 animate-pulse"></div>
      </main>
    </div>
  );
}
