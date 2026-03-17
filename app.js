const STORAGE_KEY = "rice-weighing-app-v1";
const APP_VERSION = 1;
const DEFAULT_COLUMNS = 5;
const DEFAULT_ROWS = 6;
const DEFAULT_PRICE = "6500";
const DEFAULT_CONVERSION = "10";

const elements = {
  overviewCards: document.getElementById("overviewCards"),
  resultCards: document.getElementById("resultCards"),
  boardsContainer: document.getElementById("boardsContainer"),
  recordsList: document.getElementById("recordsList"),
  recordsEmpty: document.getElementById("recordsEmpty"),
  draftStatus: document.getElementById("draftStatus"),
  draftQuickStats: document.getElementById("draftQuickStats"),
  toast: document.getElementById("toast"),
  newRecordBtn: document.getElementById("newRecordBtn"),
  saveRecordBtn: document.getElementById("saveRecordBtn"),
  clearGridBtn: document.getElementById("clearGridBtn"),
  addBoardBtn: document.getElementById("addBoardBtn"),
  clearSavedBtn: document.getElementById("clearSavedBtn"),
  customerName: document.getElementById("customerName"),
  customerPhone: document.getElementById("customerPhone"),
  recordDate: document.getElementById("recordDate"),
  pricePerKg: document.getElementById("pricePerKg"),
  conversionFactor: document.getElementById("conversionFactor"),
  tareKg: document.getElementById("tareKg"),
  impurityKg: document.getElementById("impurityKg"),
  deposit: document.getElementById("deposit"),
  paid: document.getElementById("paid"),
  note: document.getElementById("note"),
};

const appState = loadState();
let toastTimer = null;

sortRecords();
bindEvents();
renderApp();
registerServiceWorker();

function bindEvents() {
  document.addEventListener("input", handleInput);
  elements.newRecordBtn.addEventListener("click", handleNewDraft);
  elements.saveRecordBtn.addEventListener("click", handleSaveDraft);
  elements.clearGridBtn.addEventListener("click", handleClearGrid);
  elements.addBoardBtn.addEventListener("click", handleAddBoard);
  elements.clearSavedBtn.addEventListener("click", handleClearSaved);
  elements.boardsContainer.addEventListener("click", handleBoardAction);
  elements.recordsList.addEventListener("click", handleRecordAction);
}

function handleInput(event) {
  const target = event.target;

  if (target.classList.contains("js-number")) {
    const cleaned = cleanNumberInput(target.value, false);
    if (cleaned !== target.value) {
      target.value = cleaned;
    }
  }

  if (target.matches(".js-field")) {
    const field = target.dataset.field;
    appState.draft[field] = target.value;
    persistState();
    renderDerivedPanels();
    return;
  }

  if (target.matches(".cell-input")) {
    const cleaned = cleanNumberInput(target.value, true);
    if (cleaned !== target.value) {
      target.value = cleaned;
    }

    const board = appState.draft.boards.find(
      (item) => item.id === target.dataset.boardId,
    );

    if (!board) {
      return;
    }

    const rowIndex = Number(target.dataset.rowIndex);
    const colIndex = Number(target.dataset.colIndex);
    board.rows[rowIndex][colIndex] = cleaned;
    persistState();
    renderDerivedPanels();
  }
}

function handleNewDraft() {
  const preserved = {
    pricePerKg: appState.draft.pricePerKg || DEFAULT_PRICE,
    conversionFactor: appState.draft.conversionFactor || DEFAULT_CONVERSION,
    tareKg: appState.draft.tareKg || "0",
    impurityKg: "0",
    deposit: "0",
    paid: "0",
  };

  appState.draft = createEmptyDraft(preserved);
  persistState();
  renderApp();
  showToast("Đã tạo phiếu mới.");
}

function handleSaveDraft() {
  const draft = sanitizeRecord(appState.draft);
  const summary = computeRecordSummary(draft);

  if (summary.bagCount === 0) {
    showToast("Nhập ít nhất 1 ô cân trước khi lưu.");
    return;
  }

  draft.name = draft.name.trim() || `Khách ${appState.records.length + 1}`;
  draft.updatedAt = new Date().toISOString();
  draft.createdAt = draft.createdAt || draft.updatedAt;

  const existingIndex = appState.records.findIndex((item) => item.id === draft.id);

  if (existingIndex >= 0) {
    appState.records[existingIndex] = draft;
    showToast("Đã cập nhật phiếu đã lưu.");
  } else {
    appState.records.unshift(draft);
    showToast("Đã lưu phiếu thành công.");
  }

  sortRecords();
  appState.draft = cloneRecord(draft);
  persistState();
  renderApp();
}

function handleClearGrid() {
  const hasValues = appState.draft.boards.some((board) =>
    board.rows.some((row) => row.some((value) => String(value).trim() !== "")),
  );

  if (!hasValues) {
    showToast("Bảng cân đang trống.");
    return;
  }

  const confirmed = window.confirm("Xóa toàn bộ ô cân hiện tại?");
  if (!confirmed) {
    return;
  }

  appState.draft.boards = appState.draft.boards.map((board, index) =>
    createEmptyBoard(index + 1, board.title),
  );
  appState.draft.deposit = "0";
  appState.draft.paid = "0";
  appState.draft.impurityKg = "0";
  persistState();
  renderApp();
  showToast("Đã xóa dữ liệu cân.");
}

function handleAddBoard() {
  appState.draft.boards.push(createEmptyBoard(appState.draft.boards.length + 1));
  persistState();
  renderBoards();
  renderDerivedPanels();
  showToast("Đã thêm bảng cân mới.");
}

function handleClearSaved() {
  if (appState.records.length === 0) {
    showToast("Chưa có phiếu nào để xóa.");
    return;
  }

  const confirmed = window.confirm("Xóa toàn bộ phiếu đã lưu trên máy này?");
  if (!confirmed) {
    return;
  }

  appState.records = [];
  persistState();
  renderApp();
  showToast("Đã xóa toàn bộ phiếu cũ.");
}

function handleBoardAction(event) {
  const button = event.target.closest("[data-board-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.boardAction;
  const boardId = button.dataset.boardId;
  const boardIndex = appState.draft.boards.findIndex((board) => board.id === boardId);

  if (boardIndex < 0) {
    return;
  }

  const board = appState.draft.boards[boardIndex];

  if (action === "add-row") {
    board.rows.push(createEmptyRow());
    persistState();
    renderBoards();
    renderDerivedPanels();
    return;
  }

  if (action === "remove-row") {
    if (board.rows.length <= 1) {
      showToast("Cần giữ lại ít nhất 1 dòng.");
      return;
    }

    const lastRowHasValue = board.rows[board.rows.length - 1].some(
      (value) => String(value).trim() !== "",
    );

    if (lastRowHasValue) {
      const confirmed = window.confirm("Dòng cuối đang có số. Vẫn xóa?");
      if (!confirmed) {
        return;
      }
    }

    board.rows.pop();
    persistState();
    renderBoards();
    renderDerivedPanels();
    return;
  }

  if (action === "delete-board") {
    if (appState.draft.boards.length <= 1) {
      showToast("Cần giữ lại ít nhất 1 bảng.");
      return;
    }

    const confirmed = window.confirm(`Xóa ${board.title}?`);
    if (!confirmed) {
      return;
    }

    appState.draft.boards.splice(boardIndex, 1);
    appState.draft.boards = appState.draft.boards.map((item, index) => ({
      ...item,
      title: `Bảng ${index + 1}`,
    }));
    persistState();
    renderBoards();
    renderDerivedPanels();
  }
}

function handleRecordAction(event) {
  const button = event.target.closest("[data-record-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.recordAction;
  const recordId = button.dataset.recordId;
  const recordIndex = appState.records.findIndex((item) => item.id === recordId);

  if (recordIndex < 0) {
    return;
  }

  if (action === "open") {
    appState.draft = cloneRecord(appState.records[recordIndex]);
    persistState();
    renderApp();
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast("Đã mở phiếu để xem hoặc chỉnh sửa.");
    return;
  }

  if (action === "delete") {
    const confirmed = window.confirm(
      `Xóa phiếu "${appState.records[recordIndex].name || "Khách"}"?`,
    );
    if (!confirmed) {
      return;
    }

    appState.records.splice(recordIndex, 1);
    persistState();
    renderApp();
    showToast("Đã xóa phiếu cũ.");
  }
}

function renderApp() {
  syncFormFields();
  renderBoards();
  renderRecords();
  renderDerivedPanels();
}

function renderDerivedPanels() {
  const summary = computeRecordSummary(appState.draft);
  const savedStats = computeSavedStats();

  elements.draftStatus.textContent = isDraftSaved()
    ? "Đang mở phiếu đã lưu"
    : "Phiếu mới";
  elements.draftQuickStats.textContent = `${formatKg(summary.netKg)} kg / ${summary.bagCount} bao`;

  renderOverviewCards(savedStats);
  renderResultCards(summary);
  updateBoardSummaries(summary.boardSummaries);
}

function renderOverviewCards(savedStats) {
  const cards = [
    {
      label: "Số phiếu đã lưu",
      value: formatInteger(savedStats.recordCount),
      meta: savedStats.recordCount === 0 ? "Chưa có dữ liệu" : "Mở lại bất cứ lúc nào",
    },
    {
      label: "Tổng khối lượng",
      value: `${formatKg(savedStats.totalNetKg)} kg`,
      meta: `${formatInteger(savedStats.totalBags)} bao đã cân`,
    },
    {
      label: "Tổng thành tiền",
      value: formatCurrency(savedStats.totalAmount),
      meta: "Cộng toàn bộ phiếu đã lưu",
    },
    {
      label: "Còn phải thu",
      value: formatCurrency(savedStats.totalRemaining),
      meta:
        savedStats.recordCount === 0
          ? "Tự cập nhật khi lưu phiếu"
          : "Đã trừ cọc và tiền đã trả",
    },
  ];

  elements.overviewCards.innerHTML = cards
    .map(
      (card) => `
        <article class="metric-card">
          <p class="metric-card__label">${escapeHtml(card.label)}</p>
          <p class="metric-card__value">${escapeHtml(card.value)}</p>
          <p class="metric-card__meta">${escapeHtml(card.meta)}</p>
        </article>
      `,
    )
    .join("");
}

function renderResultCards(summary) {
  const cards = [
    {
      label: "Tổng trước khi trừ",
      value: `${formatKg(summary.grossKg)} kg`,
      meta: `${summary.bagCount} lần cân / bao`,
    },
    {
      label: "Khối lượng còn lại",
      value: `${formatKg(summary.netKg)} kg`,
      meta: `Đã trừ bì ${formatKg(summary.tareKg)} kg và tạp chất ${formatKg(
        summary.impurityKg,
      )} kg`,
    },
    {
      label: "Thành tiền",
      value: formatCurrency(summary.amount),
      meta: `Đơn giá ${formatCurrency(summary.pricePerKg)} / kg`,
    },
    {
      label: "Tiền cọc",
      value: formatCurrency(summary.deposit),
      meta: `Đã trả thêm ${formatCurrency(summary.paid)}`,
    },
    {
      label: "Còn lại",
      value: formatCurrency(summary.remaining),
      meta:
        summary.remaining <= 0
          ? "Đã thanh toán đủ hoặc dư."
          : "Khoản còn phải thanh toán.",
    },
    {
      label: "Gợi ý thao tác",
      value: summary.bagCount === 0 ? "Nhập cân" : "Lưu phiếu",
      meta:
        summary.bagCount === 0
          ? "Điền số vào bảng bên dưới để bắt đầu."
          : "Bấm Lưu phiếu để giữ lại kết quả trên máy.",
    },
  ];

  elements.resultCards.innerHTML = cards
    .map(
      (card) => `
        <article class="result-card">
          <p class="result-card__label">${escapeHtml(card.label)}</p>
          <p class="result-card__value">${escapeHtml(card.value)}</p>
          <p class="result-card__meta">${escapeHtml(card.meta)}</p>
        </article>
      `,
    )
    .join("");
}

function renderBoards() {
  const factor = Math.max(safeNumber(appState.draft.conversionFactor, 10), 1);
  elements.boardsContainer.innerHTML = appState.draft.boards
    .map((board, index) => {
      const summary = computeBoardSummary(board, factor);

      return `
        <article class="board-card">
          <div class="board-card__head">
            <div>
              <span class="section-kicker">Bang can</span>
              <h3 class="board-card__title">${escapeHtml(board.title)}</h3>
              <p class="board-card__subtitle">
                Nhập nhanh từng ô rồi xem tổng từng cột ở dòng vàng bên dưới.
              </p>
            </div>

            <div class="board-card__actions">
              <span class="board-summary-badge" data-board-total-badge="${board.id}">
                ${formatKg(summary.totalKg)} kg
              </span>
              <button
                class="board-mini-btn"
                data-board-action="add-row"
                data-board-id="${board.id}"
                type="button"
              >
                Thêm dòng
              </button>
              <button
                class="board-mini-btn"
                data-board-action="remove-row"
                data-board-id="${board.id}"
                type="button"
              >
                Bớt dòng
              </button>
              <button
                class="board-mini-btn danger"
                data-board-action="delete-board"
                data-board-id="${board.id}"
                type="button"
                ${index === 0 && appState.draft.boards.length === 1 ? "disabled" : ""}
              >
                Xóa bảng
              </button>
            </div>
          </div>

          <div class="table-wrap">
            <table class="weigh-table" aria-label="${escapeHtml(board.title)}">
              <thead>
                <tr>
                  ${Array.from({ length: DEFAULT_COLUMNS }, (_, colIndex) => `<th>C${colIndex + 1}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${board.rows
                  .map(
                    (row, rowIndex) => `
                      <tr>
                        ${row
                          .map(
                            (value, colIndex) => `
                              <td>
                                <input
                                  aria-label="${escapeHtml(
                                    `${board.title} cột ${colIndex + 1}, dòng ${rowIndex + 1}`,
                                  )}"
                                  class="cell-input"
                                  data-board-id="${board.id}"
                                  data-col-index="${colIndex}"
                                  data-row-index="${rowIndex}"
                                  inputmode="numeric"
                                  placeholder="0"
                                  type="text"
                                  value="${escapeAttribute(value)}"
                                >
                              </td>
                            `,
                          )
                          .join("")}
                      </tr>
                    `,
                  )
                  .join("")}
              </tbody>
              <tfoot>
                <tr>
                  ${summary.columnKg
                    .map(
                      (value, colIndex) => `
                        <td>
                          <div
                            class="table-total"
                            data-board-column-total="${board.id}-${colIndex}"
                          >
                            ${formatKg(value)}
                          </div>
                        </td>
                      `,
                    )
                    .join("")}
                </tr>
                <tr>
                  <td class="table-grand-total" colspan="${DEFAULT_COLUMNS}" data-board-grand-total="${board.id}">
                    ${formatKg(summary.totalKg)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </article>
      `;
    })
    .join("");
}

function updateBoardSummaries(boardSummaries) {
  boardSummaries.forEach((summary) => {
    summary.columnKg.forEach((value, colIndex) => {
      const cell = document.querySelector(
        `[data-board-column-total="${summary.id}-${colIndex}"]`,
      );
      if (cell) {
        cell.textContent = formatKg(value);
      }
    });

    const badge = document.querySelector(`[data-board-total-badge="${summary.id}"]`);
    if (badge) {
      badge.textContent = `${formatKg(summary.totalKg)} kg`;
    }

    const grandTotal = document.querySelector(`[data-board-grand-total="${summary.id}"]`);
    if (grandTotal) {
      grandTotal.textContent = formatKg(summary.totalKg);
    }
  });
}

function renderRecords() {
  const hasRecords = appState.records.length > 0;
  elements.recordsEmpty.hidden = hasRecords;
  elements.recordsList.innerHTML = hasRecords
    ? appState.records
        .map((record) => {
          const summary = computeRecordSummary(record);
          return `
            <article class="record-card">
              <div class="record-card__top">
                <div>
                  <h3 class="record-card__name">${escapeHtml(record.name || "Khách lẻ")}</h3>
                  <p class="record-card__meta">
                    ${escapeHtml(formatDate(record.date))}
                    ${record.phone ? ` • ${escapeHtml(record.phone)}` : ""}
                  </p>
                </div>
                <div class="record-card__main-value">${formatKg(summary.netKg)} kg</div>
              </div>

              <dl class="record-card__stats">
                <div class="record-stat">
                  <dt>Số bao</dt>
                  <dd>${formatInteger(summary.bagCount)} bao</dd>
                </div>
                <div class="record-stat">
                  <dt>Đơn giá</dt>
                  <dd>${formatCurrency(summary.pricePerKg)}</dd>
                </div>
                <div class="record-stat">
                  <dt>Thành tiền</dt>
                  <dd>${formatCurrency(summary.amount)}</dd>
                </div>
                <div class="record-stat">
                  <dt>Còn lại</dt>
                  <dd>${formatCurrency(summary.remaining)}</dd>
                </div>
              </dl>

              <div class="record-card__actions">
                <button
                  class="btn btn-secondary"
                  data-record-action="open"
                  data-record-id="${record.id}"
                  type="button"
                >
                  Mở phiếu
                </button>
                <button
                  class="btn btn-danger"
                  data-record-action="delete"
                  data-record-id="${record.id}"
                  type="button"
                >
                  Xóa
                </button>
              </div>
            </article>
          `;
        })
        .join("")
    : "";
}

function syncFormFields() {
  elements.customerName.value = appState.draft.name;
  elements.customerPhone.value = appState.draft.phone;
  elements.recordDate.value = appState.draft.date;
  elements.pricePerKg.value = appState.draft.pricePerKg;
  elements.conversionFactor.value = appState.draft.conversionFactor;
  elements.tareKg.value = appState.draft.tareKg;
  elements.impurityKg.value = appState.draft.impurityKg;
  elements.deposit.value = appState.draft.deposit;
  elements.paid.value = appState.draft.paid;
  elements.note.value = appState.draft.note;
}

function createEmptyDraft(seed = {}) {
  const now = new Date();
  return {
    id: createId(),
    name: "",
    phone: "",
    date: now.toISOString().slice(0, 10),
    pricePerKg: seed.pricePerKg ?? DEFAULT_PRICE,
    conversionFactor: seed.conversionFactor ?? DEFAULT_CONVERSION,
    tareKg: seed.tareKg ?? "0",
    impurityKg: seed.impurityKg ?? "0",
    deposit: seed.deposit ?? "0",
    paid: seed.paid ?? "0",
    note: "",
    boards: [createEmptyBoard(1), createEmptyBoard(2)],
    createdAt: "",
    updatedAt: "",
  };
}

function createEmptyBoard(index, title = `Bảng ${index}`) {
  return {
    id: createId(),
    title,
    rows: Array.from({ length: DEFAULT_ROWS }, () => createEmptyRow()),
  };
}

function createEmptyRow() {
  return Array.from({ length: DEFAULT_COLUMNS }, () => "");
}

function computeBoardSummary(board, factor) {
  const columnRaw = Array.from({ length: DEFAULT_COLUMNS }, () => 0);
  let bagCount = 0;

  board.rows.forEach((row) => {
    row.forEach((value, colIndex) => {
      const numeric = safeNumber(value, 0);
      columnRaw[colIndex] += numeric;
      if (numeric > 0) {
        bagCount += 1;
      }
    });
  });

  const columnKg = columnRaw.map((value) => value / factor);
  const totalKg = columnKg.reduce((sum, value) => sum + value, 0);

  return {
    id: board.id,
    title: board.title,
    bagCount,
    columnKg,
    totalKg,
  };
}

function computeRecordSummary(record) {
  const factor = Math.max(safeNumber(record.conversionFactor, 10), 1);
  const boardSummaries = record.boards.map((board) => computeBoardSummary(board, factor));
  const grossKg = boardSummaries.reduce((sum, board) => sum + board.totalKg, 0);
  const bagCount = boardSummaries.reduce((sum, board) => sum + board.bagCount, 0);
  const tareKg = safeNumber(record.tareKg, 0);
  const impurityKg = safeNumber(record.impurityKg, 0);
  const netKg = Math.max(0, grossKg - tareKg - impurityKg);
  const pricePerKg = safeNumber(record.pricePerKg, 0, { preferThousands: true });
  const amount = netKg * pricePerKg;
  const deposit = safeNumber(record.deposit, 0, { preferThousands: true });
  const paid = safeNumber(record.paid, 0, { preferThousands: true });
  const remaining = amount - deposit - paid;

  return {
    boardSummaries,
    factor,
    bagCount,
    grossKg,
    tareKg,
    impurityKg,
    netKg,
    pricePerKg,
    amount,
    deposit,
    paid,
    remaining,
  };
}

function computeSavedStats() {
  return appState.records.reduce(
    (stats, record) => {
      const summary = computeRecordSummary(record);
      stats.recordCount += 1;
      stats.totalNetKg += summary.netKg;
      stats.totalBags += summary.bagCount;
      stats.totalAmount += summary.amount;
      stats.totalRemaining += summary.remaining;
      return stats;
    },
    {
      recordCount: 0,
      totalNetKg: 0,
      totalBags: 0,
      totalAmount: 0,
      totalRemaining: 0,
    },
  );
}

function loadState() {
  const fallback = {
    version: APP_VERSION,
    draft: createEmptyDraft(),
    records: [],
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);

    return {
      version: APP_VERSION,
      draft: sanitizeRecord(parsed.draft || createEmptyDraft()),
      records: Array.isArray(parsed.records)
        ? parsed.records.map((record) => sanitizeRecord(record))
        : [],
    };
  } catch (error) {
    console.error("Không thể đọc dữ liệu đã lưu:", error);
    return fallback;
  }
}

function sanitizeRecord(input) {
  const base = createEmptyDraft({
    pricePerKg: input?.pricePerKg ?? DEFAULT_PRICE,
    conversionFactor: input?.conversionFactor ?? DEFAULT_CONVERSION,
    tareKg: input?.tareKg ?? "0",
    impurityKg: input?.impurityKg ?? "0",
    deposit: input?.deposit ?? "0",
    paid: input?.paid ?? "0",
  });

  const boards = Array.isArray(input?.boards) && input.boards.length > 0
    ? input.boards.map((board, index) => ({
        id: board?.id || createId(),
        title: board?.title || `Bảng ${index + 1}`,
        rows: normalizeRows(board?.rows),
      }))
    : base.boards;

  return {
    ...base,
    id: input?.id || base.id,
    name: String(input?.name || ""),
    phone: String(input?.phone || ""),
    date: String(input?.date || base.date),
    pricePerKg: String(input?.pricePerKg ?? base.pricePerKg),
    conversionFactor: String(input?.conversionFactor ?? base.conversionFactor),
    tareKg: String(input?.tareKg ?? base.tareKg),
    impurityKg: String(input?.impurityKg ?? base.impurityKg),
    deposit: String(input?.deposit ?? base.deposit),
    paid: String(input?.paid ?? base.paid),
    note: String(input?.note || ""),
    boards,
    createdAt: String(input?.createdAt || ""),
    updatedAt: String(input?.updatedAt || ""),
  };
}

function normalizeRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return Array.from({ length: DEFAULT_ROWS }, () => createEmptyRow());
  }

  return rows.map((row) => {
    if (!Array.isArray(row)) {
      return createEmptyRow();
    }

    return Array.from({ length: DEFAULT_COLUMNS }, (_, colIndex) =>
      String(row[colIndex] ?? ""),
    );
  });
}

function persistState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: APP_VERSION,
      draft: appState.draft,
      records: appState.records,
    }),
  );
}

function sortRecords() {
  appState.records.sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt || left.date || 0);
    const rightTime = Date.parse(right.updatedAt || right.date || 0);
    return rightTime - leftTime;
  });
}

function isDraftSaved() {
  return appState.records.some((record) => record.id === appState.draft.id);
}

function cloneRecord(record) {
  return JSON.parse(JSON.stringify(record));
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanNumberInput(value, digitsOnly = false) {
  const pattern = digitsOnly ? /[^\d]/g : /[^\d.,]/g;
  return String(value).replace(pattern, "");
}

function safeNumber(value, fallback = 0, options = {}) {
  const normalized = normalizeNumericString(value, options);
  if (!normalized) {
    return fallback;
  }

  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeNumericString(value, options = {}) {
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) {
    return "";
  }

  const separators = raw.match(/[.,]/g) || [];
  if (separators.length === 0) {
    return raw;
  }

  const groups = raw.split(/[.,]/);
  const thousandsPattern = groups.length > 2 && groups.slice(1).every((group) => group.length === 3);
  const singleThousandsPattern =
    options.preferThousands &&
    groups.length === 2 &&
    groups[0] !== "0" &&
    groups[1].length === 3;

  if (thousandsPattern || singleThousandsPattern) {
    return raw.replace(/[.,]/g, "");
  }

  const lastDot = raw.lastIndexOf(".");
  const lastComma = raw.lastIndexOf(",");
  const lastSeparatorIndex = Math.max(lastDot, lastComma);
  const digitsAfterSeparator = raw.length - lastSeparatorIndex - 1;

  if (separators.length === 1 && digitsAfterSeparator === 3) {
    return raw.replace(/[.,]/g, "");
  }

  const integerPart = raw.slice(0, lastSeparatorIndex).replace(/[.,]/g, "");
  const decimalPart = raw.slice(lastSeparatorIndex + 1).replace(/[.,]/g, "");

  return decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
}

function formatKg(value) {
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: Math.abs(value % 1) > 0.00001 ? 1 : 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value) {
  return `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(value)} đ`;
}

function formatInteger(value) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value) {
  if (!value) {
    return "Chưa chọn ngày";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("vi-VN");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2200);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.error("Không thể đăng ký service worker:", error);
    });
  });
}
