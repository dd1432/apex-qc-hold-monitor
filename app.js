```javascript
/* =====================================================
   APEX QC HOLD ROLL MONITOR
   Version 2
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
   FIREBASE CONFIGURATION
===================================================== */

const firebaseConfig = {
    apiKey: "AIzaSyBZC1ln8Qxkq_JJBHpMtF8zy850T3rHcg",
    authDomain: "apex-qc-hold-monitor.firebaseapp.com",
    databaseURL: "https://apex-qc-hold-monitor-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "apex-qc-hold-monitor",
    storageBucket: "apex-qc-hold-monitor.firebasestorage.app",
    messagingSenderId: "1006270751442",
    appId: "1:1006270751442:web:dca6ce7f3b3a235ee9030b"
};


/* =====================================================
   INITIALIZE FIREBASE
===================================================== */

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);


/* =====================================================
   CLOUDINARY CONFIGURATION
===================================================== */

const CLOUDINARY_CLOUD_NAME = "org593vv";
const CLOUDINARY_UPLOAD_PRESET = "apex_qc_hold";

const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1/org593vv/image/upload";
/* =====================================================
   GLOBAL VARIABLES
===================================================== */

let allHolds = [];
let currentTab = "active";

let selectedPhotoFile = null;


/* =====================================================
   DOM ELEMENTS
===================================================== */

const addHoldBtn = document.getElementById("addHoldBtn");

const addHoldModal = document.getElementById("addHoldModal");
const closeAddHold = document.getElementById("closeAddHold");
const cancelHold = document.getElementById("cancelHold");

const holdForm = document.getElementById("holdForm");

const labelPhoto = document.getElementById("labelPhoto");
const photoPreview = document.getElementById("photoPreview");

const uploadProgress = document.getElementById("uploadProgress");
const saveHoldBtn = document.getElementById("saveHoldBtn");

const detailsModal = document.getElementById("detailsModal");
const closeDetails = document.getElementById("closeDetails");

const holdList = document.getElementById("holdList");

const searchInput = document.getElementById("searchInput");
const processFilter = document.getElementById("processFilter");
const statusFilter = document.getElementById("statusFilter");
const reasonFilter = document.getElementById("reasonFilter");

const detailsContent =
    document.getElementById("detailsContent");


/* =====================================================
   ADD HOLD MODAL
===================================================== */

addHoldBtn.addEventListener("click", () => {

    addHoldModal.classList.remove("hidden");

});


closeAddHold.addEventListener(
    "click",
    closeAddHoldModal
);

cancelHold.addEventListener(
    "click",
    closeAddHoldModal
);


function closeAddHoldModal() {

    addHoldModal.classList.add("hidden");

    holdForm.reset();

    photoPreview.innerHTML = "";

    selectedPhotoFile = null;

    uploadProgress.classList.add("hidden");

    saveHoldBtn.disabled = false;
    saveHoldBtn.textContent = "SAVE HOLD";

}


/* =====================================================
   PHOTO SELECTION
===================================================== */

labelPhoto.addEventListener("change", () => {

    const file = labelPhoto.files[0];

    if (!file) {

        selectedPhotoFile = null;
        photoPreview.innerHTML = "";

        return;

    }


    selectedPhotoFile = file;


    const reader = new FileReader();

    reader.onload = function(event) {

        photoPreview.innerHTML = `
            <img
                src="${event.target.result}"
                alt="HOLD label preview"
            >
        `;

    };

    reader.readAsDataURL(file);

});


/* =====================================================
   UPLOAD PHOTO TO CLOUDINARY
===================================================== */

async function uploadPhotoToCloudinary(file) {

    const formData = new FormData();

    formData.append(
        "file",
        file
    );

    formData.append(
        "upload_preset",
        CLOUDINARY_UPLOAD_PRESET
    );


    const response = await fetch(
        CLOUDINARY_UPLOAD_URL,
        {
            method: "POST",
            body: formData
        }
    );


    if (!response.ok) {

        throw new Error(
            "Cloudinary photo upload failed."
        );

    }


    const data = await response.json();

    return {
        url: data.secure_url || "",
        publicId: data.public_id || ""
    };

}


/* =====================================================
   DETERMINE WORKFLOW
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
   GET INITIAL STATUS
===================================================== */

function getInitialWorkflowState(workflowType) {

    if (workflowType === "inspection") {

        return {
            status: "HOLD",
            currentStage: "INSPECTION"
        };

    }


    if (workflowType === "shadeApproval") {

        return {
            status: "SHADE_APPROVAL",
            currentStage: "PRINTING_MANAGER"
        };

    }


    return {
        status: "REVIEW",
        currentStage: "REVIEW"
    };

}


/* =====================================================
   CREATE HOLD
===================================================== */

holdForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        if (!selectedPhotoFile) {

            alert(
                "Please upload a clear photo of the HOLD label."
            );

            return;

        }


        try {

            saveHoldBtn.disabled = true;

            saveHoldBtn.textContent =
                "UPLOADING PHOTO...";

            uploadProgress.classList.remove(
                "hidden"
            );

            uploadProgress.textContent =
                "Uploading HOLD label photo...";


            /* -----------------------------------------
               UPLOAD PHOTO
            ----------------------------------------- */

            const photoData =
                await uploadPhotoToCloudinary(
                    selectedPhotoFile
                );


            uploadProgress.textContent =
                "Saving hold information...";


            /* -----------------------------------------
               FORM VALUES
            ----------------------------------------- */

            const jobNo =
                document
                    .getElementById("jobNo")
                    .value
                    .trim();

            const jobName =
                document
                    .getElementById("jobName")
                    .value
                    .trim();

            const rollNo =
                document
                    .getElementById("rollNo")
                    .value
                    .trim();

            const netWeight =
                Number(
                    document
                        .getElementById("netWeight")
                        .value
                );

            const process =
                document
                    .getElementById("process")
                    .value;

            const machine =
                document
                    .getElementById("machine")
                    .value
                    .trim();

            const productionDate =
                document
                    .getElementById("productionDate")
                    .value;

            const shift =
                document
                    .getElementById("shift")
                    .value;

            const operator =
                document
                    .getElementById("operator")
                    .value
                    .trim();

            const supervisor =
                document
                    .getElementById("supervisor")
                    .value
                    .trim();

            const qcInspector =
                document
                    .getElementById("qcInspector")
                    .value
                    .trim();

            const holdReason =
                document
                    .getElementById("holdReason")
                    .value;

            const observation =
                document
                    .getElementById("observation")
                    .value
                    .trim();


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


            /* -----------------------------------------
               DATABASE REFERENCE
            ----------------------------------------- */

            const holdRef =
                push(
                    ref(
                        db,
                        "holdRolls"
                    )
                );

            const holdId =
                holdRef.key;


            const holdTimestamp =
                Date.now();


            /* -----------------------------------------
               FIRST TIMELINE ACTION
            ----------------------------------------- */

            const firstActionRef =
                push(
                    ref(
                        db,
                        `holdRolls/${holdId}/actions`
                    )
                );


            const firstAction = {

                type: "HOLD CREATED",

                person: qcInspector,

                decision: "HOLD",

                remarks: observation,

                timestamp: holdTimestamp

            };


            /* -----------------------------------------
               COMPLETE RECORD
            ----------------------------------------- */

            const holdData = {

                holdId,

                jobNo,

                jobName,

                rollNo,

                netWeight,

                process,

                machine,

                productionDate,

                shift,

                operator,

                supervisor,

                qcInspector,

                holdReason,

                observation,

                labelPhoto: {

                    url: photoData.url,

                    publicId: photoData.publicId

                },

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

                actions: {

                    [firstActionRef.key]:
                        firstAction

                }

            };


            /* -----------------------------------------
               SAVE
            ----------------------------------------- */

            await set(
                holdRef,
                holdData
            );

alert(
    `Hold created successfully.\n\nJob: ${jobNo}\nRoll: ${rollNo}`
);

            closeAddHoldModal();


        } catch (error) {

            console.error(error);

            alert(
                "Unable to save the hold.\n\n" +
                error.message
            );


            saveHoldBtn.disabled = false;

            saveHoldBtn.textContent =
                "SAVE HOLD";

            uploadProgress.classList.add(
                "hidden"
            );

        }

    }
);


/* =====================================================
   LOAD HOLDS
===================================================== */

function loadHolds() {

    const holdsRef =
        ref(
            db,"holdRolls"
        );


    onValue(
        holdsRef,
        (snapshot) => {

            const data =
                snapshot.val();


            if (!data) {

                allHolds = [];

            } else {

                allHolds =
                    Object.values(data);

            }


            updateDashboard();

            renderHolds();

        },
        (error) => {

            console.error(error);

            holdList.innerHTML = `
                <div class="empty-state">
                    Unable to load QC hold data.
                </div>
            `;

        }
    );

}


loadHolds();


/* =====================================================
   DASHBOARD SUMMARY
===================================================== */

function updateDashboard() {

    const active =
        allHolds.filter(
            hold =>
                hold.status !== "RELEASED" &&
                hold.status !== "REJECTED"
        );


    const released =
        allHolds.filter(
            hold =>
                hold.status === "RELEASED"
        );


    const over24 =
        active.filter(
            hold =>
                getAgeHours(hold) >= 24
        );


    const over48 =
        active.filter(
            hold =>
                getAgeHours(hold) >= 48
        );


    const totalWeight =
        active.reduce(
            (sum, hold) =>
                sum +
                Number(
                    hold.netWeight || 0
                ),
            0
        );


    document.getElementById(
        "activeCount"
    ).textContent =
        active.length;


    document.getElementById(
        "actionCount"
    ).textContent =
        active.length;


    document.getElementById(
        "over24Count"
    ).textContent =
        over24.length;


    document.getElementById(
        "over48Count"
    ).textContent =
        over48.length;


    document.getElementById(
        "releasedCount"
    ).textContent =
        released.length;


    document.getElementById(
        "totalWeight"
    ).textContent =
        totalWeight.toFixed(2);

}


/* =====================================================
   AGE CALCULATION
===================================================== */

function getAgeHours(hold) {

    const start =
        Number(
            hold.holdTimestamp ||
            Date.now()
        );


    const end =
        hold.releaseTimestamp
            ? Number(
                hold.releaseTimestamp
            )
            : Date.now();


    return (
        end - start
    ) /
    (1000 * 60 * 60);

}


/* =====================================================
   FORMAT AGE
===================================================== */

function formatAge(hold) {

    const hours =
        getAgeHours(hold);


    const totalMinutes =
        Math.floor(
            hours * 60
        );


    const days =
        Math.floor(
            totalMinutes / 1440
        );


    const remainingAfterDays =
        totalMinutes % 1440;


    const h =
        Math.floor(
            remainingAfterDays / 60
        );


    const m =
        remainingAfterDays % 60;


    let text = "";


    if (days > 0) {

        text += `${days}d `;

    }


    text += `${h}h ${m}m`;


    return {

        text,

        className:
            hours >= 48
                ? "critical"
                : hours >= 24
                    ? "warning"
                    : "normal"

    };

}


/* =====================================================
   FORMAT DATE/TIME
===================================================== */

function formatDateTime(timestamp) {

    if (!timestamp) {

        return "-";

    }


    return new Date(timestamp)
        .toLocaleString(
            "en-IN",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

}


/* =====================================================
   STATUS TEXT
===================================================== */

function statusText(status) {

    const map = {

        HOLD: "HOLD",

        INSPECTION: "INSPECTION REQUIRED",

        INSPECTION_DONE: "INSPECTION DONE",

        SHADE_APPROVAL:
            "SHADE APPROVAL",

        REVIEW: "REVIEW",

        RELEASED: "RELEASED",

        REJECTED: "REJECTED"

    };


    return map[status] || status;

}


/* =====================================================
   CURRENT WAITING ACTION
===================================================== */

function getWaitingText(hold) {

    if (
        hold.status === "RELEASED" ||
        hold.status === "REJECTED"
    ) {

        return hold.status;

    }


    if (
        hold.workflowType ===
        "inspection"
    ) {

        if (
            hold.status ===
            "INSPECTION_DONE"
        ) {

            return "Inspection completed — Release / Reject";

        }


        return "Inspection required";

    }


    if (
        hold.workflowType ===
        "shadeApproval"
    ) {

        if (
            hold.currentStage ===
            "PRINTING_MANAGER"
        ) {

            return "Waiting for Printing Manager";

        }


        if (
            hold.currentStage ===
            "QC_MANAGER"
        ) {

            return "Waiting for QC Manager";

        }


        if (
            hold.currentStage ===
            "GM"
        ) {

            return "Waiting for GM";

        }

    }


    if (
        hold.workflowType ===
        "review"
    ) {

        return "Review required";

    }


    return "Action required";

}


/* =====================================================
   FILTER HOLDS
===================================================== */

function getFilteredHolds() {

    const search =
        searchInput.value
            .trim()
            .toLowerCase();


    const process =
        processFilter.value;


    const status =
        statusFilter.value;


    const reason =
        reasonFilter.value;


    return allHolds.filter(
        hold => {

            const isActive =
                hold.status !== "RELEASED" &&
                hold.status !== "REJECTED";


            const matchesTab =
                currentTab === "active"
                    ? isActive
                    : !isActive;


            const searchableText =
                [
                    hold.jobNo,
                    hold.jobName,
                    hold.rollNo
                ]
                    .join(" ")
                    .toLowerCase();


            const matchesSearch =
                !search ||
                searchableText.includes(
                    search
                );


            const matchesProcess =
                !process ||
                hold.process === process;


            const matchesStatus =
                !status ||
                hold.status === status;


            const matchesReason =
                !reason ||
                hold.holdReason === reason;


            return (
                matchesTab &&
                matchesSearch &&
                matchesProcess &&
                matchesStatus &&
                matchesReason
            );

        }
    );

}


/* =====================================================
   RENDER HOLD LIST
===================================================== */

function renderHolds() {

    const holds =
        getFilteredHolds();


    if (holds.length === 0) {

        holdList.innerHTML = `
            <div class="empty-state">
                ${
                    currentTab === "active"
                        ? "No active QC holds."
                        : "No hold history available."
                }
            </div>
        `;

        return;

    }


    holds.sort(
        (a, b) =>
            Number(
                b.holdTimestamp || 0
            ) -
            Number(
                a.holdTimestamp || 0
            )
    );


    holdList.innerHTML =
        holds
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

    const isClosed =
        hold.status === "RELEASED" ||
        hold.status === "REJECTED";


    const age =
        formatAge(hold);


    const cardClass =
        isClosed
            ? hold.status === "RELEASED"
                ? "released"
                : "rejected"
            : age.className;


    return `

        <div class="hold-card ${cardClass}">

            <div class="hold-top">

                <div>

                    <div class="hold-title">

                        ${escapeHtml(
                            hold.jobNo || "-"
                        )}

                        —

                        Roll

                        ${escapeHtml(
                            hold.rollNo || "-"
                        )}

                    </div>


                    <div class="hold-subtitle">

                        ${escapeHtml(
                            hold.jobName || "-"
                        )}

                    </div>

                </div>


                <div>

                    <span
                        class="status-badge status-${hold.status}"
                    >

                        ${statusText(
                            hold.status
                        )}

                    </span>

                </div>

            </div>


            <div class="hold-info-grid">

                ${infoBox(
                    "Net Weight",
                    `${Number(
                        hold.netWeight || 0
                    ).toFixed(2)} kg`
                )}

                ${infoBox(
                    "Process",
                    hold.process || "-"
                )}

                ${infoBox(
                    "Machine",
                    hold.machine || "-"
                )}

                ${infoBox(
                    "Shift",
                    hold.shift || "-"
                )}

                ${infoBox(
                    "QC Inspector",
                    hold.qcInspector || "-"
                )}

                ${infoBox(
                    "Hold Time",
                    formatDateTime(
                        hold.holdTimestamp
                    )
                )}

            </div>


            <div class="hold-reason">

                <strong>Reason:</strong>

                ${escapeHtml(
                    hold.holdReason || "-"
                )}

                <br>

                <strong>Observation:</strong>

                ${escapeHtml(
                    hold.observation || "-"
                )}

            </div>


            <div class="waiting">

                ${escapeHtml(
                    getWaitingText(hold)
                )}

            </div>


            <div class="hold-bottom">

                <div
                    class="age ${age.className}"
                >

                    ${
                        isClosed
                            ? "Total Hold Time: "
                            : "Age: "
                    }

                    ${age.text}

                </div>


                <button
                    class="view-btn"
                    onclick="window.openHoldDetails('${hold.holdId}')"
                >
                    VIEW DETAILS
                </button>

            </div>

        </div>

    `;

}


/* =====================================================
   INFO BOX
===================================================== */

function infoBox(label, value) {

    return `

        <div class="info-box">

            <span class="info-label">

                ${escapeHtml(
                    label
                )}

            </span>


            <span class="info-value">

                ${escapeHtml(
                    value
                )}

            </span>

        </div>

    `;

}


/* =====================================================
   DETAILS MODAL
===================================================== */

window.openHoldDetails = function(holdId) {

    const hold =
        allHolds.find(
            item =>
                item.holdId === holdId
        );


    if (!hold) {

        return;

    }


    detailsModal.classList.remove(
        "hidden"
    );


    renderDetailsModal(
        hold
    );

};


/* =====================================================
   RENDER DETAILS MODAL
===================================================== */

function renderDetailsModal(hold) {

    const actions =
        hold.actions
            ? Object.values(
                hold.actions
            ).sort(
                (a, b) =>
                    Number(
                        a.timestamp || 0
                    ) -
                    Number(
                        b.timestamp || 0
                    )
            )
            : [];


    detailsContent.innerHTML = `

        <div class="details-section">

            <h3>Hold Information</h3>


            <div class="details-grid">

                ${detailItem(
                    "Job Number",
                    hold.jobNo
                )}

                ${detailItem(
                    "Job Name",
                    hold.jobName
                )}

                ${detailItem(
                    "Roll Number",
                    hold.rollNo
                )}

                ${detailItem(
                    "Net Weight",
                    `${Number(
                        hold.netWeight || 0
                    ).toFixed(2)} kg`
                )}

                ${detailItem(
                    "Process",
                    hold.process
                )}

                ${detailItem(
                    "Machine",
                    hold.machine
                )}

                ${detailItem(
                    "Production Date",
                    hold.productionDate
                )}

                ${detailItem(
                    "Shift",
                    hold.shift
                )}

                ${detailItem(
                    "Operator",
                    hold.operator
                )}

                ${detailItem(
                    "Supervisor",
                    hold.supervisor
                )}

                ${detailItem(
                    "QC Inspector",
                    hold.qcInspector
                )}

                ${detailItem(
                    "Hold Reason",
                    hold.holdReason
                )}

                ${detailItem(
                    "Status",
                    statusText(
                        hold.status
                    )
                )}

                ${detailItem(
                    "Current Stage",
                    hold.currentStage
                )}

                ${detailItem(
                    "Hold Time",
                    formatDateTime(
                        hold.holdTimestamp
                    )
                )}

                ${detailItem(
                    "Release Time",
                    formatDateTime(
                        hold.releaseTimestamp
                    )
                )}

            </div>

        </div>


        <div class="details-section">

            <h3>Observation</h3>

            <div>

                ${escapeHtml(
                    hold.observation || "-"
                )}

            </div>

        </div>


        ${
            hold.labelPhoto &&
            hold.labelPhoto.url
                ? `
                    <div class="details-section">

                        <h3>
                            HOLD Label Photo
                        </h3>


                        <img
                            class="detail-photo"
                            src="${escapeHtml(
                                hold.labelPhoto.url
                            )}"
                            alt="HOLD label"
                        >

                    </div>
                `
                : ""
        }


        ${
            hold.workflowType ===
            "inspection"
                ? createInspectionActionPanel(
                    hold
                )
                : ""
        }


        <div class="details-section">

            <h3>Action Timeline</h3>

            ${
                actions.length
                    ? `
                        <div class="timeline">

                            ${actions
                                .map(
                                    action =>
                                        timelineItem(
                                            action
                                        )
                                )
                                .join("")}

                        </div>
                    `
                    : `
                        <div>
                            No actions recorded.
                        </div>
                    `
            }

        </div>

    `;

}


/* =====================================================
   INSPECTION ACTION PANEL
===================================================== */

function createInspectionActionPanel(hold) {

    if (
        hold.status ===
        "RELEASED"
    ) {

        return "";

    }


    if (
        hold.status ===
        "REJECTED"
    ) {

        return "";

    }


    /* ---------------------------------------------
       INSPECTION NOT YET COMPLETED
    --------------------------------------------- */

    if (
        hold.status ===
        "HOLD" ||
        hold.status ===
        "INSPECTION"
    ) {

        return `

            <div
                class="details-section"
                style="
                    border: 2px solid #d97706;
                    background: #fffaf0;
                    border-radius: 10px;
                    padding: 18px;
                "
            >

                <h3>
                    Inspection Action Required
                </h3>


                <p style="margin-top:0;">

                    This roll needs to be inspected.
                    The inspection operator does not
                    need to use this website.

                </p>


                <div
                    style="
                        display:grid;
                        gap:12px;
                        margin-top:15px;
                    "
                >

                    <div>

                        <label
                            style="
                                display:block;
                                font-weight:600;
                                margin-bottom:5px;
                            "
                        >
                            Inspection Operator Name
                        </label>


                        <input
                            type="text"
                            id="inspectionOperatorName"
                            placeholder="Enter actual inspection operator name"
                            style="
                                width:100%;
                                padding:10px;
                                border:1px solid #ccc;
                                border-radius:6px;
                                box-sizing:border-box;
                            "
                        >

                    </div>


                    <div>

                        <label
                            style="
                                display:block;
                                font-weight:600;
                                margin-bottom:5px;
                            "
                        >
                            Supervisor Name
                        </label>


                        <input
                            type="text"
                            id="inspectionSupervisorName"
                            placeholder="Enter supervisor name"
                            style="
                                width:100%;
                                padding:10px;
                                border:1px solid #ccc;
                                border-radius:6px;
                                box-sizing:border-box;
                            "
                        >

                    </div>


                    <div>

                        <label
                            style="
                                display:block;
                                font-weight:600;
                                margin-bottom:5px;
                            "
                        >
                            Remarks
                        </label>


                        <textarea
                            id="inspectionRemarks"
                            rows="3"
                            placeholder="Optional inspection remarks"
                            style="
                                width:100%;
                                padding:10px;
                                border:1px solid #ccc;
                                border-radius:6px;
                                box-sizing:border-box;
                                resize:vertical;
                            "
                        ></textarea>

                    </div>


                    <button
                        type="button"
                        onclick="window.markInspectionDone('${hold.holdId}')"
                        style="
                            padding:12px 16px;
                            border:none;
                            border-radius:7px;
                            background:#2563eb;
                            color:white;
                            font-weight:700;
                            cursor:pointer;
                        "
                    >
                        ✓ MARK INSPECTION DONE
                    </button>

                </div>

            </div>

        `;

    }


    /* ---------------------------------------------
       INSPECTION COMPLETED
    --------------------------------------------- */

    if (
        hold.status ===
        "INSPECTION_DONE"
    ) {

        return `

            <div
                class="details-section"
                style="
                    border: 2px solid #16a34a;
                    background: #f0fdf4;
                    border-radius: 10px;
                    padding: 18px;
                "
            >

                <h3>
                    Inspection Completed
                </h3>


                <div
                    style="
                        display:grid;
                        gap:8px;
                        margin-bottom:16px;
                    "
                >

                    ${detailItem(
                        "Inspection Operator",
                        hold.inspectionOperator
                    )}

                    ${detailItem(
                        "Entered By Supervisor",
                        hold.inspectionCompletedBy
                    )}

                    ${detailItem(
                        "Inspection Completed",
                        formatDateTime(
                            hold.inspectionCompletedTimestamp
                        )
                    )}

                </div>


                <div
                    style="
                        display:grid;
                        gap:12px;
                    "
                >

                    <div>

                        <label
                            style="
                                display:block;
                                font-weight:600;
                                margin-bottom:5px;
                            "
                        >
                            Supervisor Name
                        </label>


                        <input
                            type="text"
                            id="releaseSupervisorName"
                            placeholder="Enter supervisor name"
                            style="
                                width:100%;
                                padding:10px;
                                border:1px solid #ccc;
                                border-radius:6px;
                                box-sizing:border-box;
                            "
                        >

                    </div>


                    <div>

                        <label
                            style="
                                display:block;
                                font-weight:600;
                                margin-bottom:5px;
                            "
                        >
                            Release / Rejection Remarks
                        </label>


                        <textarea
                            id="releaseRemarks"
                            rows="3"
                            placeholder="Enter remarks"
                            style="
                                width:100%;
                                padding:10px;
                                border:1px solid #ccc;
                                border-radius:6px;
                                box-sizing:border-box;
                                resize:vertical;
                            "
                        ></textarea>

                    </div>


                    <div
                        style="
                            display:flex;
                            gap:10px;
                            flex-wrap:wrap;
                        "
                    >

                        <button
                            type="button"
                            onclick="window.releaseInspectionHold('${hold.holdId}')"
                            style="
                                flex:1;
                                min-width:200px;
                                padding:12px 16px;
                                border:none;
                                border-radius:7px;
                                background:#16a34a;
                                color:white;
                                font-weight:700;
                                cursor:pointer;
                            "
                        >
                            ✓ RELEASE FOR PRODUCTION
                        </button>


                        <button
                            type="button"
                            onclick="window.rejectInspectionHold('${hold.holdId}')"
                            style="
                                flex:1;
                                min-width:150px;
                                padding:12px 16px;
                                border:none;
                                border-radius:7px;
                                background:#dc2626;
                                color:white;
                                font-weight:700;
                                cursor:pointer;
                            "
                        >
                            ✕ REJECT
                        </button>

                    </div>

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
    async function(holdId) {

        const hold =
            allHolds.find(
                item =>
                    item.holdId ===
                    holdId
            );


        if (!hold) {

            alert(
                "Hold record not found."
            );

            return;

        }


        const operatorInput =
            document.getElementById(
                "inspectionOperatorName"
            );

        const supervisorInput =
            document.getElementById(
                "inspectionSupervisorName"
            );

        const remarksInput =
            document.getElementById(
                "inspectionRemarks"
            );


        const inspectionOperator =
            operatorInput
                ? operatorInput.value.trim()
                : "";


        const supervisor =
            supervisorInput
                ? supervisorInput.value.trim()
                : "";


        const remarks =
            remarksInput
                ? remarksInput.value.trim()
                : "";


        if (!inspectionOperator) {

            alert(
                "Please enter the inspection operator name."
            );

            return;

        }


        if (!supervisor) {

            alert(
                "Please enter the supervisor name."
            );

            return;

        }


        const timestamp =
            Date.now();


        const actionRef =
            push(
                ref(
                    db,
                    `holdRolls/${holdId}/actions`
                )
            );


        const updates = {

            status:
                "INSPECTION_DONE",

            currentStage:
                "RELEASE",

            inspectionOperator,

            inspectionCompletedBy:
                supervisor,

            inspectionCompletedTimestamp:
                timestamp,

            [`actions/${actionRef.key}`]: {

                type:
                    "INSPECTION DONE",

                person:
                    supervisor,

                decision:
                    "INSPECTION COMPLETED",

                inspectionOperator,

                remarks,

                timestamp

            }

        };


        try {

            await update(
                ref(
                    db,
                    `holdRolls/${holdId}`
                ),
                updates
            );


            alert(
                "Inspection marked as completed."
            );


            renderDetailsModal(
                {
                    ...hold,
                    ...updates,
                    actions: {
                        ...(hold.actions || {}),
                        [actionRef.key]:
                            updates[
                                `actions/${actionRef.key}`
                            ]
                    }
                }
            );


        } catch (error) {

            console.error(error);

            alert(
                "Unable to save inspection action.\n\n" +
                error.message
            );

        }

    };


/* =====================================================
   RELEASE INSPECTION HOLD
===================================================== */

window.releaseInspectionHold =
    async function(holdId) {

        const hold =
            allHolds.find(
                item =>
                    item.holdId ===
                    holdId
            );


        if (!hold) {

            alert(
                "Hold record not found."
            );

            return;

        }


        if (
            hold.status !==
            "INSPECTION_DONE"
        ) {

            alert(
                "Inspection must be completed before release."
            );

            return;

        }


        const supervisorInput =
            document.getElementById(
                "releaseSupervisorName"
            );


        const remarksInput =
            document.getElementById(
                "releaseRemarks"
            );


        const supervisor =
            supervisorInput
                ? supervisorInput.value.trim()
                : "";


        const remarks =
            remarksInput
                ? remarksInput.value.trim()
                : "";


        if (!supervisor) {

            alert(
                "Please enter the supervisor name."
            );

            return;

        }


        const timestamp =
            Date.now();


        const actionRef =
            push(
                ref(
                    db,
                    `holdRolls/${holdId}/actions`
                )
            );


        const action = {

            type:
                "RELEASED FOR PRODUCTION",

            person:
                supervisor,

            decision:
                "RELEASED",

            remarks,

            timestamp

        };


        const updates = {

            status:
                "RELEASED",

            currentStage:
                "RELEASED",

            releaseTimestamp:
                timestamp,

            [`actions/${actionRef.key}`]:
                action

        };


        try {

            await update(
                ref(
                    db,
                    `holdRolls/${holdId}`
                ),
                updates
            );


            alert(
                "Roll released for further production."
            );


            detailsModal.classList.add(
                "hidden"
            );


        } catch (error) {

            console.error(error);

            alert(
                "Unable to release the roll.\n\n" +
                error.message
            );

        }

    };


/* =====================================================
   REJECT INSPECTION HOLD
===================================================== */

window.rejectInspectionHold =
    async function(holdId) {

        const hold =
            allHolds.find(
                item =>
                    item.holdId ===
                    holdId
            );


        if (!hold) {

            alert(
                "Hold record not found."
            );

            return;

        }


        if (
            hold.status !==
            "INSPECTION_DONE"
        ) {

            alert(
                "Inspection must be completed before rejection."
            );

            return;

        }


        const supervisorInput =
            document.getElementById(
                "releaseSupervisorName"
            );


        const remarksInput =
            document.getElementById(
                "releaseRemarks"
            );


        const supervisor =
            supervisorInput
                ? supervisorInput.value.trim()
                : "";


        const remarks =
            remarksInput
                ? remarksInput.value.trim()
                : "";


        if (!supervisor) {

            alert(
                "Please enter the supervisor name."
            );

            return;

        }


        if (!remarks) {

            alert(
                "Please enter the rejection reason in Remarks."
            );

            return;

        }


        const timestamp =
            Date.now();


        const actionRef =
            push(
                ref(
                    db,
                    `holdRolls/${holdId}/actions`
                )
            );


        const action = {

            type:
                "REJECTED",

            person:
                supervisor,

            decision:
                "REJECTED",

            remarks,

            timestamp

        };


        const updates = {

            status:
                "REJECTED",

            currentStage:
                "REJECTED",

            releaseTimestamp:
                timestamp,

            [`actions/${actionRef.key}`]:
                action

        };


        try {

            await update(
                ref(
                    db,
                    `holdRolls/${holdId}`
                ),
                updates
            );


            alert(
                "Roll marked as REJECTED."
            );


            detailsModal.classList.add(
                "hidden"
            );


        } catch (error) {

            console.error(error);

            alert(
                "Unable to reject the roll.\n\n" +
                error.message
            );

        }

    };


/* =====================================================
   DETAIL ITEM
===================================================== */

function detailItem(label, value) {

    return `

        <div class="detail-item">

            <span class="label">

                ${escapeHtml(
                    label
                )}

            </span>


            <span class="value">

                ${escapeHtml(
                    value || "-"
                )}

            </span>

        </div>

    `;

}


/* =====================================================
   TIMELINE ITEM
===================================================== */

function timelineItem(action) {

    return `

        <div class="timeline-item">

            <div class="timeline-action">

                ${escapeHtml(
                    action.type || "-"
                )}

                ${
                    action.decision
                        ? ` — ${escapeHtml(
                            action.decision
                        )}`
                        : ""
                }

            </div>


            <div class="timeline-person">

                By:

                ${escapeHtml(
                    action.person || "-"
                )}

                ${
                    action.inspectionOperator
                        ? `
                            <br>
                            Inspection Operator:
                            ${escapeHtml(
                                action.inspectionOperator
                            )}
                        `
                        : ""
                }

            </div>


            <div class="timeline-time">

                ${formatDateTime(
                    action.timestamp
                )}

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

    `;

}


/* =====================================================
   CLOSE DETAILS
===================================================== */

closeDetails.addEventListener(
    "click",
    () => {

        detailsModal.classList.add(
            "hidden"
        );

    }
);


/* =====================================================
   FILTER EVENTS
===================================================== */

searchInput.addEventListener(
    "input",
    renderHolds
);

processFilter.addEventListener(
    "change",
    renderHolds
);

statusFilter.addEventListener(
    "change",
    renderHolds
);

reasonFilter.addEventListener(
    "change",
    renderHolds
);


/* =====================================================
   TAB EVENTS
===================================================== */

document
    .querySelectorAll(".tab")
    .forEach(
        tab => {

            tab.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(".tab")
                        .forEach(
                            item =>
                                item.classList.remove(
                                    "active"
                                )
                        );


                    tab.classList.add(
                        "active"
                    );


                    currentTab =
                        tab.dataset.tab;


                    renderHolds();

                }
            );

        }
    );


/* =====================================================
   AUTO REFRESH AGE DISPLAY
===================================================== */

setInterval(
    () => {

        updateDashboard();

        renderHolds();

    },
    60 * 1000
);


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

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


/* =====================================================
   INITIALIZE
===================================================== */

console.log(
    "Apex QC Hold Roll Monitor Version 2 loaded."
);
```
