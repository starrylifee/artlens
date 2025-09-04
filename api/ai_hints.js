const { Buffer } = require("node:buffer");

function buildPrompt(freeText, meta) {
  const title = meta?.title || "";
  const artist = meta?.artist || "";
  const year = meta?.year || "";
  return (
    `선택 작품: ${title} (${artist}${year ? ", " + year : ""})\n` +
    "아래 학생의 자유 관찰 초안을 바탕으로, 더 구체적이고 명확한 관찰을 할 수 있도록 3~6개의 맞춤 힌트를 제시하세요.\n" +
    "- 색채/형태·질감/구도·소재·분위기 중 보완이 필요한 부분 위주\n" +
    "- 비교/대조/근거 제시 유도\n" +
    "- 짧고 실행 가능한 문장으로\n\n" +
    "[학생 자유 관찰 초안]\n" +
    `${(freeText || "").trim()}\n`
  );
}

async function fetchImageAsBase64(url) {
  const resp = await fetch(url, { redirect: "follow" });
  if (!resp.ok) {
    throw new Error(`Failed to fetch image: HTTP ${resp.status}`);
  }
  const contentType = (resp.headers.get("content-type") || "image/jpeg").split(";")[0];
  const ab = await resp.arrayBuffer();
  const base64 = Buffer.from(ab).toString("base64");
  return { base64, mimeType: contentType || "image/jpeg" };
}

async function generateHints({ apiKey, model, prompt, imageBase64, mimeType }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini API error: HTTP ${res.status} ${text}`);
  }

  const data = await res.json();
  const candidate = (data.candidates && data.candidates[0]) || null;
  const parts = candidate?.content?.parts || [];
  const texts = parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .filter(Boolean);
  const joined = texts.join("");
  return joined?.trim() || "분석 결과를 생성하지 못했습니다. 입력을 다시 확인해 주세요.";
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.setHeader("Content-Type", "text/plain");
      res.status(405).send("Method Not Allowed");
      return;
    }

    let payload = req.body;
    if (!payload || typeof payload !== "object") {
      try {
        payload = JSON.parse(req.body || "{}");
      } catch (_) {
        payload = {};
      }
    }

    const imageUrl = payload.imageUrl;
    const freeText = payload.freeText || "";
    const meta = { title: payload.title, artist: payload.artist, year: payload.year };

    if (!imageUrl) {
      res.status(400).json({ error: "imageUrl is required" });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "Missing GEMINI_API_KEY" });
      return;
    }

    const { base64, mimeType } = await fetchImageAsBase64(imageUrl);
    const prompt = buildPrompt(freeText, meta);
    const model = "gemini-2.5-flash";
    const hints = await generateHints({
      apiKey,
      model,
      prompt,
      imageBase64: base64,
      mimeType,
    });

    res.status(200).json({ hints });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
};


