/* State */
const state = {
  artworks: [],
  filtered: [],
  selectedArtwork: null,
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
  copyPrompt: document.getElementById("copyPrompt"),
  downloadPrompt: document.getElementById("downloadPrompt"),
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
  if (freeRefined) freeRefined.value = state.observation.freeRefined || "";
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
        <img src="${a.imageUrl}" alt="${a.title}" class="h-full w-full object-cover group-hover:scale-[1.02] transition-transform" onerror="this.src='';" />
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
  if (large) large.src = a.imageUrl;
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
  el.promptPreview.textContent = prompt;
  const canExport = Boolean(prompt && ((state.observation.freeRefined && state.observation.freeRefined.trim()) || (state.observation.free && state.observation.free.trim())));
  el.copyPrompt.disabled = !canExport;
  el.downloadPrompt.disabled = !canExport;
  const freePrev = document.getElementById("freePreview");
  if (freePrev) freePrev.textContent = state.observation.free || "";
}

function handleCopy() {
  const text = el.promptPreview.textContent || "";
  if (!text.trim()) return;
  navigator.clipboard.writeText(text).then(() => showToast("복사되었습니다"));
}

function handleDownload() {
  const text = el.promptPreview.textContent || "";
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

/* Init */
async function init() {
  goToStep(1);
  el.toStep2.disabled = true;

  restore();
  el.presetSelect.value = state.preset;

  // Load artworks
  const res = await fetch("./data/artworks.json");
  state.artworks = await res.json();
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

  el.presetSelect.addEventListener("change", (e) => {
    state.preset = e.target.value;
    persist();
    refreshSummariesAndPrompt();
  });

  el.copyPrompt.addEventListener("click", handleCopy);
  el.downloadPrompt.addEventListener("click", handleDownload);

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

  // AI 힌트(로컬 비교 로직)
  if (el.getHints) {
    el.getHints.addEventListener("click", () => {
      if (!state.selectedArtwork) {
        showToast("작품을 먼저 선택하세요");
        return;
      }
      const o = state.observation;
      const suggestions = [];
      if (!o.free?.trim()) suggestions.push("자유 관찰 요약을 1–2문장으로 먼저 적어보세요.");
      if (!o.color?.trim()) suggestions.push("색채에 대한 관찰이 비어 있어요. 주요 색과 대비를 적어보세요.");
      if (!o.composition?.trim()) suggestions.push("구도/시점 언급이 없어요. 배치, 균형, 원근을 확인해보세요.");
      if (!o.formTexture?.trim()) suggestions.push("형태/질감에 대해 더 적어보면 좋아요. 선, 붓질, 질감 등을 살펴보세요.");
      if (!o.moodEmotion?.trim()) suggestions.push("분위기/감정 표현을 추가하면 더 풍부해져요.");
      if (!o.motifSymbol?.trim()) suggestions.push("소재/상징 요소(사물, 배경의 의미)를 점검해보세요.");

      const base = `선택 작품: ${state.selectedArtwork.title} (${state.selectedArtwork.artist})`;
      const freeNudge = o.free?.trim() ? "자유 관찰 요약은 좋습니다. 핵심어를 2–3개로 압축해보세요." : "자유 관찰 요약을 1–2문장으로 먼저 적어보세요.";
      const result = [base, freeNudge, ...suggestions].join("\n- ");
      el.aiHints.textContent = "- " + result;
      el.copyHints.disabled = false;
      // 힌트를 받은 후에야 4단계로 이동 가능하도록 게이트
      if (el.toStep4) el.toStep4.disabled = false;
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


