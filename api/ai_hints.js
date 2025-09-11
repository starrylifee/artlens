const { Buffer } = require("node:buffer");

function buildPrompt({ freeText, meta, analysis, observation }) {
  const title = meta?.title || "";
  const artist = meta?.artist || "";
  const year = meta?.year || "";
  const a = analysis || {};
  const o = observation || {};
  const preLines = [];
  if (Array.isArray(a.key_features) && a.key_features.length) preLines.push(`핵심 특징: ${a.key_features.join(", ")}`);
  if (a.color) preLines.push(`색채: ${a.color}`);
  if (a.composition) preLines.push(`구도/시점: ${a.composition}`);
  if (a.form_texture) preLines.push(`형태/질감: ${a.form_texture}`);
  if (a.motif_symbol) preLines.push(`소재/상징: ${a.motif_symbol}`);
  if (a.mood_emotion) preLines.push(`분위기/감정: ${a.mood_emotion}`);

  const obsLines = [];
  if (o.freeRefined || o.free) obsLines.push(`자유 관찰: ${(o.freeRefined || o.free || "").trim()}`);
  if (o.color) obsLines.push(`색채: ${o.color}`);
  if (o.composition) obsLines.push(`구도/시점: ${o.composition}`);
  if (o.formTexture) obsLines.push(`형태/질감: ${o.formTexture}`);
  if (o.motifSymbol) obsLines.push(`소재/상징: ${o.motifSymbol}`);
  if (o.moodEmotion) obsLines.push(`분위기/감정: ${o.moodEmotion}`);

  return (
    `선택 작품: ${title} (${artist}${year ? ", " + year : ""})\n` +
    "대상: 초등학교 4학년.\n" +
    "역할: 아래의 '작품 사전 분석'과 '학생 입력'을 비교하고, 제공된 이미지까지 참고하여 학생이 바로 보완하면 좋은 2가지를 '질문' 2문장으로 제시하세요.\n" +
    "규칙:\n" +
    "- 정확히 두 개의 질문만 출력 (각 1문장).\n" +
    "- 쉬운 한국어, 20~30자 내외.\n" +
    "- 새로운 정보/추정 금지: 이미지와 사전분석, 학생 입력의 차이에만 근거.\n" +
    "- 각 질문은 큰따옴표로 감싸고 물음표로 끝내기.\n" +
    "- 번호/불릿/설명 없이 질문만, 줄바꿈으로 구분.\n\n" +
    "[작품 사전 분석]\n" +
    (preLines.join("\n") + "\n\n") +
    "[학생 입력]\n" +
    (obsLines.join("\n") + "\n\n") +
    "[학생 자유 관찰 원문]\n" +
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
  let joined = texts.join("").trim();

  // 후처리: 마크다운/불릿 제거, 개행 정리
  joined = joined
    .replace(/^\s*(?:프롬프트\s*[:：-]\s*)/i, "")
    .replace(/^`+|`+$/g, "")
    .replace(/^"+|"+$/g, "")
    .replace(/[\t]+/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/[•·\-]\s*/g, "");

  // 문장 분할(간단 휴리스틱)
  function splitSentencesKorean(text) {
    const result = [];
    let cur = "";
    for (const ch of text) {
      cur += ch;
      if (ch === "." || ch === "!" || ch === "?" || ch === "…") {
        const trimmed = cur.trim();
        if (trimmed) result.push(trimmed);
        cur = "";
      }
    }
    if (cur.trim()) result.push(cur.trim());
    return result;
  }

  const sentences = splitSentencesKorean(joined)
    .map((s) => s.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);

  // 두 문장만 유지. 없으면 전체를 하나로 간주.
  const top2 = sentences.length ? sentences.slice(0, 2) : [joined];

  function toQuotedQuestion(s) {
    let t = (s || "").trim();
    // 외곽 기호 제거
    t = t.replace(/^`+|`+$/g, "");
    t = t.replace(/^"+|"+$/g, "");
    t = t.replace(/^[•·\-]+\s*/, "");
    // 문장부호 정리 및 물음표 보장
    t = t.replace(/[.!…]+$/g, "");
    if (!t.endsWith("?")) t = t + "?";
    return `"${t}"`;
  }

  const formatted = top2.map(toQuotedQuestion).join("\n");
  return formatted;
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
    const analysis = payload.analysis || {};
    const observation = payload.observation || {};

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
    const prompt = buildPrompt({ freeText, meta, analysis, observation });
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


