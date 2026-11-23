export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const url = new URL(
      "https://epilogue-bash-chess.ngrok-free.dev/api/power/history"
    );

    if (req.query.limit !== undefined) {
      const limit = Number(req.query.limit);

      if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
        return res.status(400).json({ error: "Limit tidak valid" });
      }

      url.searchParams.set("limit", String(limit));
    }

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (!response.ok) {
      return res.status(502).json({
        error: `Backend API returned HTTP ${response.status}`,
      });
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return res.status(502).json({
        error: "Backend mengirim respons bukan JSON",
      });
    }

    const data = await response.json();

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(data);
  } catch (error) {
    console.error("API history failed:", error);
    return res.status(502).json({
      error: "Gagal menghubungi histori power meter",
    });
  }
}