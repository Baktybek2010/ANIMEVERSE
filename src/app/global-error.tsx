"use client";

/** Аварийная страница, если сломался корневой layout (словари могут быть недоступны). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ru">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#07060e", color: "#f4f2ff", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>ANIMEVERSE</h1>
          <p style={{ color: "#aaa5c7", marginBottom: 20 }}>Произошла ошибка · Something went wrong · エラーが発生しました</p>
          <button
            type="button"
            onClick={reset}
            style={{ background: "#7c3aed", color: "#fff", border: 0, borderRadius: 12, padding: "12px 24px", fontSize: 14, cursor: "pointer" }}
          >
            ↻
          </button>
        </div>
      </body>
    </html>
  );
}
