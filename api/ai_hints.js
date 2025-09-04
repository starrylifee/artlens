const { Buffer } = require("node:buffer");

function buildPrompt(freeText, meta) {
  const title = meta?.title || "";
  const artist = meta?.artist || "";
  const year = meta?.year || "";
  return (
    `선택 작품: ${title} (${artist}${year ? ", " + year : ""})\n` +
    "대상: 초등학교 4학년.\n" +
    "역할: 그림(이미지)과 학생의 글을 비교하여, 학생이 바로 고칠 수 있는 가장 중요한 보완 2가지를 '질문' 형태로 제시해 주세요.\n" +
    "규칙:\n" +
    "- 두 개의 질문만 출력 (각 1문장).\n" +
    "- 쉬운 한국어, 간단한 질문 (가능하면 20~30자).\n" +
    "- 새로운 내용 추정/추가 금지. 이미지와 학생 글의 차이에만 근거.\n" +
    "- 각 질문은 큰따옴표로 감싸고 물음표로 끝내기.\n" +
    "- 번호/불릿/설명/접두 문구 없이 질문만, 각 질문은 줄바꿈으로 구분.\n\n" +
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


