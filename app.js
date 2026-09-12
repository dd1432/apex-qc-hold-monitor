/* =====================================================
   APEX QC HOLD ROLL MONITOR
   Version 1
===================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getDatabase,
    ref,
    push,
    set,
    onValue
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";


/* =====================================================
   FIREBASE CONFIGURATION
===================================================== */

const firebaseConfig = {
    apiKey: "AIzaSyBZC1ln8lQxkq_JJBHpMtF8zy850T3rHcg",
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

const CLOUDINARY_UPLOAD_URL =
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;


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


/* =====================================================
   ADD HOLD MODAL
===================================================== */

addHoldBtn.addEventListener("click", () => {

    addHoldModal.classList.remove("hidden");

});


closeAddHold.addEventListener("click", closeAddHoldModal);

cancelHold.addEventListener("click", closeAddHoldModal);


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

    reader.onload = function (event) {

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

holdForm.addEventListener("submit", async (event) => {

    event.preventDefault();


    if (!selectedPhotoFile) {

        alert("Please upload a clear photo of the HOLD label.");

        return;

    }


    try {

        saveHoldBtn.disabled = true;

        saveHoldBtn.textContent = "UPLOADING PHOTO...";

        uploadProgress.classList.remove("hidden");

        uploadProgress.textContent =
            "Uploading HOLD label photo...";


        /* ---------------------------------------------
           UPLOAD PHOTO
        --------------------------------------------- */

        const photoData =
            await uploadPhotoToCloudinary(
                selectedPhotoFile
            );


        uploadProgress.textContent =
            "Saving hold information...";


        /* ---------------------------------------------
           FORM VALUES
        --------------------------------------------- */

        const jobNo =
            document.getElementById("jobNo").value.trim();

        const jobName =
            document.getElementById("jobName").value.trim();

        const rollNo =
            document.getElementById("rollNo").value.trim();

        const netWeight =
            Number(
                document.getElementById("netWeight").value
            );

        const process =
            document.getElementById("process").value;

        const machine =
            document.getElementById("machine").value.trim();

        const productionDate =
            document.getElementById("productionDate").value;

        const shift =
            document.getElementById("shift").value;

        const operator =
            document.getElementById("operator").value.trim();

        const supervisor =
            document.getElementById("supervisor").value.trim();

        const qcInspector =
            document.getElementById("qcInspector").value.trim();

        const holdReason =
            document.getElementById("holdReason").value;

        const observation =
            document.getElementById("observation").value.trim();


        /* ---------------------------------------------
           WORKFLOW
        --------------------------------------------- */

        const workflowType =
            determineWorkflow(holdReason);

        const workflowState =
            getInitialWorkflowState(
                workflowType
            );


        /* ---------------------------------------------
           DATABASE REFERENCE
        --------------------------------------------- */

        const holdRef =
            push(
                ref(db, "holdRolls")
            );

        const holdId =
            holdRef.key;


        const holdTimestamp =
            Date.now();


        /* ---------------------------------------------
           FIRST TIMELINE ACTION
        --------------------------------------------- */

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


        /* ---------------------------------------------
           COMPLETE RECORD
        --------------------------------------------- */

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

            status: workflowState.status,

            currentStage: workflowState.currentStage,

            holdTimestamp,

            releaseTimestamp: null,

            actions: {

                [firstActionRef.key]: firstAction

            }

        };


        /* ---------------------------------------------
           SAVE
        --------------------------------------------- */

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

        uploadProgress.classList.add("hidden");

    }

});


/* =====================================================
   LOAD HOLDS
===================================================== */

function loadHolds() {

    const holdsRef =
        ref(db, "holdRolls");


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
                sum + Number(hold.netWeight || 0),
            0
        );


    document.getElementById("activeCount").textContent =
        active.length;


    /*
       Version 1:
       Every active hold is considered
       action-required until its workflow
       is completed.
    */

    document.getElementById("actionCount").textContent =
        active.length;


    document.getElementById("over24Count").textContent =
        over24.length;


    document.getElementById("over48Count").textContent =
        over48.length;


    document.getElementById("releasedCount").textContent =
        released.length;


    document.getElementById("totalWeight").textContent =
        totalWeight.toFixed(2);

}


/* =====================================================
   AGE CALCULATION
===================================================== */

function getAgeHours(hold) {

    const start =
        Number(hold.holdTimestamp || Date.now());


    const end =
        hold.releaseTimestamp
            ? Number(hold.releaseTimestamp)
            : Date.now();


    return (
        end - start
    ) / (1000 * 60 * 60);

}


/* =====================================================
   FORMAT AGE
===================================================== */

function formatAge(hold) {

    const hours =
        getAgeHours(hold);


    const totalMinutes =
        Math.floor(hours * 60);


    const days =
        Math.floor(totalMinutes / 1440);


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

        INSPECTION: "INSPECTION",

        SHADE_APPROVAL: "SHADE APPROVAL",

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


    if (hold.workflowType === "inspection") {

        return "Inspection / corrective action required";

    }


    if (hold.workflowType === "shadeApproval") {

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


    if (hold.workflowType === "review") {

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
                searchableText.includes(search);


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
            Number(b.holdTimestamp || 0) -
            Number(a.holdTimestamp || 0)
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

                    <span class="status-badge status-${hold.status}">

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

                <div class="age ${age.className}">

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
                ${escapeHtml(label)}
            </span>

            <span class="info-value">
                ${escapeHtml(value)}
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


    const actions =
        hold.actions
            ? Object.values(
                hold.actions
            ).sort(
                (a, b) =>
                    Number(a.timestamp || 0) -
                    Number(b.timestamp || 0)
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

                        <h3>HOLD Label Photo</h3>

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

};


closeDetails.addEventListener(
    "click",
    () => {

        detailsModal.classList.add(
            "hidden"
        );

    }
);


/* =====================================================
   DETAIL ITEM
===================================================== */

function detailItem(label, value) {

    return `

        <div class="detail-item">

            <span class="label">
                ${escapeHtml(label)}
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
    "Apex QC Hold Roll Monitor loaded."
);
