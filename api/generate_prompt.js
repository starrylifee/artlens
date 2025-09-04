function buildImagePromptInstruction(refinedText, _meta) {
  const guide = [
    "아래 '수정 관찰(요약)' 텍스트만 사용하여, 새로운 내용을 추가하지 말고 자연스러운 한국어 한 문장으로 정리하세요.",
    "- 핵심 명사/형용사/관계어를 보존하고, 의미가 겹치는 표현은 병합",
    "- 불필요한 조사/어미/군더더기 제거",
    "- 제목/작품명/원작/느낀/반영 등의 단어 사용 금지",
    "- 결과는 한 문장(마침표 하나)만 출력. 접두/해설/따옴표/코드블록 금지",
    "\n[수정 관찰(요약)]\n" + (refinedText || "").trim(),
  ].join("\n");
  return guide;
}

async function generateWithGemini({ apiKey, model, prompt }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
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

  // 후처리: 접두어/따옴표/코드펜스 제거 및 개행 -> 쉼표
  joined = joined.replace(/^\s*(?:프롬프트\s*[:：-]\s*)/i, "");
  joined = joined.replace(/^`+|`+$/g, "");
  joined = joined.replace(/^"+|"+$/g, "");
  joined = joined.replace(/[\n\r]+/g, ", ");
  return joined;
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

    const refinedText = (payload.refinedText || "").trim();
    const meta = { title: payload.title || "", artist: payload.artist || "" };
    if (!refinedText) {
      res.status(400).json({ error: "refinedText is required" });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "Missing GEMINI_API_KEY" });
      return;
    }

    const model = "gemini-2.5-flash";
    const prompt = buildImagePromptInstruction(refinedText, meta);
    const promptText = await generateWithGemini({ apiKey, model, prompt });
    const finalPrompt = (promptText || "").trim();
    if (!finalPrompt) {
      res.status(200).json({ prompt: "" });
      return;
    }
    res.status(200).json({ prompt: finalPrompt });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
};


