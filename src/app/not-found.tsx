import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <h1 style={{ fontSize: "3rem", fontWeight: "bold" }}>404</h1>
      <p style={{ fontSize: "1.5rem", marginTop: "1rem" }}>
        Nie znaleziono strony
      </p>
      <Link
        href="/"
        style={{
          marginTop: "2rem",
          color: "#2563eb",
          textDecoration: "underline",
        }}
      >
        Wróć na stronę główną
      </Link>
    </div>
  );
}
