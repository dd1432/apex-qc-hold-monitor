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

const CLOUDINARY_UPLOAD_URL =
    "https://api.cloudinary.com/v1_1/org593vv/image/upload";


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
   WORKFLOW
   ===================================================== */

function determineWorkflow(holdReason) {

    if (holdReason === "Shade Mismatch") {
        return "shadeApproval";
    }

    if (holdReason === "GSM / Weight") {
        return "review";
    }

    return "inspection";
}


/* =====================================================
   INITIAL WORKFLOW STATE
   ===================================================== */

function getInitialWorkflowState(workflowType) {

    if (workflowType === "shadeApproval") {

        return {
            status: "SHADE_APPROVAL",
            currentStage: "PRINTING_MANAGER"
        };

    }

    if (workflowType === "review") {

        return {
            status: "REVIEW",
            currentStage: "REVIEW"
        };

    }

    return {
        status: "HOLD",
        currentStage: "INSPECTION"
    };
}


/* =====================================================
   FORMAT DATE
   ===================================================== */

function formatDate(timestamp) {

    if (!timestamp) {
        return "-";
    }

    const date = new Date(timestamp);

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}


/* =====================================================
   FORMAT WEIGHT
   ===================================================== */

function formatWeight(weight) {

    if (
        weight === null ||
        weight === undefined ||
        weight === ""
    ) {
        return "-";
    }

    return `${weight} kg`;
}


/* =====================================================
   HOLD AGE
   ===================================================== */

function getHoldAge(timestamp, releaseTimestamp = null) {

    if (!timestamp) {
        return "-";
    }

    const start = new Date(timestamp).getTime();

    const end = releaseTimestamp
        ? new Date(releaseTimestamp).getTime()
        : Date.now();

    let diff = end - start;

    if (diff < 0) {
        diff = 0;
    }

    const totalMinutes = Math.floor(diff / 60000);

    const days = Math.floor(totalMinutes / 1440);

    const hours = Math.floor(
        (totalMinutes % 1440) / 60
    );

    const minutes = totalMinutes % 60;

    if (days > 0) {

        return `${days}d ${hours}h ${minutes}m`;

    }

    if (hours > 0) {

        return `${hours}h ${minutes}m`;

    }

    return `${minutes}m`;
}


/* =====================================================
   AGE CLASS
   ===================================================== */

function getAgeClass(timestamp, releaseTimestamp = null) {

    if (!timestamp) {
        return "";
    }

    const start = new Date(timestamp).getTime();

    const end = releaseTimestamp
        ? new Date(releaseTimestamp).getTime()
        : Date.now();

    const hours =
        (end - start) / (1000 * 60 * 60);

    if (hours >= 48) {
        return "critical";
    }

    if (hours >= 24) {
        return "warning";
    }

    return "normal";
}


/* =====================================================
   STATUS TEXT
   ===================================================== */

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


/* =====================================================
   WAITING ACTION
   ===================================================== */

function getWaitingText(hold) {

    if (hold.status === "RELEASED") {
        return "Completed";
    }

    if (hold.status === "REJECTED") {
        return "Rejected";
    }


    if (hold.workflowType === "inspection") {

        if (hold.status === "INSPECTION_DONE") {

            return "Release / Reject";
        }

        return "Inspection Required";
    }


    if (hold.workflowType === "shadeApproval") {

        if (hold.currentStage === "PRINTING_MANAGER") {
            return "Printing Manager";
        }

        if (hold.currentStage === "QC_MANAGER") {
            return "QC Manager";
        }

        if (hold.currentStage === "GM") {
            return "GM";
        }

        return "Shade Approval";
    }


    if (hold.workflowType === "review") {
        return "Review Required";
    }


    return "-";
}


/* =====================================================
   UPDATE SUMMARY
   ===================================================== */

function updateSummary() {

    const activeHolds =
        allHolds.filter(
            hold =>
                hold.status !== "RELEASED" &&
                hold.status !== "REJECTED"
        );


    const releasedHolds =
        allHolds.filter(
            hold =>
                hold.status === "RELEASED"
        );


    const over24 =
        activeHolds.filter(
            hold => {

                const age =
                    Date.now() -
                    new Date(hold.holdTimestamp).getTime();

                return age >= 24 * 60 * 60 * 1000;
            }
        );


    const over48 =
        activeHolds.filter(
            hold => {

                const age =
                    Date.now() -
                    new Date(hold.holdTimestamp).getTime();

                return age >= 48 * 60 * 60 * 1000;
            }
        );


    const totalWeight =
        activeHolds.reduce(
            (sum, hold) =>
                sum + (Number(hold.netWeight) || 0),
            0
        );


    const activeElement =
        document.getElementById("activeCount");

    const actionElement =
        document.getElementById("actionCount");

    const over24Element =
        document.getElementById("over24Count");

    const over48Element =
        document.getElementById("over48Count");

    const releasedElement =
        document.getElementById("releasedCount");

    const weightElement =
        document.getElementById("totalWeight");


    if (activeElement) {
        activeElement.textContent =
            activeHolds.length;
    }


    if (actionElement) {

        const actionRequired =
            activeHolds.filter(
                hold =>
                    hold.status !== "INSPECTION_DONE"
            );

        actionElement.textContent =
            actionRequired.length;
    }


    if (over24Element) {
        over24Element.textContent =
            over24.length;
    }


    if (over48Element) {
        over48Element.textContent =
            over48.length;
    }


    if (releasedElement) {
        releasedElement.textContent =
            releasedHolds.length;
    }


    if (weightElement) {
        weightElement.textContent =
            `${totalWeight.toFixed(2)} kg`;
    }
}


/* =====================================================
   FILTER HOLDS
   ===================================================== */

function filterHolds(holds) {

    const search =
        searchInput
            ? searchInput.value
                .trim()
                .toLowerCase()
            : "";


    const process =
        processFilter
            ? processFilter.value
            : "";


    const status =
        statusFilter
            ? statusFilter.value
            : "";


    const reason =
        reasonFilter
            ? reasonFilter.value
            : "";


    return holds.filter(hold => {

        const searchableText = [

            hold.jobNo,

            hold.rollNo,

            hold.jobName,

            hold.process,

            hold.machine,

            hold.operator,

            hold.supervisor,

            hold.qcInspector,

            hold.holdReason

        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


        if (
            search &&
            !searchableText.includes(search)
        ) {
            return false;
        }


        if (
            process &&
            hold.process !== process
        ) {
            return false;
        }


        if (
            status &&
            hold.status !== status
        ) {
            return false;
        }


        if (
            reason &&
            hold.holdReason !== reason
        ) {
            return false;
        }


        return true;
    });
}


/* =====================================================
   RENDER ACTIVE HOLDS
   ===================================================== */

function renderActiveHolds() {

    if (!holdList) {
        return;
    }


    const activeHolds =
        allHolds.filter(
            hold =>
                hold.status !== "RELEASED" &&
                hold.status !== "REJECTED"
        );


    const filtered =
        filterHolds(activeHolds);


    if (filtered.length === 0) {

        holdList.innerHTML = `
            <div class="empty-state">
                No active QC hold rolls found.
            </div>
        `;

        return;
    }


    holdList.innerHTML =
        filtered
            .sort(
                (a, b) =>
                    new Date(b.holdTimestamp) -
                    new Date(a.holdTimestamp)
            )
            .map(
                hold =>
                    createHoldCard(hold)
            )
            .join("");
}


/* =====================================================
   RENDER HISTORY
   ===================================================== */

function renderHistory() {

    if (!historyList) {
        return;
    }


    const history =
        allHolds.filter(
            hold =>
                hold.status === "RELEASED" ||
                hold.status === "REJECTED"
        );


    const filtered =
        filterHolds(history);


    if (filtered.length === 0) {

        historyList.innerHTML = `
            <div class="empty-state">
                No hold history found.
            </div>
        `;

        return;
    }


    historyList.innerHTML =
        filtered
            .sort(
                (a, b) =>
                    new Date(b.holdTimestamp) -
                    new Date(a.holdTimestamp)
            )
            .map(
                hold =>
                    createHoldCard(hold)
            )
            .join("");
}


/* =====================================================
   CREATE HOLD CARD
   ===================================================== */

function createHoldCard(hold) {

    const ageClass =
        getAgeClass(
            hold.holdTimestamp,
            hold.releaseTimestamp
        );


    const age =
        getHoldAge(
            hold.holdTimestamp,
            hold.releaseTimestamp
        );


    const status =
        getStatusText(hold.status);


    const waiting =
        getWaitingText(hold);


    return `
        <div class="hold-card ${ageClass}">

            <div class="hold-card-header">

                <div>
                    <div class="hold-job">
                        ${escapeHtml(hold.jobNo || "-")}
                    </div>

                    <div class="hold-roll">
                        Roll: ${escapeHtml(hold.rollNo || "-")}
                    </div>
                </div>

                <div class="hold-status">
                    ${escapeHtml(status)}
                </div>

            </div>


            <div class="hold-card-grid">

                <div>
                    <span>Job Name</span>
                    <strong>
                        ${escapeHtml(hold.jobName || "-")}
                    </strong>
                </div>


                <div>
                    <span>Weight</span>
                    <strong>
                        ${escapeHtml(
                            formatWeight(hold.netWeight)
                        )}
                    </strong>
                </div>


                <div>
                    <span>Process</span>
                    <strong>
                        ${escapeHtml(hold.process || "-")}
                    </strong>
                </div>


                <div>
                    <span>Machine</span>
                    <strong>
                        ${escapeHtml(hold.machine || "-")}
                    </strong>
                </div>


                <div>
                    <span>Shift</span>
                    <strong>
                        ${escapeHtml(hold.shift || "-")}
                    </strong>
                </div>


                <div>
                    <span>QC Inspector</span>
                    <strong>
                        ${escapeHtml(
                            hold.qcInspector || "-"
                        )}
                    </strong>
                </div>


                <div>
                    <span>Hold Reason</span>
                    <strong>
                        ${escapeHtml(
                            hold.holdReason || "-"
                        )}
                    </strong>
                </div>


                <div>
                    <span>Waiting Action</span>
                    <strong>
                        ${escapeHtml(waiting)}
                    </strong>
                </div>

            </div>


            <div class="hold-card-footer">

                <div>
                    <span>Hold Age</span>

                    <strong class="age-value">
                        ${age}
                    </strong>
                </div>


                <button
                    class="view-details-btn"
                    onclick="openDetails('${hold.holdId}')"
                >
                    VIEW DETAILS
                </button>

            </div>

        </div>
    `;
}


/* =====================================================
   ESCAPE HTML
   ===================================================== */

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =====================================================
   OPEN ADD HOLD MODAL
   ===================================================== */

if (addHoldBtn) {

    addHoldBtn.addEventListener(
        "click",
        () => {

            if (addHoldModal) {
                addHoldModal.classList.add("show");
            }
        }
    );
}


/* =====================================================
   CLOSE ADD HOLD MODAL
   ===================================================== */

function closeAddHoldModal() {

    if (addHoldModal) {
        addHoldModal.classList.remove("show");
    }

    if (holdForm) {
        holdForm.reset();
    }
}


if (closeModalBtn) {

    closeModalBtn.addEventListener(
        "click",
        closeAddHoldModal
    );
}


if (cancelHoldBtn) {

    cancelHoldBtn.addEventListener(
        "click",
        closeAddHoldModal
    );
}


/* =====================================================
   CREATE HOLD
   ===================================================== */

if (holdForm) {

    holdForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            try {

                const submitButton =
                    holdForm.querySelector(
                        'button[type="submit"]'
                    );


                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent =
                        "SAVING...";
                }


                const jobNo =
                    document.getElementById("jobNo")
                        ?.value
                        .trim();


                const jobName =
                    document.getElementById("jobName")
                        ?.value
                        .trim();


                const rollNo =
                    document.getElementById("rollNo")
                        ?.value
                        .trim();


                const netWeight =
                    document.getElementById("netWeight")
                        ?.value;


                const process =
                    document.getElementById("process")
                        ?.value;


                const machine =
                    document.getElementById("machine")
                        ?.value
                        .trim();


                const productionDate =
                    document.getElementById("productionDate")
                        ?.value;


                const shift =
                    document.getElementById("shift")
                        ?.value;


                const operator =
                    document.getElementById("operator")
                        ?.value
                        .trim();


                const supervisor =
                    document.getElementById("supervisor")
                        ?.value
                        .trim();


                const qcInspector =
                    document.getElementById("qcInspector")
                        ?.value
                        .trim();


                const holdReason =
                    document.getElementById("holdReason")
                        ?.value;


                const observation =
                    document.getElementById("observation")
                        ?.value
                        .trim();


                const photoInput =
                    document.getElementById("labelPhoto");


                if (!jobNo) {
                    alert("Please enter Job No.");
                    return;
                }


                if (!rollNo) {
                    alert("Please enter Roll No.");
                    return;
                }


                if (!holdReason) {
                    alert("Please select Hold Reason.");
                    return;
                }


                /* -----------------------------------------
                   PHOTO UPLOAD
                   ----------------------------------------- */

                let labelPhoto = "";


                if (
                    photoInput &&
                    photoInput.files &&
                    photoInput.files.length > 0
                ) {

                    const file =
                        photoInput.files[0];


                    const formData =
                        new FormData();


                    formData.append(
                        "file",
                        file
                    );


                    formData.append(
                        "upload_preset",
                        CLOUDINARY_UPLOAD_PRESET
                    );


                    const cloudinaryResponse =
                        await fetch(
                            CLOUDINARY_UPLOAD_URL,
                            {
                                method: "POST",
                                body: formData
                            }
                        );


                    if (
                        !cloudinaryResponse.ok
                    ) {

                        throw new Error(
                            "Photo upload failed."
                        );
                    }


                    const cloudinaryData =
                        await cloudinaryResponse.json();


                    labelPhoto =
                        cloudinaryData.secure_url || "";
                }


                /* -----------------------------------------
                   HOLD ID
                   ----------------------------------------- */

                const holdRef =
                    push(
                        ref(db, "holdRolls")
                    );


                const holdId =
                    holdRef.key;


                /* -----------------------------------------
                   WORKFLOW
                   ----------------------------------------- */

                const workflowType =
                    determineWorkflow(
                        holdReason
                    );


                const workflowState =
                    getInitialWorkflowState(
                        workflowType
                    );


                const holdTimestamp =
                    new Date().toISOString();


                /* -----------------------------------------
                   HOLD DATA
                   ----------------------------------------- */

                const holdData = {

                    holdId,

                    jobNo,

                    jobName,

                    rollNo,

                    netWeight:
                        netWeight || 0,

                    process,

                    machine,

                    productionDate,

                    shift,

                    operator,

                    supervisor,

                    qcInspector,

                    holdReason,

                    observation,

                    labelPhoto,

                    workflowType,

                    status:
                        workflowState.status,

                    currentStage:
                        workflowState.currentStage,

                    holdTimestamp,

                    releaseTimestamp: null,

                    inspectionOperator: null,

                    inspectionCompletedBy: null,

                    inspectionCompletedTimestamp: null,

                    actions: {}

                };


                /* -----------------------------------------
                   SAVE HOLD
                   ----------------------------------------- */

                await set(
                    holdRef,
                    holdData
                );


                /* -----------------------------------------
                   FIRST ACTION
                   ----------------------------------------- */

                const firstActionRef =
                    push(
                        ref(
                            db,
                            `holdRolls/${holdId}/actions`
                        )
                    );


                await set(
                    firstActionRef,
                    {

                        type: "HOLD CREATED",

                        person:
                            qcInspector || supervisor || "QC",

                        decision: "HOLD",

                        remarks:
                            observation || "",

                        timestamp:
                            holdTimestamp
                    }
                );


                alert(
                    `Hold created successfully.\n\nJob: ${jobNo}\nRoll: ${rollNo}`
                );


                closeAddHoldModal();

            }

            catch (error) {

                console.error(
                    "CREATE HOLD ERROR:",
                    error
                );


                alert(
                    "Unable to create hold.\n\n" +
                    error.message
                );

            }

            finally {

                const submitButton =
                    holdForm.querySelector(
                        'button[type="submit"]'
                    );


                if (submitButton) {

                    submitButton.disabled = false;

                    submitButton.textContent =
                        "CREATE HOLD";
                }
            }

        }
    );
}


/* =====================================================
   LOAD HOLDS
   ===================================================== */

function loadHolds() {

    const holdsRef =
        ref(db, "holdRolls");


    onValue(
        holdsRef,
        snapshot => {

            const data =
                snapshot.val();


            if (!data) {

                allHolds = [];

            } else {

                allHolds =
                    Object.values(data);
            }


            updateSummary();

            renderActiveHolds();

            renderHistory();

        },

        error => {

            console.error(
                "FIREBASE LOAD ERROR:",
                error
            );


            if (holdList) {

                holdList.innerHTML = `
                    <div class="empty-state">
                        Unable to load QC hold data.
                    </div>
                `;
            }
        }
    );
}


/* =====================================================
   OPEN DETAILS
   ===================================================== */

window.openDetails =
    function (holdId) {

        currentHoldId =
            holdId;


        const hold =
            allHolds.find(
                item =>
                    item.holdId === holdId
            );


        if (!hold) {

            alert(
                "Hold record not found."
            );

            return;
        }


        renderDetailsModal(hold);


        if (detailsModal) {
            detailsModal.classList.add("show");
        }
    };


/* =====================================================
   CLOSE DETAILS
   ===================================================== */

function closeDetailsModal() {

    currentHoldId = null;

    if (detailsModal) {
        detailsModal.classList.remove("show");
    }
}


if (closeDetailsBtn) {

    closeDetailsBtn.addEventListener(
        "click",
        closeDetailsModal
    );
}


/* =====================================================
   RENDER DETAILS
   ===================================================== */

function renderDetailsModal(hold) {

    if (!detailsContent) {
        return;
    }


    const actions =
        hold.actions
            ? Object.values(hold.actions)
            : [];


    actions.sort(
        (a, b) =>
            new Date(a.timestamp) -
            new Date(b.timestamp)
    );


    detailsContent.innerHTML = `

        <div class="details-header">

            <div>

                <h2>
                    ${escapeHtml(
                        hold.jobNo || "-"
                    )}
                </h2>

                <p>
                    Roll:
                    ${escapeHtml(
                        hold.rollNo || "-"
                    )}
                </p>

            </div>

            <div class="hold-status">
                ${escapeHtml(
                    getStatusText(
                        hold.status
                    )
                )}
            </div>

        </div>


        <div class="details-grid">

            <div>
                <span>Job Name</span>
                <strong>
                    ${escapeHtml(
                        hold.jobName || "-"
                    )}
                </strong>
            </div>


            <div>
                <span>Net Weight</span>
                <strong>
                    ${escapeHtml(
                        formatWeight(
                            hold.netWeight
                        )
                    )}
                </strong>
            </div>


            <div>
                <span>Process</span>
                <strong>
                    ${escapeHtml(
                        hold.process || "-"
                    )}
                </strong>
            </div>


            <div>
                <span>Machine</span>
                <strong>
                    ${escapeHtml(
                        hold.machine || "-"
                    )}
                </strong>
            </div>


            <div>
                <span>Production Date</span>
                <strong>
                    ${escapeHtml(
                        hold.productionDate || "-"
                    )}
                </strong>
            </div>


            <div>
                <span>Shift</span>
                <strong>
                    ${escapeHtml(
                        hold.shift || "-"
                    )}
                </strong>
            </div>


            <div>
                <span>Operator</span>
                <strong>
                    ${escapeHtml(
                        hold.operator || "-"
                    )}
                </strong>
            </div>


            <div>
                <span>Supervisor</span>
                <strong>
                    ${escapeHtml(
                        hold.supervisor || "-"
                    )}
                </strong>
            </div>


            <div>
                <span>QC Inspector</span>
                <strong>
                    ${escapeHtml(
                        hold.qcInspector || "-"
                    )}
                </strong>
            </div>


            <div>
                <span>Hold Reason</span>
                <strong>
                    ${escapeHtml(
                        hold.holdReason || "-"
                    )}
                </strong>
            </div>


            <div>
                <span>Hold Time</span>
                <strong>
                    ${formatDate(
                        hold.holdTimestamp
                    )}
                </strong>
            </div>


            <div>
                <span>Current Age</span>
                <strong>
                    ${getHoldAge(
                        hold.holdTimestamp,
                        hold.releaseTimestamp
                    )}
                </strong>
            </div>

        </div>


        ${
            hold.observation
                ? `
                    <div class="details-section">

                        <h3>
                            QC Observation
                        </h3>

                        <p>
                            ${escapeHtml(
                                hold.observation
                            )}
                        </p>

                    </div>
                `
                : ""
        }


        ${
            hold.labelPhoto
                ? `
                    <div class="details-section">

                        <h3>
                            Roll Label Photo
                        </h3>

                        <img
                            src="${escapeHtml(
                                hold.labelPhoto
                            )}"
                            class="label-photo"
                            alt="Roll Label"
                        >

                    </div>
                `
                : ""
        }


        ${
            hold.workflowType === "inspection"
                ? createInspectionActionPanel(
                    hold
                )
                : ""
        }


        ${
            hold.workflowType === "shadeApproval"
                ? createShadeApprovalPanel(
                    hold
                )
                : ""
        }


        ${
            hold.workflowType === "review"
                ? createReviewPanel(
                    hold
                )
                : ""
        }


        <div class="details-section">

            <h3>
                Action History
            </h3>

            <div class="timeline">

                ${
                    actions.length === 0
                        ? `
                            <div>
                                No actions recorded.
                            </div>
                        `
                        : actions
                            .map(
                                action =>
                                    createTimelineItem(
                                        action,
                                        hold
                                    )
                            )
                            .join("")
                }

            </div>

        </div>
    `;
}


/* =====================================================
   INSPECTION ACTION PANEL
   ===================================================== */

function createInspectionActionPanel(hold) {

    if (
        hold.status === "RELEASED" ||
        hold.status === "REJECTED"
    ) {

        return "";
    }


    if (
        hold.status === "HOLD" ||
        hold.status === "INSPECTION"
    ) {

        return `

            <div class="action-panel">

                <h3>
                    Inspection
                </h3>

                <p>
                    Supervisor must enter the
                    actual inspection operator.
                </p>


                <label>
                    Inspection Operator Name
                </label>

                <input
                    type="text"
                    id="inspectionOperator"
                    placeholder="Enter inspection operator name"
                >


                <label>
                    Supervisor Name
                </label>

                <input
                    type="text"
                    id="inspectionSupervisor"
                    placeholder="Enter supervisor name"
                >


                <label>
                    Remarks
                </label>

                <textarea
                    id="inspectionRemarks"
                    placeholder="Enter inspection remarks"
                ></textarea>


                <button
                    class="primary-action"
                    onclick="markInspectionDone('${hold.holdId}')"
                >
                    ✓ MARK INSPECTION DONE
                </button>

            </div>

        `;
    }


    if (hold.status === "INSPECTION_DONE") {

        return `

            <div class="action-panel">

                <h3>
                    Inspection Completed
                </h3>


                <div class="inspection-completed-box">

                    <p>
                        <strong>
                            Inspection Operator:
                        </strong>

                        ${escapeHtml(
                            hold.inspectionOperator || "-"
                        )}
                    </p>


                    <p>
                        <strong>
                            Completed By:
                        </strong>

                        ${escapeHtml(
                            hold.inspectionCompletedBy || "-"
                        )}
                    </p>


                    <p>
                        <strong>
                            Completed Time:
                        </strong>

                        ${formatDate(
                            hold.inspectionCompletedTimestamp
                        )}
                    </p>

                </div>


                <label>
                    Supervisor Name
                </label>

                <input
                    type="text"
                    id="releaseSupervisor"
                    placeholder="Enter supervisor name"
                >


                <label>
                    Release / Rejection Remarks
                </label>

                <textarea
                    id="releaseRemarks"
                    placeholder="Enter remarks"
                ></textarea>


                <div class="action-buttons">

                    <button
                        class="success-action"
                        onclick="releaseInspectionHold('${hold.holdId}')"
                    >
                        ✓ RELEASE FOR PRODUCTION
                    </button>


                    <button
                        class="danger-action"
                        onclick="rejectInspectionHold('${hold.holdId}')"
                    >
                        ✕ REJECT
                    </button>

                </div>

            </div>

        `;
    }


    return "";
}


/* =====================================================
   MARK INSPECTION DONE
   ===================================================== */

window.markInspectionDone =
    async function (holdId) {

        try {

            const inspectionOperator =
                document.getElementById(
                    "inspectionOperator"
                )
                    ?.value
                    .trim();


            const inspectionSupervisor =
                document.getElementById(
                    "inspectionSupervisor"
                )
                    ?.value
                    .trim();


            const inspectionRemarks =
                document.getElementById(
                    "inspectionRemarks"
                )
                    ?.value
                    .trim();


            if (!inspectionOperator) {

                alert(
                    "Please enter Inspection Operator Name."
                );

                return;
            }


            if (!inspectionSupervisor) {

                alert(
                    "Please enter Supervisor Name."
                );

                return;
            }


            const timestamp =
                new Date().toISOString();


            const holdRef =
                ref(
                    db,
                    `holdRolls/${holdId}`
                );


            await update(
                holdRef,
                {

                    status:
                        "INSPECTION_DONE",

                    currentStage:
                        "RELEASE",

                    inspectionOperator,

                    inspectionCompletedBy:
                        inspectionSupervisor,

                    inspectionCompletedTimestamp:
                        timestamp
                }
            );


            const actionRef =
                push(
                    ref(
                        db,
                        `holdRolls/${holdId}/actions`
                    )
                );


            await set(
                actionRef,
                {

                    type:
                        "INSPECTION COMPLETED",

                    person:
                        inspectionSupervisor,

                    inspectionOperator,

                    decision:
                        "INSPECTION DONE",

                    remarks:
                        inspectionRemarks || "",

                    timestamp
                }
            );


            alert(
                "Inspection marked as completed."
            );

        }

        catch (error) {

            console.error(
                "INSPECTION ERROR:",
                error
            );


            alert(
                "Unable to save inspection.\n\n" +
                error.message
            );
        }
    };


/* =====================================================
   RELEASE INSPECTION HOLD
   ===================================================== */

window.releaseInspectionHold =
    async function (holdId) {

        try {

            const supervisor =
                document.getElementById(
                    "releaseSupervisor"
                )
                    ?.value
                    .trim();


            const remarks =
                document.getElementById(
                    "releaseRemarks"
                )
                    ?.value
                    .trim();


            if (!supervisor) {

                alert(
                    "Please enter Supervisor Name."
                );

                return;
            }


            const timestamp =
                new Date().toISOString();


            const holdRef =
                ref(
                    db,
                    `holdRolls/${holdId}`
                );


            await update(
                holdRef,
                {

                    status:
                        "RELEASED",

                    currentStage:
                        "RELEASED",

                    releaseTimestamp:
                        timestamp
                }
            );


            const actionRef =
                push(
                    ref(
                        db,
                        `holdRolls/${holdId}/actions`
                    )
                );


            await set(
                actionRef,
                {

                    type:
                        "RELEASED FOR PRODUCTION",

                    person:
                        supervisor,

                    decision:
                        "RELEASED",

                    remarks:
                        remarks || "",

                    timestamp
                }
            );


            alert(
                "Roll released for production."
            );

        }

        catch (error) {

            console.error(
                "RELEASE ERROR:",
                error
            );


            alert(
                "Unable to release roll.\n\n" +
                error.message
            );
        }
    };


/* =====================================================
   REJECT INSPECTION HOLD
   ===================================================== */

window.rejectInspectionHold =
    async function (holdId) {

        try {

            const supervisor =
                document.getElementById(
                    "releaseSupervisor"
                )
                    ?.value
                    .trim();


            const remarks =
                document.getElementById(
                    "releaseRemarks"
                )
                    ?.value
                    .trim();


            if (!supervisor) {

                alert(
                    "Please enter Supervisor Name."
                );

                return;
            }


            if (!remarks) {

                alert(
                    "Please enter rejection reason."
                );

                return;
            }


            const timestamp =
                new Date().toISOString();


            const holdRef =
                ref(
                    db,
                    `holdRolls/${holdId}`
                );


            await update(
                holdRef,
                {

                    status:
                        "REJECTED",

                    currentStage:
                        "REJECTED",

                    releaseTimestamp:
                        timestamp
                }
            );


            const actionRef =
                push(
                    ref(
                        db,
                        `holdRolls/${holdId}/actions`
                    )
                );


            await set(
                actionRef,
                {

                    type:
                        "REJECTED",

                    person:
                        supervisor,

                    decision:
                        "REJECTED",

                    remarks,

                    timestamp
                }
            );


            alert(
                "Roll has been rejected."
            );

        }

        catch (error) {

            console.error(
                "REJECTION ERROR:",
                error
            );


            alert(
                "Unable to reject roll.\n\n" +
                error.message
            );
        }
    };


/* =====================================================
   SHADE APPROVAL PANEL
   ===================================================== */

function createShadeApprovalPanel(hold) {

    if (
        hold.status === "RELEASED" ||
        hold.status === "REJECTED"
    ) {

        return "";
    }


    return `

        <div class="action-panel">

            <h3>
                Shade Approval
            </h3>

            <p>
                Current Stage:
                <strong>
                    ${escapeHtml(
                        hold.currentStage || "-"
                    )}
                </strong>
            </p>


            <label>
                Name
            </label>

            <input
                type="text"
                id="shadePerson"
                placeholder="Enter person name"
            >


            <label>
                Remarks
            </label>

            <textarea
                id="shadeRemarks"
                placeholder="Enter remarks"
            ></textarea>


            <div class="action-buttons">

                <button
                    class="success-action"
                    onclick="shadeApprove('${hold.holdId}')"
                >
                    ✓ APPROVE
                </button>


                <button
                    class="danger-action"
                    onclick="shadeReject('${hold.holdId}')"
                >
                    ✕ REJECT
                </button>

            </div>

        </div>

    `;
}


/* =====================================================
   SHADE APPROVE
   ===================================================== */

window.shadeApprove =
    async function (holdId) {

        try {

            const person =
                document.getElementById(
                    "shadePerson"
                )
                    ?.value
                    .trim();


            const remarks =
                document.getElementById(
                    "shadeRemarks"
                )
                    ?.value
                    .trim();


            if (!person) {

                alert(
                    "Please enter name."
                );

                return;
            }


            const hold =
                allHolds.find(
                    item =>
                        item.holdId === holdId
                );


            if (!hold) {
                return;
            }


            const timestamp =
                new Date().toISOString();


            let nextStage =
                "PRINTING_MANAGER";


            let nextStatus =
                "SHADE_APPROVAL";


            if (
                hold.currentStage ===
                "PRINTING_MANAGER"
            ) {

                nextStage =
                    "QC_MANAGER";

            } else if (
                hold.currentStage ===
                "QC_MANAGER"
            ) {

                nextStage =
                    "GM";

            } else if (
                hold.currentStage ===
                "GM"
            ) {

                nextStage =
                    "RELEASED";

                nextStatus =
                    "RELEASED";
            }


            const updates = {

                status:
                    nextStatus,

                currentStage:
                    nextStage
            };


            if (
                nextStatus ===
                "RELEASED"
            ) {

                updates.releaseTimestamp =
                    timestamp;
            }


            await update(
                ref(
                    db,
                    `holdRolls/${holdId}`
                ),
                updates
            );


            const actionRef =
                push(
                    ref(
                        db,
                        `holdRolls/${holdId}/actions`
                    )
                );


            await set(
                actionRef,
                {

                    type:
                        "SHADE APPROVAL",

                    person,

                    decision:
                        "APPROVED",

                    stage:
                        hold.currentStage,

                    remarks:
                        remarks || "",

                    timestamp
                }
            );


            alert(
                nextStatus === "RELEASED"
                    ? "Shade approved. Roll released."
                    : "Approval recorded."
            );

        }

        catch (error) {

            console.error(
                "SHADE APPROVAL ERROR:",
                error
            );


            alert(
                "Unable to save approval.\n\n" +
                error.message
            );
        }
    };


/* =====================================================
   SHADE REJECT
   ===================================================== */

window.shadeReject =
    async function (holdId) {

        try {

            const person =
                document.getElementById(
                    "shadePerson"
                )
                    ?.value
                    .trim();


            const remarks =
                document.getElementById(
                    "shadeRemarks"
                )
                    ?.value
                    .trim();


            if (!person) {

                alert(
                    "Please enter name."
                );

                return;
            }


            if (!remarks) {

                alert(
                    "Please enter rejection reason."
                );

                return;
            }


            const timestamp =
                new Date().toISOString();


            await update(
                ref(
                    db,
                    `holdRolls/${holdId}`
                ),
                {

                    status:
                        "REJECTED",

                    currentStage:
                        "REJECTED",

                    releaseTimestamp:
                        timestamp
                }
            );


            const actionRef =
                push(
                    ref(
                        db,
                        `holdRolls/${holdId}/actions`
                    )
                );


            await set(
                actionRef,
                {

                    type:
                        "SHADE REJECTED",

                    person,

                    decision:
                        "REJECTED",

                    remarks,

                    timestamp
                }
            );


            alert(
                "Shade approval rejected."
            );

        }

        catch (error) {

            console.error(
                "SHADE REJECTION ERROR:",
                error
            );


            alert(
                "Unable to reject shade approval.\n\n" +
                error.message
            );
        }
    };


/* =====================================================
   REVIEW PANEL
   ===================================================== */

function createReviewPanel(hold) {

    if (
        hold.status === "RELEASED" ||
        hold.status === "REJECTED"
    ) {

        return "";
    }


    return `

        <div class="action-panel">

            <h3>
                Review Required
            </h3>


            <label>
                Reviewer Name
            </label>

            <input
                type="text"
                id="reviewPerson"
                placeholder="Enter reviewer name"
            >


            <label>
                Remarks
            </label>

            <textarea
                id="reviewRemarks"
                placeholder="Enter review remarks"
            ></textarea>


            <div class="action-buttons">

                <button
                    class="success-action"
                    onclick="completeReview('${hold.holdId}')"
                >
                    ✓ RELEASE
                </button>


                <button
                    class="danger-action"
                    onclick="rejectReview('${hold.holdId}')"
                >
                    ✕ REJECT
                </button>

            </div>

        </div>

    `;
}


/* =====================================================
   COMPLETE REVIEW
   ===================================================== */

window.completeReview =
    async function (holdId) {

        try {

            const person =
                document.getElementById(
                    "reviewPerson"
                )
                    ?.value
                    .trim();


            const remarks =
                document.getElementById(
                    "reviewRemarks"
                )
                    ?.value
                    .trim();


            if (!person) {

                alert(
                    "Please enter reviewer name."
                );

                return;
            }


            const timestamp =
                new Date().toISOString();


            await update(
                ref(
                    db,
                    `holdRolls/${holdId}`
                ),
                {

                    status:
                        "RELEASED",

                    currentStage:
                        "RELEASED",

                    releaseTimestamp:
                        timestamp
                }
            );


            const actionRef =
                push(
                    ref(
                        db,
                        `holdRolls/${holdId}/actions`
                    )
                );


            await set(
                actionRef,
                {

                    type:
                        "REVIEW COMPLETED",

                    person,

                    decision:
                        "RELEASED",

                    remarks:
                        remarks || "",

                    timestamp
                }
            );


            alert(
                "Review completed. Roll released."
            );

        }

        catch (error) {

            console.error(
                "REVIEW ERROR:",
                error
            );


            alert(
                "Unable to complete review.\n\n" +
                error.message
            );
        }
    };


/* =====================================================
   REJECT REVIEW
   ===================================================== */

window.rejectReview =
    async function (holdId) {

        try {

            const person =
                document.getElementById(
                    "reviewPerson"
                )
                    ?.value
                    .trim();


            const remarks =
                document.getElementById(
                    "reviewRemarks"
                )
                    ?.value
                    .trim();


            if (!person) {

                alert(
                    "Please enter reviewer name."
                );

                return;
            }


            if (!remarks) {

                alert(
                    "Please enter rejection reason."
                );

                return;
            }


            const timestamp =
                new Date().toISOString();


            await update(
                ref(
                    db,
                    `holdRolls/${holdId}`
                ),
                {

                    status:
                        "REJECTED",

                    currentStage:
                        "REJECTED",

                    releaseTimestamp:
                        timestamp
                }
            );


            const actionRef =
                push(
                    ref(
                        db,
                        `holdRolls/${holdId}/actions`
                    )
                );


            await set(
                actionRef,
                {

                    type:
                        "REVIEW REJECTED",

                    person,

                    decision:
                        "REJECTED",

                    remarks,

                    timestamp
                }
            );


            alert(
                "Roll has been rejected."
            );

        }

        catch (error) {

            console.error(
                "REVIEW REJECTION ERROR:",
                error
            );


            alert(
                "Unable to reject roll.\n\n" +
                error.message
            );
        }
    };


/* =====================================================
   TIMELINE ITEM
   ===================================================== */

function createTimelineItem(action, hold) {

    return `

        <div class="timeline-item">

            <div class="timeline-dot"></div>

            <div class="timeline-content">

                <div class="timeline-header">

                    <strong>
                        ${escapeHtml(
                            action.type || "-"
                        )}
                    </strong>

                    <span>
                        ${formatDate(
                            action.timestamp
                        )}
                    </span>

                </div>


                <div class="timeline-person">

                    Person:
                    <strong>
                        ${escapeHtml(
                            action.person || "-"
                        )}
                    </strong>

                </div>


                ${
                    action.inspectionOperator
                        ? `
                            <div>
                                Inspection Operator:
                                <strong>
                                    ${escapeHtml(
                                        action.inspectionOperator
                                    )}
                                </strong>
                            </div>
                        `
                        : ""
                }


                <div>

                    Decision:
                    <strong>
                        ${escapeHtml(
                            action.decision || "-"
                        )}
                    </strong>

                </div>


                ${
                    action.remarks
                        ? `
                            <div class="timeline-remarks">

                                ${escapeHtml(
                                    action.remarks
                                )}

                            </div>
                        `
                        : ""
                }

            </div>

        </div>

    `;
}


/* =====================================================
   TAB SWITCHING
   ===================================================== */

if (activeTab) {

    activeTab.addEventListener(
        "click",
        () => {

            document
                .querySelectorAll(".tab")
                .forEach(tab =>
                    tab.classList.remove("active")
                );


            activeTab.classList.add("active");


            if (holdList) {
                holdList.style.display =
                    "block";
            }


            if (historyList) {
                historyList.style.display =
                    "none";
            }


            renderActiveHolds();
        }
    );
}


if (historyTab) {

    historyTab.addEventListener(
        "click",
        () => {

            document
                .querySelectorAll(".tab")
                .forEach(tab =>
                    tab.classList.remove("active")
                );


            historyTab.classList.add("active");


            if (holdList) {
                holdList.style.display =
                    "none";
            }


            if (historyList) {
                historyList.style.display =
                    "block";
            }


            renderHistory();
        }
    );
}


/* =====================================================
   SEARCH + FILTER EVENTS
   ===================================================== */

if (searchInput) {

    searchInput.addEventListener(
        "input",
        () => {

            renderActiveHolds();

            renderHistory();
        }
    );
}


if (processFilter) {

    processFilter.addEventListener(
        "change",
        () => {

            renderActiveHolds();

            renderHistory();
        }
    );
}


if (statusFilter) {

    statusFilter.addEventListener(
        "change",
        () => {

            renderActiveHolds();

            renderHistory();
        }
    );
}


if (reasonFilter) {

    reasonFilter.addEventListener(
        "change",
        () => {

            renderActiveHolds();

            renderHistory();
        }
    );
}


/* =====================================================
   LIVE AGE REFRESH
   ===================================================== */

setInterval(
    () => {

        updateSummary();

        renderActiveHolds();

        renderHistory();

    },
    60000
);


/* =====================================================
   CLOSE MODALS WHEN CLICKING OUTSIDE
   ===================================================== */

window.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            addHoldModal
        ) {

            closeAddHoldModal();
        }


        if (
            event.target ===
            detailsModal
        ) {

            closeDetailsModal();
        }
    }
);


/* =====================================================
   START APPLICATION
   ===================================================== */

loadHolds();

console.log(
    "Apex QC Hold Monitor loaded successfully."
);
