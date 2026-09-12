/* =====================================================
   APEX QC HOLD ROLL MONITOR
   ===================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
    getDatabase,
    ref,
    push,
    set,
    update,
    onValue
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

/* =====================================================
   FIREBASE CONFIG
   ===================================================== */

const firebaseConfig = {
    apiKey: "AIzaSyBZC1ln8Qxkq_JJBHpMtF8zy850T3rHcg",
    authDomain: "apex-qc-hold-monitor.firebaseapp.com",
    databaseURL: "https://apex-qc-hold-monitor-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "apex-qc-hold-monitor",
    storageBucket: "apex-qc-hold-monitor.firebasestorage.app",
    messagingSenderId: "1006270751442",
    appId: "1:1006270751442:web:dca6ce7f3b3a235ee9030b"
};

/* =====================================================
   FIREBASE INITIALIZATION
   ===================================================== */

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* =====================================================
   CLOUDINARY CONFIG
   ===================================================== */

const CLOUDINARY_CLOUD_NAME = "org593vv";
const CLOUDINARY_UPLOAD_PRESET = "apex_qc_hold";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

/* =====================================================
   DOM ELEMENTS
   ===================================================== */

const addHoldBtn = document.getElementById("addHoldBtn");
const addHoldModal = document.getElementById("addHoldModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelHoldBtn = document.getElementById("cancelHoldBtn");
const holdForm = document.getElementById("holdForm");

const detailsModal = document.getElementById("detailsModal");
const closeDetailsBtn = document.getElementById("closeDetailsBtn");
const detailsContent = document.getElementById("detailsContent");

const holdList = document.getElementById("holdList");
const historyList = document.getElementById("historyList");

const activeTab = document.getElementById("activeTab");
const historyTab = document.getElementById("historyTab");

const searchInput = document.getElementById("searchInput");
const processFilter = document.getElementById("processFilter");
const statusFilter = document.getElementById("statusFilter");
const reasonFilter = document.getElementById("reasonFilter");

/* =====================================================
   GLOBAL DATA
   ===================================================== */

let allHolds = [];
let currentHoldId = null;

/* =====================================================
   WORKFLOW HELPER FUNCTIONS
   ===================================================== */

function determineWorkflow(holdReason) {
    if (holdReason === "Shade Mismatch") return "shadeApproval";
    if (holdReason === "GSM / Weight") return "review";
    return "inspection";
}

function getInitialWorkflowState(workflowType) {
    if (workflowType === "shadeApproval") {
        return { status: "SHADE_APPROVAL", currentStage: "PRINTING_MANAGER" };
    }
    if (workflowType === "review") {
        return { status: "REVIEW", currentStage: "REVIEW" };
    }
    return { status: "HOLD", currentStage: "INSPECTION" };
}

function formatDate(timestamp) {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatWeight(weight) {
    if (weight === null || weight === undefined || weight === "") return "-";
    return `${weight} kg`;
}

function getHoldAge(timestamp, releaseTimestamp = null) {
    if (!timestamp) return "-";
    const start = new Date(timestamp).getTime();
    const end = releaseTimestamp ? new Date(releaseTimestamp).getTime() : Date.now();
    let diff = Math.max(0, end - start);

    const totalMinutes = Math.floor(diff / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function getAgeClass(timestamp, releaseTimestamp = null) {
    if (!timestamp) return "";
    const start = new Date(timestamp).getTime();
    const end = releaseTimestamp ? new Date(releaseTimestamp).getTime() : Date.now();
    const hours = (end - start) / (1000 * 60 * 60);

    if (hours >= 48) return "critical";
    if (hours >= 24) return "warning";
    return "normal";
}

function getStatusText(status) {
    const statusMap = {
        HOLD: "HOLD",
        INSPECTION: "INSPECTION REQUIRED",
        INSPECTION_DONE: "INSPECTION DONE",
        SHADE_APPROVAL: "SHADE APPROVAL",
        REVIEW: "REVIEW",
        RELEASED: "RELEASED",
        REJECTED: "REJECTED"
    };
    return statusMap[status] || status || "-";
}

function getWaitingText(hold) {
    if (hold.status === "RELEASED") return "Completed";
    if (hold.status === "REJECTED") return "Rejected";

    if (hold.workflowType === "inspection") {
        return hold.status === "INSPECTION_DONE" ? "Release / Reject" : "Inspection Required";
    }
    if (hold.workflowType === "shadeApproval") {
        const stageMap = {
            PRINTING_MANAGER: "Printing Manager",
            QC_MANAGER: "QC Manager",
            GM: "GM"
        };
        return stageMap[hold.currentStage] || "Shade Approval";
    }
    if (hold.workflowType === "review") return "Review Required";
    return "-";
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =====================================================
   SUMMARY UPDATES & FILTERING
   ===================================================== */

function updateSummary() {
    const activeHolds = allHolds.filter(h => h.status !== "RELEASED" && h.status !== "REJECTED");
    const releasedHolds = allHolds.filter(h => h.status === "RELEASED");
    const now = Date.now();

    const over24 = activeHolds.filter(h => (now - new Date(h.holdTimestamp).getTime()) >= 86400000);
    const over48 = activeHolds.filter(h => (now - new Date(h.holdTimestamp).getTime()) >= 172800000);
    const totalWeight = activeHolds.reduce((sum, h) => sum + (Number(h.netWeight) || 0), 0);

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setVal("activeCount", activeHolds.length);
    setVal("actionCount", activeHolds.filter(h => h.status !== "INSPECTION_DONE").length);
    setVal("over24Count", over24.length);
    setVal("over48Count", over48.length);
    setVal("releasedCount", releasedHolds.length);
    setVal("totalWeight", `${totalWeight.toFixed(2)} kg`);
}

function filterHolds(holds) {
    const search = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const process = processFilter ? processFilter.value : "";
    const status = statusFilter ? statusFilter.value : "";
    const reason = reasonFilter ? reasonFilter.value : "";

    return holds.filter(hold => {
        const searchableText = [
            hold.jobNo, hold.rollNo, hold.jobName, hold.process,
            hold.machine, hold.operator, hold.supervisor, hold.qcInspector, hold.holdReason
        ].filter(Boolean).join(" ").toLowerCase();

        if (search && !searchableText.includes(search)) return false;
        if (process && hold.process !== process) return false;
        if (status && hold.status !== status) return false;
        if (reason && hold.holdReason !== reason) return false;

        return true;
    });
}

/* =====================================================
   RENDERING CARDS & TABLES
   ===================================================== */

function createHoldCard(hold) {
    const ageClass = getAgeClass(hold.holdTimestamp, hold.releaseTimestamp);
    const age = getHoldAge(hold.holdTimestamp, hold.releaseTimestamp);
    const status = getStatusText(hold.status);
    const waiting = getWaitingText(hold);

    return `
        <div class="hold-card ${ageClass}">
            <div class="hold-card-header">
                <div>
                    <div class="hold-job">${escapeHtml(hold.jobNo || "-")}</div>
                    <div class="hold-roll">Roll: ${escapeHtml(hold.rollNo || "-")}</div>
                </div>
                <div class="hold-status">${escapeHtml(status)}</div>
            </div>
            <div class="hold-card-grid">
                <div><span>Job Name</span><strong>${escapeHtml(hold.jobName || "-")}</strong></div>
                <div><span>Weight</span><strong>${escapeHtml(formatWeight(hold.netWeight))}</strong></div>
                <div><span>Process</span><strong>${escapeHtml(hold.process || "-")}</strong></div>
                <div><span>Machine</span><strong>${escapeHtml(hold.machine || "-")}</strong></div>
                <div><span>Shift</span><strong>${escapeHtml(hold.shift || "-")}</strong></div>
                <div><span>QC Inspector</span><strong>${escapeHtml(hold.qcInspector || "-")}</strong></div>
                <div><span>Hold Reason</span><strong>${escapeHtml(hold.holdReason || "-")}</strong></div>
                <div><span>Waiting Action</span><strong>${escapeHtml(waiting)}</strong></div>
            </div>
            <div class="hold-card-footer">
                <div><span>Hold Age</span><strong class="age-value">${age}</strong></div>
                <button class="view-details-btn" onclick="openDetails('${hold.holdId}')">VIEW DETAILS</button>
            </div>
        </div>
    `;
}

function renderActiveHolds() {
    if (!holdList) return;
    const activeHolds = allHolds.filter(h => h.status !== "RELEASED" && h.status !== "REJECTED");
    const filtered = filterHolds(activeHolds);

    if (filtered.length === 0) {
        holdList.innerHTML = `<div class="empty-state">No active QC hold rolls found.</div>`;
        return;
    }

    holdList.innerHTML = filtered
        .sort((a, b) => new Date(b.holdTimestamp) - new Date(a.holdTimestamp))
        .map(createHoldCard)
        .join("");
}

function renderHistory() {
    if (!historyList) return;
    const history = allHolds.filter(h => h.status === "RELEASED" || h.status === "REJECTED");
    const filtered = filterHolds(history);

    if (filtered.length === 0) {
        historyList.innerHTML = `<div class="empty-state">No hold history found.</div>`;
        return;
    }

    historyList.innerHTML = filtered
        .sort((a, b) => new Date(b.holdTimestamp) - new Date(a.holdTimestamp))
        .map(createHoldCard)
        .join("");
}

/* =====================================================
   DETAILS MODAL RENDERING & ACTIONS
   ===================================================== */

function renderDetailsModal(hold) {
    if (!detailsContent) return;

    const actions = hold.actions ? Object.values(hold.actions) : [];
    actions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const actionsHtml = actions.map(act => `
        <div class="timeline-item">
            <div class="timeline-header">
                <strong>${escapeHtml(act.type)}</strong>
                <span>${formatDate(act.timestamp)}</span>
            </div>
            <div class="timeline-body">
                <p><strong>By:</strong> ${escapeHtml(act.person)} | <strong>Decision:</strong> ${escapeHtml(act.decision)}</p>
                ${act.remarks ? `<p><strong>Remarks:</strong> ${escapeHtml(act.remarks)}</p>` : ""}
            </div>
        </div>
    `).join("");

    const photoUrl = typeof hold.labelPhoto === "string" 
        ? hold.labelPhoto 
        : (hold.labelPhoto?.secure_url || hold.labelPhoto?.url || "");

    detailsContent.innerHTML = `
        <div class="details-header">
            <div>
                <h2>${escapeHtml(hold.jobNo || "-")}</h2>
                <p>Roll: ${escapeHtml(hold.rollNo || "-")}</p>
            </div>
            <div class="hold-status">${escapeHtml(getStatusText(hold.status))}</div>
        </div>
        <div class="details-grid">
            <div><span>Job Name</span><strong>${escapeHtml(hold.jobName || "-")}</strong></div>
            <div><span>Net Weight</span><strong>${escapeHtml(formatWeight(hold.netWeight))}</strong></div>
            <div><span>Process</span><strong>${escapeHtml(hold.process || "-")}</strong></div>
            <div><span>Machine</span><strong>${escapeHtml(hold.machine || "-")}</strong></div>
            <div><span>Production Date</span><strong>${escapeHtml(hold.productionDate || "-")}</strong></div>
            <div><span>Shift</span><strong>${escapeHtml(hold.shift || "-")}</strong></div>
            <div><span>Operator</span><strong>${escapeHtml(hold.operator || "-")}</strong></div>
            <div><span>Supervisor</span><strong>${escapeHtml(hold.supervisor || "-")}</strong></div>
            <div><span>QC Inspector</span><strong>${escapeHtml(hold.qcInspector || "-")}</strong></div>
            <div><span>Hold Reason</span><strong>${escapeHtml(hold.holdReason || "-")}</strong></div>
            <div><span>Created At</span><strong>${formatDate(hold.holdTimestamp)}</strong></div>
            <div><span>Hold Age</span><strong>${getHoldAge(hold.holdTimestamp, hold.releaseTimestamp)}</strong></div>
        </div>
        ${hold.observation ? `<div class="details-section"><h3>Observation</h3><p>${escapeHtml(hold.observation)}</p></div>` : ""}
        ${photoUrl ? `
            <div class="details-section">
                <h3>Label / Defect Photo</h3>
                <a href="${escapeHtml(photoUrl)}" target="_blank">
                    <img src="${escapeHtml(photoUrl)}" class="label-photo" alt="Roll Label">
                </a>
            </div>
        ` : ""}
        <div class="details-section">
            <h3>Audit / Action History</h3>
            <div class="timeline">${actionsHtml || "<p>No actions logged.</p>"}</div>
        </div>
        ${(hold.status !== "RELEASED" && hold.status !== "REJECTED") ? `
            <div class="details-actions">
                <button class="btn-release" onclick="updateHoldState('${hold.holdId}', 'RELEASED')">RELEASE ROLL</button>
                <button class="btn-reject" onclick="updateHoldState('${hold.holdId}', 'REJECTED')">REJECT ROLL</button>
            </div>
        ` : ""}
    `;
}

window.openDetails = function (holdId) {
    currentHoldId = holdId;
    const hold = allHolds.find(item => item.holdId === holdId);
    if (!hold) {
        alert("Hold record not found.");
        return;
    }
    renderDetailsModal(hold);
    if (detailsModal) detailsModal.classList.add("show");
};

function closeDetailsModal() {
    currentHoldId = null;
    if (detailsModal) detailsModal.classList.remove("show");
}

if (closeDetailsBtn) closeDetailsBtn.addEventListener("click", closeDetailsModal);

/* =====================================================
   UPDATE HOLD STATE (RELEASE / REJECT)
   ===================================================== */

window.updateHoldState = async function(holdId, newStatus) {
    const person = prompt("Enter your name / ID:");
    if (!person) return;

    const remarks = prompt(`Enter remarks for ${newStatus}:`) || "";
    const timestamp = new Date().toISOString();

    try {
        const updates = {
            [`holdRolls/${holdId}/status`]: newStatus,
            [`holdRolls/${holdId}/releaseTimestamp`]: timestamp
        };

        await update(ref(db), updates);

        const actionRef = push(ref(db, `holdRolls/${holdId}/actions`));
        await set(actionRef, {
            type: `ROLL ${newStatus}`,
            person,
            decision: newStatus,
            remarks,
            timestamp
        });

        alert(`Roll status updated to ${newStatus}.`);
        closeDetailsModal();
    } catch (error) {
        console.error("STATUS UPDATE ERROR:", error);
        alert("Failed to update status: " + error.message);
    }
};

/* =====================================================
   ADD HOLD MODAL HANDLERS
   ===================================================== */

if (addHoldBtn) {
    addHoldBtn.addEventListener("click", () => {
        if (addHoldModal) addHoldModal.classList.add("show");
    });
}

function closeAddHoldModal() {
    if (addHoldModal) addHoldModal.classList.remove("show");
    if (holdForm) holdForm.reset();
}

if (closeModalBtn) closeModalBtn.addEventListener("click", closeAddHoldModal);
if (cancelHoldBtn) cancelHoldBtn.addEventListener("click", closeAddHoldModal);

if (holdForm) {
    holdForm.addEventListener("submit", async event => {
        event.preventDefault();
        const submitButton = holdForm.querySelector('button[type="submit"]');

        try {
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "SAVING...";
            }

            const jobNo = document.getElementById("jobNo")?.value.trim();
            const jobName = document.getElementById("jobName")?.value.trim();
            const rollNo = document.getElementById("rollNo")?.value.trim();
            const netWeight = document.getElementById("netWeight")?.value;
            const process = document.getElementById("process")?.value;
            const machine = document.getElementById("machine")?.value.trim();
            const productionDate = document.getElementById("productionDate")?.value;
            const shift = document.getElementById("shift")?.value;
            const operator = document.getElementById("operator")?.value.trim();
            const supervisor = document.getElementById("supervisor")?.value.trim();
            const qcInspector = document.getElementById("qcInspector")?.value.trim();
            const holdReason = document.getElementById("holdReason")?.value;
            const observation = document.getElementById("observation")?.value.trim();
            const photoInput = document.getElementById("labelPhoto");

            if (!jobNo || !rollNo || !holdReason) {
                alert("Please fill in Job No, Roll No, and Hold Reason.");
                return;
            }

            let labelPhoto = "";
            if (photoInput?.files?.[0]) {
                const formData = new FormData();
                formData.append("file", photoInput.files[0]);
                formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

                const cloudinaryResponse = await fetch(CLOUDINARY_UPLOAD_URL, {
                    method: "POST",
                    body: formData
                });

                if (!cloudinaryResponse.ok) throw new Error("Photo upload failed.");
                const cloudinaryData = await cloudinaryResponse.json();
                labelPhoto = cloudinaryData.secure_url || "";
            }

            const holdRef = push(ref(db, "holdRolls"));
            const holdId = holdRef.key;
            const workflowType = determineWorkflow(holdReason);
            const workflowState = getInitialWorkflowState(workflowType);
            const holdTimestamp = new Date().toISOString();

            const holdData = {
                holdId, jobNo, jobName, rollNo,
                netWeight: netWeight || 0,
                process, machine, productionDate, shift,
                operator, supervisor, qcInspector, holdReason,
                observation, labelPhoto, workflowType,
                status: workflowState.status,
                currentStage: workflowState.currentStage,
                holdTimestamp,
                releaseTimestamp: null
            };

            await set(holdRef, holdData);

            const firstActionRef = push(ref(db, `holdRolls/${holdId}/actions`));
            await set(firstActionRef, {
                type: "HOLD CREATED",
                person: qcInspector || supervisor || "QC",
                decision: "HOLD",
                remarks: observation || "",
                timestamp: holdTimestamp
            });

            alert(`Hold created successfully.\n\nJob: ${jobNo}\nRoll: ${rollNo}`);
            closeAddHoldModal();
        } catch (error) {
            console.error("CREATE HOLD ERROR:", error);
            alert("Unable to create hold.\n\n" + error.message);
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "CREATE HOLD";
            }
        }
    });
}

/* =====================================================
   TAB & FILTER EVENT LISTENERS
   ===================================================== */

if (activeTab && historyTab) {
    activeTab.addEventListener("click", () => {
        activeTab.classList.add("active");
        historyTab.classList.remove("active");
        if (holdList) holdList.style.display = "block";
        if (historyList) historyList.style.display = "none";
    });

    historyTab.addEventListener("click", () => {
        historyTab.classList.add("active");
        activeTab.classList.remove("active");
        if (holdList) holdList.style.display = "none";
        if (historyList) historyList.style.display = "block";
    });
}

[searchInput, processFilter, statusFilter, reasonFilter].forEach(element => {
    if (element) {
        element.addEventListener("input", () => {
            renderActiveHolds();
            renderHistory();
        });
    }
});

/* =====================================================
   INITIAL LOAD
   ===================================================== */

function loadHolds() {
    const holdsRef = ref(db, "holdRolls");
    onValue(holdsRef, snapshot => {
        const data = snapshot.val();
        allHolds = data ? Object.values(data) : [];

        updateSummary();
        renderActiveHolds();
        renderHistory();
    }, error => {
        console.error("FIREBASE LOAD ERROR:", error);
        if (holdList) {
            holdList.innerHTML = `<div class="empty-state">Unable to load QC hold data.</div>`;
        }
    });
}

loadHolds();
