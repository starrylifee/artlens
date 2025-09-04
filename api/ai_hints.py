import os
import json
import traceback
from typing import Any, Dict

import requests
from google import genai
from google.genai import types


def _fetch_image_bytes(url: str) -> bytes:
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.content


def _build_prompt(free_text: str, meta: Dict[str, Any]) -> str:
    title = meta.get("title") or ""
    artist = meta.get("artist") or ""
    year = meta.get("year") or ""
    return (
        f"선택 작품: {title} ({artist}{', ' + year if year else ''})\n"
        "아래 학생의 자유 관찰 초안을 바탕으로, 더 구체적이고 명확한 관찰을 할 수 있도록 3~6개의 맞춤 힌트를 제시하세요.\n"
        "- 색채/형태·질감/구도·소재·분위기 중 보완이 필요한 부분 위주\n"
        "- 비교/대조/근거 제시 유도\n"
        "- 짧고 실행 가능한 문장으로\n\n"
        "[학생 자유 관찰 초안]\n"
        f"{(free_text or '').strip()}\n"
    )


def handler(request):
    try:
        if request.method != "POST":
            return ("Method Not Allowed", 405, {"Content-Type": "text/plain"})

        try:
            payload = request.get_json() or {}
        except Exception:
            payload = json.loads(request.body or "{}")

        image_url = payload.get("imageUrl")
        free_text = payload.get("freeText") or ""
        meta = {
            "title": payload.get("title"),
            "artist": payload.get("artist"),
            "year": payload.get("year"),
        }

        if not image_url:
            return (json.dumps({"error": "imageUrl is required"}), 400, {"Content-Type": "application/json"})

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return (json.dumps({"error": "Missing GEMINI_API_KEY"}), 500, {"Content-Type": "application/json"})

        image_bytes = _fetch_image_bytes(image_url)

        client = genai.Client(api_key=api_key)
        model = "gemini-2.5-flash"

        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=_build_prompt(free_text, meta)),
                    types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                ],
            )
        ]

        tools = [types.Tool(googleSearch=types.GoogleSearch())]
        config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_budget=-1),
            tools=tools,
        )

        chunks = []
        for chunk in client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=config,
        ):
            if getattr(chunk, "text", None):
                chunks.append(chunk.text)
        text = ("".join(chunks)).strip() or "분석 결과를 생성하지 못했습니다. 입력을 다시 확인해 주세요."

        return (json.dumps({"hints": text}), 200, {"Content-Type": "application/json"})

    except Exception as e:
        err = {"error": str(e), "trace": traceback.format_exc()}
        return (json.dumps(err), 500, {"Content-Type": "application/json"})


def app(request):
    body, status, headers = handler(request)
    return body, status, headers


