/* =========================================================
   APEX QC HOLD ROLL MONITOR - APP LOGIC
========================================================= */

// --- GLOBAL STATE ---
let holds = {};
let currentHoldId = null;
let currentTab = "active";
let uploadedPhotoUrl = "";

// --- DOM ELEMENTS ---
const holdList = document.getElementById("holdList");
const historyList = document.getElementById("historyList");

// --- FIREBASE / DATABASE SETUP ---
// Assumes Firebase Realtime Database is initialized in your HTML or config module
// Example reference: const holdsRef = ref(database, 'holds');

/* =========================================================
   INITIALIZATION & EVENT LISTENERS
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    setupFilters();
});

/**
 * Firebase Realtime Database Listener
 * Listens for live updates and refreshes UI
 */
// Replace 'holdsRef' with your active Firebase database reference
onValue(holdsRef, (snapshot) => {
    holds = snapshot.val() || {};
    
    // Refresh dashboard UI
    renderDashboard();

    // Automatically trigger detail modal if 'hold' parameter exists in URL
    openHoldFromUrl();
});


/* =========================================================
   HELPER / FORMATTING FUNCTIONS
========================================================= */

function formatStatus(status) {
    if (!status) return "N/A";
    const statusMap = {
        "hold": "ON HOLD",
        "released": "RELEASED",
        "rejected": "REJECTED"
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
   DASHBOARD & TAB RENDER
========================================================= */

function switchTab(tabName) {
    currentTab = tabName;
    
    document.querySelectorAll(".tabs button").forEach(btn => {
        btn.classList.remove("active");
    });
    
    const activeBtn = document.getElementById(`${tabName}TabBtn`);
    if (activeBtn) activeBtn.classList.add("active");

    if (tabName === "active") {
        document.getElementById("activeHoldSection").classList.remove("hidden");
        document.getElementById("historySection").classList.add("hidden");
    } else {
        document.getElementById("activeHoldSection").classList.add("hidden");
        document.getElementById("historySection").classList.remove("hidden");
    }

    renderDashboard();
}

function renderDashboard() {
    updateSummaryCards();
    renderHoldList();
    renderHistoryList();
}

function updateSummaryCards() {
    let totalActive = 0;
    let criticalCount = 0;
    let totalWeight = 0;
    let pendingQC = 0;
    let pendingReview = 0;
    let pendingShade = 0;

    Object.values(holds).forEach(hold => {
        if (hold.status === "hold") {
            totalActive++;
            totalWeight += Number(hold.netWeight) || 0;

            const durationHours = getHoldDurationMs(hold) / (1000 * 60 * 60);
            if (durationHours > 24) criticalCount++;

            if (hold.currentStage === "inspection") pendingQC++;
            if (hold.currentStage === "review") pendingReview++;
            if (hold.currentStage === "shade_approval") pendingShade++;
        }
    });

    if (document.getElementById("totalActiveHolds")) document.getElementById("totalActiveHolds").textContent = totalActive;
    if (document.getElementById("criticalHolds")) document.getElementById("criticalHolds").textContent = criticalCount;
    if (document.getElementById("totalActiveWeight")) document.getElementById("totalActiveWeight").textContent = `${totalWeight.toLocaleString()} kg`;
    if (document.getElementById("pendingQC")) document.getElementById("pendingQC").textContent = pendingQC;
    if (document.getElementById("pendingReview")) document.getElementById("pendingReview").textContent = pendingReview;
    if (document.getElementById("pendingShade")) document.getElementById("pendingShade").textContent = pendingShade;
}


/* =========================================================
   HOLD CARDS RENDERING
========================================================= */

function renderHoldList() {
    if (!holdList) return;
    holdList.innerHTML = "";

    const activeHolds = Object.entries(holds)
        .filter(([_, hold]) => hold.status === "hold")
        .sort((a, b) => b[1].holdTimestamp - a[1].holdTimestamp);

    if (activeHolds.length === 0) {
        holdList.innerHTML = `<div class="empty-state">No active holds found.</div>`;
        return;
    }

    activeHolds.forEach(([id, hold]) => {
        const durationMs = getHoldDurationMs(hold);
        const durationHours = durationMs / (1000 * 60 * 60);
        let severityClass = "normal";
        if (durationHours > 24) severityClass = "critical";
        else if (durationHours > 12) severityClass = "warning";

        const card = document.createElement("div");
        card.className = `hold-card ${severityClass}`;
        card.innerHTML = `
            <div class="hold-card-header">
                <div class="hold-card-title">
                    <h3>Job #${hold.jobNo} — Roll #${hold.rollNo}</h3>
                    <p>${hold.jobName || "N/A"}</p>
                </div>
                <span class="badge badge-hold">AGE: ${formatDuration(durationMs)}</span>
            </div>
            <div class="hold-details">
                <div class="detail-item">
                    <label>Process / Machine</label>
                    <span>${hold.process} (${hold.machine})</span>
                </div>
                <div class="detail-item">
                    <label>Weight</label>
                    <span>${hold.netWeight} kg</span>
                </div>
                <div class="detail-item">
                    <label>Reason</label>
                    <span>${hold.holdReason}</span>
                </div>
                <div class="detail-item">
                    <label>Stage</label>
                    <span>${formatStage(hold.currentStage)}</span>
                </div>
                <div class="detail-item">
                    <label>Inspector</label>
                    <span>${hold.qcInspector}</span>
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
        .filter(([_, hold]) => hold.status !== "hold")
        .sort((a, b) => (b[1].closedTimestamp || 0) - (a[1].closedTimestamp || 0));

    if (historyHolds.length === 0) {
        historyList.innerHTML = `<div class="empty-state">No history records found.</div>`;
        return;
    }

    historyHolds.forEach(([id, hold]) => {
        const badgeClass = hold.status === "released" ? "badge-released" : "badge-rejected";
        
        const card = document.createElement("div");
        card.className = "hold-card normal";
        card.innerHTML = `
            <div class="hold-card-header">
                <div class="hold-card-title">
                    <h3>Job #${hold.jobNo} — Roll #${hold.rollNo}</h3>
                    <p>${hold.jobName || "N/A"}</p>
                </div>
                <span class="badge ${badgeClass}">${formatStatus(hold.status)}</span>
            </div>
            <div class="hold-details">
                <div class="detail-item">
                    <label>Process / Machine</label>
                    <span>${hold.process} (${hold.machine})</span>
                </div>
                <div class="detail-item">
                    <label>Weight</label>
                    <span>${hold.netWeight} kg</span>
                </div>
                <div class="detail-item">
                    <label>Total Hold Time</label>
                    <span>${formatDuration(getHoldDurationMs(hold))}</span>
                </div>
                <div class="detail-item">
                    <label>Final Action</label>
                    <span>${formatStatus(hold.status)}</span>
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

    // Populate Modal Basic Data
    document.getElementById("detailJobNo").textContent = hold.jobNo || "-";
    document.getElementById("detailRollNo").textContent = hold.rollNo || "-";
    document.getElementById("detailJobName").textContent = hold.jobName || "-";
    document.getElementById("detailStatus").textContent = formatStatus(hold.status);
    document.getElementById("detailStage").textContent = formatStage(hold.currentStage);
    document.getElementById("detailProcess").textContent = `${hold.process || "-"} (${hold.machine || "-"})`;
    document.getElementById("detailWeight").textContent = `${hold.netWeight || "0"} kg`;
    document.getElementById("detailReason").textContent = hold.holdReason || "-";
    document.getElementById("detailInspector").textContent = hold.qcInspector || "-";
    document.getElementById("detailCreated").textContent = formatDateTime(hold.holdTimestamp);
    document.getElementById("detailAge").textContent = formatDuration(getHoldDurationMs(hold));

    // Render Timeline & Photo if available
    renderTimeline(hold);

    const photoElem = document.getElementById("detailLabelPhoto");
    if (photoElem) {
        if (hold.labelPhotoUrl) {
            photoElem.src = hold.labelPhotoUrl;
            photoElem.classList.remove("hidden");
        } else {
            photoElem.classList.add("hidden");
        }
    }

    // Toggle Action Panels based on stage
    setupActionPanel(hold);

    openModal("detailsModal");
}

function renderTimeline(hold) {
    const timelineContainer = document.getElementById("detailTimeline");
    if (!timelineContainer) return;

    timelineContainer.innerHTML = "";
    const logs = hold.history || [];

    logs.forEach(log => {
        const item = document.createElement("div");
        item.className = "timeline-item";
        item.innerHTML = `
            <strong>${log.action || "Action Taken"}</strong>
            <p>${log.note || "No details provided."}</p>
            <small>By ${log.user || "System"} on ${formatDateTime(log.timestamp)}</small>
        `;
        timelineContainer.appendChild(item);
    });
}

function setupActionPanel(hold) {
    const actionPanel = document.getElementById("actionPanel");
    if (!actionPanel) return;

    if (hold.status !== "hold") {
        actionPanel.classList.add("hidden");
        return;
    }

    actionPanel.classList.remove("hidden");
    // Show/hide relevant fields based on hold.currentStage as required by your business flow
}


/* =========================================================
   REMINDER & EMAIL LINKING
========================================================= */

function openReminderModal() {
    openModal("reminderModal");
}

/**
 * Generates an email reminder with a direct deep link to the current roll
 */
function sendReminder() {
    if (!currentHoldId || !holds[currentHoldId]) return;

    const hold = holds[currentHoldId];
    const person = document.getElementById("reminderPerson").value.trim();
    const message = document.getElementById("reminderMessage").value.trim();

    if (!person) {
        alert("Please enter the name of the responsible person.");
        return;
    }

    // 1. Construct direct link to this specific hold
    const websiteUrl = "https://dd1432.github.io/apex-qc-hold-monitor/";
    const rollLink = `${websiteUrl}?hold=${encodeURIComponent(currentHoldId)}`;

    // 2. Build email body containing the direct link
    const body = `QC HOLD REMINDER

Responsible Person: ${person}

Job No: ${hold.jobNo}
Job Name: ${hold.jobName}
Roll No: ${hold.rollNo}
Net Weight: ${hold.netWeight} kg
Process: ${hold.process}
Machine: ${hold.machine}
Production Date: ${hold.productionDate}
Shift: ${hold.shift}

Operator: ${hold.operator}
Supervisor: ${hold.supervisor}
QC Inspector: ${hold.qcInspector}

Hold Reason: ${hold.holdReason}
Status: ${formatStatus(hold.status)}
Current Stage: ${formatStage(hold.currentStage)}

Hold Created: ${formatDateTime(hold.holdTimestamp)}
Current Hold Age: ${formatDuration(getHoldDurationMs(hold))}

Observation: ${hold.observation || "No observation provided."}

----------------------------------------
OPEN THIS ROLL IN QC HOLD MONITOR:
${rollLink}
----------------------------------------

${message ? `Additional Message:\n${message}` : ""}`;

    const subject = encodeURIComponent(`QC HOLD REMINDER - Job ${hold.jobNo} / Roll ${hold.rollNo}`);
    const mailtoUrl = `mailto:?subject=${subject}&body=${encodeURIComponent(body)}`;

    window.location.href = mailtoUrl;
    closeModal("reminderModal");
}


/* =========================================================
   FILTERS & SEARCH
========================================================= */

function setupFilters() {
    const searchInput = document.getElementById("searchInput");
    const processFilter = document.getElementById("processFilter");
    const stageFilter = document.getElementById("stageFilter");

    const applyFilters = () => {
        const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
        const selectedProcess = processFilter ? processFilter.value : "";
        const selectedStage = stageFilter ? stageFilter.value : "";

        const cards = document.querySelectorAll("#holdList .hold-card, #historyList .hold-card");
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            const matchesQuery = !query || text.includes(query);
            const matchesProcess = !selectedProcess || text.includes(selectedProcess.toLowerCase());
            const matchesStage = !selectedStage || text.includes(selectedStage.toLowerCase());

            if (matchesQuery && matchesProcess && matchesStage) {
                card.classList.remove("hidden");
            } else {
                card.classList.add("hidden");
            }
        });
    };

    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (processFilter) processFilter.addEventListener("change", applyFilters);
    if (stageFilter) stageFilter.addEventListener("change", applyFilters);
}


/* =========================================================
   DEEP LINK AUTO-OPEN HANDLER
========================================================= */

/**
 * Reads the 'hold' URL parameter and opens the corresponding detail modal
 */
function openHoldFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const holdId = params.get("hold");

    if (!holdId) return;

    if (holds[holdId]) {
        setTimeout(() => {
            openDetails(holdId);
        }, 500);
    }
}
