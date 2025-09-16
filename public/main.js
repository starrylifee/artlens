/* State */
const state = {
  artworks: [],
  filtered: [],
  selectedArtwork: null,
  analysesById: {},
  observation: {
    free: "",
    freeRefined: "",
    color: "",
    formTexture: "",
    composition: "",
    motifSymbol: "",
    moodEmotion: "",
    notes: "",
  },
  preset: "general",
};

/* Elements */
const el = {
  stepSections: [
    document.getElementById("step-1"),
    document.getElementById("step-2"),
    document.getElementById("step-3"),
    document.getElementById("step-4"),
  ],
  stepper: document.getElementById("stepper"),
  searchInput: document.getElementById("searchInput"),
  tagFilter: document.getElementById("tagFilter"),
  artworksGrid: document.getElementById("artworksGrid"),
  toStep2: document.getElementById("toStep2"),
  toStep3: document.getElementById("toStep3"),
  toStep4: document.getElementById("toStep4"),
  backTo3: document.getElementById("backTo3"),
  backTo1: document.getElementById("backTo1"),
  backTo2: document.getElementById("backTo2"),
  selectedArtworkInfo: document.getElementById("selectedArtworkInfo"),
  observationForm: document.getElementById("observationForm"),
  presetSelect: document.getElementById("presetSelect"),
  promptPreview: document.getElementById("promptPreview"),
  promptEditor: document.getElementById("promptEditor"),
  copyPrompt: document.getElementById("copyPrompt"),
  downloadPrompt: document.getElementById("downloadPrompt"),
  copyObservation: document.getElementById("copyObservation"),
  observationPreview4: document.getElementById("observationPreview4"),
  getHints: document.getElementById("getHints"),
  copyHints: document.getElementById("copyHints"),
  aiHints: document.getElementById("aiHints"),
  resetAll: document.getElementById("resetAll"),
  summaryArtwork: document.getElementById("summaryArtwork"),
  summaryObservation: document.getElementById("summaryObservation"),
  artworkModal: document.getElementById("artworkModal"),
  modalOverlay: document.getElementById("modalOverlay"),
  modalImage: document.getElementById("modalImage"),
  modalMeta: document.getElementById("modalMeta"),
  modalTitle: document.getElementById("modalTitle"),
  closeModal: document.getElementById("closeModal"),
  toast: document.getElementById("toast"),
  aiProcessingModal: document.getElementById("aiProcessingModal"),
  processingMessage: document.getElementById("processingMessage"),
};

/* Utilities */
function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  setTimeout(() => {
    el.toast.classList.add("hidden");
    el.toast.textContent = "";
  }, 1600);
}

function goToStep(step) {
  // step: 1..3
  el.stepSections.forEach((section, idx) => {
    const shouldShow = idx === step - 1;
    if (shouldShow) section.classList.remove("hidden");
    else section.classList.add("hidden");
  });
  // Stepper active UI
  document.querySelectorAll(".step-item").forEach((node) => {
    const s = Number(node.getAttribute("data-step"));
    if (s === step) node.classList.add("step-active");
    else node.classList.remove("step-active");
  });
  // 버튼 게이트 최신화
  updateStep2Gate();
  // 3단계 진입 시 수정 관찰 기본값을 내 관찰로 복사(비어있을 때만)
  if (step === 3) {
    try { ensureRefinedDefaultFromFree(); } catch (e) {}
  }
  // 4단계 진입 시 처리 모달 표시 및 프롬프트 자동 생성
  if (step === 4) {
    try { showAiProcessingModal(true, "인공지능이 사용자의 입력을 정리하고 있습니다."); } catch (e) {}
    setTimeout(async () => {
      try {
        await autoGenerateImagePrompt();
        // 생성된 내용을 에디터로 이동(편집 가능)
        if (el.promptEditor && el.promptPreview) {
          const txt = (el.promptPreview.textContent || "").trim();
          el.promptEditor.value = txt;
          // 프리뷰는 숨김 유지, 에디터 우선
          el.copyPrompt.disabled = !Boolean(txt);
          el.downloadPrompt.disabled = !Boolean(txt);
        }
      } catch (e) {
        // 실패해도 모달은 닫고 토스트만 알림
        showToast("프롬프트 생성 실패: " + (e?.message || e));
      } finally {
        try { showAiProcessingModal(false); } catch (_) {}
      }
    }, 50);
  }
}

function persist() {
  try {
    localStorage.setItem("selectedArtworkId", state.selectedArtwork ? state.selectedArtwork.id : "");
    localStorage.setItem("observation", JSON.stringify(state.observation));
    localStorage.setItem("preset", state.preset);
  } catch (e) {
    // ignore
  }
}

function restore() {
  try {
    const obs = localStorage.getItem("observation");
    if (obs) {
      Object.assign(state.observation, JSON.parse(obs));
    }
    const preset = localStorage.getItem("preset");
    if (preset) state.preset = preset;
  } catch (e) {}
}

function applyObservationToForm() {
  const free = document.getElementById("obs-free");
  if (free) free.value = state.observation.free || "";
  const freeRefined = document.getElementById("obs-free-refined");
  if (freeRefined) {
    // 3단계의 수정 관찰(요약)은 기본값으로 내 관찰(요약) 복사
    // 사용자가 이미 입력한 값이 있으면 덮어쓰지 않음
    const current = state.observation.freeRefined || "";
    if (current && current.trim()) {
      freeRefined.value = current;
    } else {
      freeRefined.value = state.observation.free || "";
      state.observation.freeRefined = freeRefined.value;
    }
  }
  const c = document.getElementById("obs-color");
  if (c) c.value = state.observation.color || "";
  const ft = document.getElementById("obs-formTexture");
  if (ft) ft.value = state.observation.formTexture || "";
  const comp = document.getElementById("obs-composition");
  if (comp) comp.value = state.observation.composition || "";
  const ms = document.getElementById("obs-motifSymbol");
  if (ms) ms.value = state.observation.motifSymbol || "";
  const me = document.getElementById("obs-moodEmotion");
  if (me) me.value = state.observation.moodEmotion || "";
  const notes = document.getElementById("obs-notes");
  if (notes) notes.value = state.observation.notes || "";
}

function countFilledCoreFields() {
  // 3단계로 이동 게이트를 자유 관찰 입력 여부로 단순화
  return (state.observation.free?.trim() ? 1 : 0);
}

function updateStep2Gate() {
  // 통합 게이트: 최소 요건만 적용
  if (el.toStep2) el.toStep2.disabled = !Boolean(state.selectedArtwork);
  if (el.toStep3) el.toStep3.disabled = false; // 항상 이동 허용
  if (el.toStep4) el.toStep4.disabled = false; // 항상 이동 허용 (원하면 AI 힌트 수신 시로 변경 가능)
}

function populateTagFilter() {
  const tagSet = new Set();
  state.artworks.forEach((a) => (a.tags || []).forEach((t) => tagSet.add(t)));
  const current = el.tagFilter.value;
  el.tagFilter.innerHTML = "<option value=\"\">태그 전체</option>" +
    Array.from(tagSet)
      .sort()
      .map((t) => `<option value="${t}">${t}</option>`)  
      .join("");
  if (current) el.tagFilter.value = current;
}

function renderArtworks(list) {
  el.artworksGrid.innerHTML = "";
  if (!list.length) {
    el.artworksGrid.innerHTML = '<div class="col-span-full text-sm text-gray-500">검색 결과가 없습니다.</div>';
    return;
  }
  list.forEach((a) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "art-card group rounded-md border bg-white overflow-hidden text-left hover:shadow focus:outline-none";
    card.dataset.id = a.id;
    card.innerHTML = `
      <div class="aspect-[4/3] bg-gray-100 overflow-hidden">
        <img src="${a.imageUrl}" alt="${a.title}" referrerpolicy="no-referrer" loading="lazy" class="h-full w-full object-cover group-hover:scale-[1.02] transition-transform" onerror="this.src='./images/background.png';" />
      </div>
      <div class="p-2">
        <div class="text-sm font-medium">${a.title}</div>
        <div class="text-xs text-gray-600">${a.artist} · ${a.year}</div>
        <div class="mt-1 flex flex-wrap gap-1">
          ${(a.tags||[]).slice(0,4).map(t=>`<span class=\"inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700\">${t}</span>`).join("")}
        </div>
      </div>
    `;
    card.addEventListener("click", () => {
      selectArtwork(a);
      updateGridSelectionHighlight();
    });
    el.artworksGrid.appendChild(card);
  });
  updateGridSelectionHighlight();
}

function filterArtworks() {
  const q = (el.searchInput.value || "").toLowerCase().trim();
  const tag = el.tagFilter.value || "";
  state.filtered = state.artworks.filter((a) => {
    const hay = `${a.title} ${a.artist} ${(a.tags||[]).join(" ")}`.toLowerCase();
    const okQ = !q || hay.includes(q);
    const okTag = !tag || (a.tags||[]).includes(tag);
    return okQ && okTag;
  });
  renderArtworks(state.filtered);
}

function selectArtwork(a) {
  state.selectedArtwork = a;
  el.toStep2.disabled = false;
  el.selectedArtworkInfo.innerHTML = `
    <div class="flex gap-3">
      <img src="${a.imageUrl}" alt="${a.title}" class="w-24 h-16 object-cover rounded" />
      <div>
        <div class="font-medium">${a.title}</div>
        <div class="text-sm text-gray-600">${a.artist} · ${a.year}</div>
        <div class="text-xs text-gray-500 mt-1">출처: <a href="${a.source.url}" target="_blank" class="text-indigo-600 underline">${a.source.name}</a> (${a.source.license})</div>
      </div>
    </div>
  `;
  const large = document.getElementById("selectedArtworkLarge");
  if (large) { large.src = a.imageUrl; try { large.referrerPolicy = 'no-referrer'; } catch (e) {} }
  persist();
}

function updateGridSelectionHighlight() {
  const selectedId = state.selectedArtwork?.id;
  const cards = el.artworksGrid.querySelectorAll("button[data-id]");
  cards.forEach((btn) => {
    if (btn.dataset.id === selectedId) btn.classList.add("selected");
    else btn.classList.remove("selected");
  });
}

let modalKeyHandler = null;

function openModal(a) {
  el.modalTitle.textContent = a.title;
  el.modalImage.src = a.imageUrl;
  try { el.modalImage.referrerPolicy = 'no-referrer'; } catch (e) {}
  el.modalMeta.innerHTML = `
    <div class="text-sm">${a.artist} · ${a.year}</div>
    <div class="text-xs text-gray-500">태그: ${(a.tags||[]).join(', ') || '-'}</div>
    <div class="text-xs text-gray-500">출처: <a class="text-indigo-600 underline" target="_blank" href="${a.source.url}">${a.source.name}</a> (${a.source.license})</div>
  `;
  el.artworkModal.classList.remove("hidden");
  // Esc로 닫기 활성화 (등록/해제 관리)
  modalKeyHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };
  document.addEventListener('keydown', modalKeyHandler);
}

function closeModal() {
  el.artworkModal.classList.add("hidden");
  if (modalKeyHandler) {
    document.removeEventListener('keydown', modalKeyHandler);
    modalKeyHandler = null;
  }
}

// 전역 안전 호출자(인라인 onclick 대비)
window.__closeArtworkModal = () => closeModal();
window.__proceedFromModal = () => { closeModal(); goToStep(2); };

function attachAssistPolicies(enabled) {
  const ids = [
    "obs-color",
    "obs-formTexture",
    "obs-composition",
    "obs-motifSymbol",
    "obs-moodEmotion",
    "obs-notes",
  ];
  ids.forEach((id) => {
    const ta = document.getElementById(id);
    ta.onpaste = enabled ? (e) => { e.preventDefault(); showToast("붙여넣기 차단됨"); } : null;
    ta.ondrop = enabled ? (e) => { e.preventDefault(); showToast("드롭 차단됨"); } : null;
    ta.oncontextmenu = enabled ? (e) => { e.preventDefault(); showToast("우클릭 차단됨"); } : null;
  });
}

function buildPrompt() {
  const a = state.selectedArtwork;
  if (!a) return "";
  const o = state.observation;
  const parts = [];
  if (o.freeRefined) parts.push(`자유 관찰(수정): ${o.freeRefined}`);
  else if (o.free) parts.push(`자유 관찰 요약: ${o.free}`);
  if (o.color) parts.push(`색채: ${o.color}`);
  if (o.formTexture) parts.push(`형태/질감: ${o.formTexture}`);
  if (o.composition) parts.push(`구도/시점: ${o.composition}`);
  if (o.motifSymbol) parts.push(`소재/상징: ${o.motifSymbol}`);
  if (o.moodEmotion) parts.push(`분위기/감정: ${o.moodEmotion}`);

  if (state.preset === "detailed") {
    return `원작 '${a.title}'( ${a.artist}, ${a.year} )의 관찰 요소를 반영하여, ${parts.join(", ")}. 원작의 주요 특성을 유지하되, 불필요한 텍스트/워터마크/프레임 없이 고해상도 이미지를 생성.`;
  }
  // general
  return `${a.title}에서 느낀 핵심 특징을 반영: ${parts.join(", ")}. 원작 분위기에 가깝게.`;
}

function refreshSummariesAndPrompt() {
  const a = state.selectedArtwork;
  if (a) {
    if (el.summaryArtwork) {
      el.summaryArtwork.innerHTML = `
        <div class="flex gap-3">
          <img src="${a.imageUrl}" alt="${a.title}" class="w-24 h-16 object-cover rounded" />
          <div>
            <div class="font-medium">${a.title}</div>
            <div class="text-sm text-gray-600">${a.artist} · ${a.year}</div>
          </div>
        </div>`;
    }
    const large3 = document.getElementById("step3ArtworkLarge");
    if (large3) large3.src = a.imageUrl;
    const large4 = document.getElementById("step4ArtworkLarge");
    if (large4) large4.src = a.imageUrl;
  } else {
    if (el.summaryArtwork) el.summaryArtwork.textContent = "-";
  }

  const o = state.observation;
  const summaryObsEl = document.getElementById("summaryObservation");
  if (summaryObsEl) {
    summaryObsEl.innerHTML = `
      <ul class="list-disc pl-4 text-sm space-y-1">
        ${o.freeRefined ? `<li>자유 관찰(수정): ${o.freeRefined}</li>` : (o.free ? `<li>자유 관찰: ${o.free}</li>` : "")}
        ${o.color ? `<li>색채: ${o.color}</li>` : ""}
        ${o.formTexture ? `<li>형태/질감: ${o.formTexture}</li>` : ""}
        ${o.composition ? `<li>구도/시점: ${o.composition}</li>` : ""}
        ${o.motifSymbol ? `<li>소재/상징: ${o.motifSymbol}</li>` : ""}
        ${o.moodEmotion ? `<li>분위기/감정: ${o.moodEmotion}</li>` : ""}
        ${o.notes ? `<li>메모: ${o.notes}</li>` : ""}
      </ul>`;
  }

  const prompt = buildPrompt();
  // 4단계에서는 autoGenerateImagePrompt가 최종 프롬프트를 설정하므로 여기서 미리보기를 덮어쓰지 않음
  const isStep4Visible = (function() {
    const sec = document.getElementById("step-4");
    return sec && !sec.classList.contains("hidden");
  })();
  if (!isStep4Visible) {
    el.promptPreview.textContent = prompt;
    const canExport = Boolean(
      prompt && (
        (state.observation.freeRefined && state.observation.freeRefined.trim()) ||
        (state.observation.free && state.observation.free.trim())
      )
    );
    el.copyPrompt.disabled = !canExport;
    el.downloadPrompt.disabled = !canExport;
  }
  const freePrev = document.getElementById("freePreview");
  if (freePrev) freePrev.textContent = state.observation.free || "";
  // 4단계 관찰값 프리뷰 채우기
  if (el.observationPreview4) {
    const o = state.observation;
    const items = [];
    if (o.free) items.push(`자유 관찰: ${o.free}`);
    if (o.freeRefined) items.push(`수정 관찰: ${o.freeRefined}`);
    if (o.color) items.push(`색채: ${o.color}`);
    if (o.formTexture) items.push(`형태/질감: ${o.formTexture}`);
    if (o.composition) items.push(`구도/시점: ${o.composition}`);
    if (o.motifSymbol) items.push(`소재/상징: ${o.motifSymbol}`);
    if (o.moodEmotion) items.push(`분위기/감정: ${o.moodEmotion}`);
    if (o.notes) items.push(`메모: ${o.notes}`);
    el.observationPreview4.textContent = items.join("\n");
    if (el.copyObservation) el.copyObservation.disabled = !Boolean(items.length);
  }
}

function showAiProcessingModal(show, message) {
  if (!el.aiProcessingModal) return;
  if (typeof message === 'string' && el.processingMessage) {
    el.processingMessage.textContent = message;
  }
  if (show) el.aiProcessingModal.classList.remove("hidden");
  else el.aiProcessingModal.classList.add("hidden");
}

function ensureRefinedDefaultFromFree() {
  const ta = document.getElementById("obs-free-refined");
  if (!ta) return;
  const current = (state.observation.freeRefined || "").trim();
  if (!current) {
    const base = state.observation.free || "";
    ta.value = base;
    state.observation.freeRefined = base;
  }
}

// 사용자 입력을 문장형 프롬프트로 정돈(첨언 없이 형식만 다듬기)
function refineUserPromptText(raw) {
  const text = (raw || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  // 구분자 통일: 줄바꿈, 점, 불릿/구분 기호, 슬래시 등을 쉼표로 치환
  let normalized = text
    .replace(/[\n\r]+/g, ", ")
    .replace(/[·•∙●]/g, ", ")
    .replace(/[\/|\u2215]/g, ", ")
    .replace(/\s*[,;]\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/[, ]{2,}/g, ", ");

  // 조각 분할 후 정리
  const chunks = normalized
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // 중복 제거(형태 보존)
  const seen = new Set();
  const uniq = [];
  for (const c of chunks) {
    const key = c.replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniq.push(c);
  }

  return uniq.join(", ");
}

// 사용자의 의견만 정리해 만드는 이미지 생성 프롬프트 자동 생성
async function autoGenerateImagePrompt() {
  const a = state.selectedArtwork;
  if (!a) throw new Error("작품이 선택되지 않았습니다");
  const o = state.observation;
  // 3단계 '수정 관찰(요약)'만을 활용
  const refinedOnly = (o.freeRefined || "").trim();
  if (!refinedOnly) {
    // 수정본이 없으면 내보내기 비활성화 및 안내
    el.promptPreview.textContent = "";
    el.copyPrompt.disabled = true;
    el.downloadPrompt.disabled = true;
    try { showToast("3단계에서 수정 관찰을 먼저 작성하세요"); } catch (_) {}
    return;
  }
  // 서버에 Gemini 기반 프롬프트 생성을 요청(이미지 미포함)
  try {
    const resp = await fetch("/api/generate_prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refinedText: refinedOnly,
        title: a.title,
        artist: a.artist,
      }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const promptText = (data && data.prompt) ? String(data.prompt).trim() : "";
    el.promptPreview.textContent = promptText;
    const canExport = Boolean(promptText);
    el.copyPrompt.disabled = !canExport;
    el.downloadPrompt.disabled = !canExport;
  } catch (e) {
    // 실패 시 로컬 정리 로직으로 폴백
    const body = refineUserPromptText(refinedOnly);
    // 키워드들을 자연스러운 한 문장으로 단순 결합(새 정보 추가 금지)
    const fallback = body ? `${body}를(을) 반영한 한 장면.` : "";
    el.promptPreview.textContent = fallback;
    const canExport = Boolean(fallback);
    el.copyPrompt.disabled = !canExport;
    el.downloadPrompt.disabled = !canExport;
    try { showToast("AI 프롬프트 생성 실패, 로컬 형식으로 대체"); } catch (_) {}
  }
}

function handleCopy() {
  const fromEditor = el.promptEditor ? el.promptEditor.value : "";
  const text = (fromEditor && fromEditor.trim()) ? fromEditor : (el.promptPreview.textContent || "");
  if (!text.trim()) return;
  navigator.clipboard.writeText(text).then(() => showToast("복사되었습니다"));
}

function handleDownload() {
  const fromEditor = el.promptEditor ? el.promptEditor.value : "";
  const text = (fromEditor && fromEditor.trim()) ? fromEditor : (el.promptPreview.textContent || "");
  if (!text.trim()) return;
  const a = state.selectedArtwork;
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `prompt-${a ? a.title.replace(/\s+/g, "_") : "art"}-${dateStr}.txt`;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast("다운로드 시작");
}

// AI 힌트 서버 호출
async function requestAiHints(artwork, observation) {
  // 서버 함수가 절대 URL만 처리 가능하므로 변환
  const absoluteImageUrl = (function(u){
    try {
      if (!u) return "";
      if (/^https?:\/\//i.test(u)) return u;
      return new URL(u, window.location.origin).href;
    } catch (_) { return u || ""; }
  })(artwork.imageUrl);

  const payload = {
    imageUrl: absoluteImageUrl,
    title: artwork.title,
    artist: artwork.artist,
    year: artwork.year,
    freeText: observation.free || "",
    analysis: state.analysesById[artwork.id] || {},
    observation: {
      free: observation.free || "",
      freeRefined: observation.freeRefined || "",
      color: observation.color || "",
      formTexture: observation.formTexture || "",
      composition: observation.composition || "",
      motifSymbol: observation.motifSymbol || "",
      moodEmotion: observation.moodEmotion || "",
      notes: observation.notes || "",
    },
  };
  const res = await fetch("/api/ai_hints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data || !data.hints || !(data.hints || "").trim()) {
    throw new Error("Empty AI hints");
  }
  return String(data.hints).trim();
}

// 로컬 폴백 힌트 생성
function buildLocalHints(artwork, observation) {
  const o = observation;
  const suggestions = [];
  if (!o.free?.trim()) suggestions.push("자유 관찰 요약을 1–2문장으로 먼저 적어보세요.");
  if (!o.color?.trim()) suggestions.push("색채에 대한 관찰이 비어 있어요. 주요 색과 대비를 적어보세요.");
  if (!o.composition?.trim()) suggestions.push("구도/시점 언급이 없어요. 배치, 균형, 원근을 확인해보세요.");
  if (!o.formTexture?.trim()) suggestions.push("형태/질감에 대해 더 적어보면 좋아요. 선, 붓질, 질감 등을 살펴보세요.");
  if (!o.moodEmotion?.trim()) suggestions.push("분위기/감정 표현을 추가하면 더 풍부해져요.");
  if (!o.motifSymbol?.trim()) suggestions.push("소재/상징 요소(사물, 배경의 의미)를 점검해보세요.");

  const base = `선택 작품: ${artwork.title} (${artwork.artist})`;
  const freeNudge = o.free?.trim()
    ? "자유 관찰 요약은 좋습니다. 핵심어를 2–3개로 압축해보세요."
    : "자유 관찰 요약을 1–2문장으로 먼저 적어보세요.";
  const result = [base, freeNudge, ...suggestions].join("\n- ");
  return "- " + result;
}

// 사전 분석 기반 로컬 힌트 생성: 작품의 정리된 분석과 학생 입력 간의 간극을 질문으로 제시
function buildHintsFromPreAnalysis(pre, observation) {
  const o = observation || {};

  const joinText = (...parts) => parts
    .map((p) => (p || "").toString())
    .join(" \n ")
    .toLowerCase();

  const studentText = joinText(
    o.free, o.freeRefined, o.color, o.composition, o.formTexture, o.motifSymbol, o.moodEmotion, o.notes
  );

  const suggestions = [];
  const addQ = (q) => { if (q && q.trim()) suggestions.push("- " + q.trim()); };
  const short = (txt, max = 26) => {
    const s = String(txt || "").trim();
    if (!s) return "";
    return s.length > max ? s.slice(0, max) + "…" : s;
  };
  const notCovered = (phrase) => {
    const p = String(phrase || "").toLowerCase().trim();
    if (!p) return false;
    return !studentText.includes(p);
  };

  // 1) 핵심 특징 중 학생 서술에 드러나지 않은 것에 대한 보완 질문
  if (Array.isArray(pre.key_features)) {
    pre.key_features.forEach((feat) => {
      if (notCovered(feat)) addQ(`핵심 특징 ‘${short(feat)}’에 대한 설명을 한 줄 추가해볼까요?`);
    });
  }

  // 2) 범주별 보완(해당 항목이 비어 있거나, 핵심 단서가 드러나지 않은 경우)
  if (!o.color?.trim() && pre.color) {
    addQ(`색채(예: ${short(pre.color)})에 대한 관찰을 덧붙여 볼까요?`);
  }
  if (!o.composition?.trim() && pre.composition) {
    addQ(`구도/시선 흐름(예: ${short(pre.composition)})을 어떻게 느꼈는지 적어볼까요?`);
  }
  if (!o.formTexture?.trim() && pre.form_texture) {
    addQ(`형태/질감(예: ${short(pre.form_texture)})에서 인상적인 점을 추가해볼까요?`);
  }
  if (!o.motifSymbol?.trim() && pre.motif_symbol) {
    addQ(`소재/상징(예: ${short(pre.motif_symbol)})의 의미를 한 줄로 정리해볼까요?`);
  }
  if (!o.moodEmotion?.trim() && pre.mood_emotion) {
    addQ(`분위기/감정(예: ${short(pre.mood_emotion)})을 2–3개 키워드로 요약해볼까요?`);
  }

  // 3) 기본 자유 관찰이 비어 있으면 핵심 인상부터 유도
  if (!o.free?.trim() && !o.freeRefined?.trim()) {
    addQ("자유 관찰(요약)에서 작품의 첫인상/핵심 인상을 1–2문장으로 적어볼까요?");
  }

  // 4) 보완 질문이 너무 적으면 작품 고유 질문 일부 보강
  if (suggestions.length < 4 && Array.isArray(pre.questions)) {
    pre.questions.slice(0, 4 - suggestions.length).forEach((q) => addQ(q));
  }

  if (!suggestions.length) {
    addQ("아주 좋아요. 핵심을 잘 짚었습니다. 마지막으로 한 문장으로 요약해볼까요?");
  }

  return [
    "아래 보완 질문을 참고해 관찰을 더 구체화해 보세요:",
    ...suggestions.slice(0, 8)
  ].join("\n");
}

/* Init */
async function init() {
  goToStep(1);
  el.toStep2.disabled = true;

  restore();
  if (el.presetSelect) {
    el.presetSelect.value = state.preset;
  }

  // Load artworks
  const res = await fetch("./data/artworks.json");
  state.artworks = await res.json();

  // Load pre-analyses (optional)
  try {
    const anaRes = await fetch("./data/analyses.json");
    if (anaRes.ok) {
      const analyses = await anaRes.json();
      state.analysesById = (analyses || []).reduce((acc, item) => {
        if (item && item.id) acc[item.id] = item;
        return acc;
      }, {});
    }
  } catch (_) {
    state.analysesById = {};
  }
  populateTagFilter();
  state.filtered = state.artworks;
  renderArtworks(state.filtered);

  // Restore selected artwork if possible
  try {
    const selectedId = localStorage.getItem("selectedArtworkId");
    if (selectedId) {
      const found = state.artworks.find((a) => a.id === selectedId);
      if (found) selectArtwork(found);
    }
  } catch (e) {}

  // Observation form restore
  applyObservationToForm();
  updateStep2Gate();
  refreshSummariesAndPrompt();

  // Event bindings
  el.searchInput.addEventListener("input", filterArtworks);
  el.tagFilter.addEventListener("change", filterArtworks);

  // 로고 클릭 시 첫 화면(1단계)로 이동
  const logo = document.getElementById("homeLogo");
  if (logo) {
    logo.addEventListener("click", () => {
      // 선택/입력 상태는 유지하면서 1단계 UI로만 이동
      goToStep(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // 안전망: 그리드 위임 바인딩(동적으로 생성되는 카드 클릭 감지)
  el.artworksGrid.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('button[data-id]');
    if (!btn) return;
    const id = btn.dataset.id;
    const found = state.artworks.find(a => a.id === id);
    if (found) {
      selectArtwork(found);
      updateGridSelectionHighlight();
    }
  });

  el.toStep2.addEventListener("click", () => goToStep(2));
  el.backTo1.addEventListener("click", () => goToStep(1));

  el.toStep3.addEventListener("click", () => {
    goToStep(3);
    refreshSummariesAndPrompt();
  });
  el.backTo2?.addEventListener("click", () => goToStep(2));
  el.toStep4?.addEventListener("click", () => {
    goToStep(4);
    refreshSummariesAndPrompt();
  });
  el.backTo3?.addEventListener("click", () => goToStep(3));

  // 보조정책 토글 요소가 없어도 오류 없도록 가드
  if (el.assistToggle && typeof attachAssistPolicies === 'function') {
    el.assistToggle.addEventListener("change", (e) => {
      attachAssistPolicies(Boolean(e.target.checked));
    });
  }

  if (el.presetSelect) {
    el.presetSelect.addEventListener("change", (e) => {
      state.preset = e.target.value;
      persist();
      refreshSummariesAndPrompt();
    });
  }

  el.copyPrompt.addEventListener("click", handleCopy);
  el.downloadPrompt.addEventListener("click", handleDownload);

  // 4단계: 관찰값 복사 버튼
  if (el.copyObservation && el.observationPreview4) {
    el.copyObservation.addEventListener("click", () => {
      const text = el.observationPreview4.textContent || "";
      if (!text.trim()) return;
      navigator.clipboard.writeText(text).then(() => showToast("관찰 결과가 복사되었습니다"));
    });
  }

  // 4단계: 에디터 입력 변경 시 버튼 활성화 및 상태 동기화
  if (el.promptEditor) {
    el.promptEditor.addEventListener("input", () => {
      const val = el.promptEditor.value || "";
      const has = Boolean(val.trim());
      el.copyPrompt.disabled = !has;
      el.downloadPrompt.disabled = !has;
    });
  }

  // 2단계: 저장 불러오기(로컬스토리지 백업 복원)
  const restoreBtn = document.getElementById("restoreDraft");
  if (restoreBtn) {
    restoreBtn.addEventListener("click", () => {
      try {
        const obs = localStorage.getItem("observation");
        if (!obs) { showToast("저장된 내용이 없습니다"); return; }
        const restored = JSON.parse(obs);
        if (restored && typeof restored === 'object') {
          state.observation = { ...state.observation, ...restored };
          applyObservationToForm();
          refreshSummariesAndPrompt();
          showToast("임시 저장 불러옴");
        }
      } catch (e) { showToast("복원 실패"); }
    });
  }

  // AI 힌트: 사전 분석 우선 + 서버 호출 + 폴백
  if (el.getHints) {
    el.getHints.addEventListener("click", async () => {
      if (!state.selectedArtwork) {
        showToast("작품을 먼저 선택하세요");
        return;
      }
      // 로딩 상태
      el.getHints.disabled = true;
      const prevLabel = el.getHints.textContent;
      el.getHints.textContent = "분석 중...";
      el.aiHints.textContent = "분석을 준비하고 있습니다...";
      try {
        // 항상 서버 호출(사전분석/학생입력 포함). 서버가 2문항으로 정리
        const hints = await requestAiHints(state.selectedArtwork, state.observation);
        el.aiHints.textContent = hints;
        el.copyHints.disabled = false;
        if (el.toStep4) el.toStep4.disabled = false;
      } catch (e) {
        // 폴백: 로컬 비교 힌트에서 상위 2개만 추려 출력
        const pre = state.analysesById[state.selectedArtwork.id];
        const fallbackFull = pre
          ? buildHintsFromPreAnalysis(pre, state.observation)
          : buildLocalHints(state.selectedArtwork, state.observation);
        const two = (fallbackFull || "")
          .split("\n")
          .filter((l) => /^\s*-\s+/.test(l))
          .slice(0, 2)
          .join("\n");
        const header = "아래 보완 질문 (로컬 폴백):";
        el.aiHints.textContent = two ? `${header}\n${two}` : `${header}\n- 자유 관찰 핵심을 1–2문장으로 적어볼까요?\n- 색/구도 중 한 가지를 골라 한 줄로 보완해볼까요?`;
        el.copyHints.disabled = false;
      } finally {
        el.getHints.disabled = false;
        el.getHints.textContent = prevLabel;
      }
    });
  }
  if (el.copyHints) {
    el.copyHints.addEventListener("click", () => {
      const text = el.aiHints.textContent || "";
      if (!text.trim()) return;
      navigator.clipboard.writeText(text).then(() => showToast("힌트가 복사되었습니다"));
    });
  }

  el.resetAll.addEventListener("click", () => {
    if (!confirm("모든 내용을 초기화할까요?")) return;
    localStorage.removeItem("selectedArtworkId");
    localStorage.removeItem("observation");
    localStorage.removeItem("preset");
    state.selectedArtwork = null;
    state.observation = { free: "", color: "", formTexture: "", composition: "", motifSymbol: "", moodEmotion: "", notes: "" };
    state.preset = "general";
    el.presetSelect.value = state.preset;
    el.selectedArtworkInfo.textContent = "작품을 먼저 선택하세요.";
    applyObservationToForm();
    updateStep2Gate();
    refreshSummariesAndPrompt();
    el.toStep2.disabled = true;
    goToStep(1);
    showToast("초기화 완료");
  });

  el.closeModal.addEventListener("click", closeModal);
  if (el.modalOverlay) {
    el.modalOverlay.addEventListener("click", closeModal);
  } else {
    // 오버레이 id가 없을 경우, 배경 클릭으로 닫히게 컨테이너로 폴백
    el.artworkModal.addEventListener("click", (e) => {
      if (e.target === el.artworkModal) closeModal();
    });
  }
  // 닫기 버튼 위임 처리(안전망)
  el.artworkModal.addEventListener("click", (e) => {
    const target = e.target;
    if (target && (target.id === "closeModal" || (target.closest && target.closest("#closeModal")))) {
      closeModal();
    }
  });

  // 모달 큰 이미지 클릭 시 2단계로 이동
  el.modalImage.addEventListener('click', () => {
    closeModal();
    goToStep(2);
  });

  // Observation inputs listeners
  const mapping = [
    ["obs-free", "free"],
    ["obs-free-refined", "freeRefined"],
    ["obs-color", "color"],
    ["obs-formTexture", "formTexture"],
    ["obs-composition", "composition"],
    ["obs-motifSymbol", "motifSymbol"],
    ["obs-moodEmotion", "moodEmotion"],
    ["obs-notes", "notes"],
  ];
  mapping.forEach(([id, key]) => {
    const ta = document.getElementById(id);
    if (!ta) return;
    ta.addEventListener("input", (e) => {
      state.observation[key] = e.target.value;
      persist();
      updateStep2Gate();
      if (id === "obs-free") {
        const freePrev = document.getElementById("freePreview");
        if (freePrev) freePrev.textContent = e.target.value;
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", init);

// 전역 안전 호출자: 단계 1 버튼 인라인용
window.__goStep2 = () => {
  goToStep(2);
};
window.__goStep1 = () => { goToStep(1); };
window.__goStep3 = () => { goToStep(3); refreshSummariesAndPrompt(); };
window.__goStep4 = () => { goToStep(4); refreshSummariesAndPrompt(); };


