/* =========================================================
   APEX QC HOLD ROLL MONITOR - APP LOGIC
========================================================= */

// --- GLOBAL STATE ---
let holds = {};
let currentHoldId = null;

// --- DOM ELEMENTS ---
const holdList = document.getElementById("holdList");
const historyList = document.getElementById("historyList");
const addHoldBtn = document.getElementById("addHoldBtn");
const addHoldModal = document.getElementById("addHoldModal");
const closeAddHold = document.getElementById("closeAddHold");

/* =========================================================
   INITIALIZATION & EVENT LISTENERS
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    setupModals();
    setupFilters();
});

/**
 * Firebase Realtime Database Listener
 * Make sure Firebase DB is initialized prior to this script.
 */
if (typeof holdsRef !== "undefined") {
    onValue(holdsRef, (snapshot) => {
        holds = snapshot.val() || {};
        renderDashboard();
        openHoldFromUrl();
    });
}

/* =========================================================
   HELPER / FORMATTING FUNCTIONS
========================================================= */

function formatStatus(status) {
    if (!status) return "N/A";
    const statusMap = {
        "hold": "ON HOLD",
        "released": "RELEASED",
        "rejected": "REJECTED",
        "INSPECTION_DONE": "INSPECTION DONE",
        "SHADE_APPROVAL": "SHADE APPROVAL",
        "REVIEW": "REVIEW"
    };
    return statusMap[status] || status.toUpperCase();
}

function formatStage(stage) {
    if (!stage) return "N/A";
    const stageMap = {
        "inspection": "QC Inspection Required",
        "review": "Manager Review Required",
        "shade_approval": "Shade Approval Required",
        "completed": "Completed"
    };
    return stageMap[stage] || stage;
}

function formatDateTime(timestamp) {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getHoldDurationMs(hold) {
    if (!hold || !hold.holdTimestamp) return 0;
    const endTime = hold.closedTimestamp || Date.now();
    return endTime - hold.holdTimestamp;
}

function formatDuration(ms) {
    if (!ms || ms <= 0) return "0h 0m";
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        const remainingHours = hours % 24;
        return `${days}d ${remainingHours}h ${minutes}m`;
    }
    return `${hours}h ${minutes}m`;
}

/* =========================================================
   DASHBOARD, TABS & SUMMARY CARDS
========================================================= */

function setupTabs() {
    const tabButtons = document.querySelectorAll(".tabs .tab");
    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            const targetTab = button.getAttribute("data-tab");

            tabButtons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");

            document.querySelectorAll("[data-tab-content]").forEach(content => {
                if (content.getAttribute("data-tab-content") === targetTab) {
                    content.classList.remove("hidden");
                } else {
                    content.classList.add("hidden");
                }
            });
        });
    });
}

function renderDashboard() {
    updateSummaryCards();
    renderHoldList();
    renderHistoryList();
}

function updateSummaryCards() {
    let activeHoldsCount = 0;
    let actionRequiredCount = 0;
    let over24Count = 0;
    let over48Count = 0;
    let releasedCount = 0;
    let totalWeight = 0;

    Object.values(holds).forEach(hold => {
        if (hold.status === "hold" || hold.status === "HOLD") {
            activeHoldsCount++;
            totalWeight += Number(hold.netWeight) || 0;

            const durationHours = getHoldDurationMs(hold) / (1000 * 60 * 60);
            if (durationHours > 48) {
                over48Count++;
            } else if (durationHours > 24) {
                over24Count++;
            }

            if (hold.currentStage === "inspection" || hold.currentStage === "review") {
                actionRequiredCount++;
            }
        } else if (hold.status === "released" || hold.status === "RELEASED") {
            releasedCount++;
        }
    });

    const activeEl = document.getElementById("activeHolds");
    const actionEl = document.getElementById("actionRequired");
    const over24El = document.getElementById("over24");
    const over48El = document.getElementById("over48");
    const releasedEl = document.getElementById("released");
    const weightEl = document.getElementById("totalWeight");

    if (activeEl) activeEl.textContent = activeHoldsCount;
    if (actionEl) actionEl.textContent = actionRequiredCount;
    if (over24El) over24El.textContent = over24Count;
    if (over48El) over48El.textContent = over48Count;
    if (releasedEl) releasedEl.textContent = releasedCount;
    if (weightEl) weightEl.textContent = `${totalWeight.toFixed(2)} kg`;
}

/* =========================================================
   HOLD CARDS RENDERING
========================================================= */

function renderHoldList() {
    if (!holdList) return;
    holdList.innerHTML = "";

    const activeHolds = Object.entries(holds)
        .filter(([_, hold]) => hold.status === "hold" || hold.status === "HOLD")
        .sort((a, b) => (b[1].holdTimestamp || 0) - (a[1].holdTimestamp || 0));

    if (activeHolds.length === 0) {
        holdList.innerHTML = `<div class="empty-state">No active holds found.</div>`;
        return;
    }

    activeHolds.forEach(([id, hold]) => {
        const durationMs = getHoldDurationMs(hold);
        const durationHours = durationMs / (1000 * 60 * 60);
        let severityClass = "normal";
        if (durationHours > 48) severityClass = "critical";
        else if (durationHours > 24) severityClass = "warning";

        const card = document.createElement("div");
        card.className = `hold-card ${severityClass}`;
        card.innerHTML = `
            <div class="hold-card-header">
                <div class="hold-card-title">
                    <h3>Job #${hold.jobNo || "N/A"} — Roll #${hold.rollNo || "N/A"}</h3>
                    <p>${hold.jobName || "N/A"}</p>
                </div>
                <span class="badge badge-hold">AGE: ${formatDuration(durationMs)}</span>
            </div>
            <div class="hold-details">
                <div class="detail-item">
                    <label>Process / Machine</label>
                    <span>${hold.process || "N/A"} (${hold.machine || "N/A"})</span>
                </div>
                <div class="detail-item">
                    <label>Weight</label>
                    <span>${hold.netWeight || 0} kg</span>
                </div>
                <div class="detail-item">
                    <label>Reason</label>
                    <span>${hold.holdReason || "N/A"}</span>
                </div>
                <div class="detail-item">
                    <label>Stage</label>
                    <span>${formatStage(hold.currentStage)}</span>
                </div>
                <div class="detail-item">
                    <label>Inspector</label>
                    <span>${hold.qcInspector || "N/A"}</span>
                </div>
            </div>
            <div class="hold-card-footer">
                <span class="waiting-action">Stage: ${formatStage(hold.currentStage)}</span>
                <button class="view-details-btn" onclick="openDetails('${id}')">View Details</button>
            </div>
        `;
        holdList.appendChild(card);
    });
}

function renderHistoryList() {
    if (!historyList) return;
    historyList.innerHTML = "";

    const historyHolds = Object.entries(holds)
        .filter(([_, hold]) => hold.status !== "hold" && hold.status !== "HOLD")
        .sort((a, b) => (b[1].closedTimestamp || 0) - (a[1].closedTimestamp || 0));

    if (historyHolds.length === 0) {
        historyList.innerHTML = `<div class="empty-state">No history records found.</div>`;
        return;
    }

    historyHolds.forEach(([id, hold]) => {
        const isReleased = hold.status === "released" || hold.status === "RELEASED";
        const badgeClass = isReleased ? "badge-released" : "badge-rejected";
        
        const card = document.createElement("div");
        card.className = "hold-card normal";
        card.innerHTML = `
            <div class="hold-card-header">
                <div class="hold-card-title">
                    <h3>Job #${hold.jobNo || "N/A"} — Roll #${hold.rollNo || "N/A"}</h3>
                    <p>${hold.jobName || "N/A"}</p>
                </div>
                <span class="badge ${badgeClass}">${formatStatus(hold.status)}</span>
            </div>
            <div class="hold-details">
                <div class="detail-item">
                    <label>Process / Machine</label>
                    <span>${hold.process || "N/A"} (${hold.machine || "N/A"})</span>
                </div>
                <div class="detail-item">
                    <label>Weight</label>
                    <span>${hold.netWeight || 0} kg</span>
                </div>
                <div class="detail-item">
                    <label>Total Hold Time</label>
                    <span>${formatDuration(getHoldDurationMs(hold))}</span>
                </div>
                <div class="detail-item">
                    <label>Closed Date</label>
                    <span>${formatDateTime(hold.closedTimestamp)}</span>
                </div>
            </div>
            <div class="hold-card-footer">
                <span class="waiting-action">Closed</span>
                <button class="view-details-btn" onclick="openDetails('${id}')">View Details</button>
            </div>
        `;
        historyList.appendChild(card);
    });
}

/* =========================================================
   MODALS CONTROL
========================================================= */

function setupModals() {
    if (addHoldBtn && addHoldModal) {
        addHoldBtn.addEventListener("click", () => openModal("addHoldModal"));
    }
    if (closeAddHold && addHoldModal) {
        closeAddHold.addEventListener("click", () => closeModal("addHoldModal"));
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove("hidden");
        document.body.classList.add("modal-open");
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add("hidden");
        document.body.classList.remove("modal-open");
    }
}

function openDetails(holdId) {
    currentHoldId = holdId;
    const hold = holds[holdId];
    if (!hold) return;

    const detailJobNo = document.getElementById("detailJobNo");
    const detailRollNo = document.getElementById("detailRollNo");
    const detailJobName = document.getElementById("detailJobName");
    const detailStatus = document.getElementById("detailStatus");
    const detailStage = document.getElementById("detailStage");

    if (detailJobNo) detailJobNo.textContent = hold.jobNo || "-";
    if (detailRollNo) detailRollNo.textContent = hold.rollNo || "-";
    if (detailJobName) detailJobName.textContent = hold.jobName || "-";
    if (detailStatus) detailStatus.textContent = formatStatus(hold.status);
    if (detailStage) detailStage.textContent = formatStage(hold.currentStage);

    openModal("detailsModal");
}

/* =========================================================
   FILTERS & SEARCH
========================================================= */

function setupFilters() {
    const searchInput = document.getElementById("searchInput");
    const processFilter = document.getElementById("processFilter");
    const statusFilter = document.getElementById("statusFilter");
    const reasonFilter = document.getElementById("reasonFilter");

    const applyFilters = () => {
        const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
        const selectedProcess = processFilter ? processFilter.value.toLowerCase() : "";
        const selectedStatus = statusFilter ? statusFilter.value.toLowerCase() : "";
        const selectedReason = reasonFilter ? reasonFilter.value.toLowerCase() : "";

        const cards = document.querySelectorAll("#holdList .hold-card, #historyList .hold-card");
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            const matchesQuery = !query || text.includes(query);
            const matchesProcess = !selectedProcess || text.includes(selectedProcess);
            const matchesStatus = !selectedStatus || text.includes(selectedStatus);
            const matchesReason = !selectedReason || text.includes(selectedReason);

            if (matchesQuery && matchesProcess && matchesStatus && matchesReason) {
                card.classList.remove("hidden");
            } else {
                card.classList.add("hidden");
            }
        });
    };

    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (processFilter) processFilter.addEventListener("change", applyFilters);
    if (statusFilter) statusFilter.addEventListener("change", applyFilters);
    if (reasonFilter) reasonFilter.addEventListener("change", applyFilters);
}

/* =========================================================
   DEEP LINK AUTO-OPEN HANDLER
========================================================= */

function openHoldFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const holdId = params.get("hold");

    if (holdId && holds[holdId]) {
        setTimeout(() => {
            openDetails(holdId);
        }, 500);
    }
}
