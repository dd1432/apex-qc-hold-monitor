/* =====================================================
   APEX QC HOLD ROLL MONITOR
   Complete Application JavaScript
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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);


/* =====================================================
   CLOUDINARY
===================================================== */

const CLOUDINARY_CLOUD_NAME = "org593vv";
const CLOUDINARY_UPLOAD_PRESET = "apex_qc_hold";

const CLOUDINARY_UPLOAD_URL =
    "https://api.cloudinary.com/v1_1/org593vv/image/upload";


/* =====================================================
   DOM ELEMENTS
===================================================== */

const addHoldBtn =
    document.getElementById("addHoldBtn");

const addHoldModal =
    document.getElementById("addHoldModal");

/* IMPORTANT:
   These IDs now exactly match index.html
*/

const closeModalBtn =
    document.getElementById("closeAddHold");

const cancelHoldBtn =
    document.getElementById("cancelHold");

const holdForm =
    document.getElementById("holdForm");


const detailsModal =
    document.getElementById("detailsModal");

const closeDetailsBtn =
    document.getElementById("closeDetails");

const detailsContent =
    document.getElementById("detailsContent");


const holdList =
    document.getElementById("holdList");

const historyList =
    document.getElementById("historyList");


/* Tabs are selected using data-tab.
   This avoids depending on IDs that do not exist.
*/

const tabButtons =
    document.querySelectorAll(".tab");


/* Search / Filters */

const searchInput =
    document.getElementById("searchInput");

const processFilter =
    document.getElementById("processFilter");

const statusFilter =
    document.getElementById("statusFilter");

const reasonFilter =
    document.getElementById("reasonFilter");


/* Summary */

const activeHoldsElement =
    document.getElementById("activeHolds");

const actionRequiredElement =
    document.getElementById("actionRequired");

const over24Element =
    document.getElementById("over24");

const over48Element =
    document.getElementById("over48");

const releasedElement =
    document.getElementById("released");

const totalWeightElement =
    document.getElementById("totalWeight");


/* =====================================================
   GLOBAL DATA
===================================================== */

let holds = {};

let currentHoldId = null;

let currentTab = "active";


/* =====================================================
   HELPER FUNCTIONS
===================================================== */

function escapeHtml(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* -----------------------------------------------------
   Photo URL helper

   Handles:
   - Cloudinary URL string
   - old Firebase object
   - secure_url
   - url
   - imageUrl
   - downloadURL
----------------------------------------------------- */

function getPhotoUrl(photo) {

    if (!photo) {
        return "";
    }

    if (typeof photo === "string") {
        return photo;
    }

    if (typeof photo === "object") {

        return (
            photo.secure_url ||
            photo.url ||
            photo.imageUrl ||
            photo.downloadURL ||
            ""
        );
    }

    return "";
}


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
   DATE / TIME
===================================================== */

function formatDateTime(timestamp) {

    if (!timestamp) {
        return "-";
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}


/* =====================================================
   HOLD AGE
===================================================== */

function getHoldDuration(hold) {

    if (!hold || !hold.holdTimestamp) {
        return {
            milliseconds: 0,
            hours: 0,
            text: "0h 0m"
        };
    }

    const start =
        Number(hold.holdTimestamp);

    const end =
        hold.releaseTimestamp
            ? Number(hold.releaseTimestamp)
            : Date.now();

    const milliseconds =
        Math.max(0, end - start);

    const totalMinutes =
        Math.floor(milliseconds / 60000);

    const days =
        Math.floor(totalMinutes / 1440);

    const hours =
        Math.floor((totalMinutes % 1440) / 60);

    const minutes =
        totalMinutes % 60;

    let text = "";

    if (days > 0) {
        text += `${days}d `;
    }

    text += `${hours}h ${minutes}m`;

    return {
        milliseconds,
        hours: milliseconds / 3600000,
        text
    };
}


/* =====================================================
   AGE CLASS
===================================================== */

function getAgeClass(hold) {

    const duration =
        getHoldDuration(hold);

    if (duration.hours >= 48) {
        return "critical";
    }

    if (duration.hours >= 24) {
        return "warning";
    }

    return "normal";
}


/* =====================================================
   STATUS LABEL
===================================================== */

function formatStatus(status) {

    const map = {

        HOLD: "HOLD",

        INSPECTION: "INSPECTION",

        INSPECTION_DONE: "INSPECTION DONE",

        SHADE_APPROVAL: "SHADE REVIEW",

        REVIEW: "REVIEW",

        RELEASED: "RELEASED",

        REJECTED: "REJECTED"
    };

    return map[status] || status || "-";
}


/* =====================================================
   STAGE LABEL
===================================================== */

function formatStage(stage) {

    const map = {

        INSPECTION:
            "Inspection Required",

        INSPECTION_DONE:
            "Inspection Done",

        PRINTING_MANAGER:
            "Printing Manager",

        QC_MANAGER:
            "QC Manager",

        GM:
            "GM Approval",

        REVIEW:
            "Review Required",

        RELEASED:
            "Released",

        REJECTED:
            "Rejected"
    };

    return map[stage] || stage || "-";
}


/* =====================================================
   ACTION REQUIRED
===================================================== */

function requiresAction(hold) {

    if (!hold) {
        return false;
    }

    if (
        hold.status === "RELEASED" ||
        hold.status === "REJECTED"
    ) {
        return false;
    }

    return true;
}


/* =====================================================
   CLOUDINARY UPLOAD
===================================================== */

async function uploadPhoto(file) {

    if (!file) {
        return null;
    }

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


    const response =
        await fetch(
            CLOUDINARY_UPLOAD_URL,
            {
                method: "POST",
                body: formData
            }
        );


    if (!response.ok) {

        throw new Error(
            "Photo upload failed."
        );
    }


    const data =
        await response.json();


    return data;
}


/* =====================================================
   OPEN ADD HOLD MODAL
===================================================== */

function openAddHoldModal() {

    if (!addHoldModal) {
        return;
    }

    addHoldModal.classList.add("show");

    addHoldModal.classList.remove("hidden");

    document.body.classList.add("modal-open");

    const firstInput =
        addHoldModal.querySelector(
            "input, select, textarea"
        );

    if (firstInput) {

        setTimeout(() => {
            firstInput.focus();
        }, 100);
    }
}


/* =====================================================
   CLOSE ADD HOLD MODAL
===================================================== */

function closeAddHoldModal() {

    if (!addHoldModal) {
        return;
    }

    addHoldModal.classList.remove("show");

    addHoldModal.classList.add("hidden");

    document.body.classList.remove("modal-open");

    if (holdForm) {
        holdForm.reset();
    }
}


/* =====================================================
   OPEN DETAILS MODAL
===================================================== */

window.openDetails = function (holdId) {

    currentHoldId =
        holdId;

    const hold =
        holds[holdId];

    if (!hold) {

        console.error(
            "Hold not found:",
            holdId
        );

        return;
    }


    renderDetailsModal(hold);


    if (detailsModal) {

        detailsModal.classList.add("show");

        detailsModal.classList.remove("hidden");

        document.body.classList.add("modal-open");
    }
};


/* =====================================================
   CLOSE DETAILS MODAL
===================================================== */

function closeDetailsModal() {

    currentHoldId = null;

    if (detailsModal) {

        detailsModal.classList.remove("show");

        detailsModal.classList.add("hidden");

        document.body.classList.remove("modal-open");
    }
}


/* =====================================================
   CREATE HOLD
===================================================== */

async function createHold(event) {

    event.preventDefault();


    const saveButton =
        document.getElementById("saveHoldBtn");


    if (saveButton) {

        saveButton.disabled = true;

        saveButton.textContent =
            "SAVING...";
    }


    try {

        const formData =
            new FormData(holdForm);


        const jobNo =
            (formData.get("jobNo") || "").trim();

        const jobName =
            (formData.get("jobName") || "").trim();

        const rollNo =
            (formData.get("rollNo") || "").trim();

        const netWeight =
            Number(
                formData.get("netWeight") || 0
            );

        const process =
            (formData.get("process") || "").trim();

        const machine =
            (formData.get("machine") || "").trim();

        const productionDate =
            formData.get("productionDate") || "";

        const shift =
            (formData.get("shift") || "").trim();

        const operator =
            (formData.get("operator") || "").trim();

        const supervisor =
            (formData.get("supervisor") || "").trim();

        const qcInspector =
            (formData.get("qcInspector") || "").trim();

        const holdReason =
            (formData.get("holdReason") || "").trim();

        const observation =
            (formData.get("observation") || "").trim();


        if (!jobNo) {
            throw new Error(
                "Please enter Job Number."
            );
        }

        if (!rollNo) {
            throw new Error(
                "Please enter Roll Number."
            );
        }

        if (!holdReason) {
            throw new Error(
                "Please select Hold Reason."
            );
        }

        if (!qcInspector) {
            throw new Error(
                "Please enter QC Inspector."
            );
        }


        /* ---------------------------------------------
           PHOTO
        --------------------------------------------- */

        const photoInput =
            document.getElementById("labelPhoto");

        let cloudinaryData =
            null;


        if (
            photoInput &&
            photoInput.files &&
            photoInput.files.length > 0
        ) {

            if (saveButton) {

                saveButton.textContent =
                    "UPLOADING PHOTO...";
            }

            cloudinaryData =
                await uploadPhoto(
                    photoInput.files[0]
                );
        }


        /* ---------------------------------------------
           WORKFLOW
        --------------------------------------------- */

        const workflowType =
            determineWorkflow(
                holdReason
            );


        const workflowState =
            getInitialWorkflowState(
                workflowType
            );


        /* ---------------------------------------------
           HOLD ID
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
           PHOTO URL

           Store URL as string.
           This prevents [object Object] problem.
        --------------------------------------------- */

        let labelPhoto = "";

        if (cloudinaryData) {

            labelPhoto =
                cloudinaryData.secure_url ||
                cloudinaryData.url ||
                "";
        }


        /* ---------------------------------------------
           HOLD DATA
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

            labelPhoto,

            workflowType,

            status:
                workflowState.status,

            currentStage:
                workflowState.currentStage,

            holdTimestamp,

            releaseTimestamp: null,

            actions: {}
        };


        /* ---------------------------------------------
           SAVE HOLD
        --------------------------------------------- */

        await set(
            holdRef,
            holdData
        );


        /* ---------------------------------------------
           FIRST ACTION
        --------------------------------------------- */

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

                person: qcInspector,

                decision: "HOLD",

                remarks:
                    observation ||
                    "Roll placed on QC hold.",

                timestamp:
                    holdTimestamp
            }
        );


        closeAddHoldModal();


        alert(
            "Hold roll saved successfully."
        );


    } catch (error) {

        console.error(
            "Create hold error:",
            error
        );


        alert(
            error.message ||
            "Failed to save hold."
        );


    } finally {

        if (saveButton) {

            saveButton.disabled = false;

            saveButton.textContent =
                "SAVE HOLD";
        }
    }
}


/* =====================================================
   INSPECTION DONE
===================================================== */

window.markInspectionDone =
    async function () {

        if (!currentHoldId) {
            return;
        }


        const hold =
            holds[currentHoldId];

        if (!hold) {
            return;
        }


        const operatorInput =
            document.getElementById(
                "inspectionOperator"
            );

        const supervisorInput =
            document.getElementById(
                "inspectionSupervisor"
            );

        const remarksInput =
            document.getElementById(
                "inspectionRemarks"
            );


        const inspectionOperator =
            operatorInput
                ? operatorInput.value.trim()
                : "";

        const inspectionSupervisor =
            supervisorInput
                ? supervisorInput.value.trim()
                : "";

        const remarks =
            remarksInput
                ? remarksInput.value.trim()
                : "";


        if (!inspectionOperator) {

            alert(
                "Please enter Inspection Operator name."
            );

            return;
        }


        if (!inspectionSupervisor) {

            alert(
                "Please enter Supervisor name."
            );

            return;
        }


        const timestamp =
            Date.now();


        const actionRef =
            push(
                ref(
                    db,
                    `holdRolls/${currentHoldId}/actions`
                )
            );


        try {

            await set(
                actionRef,
                {

                    type:
                        "INSPECTION DONE",

                    person:
                        inspectionSupervisor,

                    inspectionOperator,

                    decision:
                        "INSPECTION DONE",

                    remarks:
                        remarks ||
                        "Inspection completed.",

                    timestamp
                }
            );


            await update(
                ref(
                    db,
                    `holdRolls/${currentHoldId}`
                ),
                {

                    status:
                        "INSPECTION_DONE",

                    currentStage:
                        "INSPECTION_DONE"
                }
            );


            renderDetailsModal(
                {
                    ...hold,

                    status:
                        "INSPECTION_DONE",

                    currentStage:
                        "INSPECTION_DONE"
                }
            );


            alert(
                "Inspection marked as completed."
            );


        } catch (error) {

            console.error(
                error
            );

            alert(
                "Failed to update inspection."
            );
        }
    };


/* =====================================================
   RELEASE INSPECTION HOLD
===================================================== */

window.releaseInspectionHold =
    async function () {

        if (!currentHoldId) {
            return;
        }


        const hold =
            holds[currentHoldId];

        if (!hold) {
            return;
        }


        const supervisorInput =
            document.getElementById(
                "releaseSupervisor"
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
                "Please enter Supervisor name."
            );

            return;
        }


        const timestamp =
            Date.now();


        try {

            const actionRef =
                push(
                    ref(
                        db,
                        `holdRolls/${currentHoldId}/actions`
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
                        "RELEASE",

                    remarks:
                        remarks ||
                        "Released for further production.",

                    timestamp
                }
            );


            await update(
                ref(
                    db,
                    `holdRolls/${currentHoldId}`
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


            closeDetailsModal();


            alert(
                "Roll released for production."
            );


        } catch (error) {

            console.error(
                error
            );

            alert(
                "Failed to release roll."
            );
        }
    };


/* =====================================================
   REJECT INSPECTION HOLD
===================================================== */

window.rejectInspectionHold =
    async function () {

        if (!currentHoldId) {
            return;
        }


        const supervisorInput =
            document.getElementById(
                "rejectSupervisor"
            );

        const reasonInput =
            document.getElementById(
                "rejectRemarks"
            );


        const supervisor =
            supervisorInput
                ? supervisorInput.value.trim()
                : "";

        const reason =
            reasonInput
                ? reasonInput.value.trim()
                : "";


        if (!supervisor) {

            alert(
                "Please enter Supervisor name."
            );

            return;
        }


        if (!reason) {

            alert(
                "Please enter rejection reason."
            );

            return;
        }


        const timestamp =
            Date.now();


        try {

            const actionRef =
                push(
                    ref(
                        db,
                        `holdRolls/${currentHoldId}/actions`
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
                        "REJECT",

                    remarks:
                        reason,

                    timestamp
                }
            );


            await update(
                ref(
                    db,
                    `holdRolls/${currentHoldId}`
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


            closeDetailsModal();


            alert(
                "Roll marked as rejected."
            );


        } catch (error) {

            console.error(
                error
            );

            alert(
                "Failed to reject roll."
            );
        }
    };


/* =====================================================
   SHADE APPROVAL
===================================================== */

window.submitShadeApproval =
    async function (
        stage,
        decision
    ) {

        if (!currentHoldId) {
            return;
        }


        const hold =
            holds[currentHoldId];

        if (!hold) {
            return;
        }


        let nameId = "";

        let remarksId = "";


        if (stage === "PRINTING_MANAGER") {

            nameId =
                "printingManagerName";

            remarksId =
                "printingManagerRemarks";
        }

        else if (stage === "QC_MANAGER") {

            nameId =
                "qcManagerName";

            remarksId =
                "qcManagerRemarks";
        }

        else if (stage === "GM") {

            nameId =
                "gmName";

            remarksId =
                "gmRemarks";
        }


        const nameInput =
            document.getElementById(
                nameId
            );

        const remarksInput =
            document.getElementById(
                remarksId
            );


        const person =
            nameInput
                ? nameInput.value.trim()
                : "";

        const remarks =
            remarksInput
                ? remarksInput.value.trim()
                : "";


        if (!person) {

            alert(
                "Please enter your name."
            );

            return;
        }


        if (
            decision === "REJECT" &&
            !remarks
        ) {

            alert(
                "Please enter rejection reason."
            );

            return;
        }


        const timestamp =
            Date.now();


        try {

            const actionRef =
                push(
                    ref(
                        db,
                        `holdRolls/${currentHoldId}/actions`
                    )
                );


            await set(
                actionRef,
                {

                    type:
                        `${formatStage(stage)} DECISION`,

                    person,

                    decision,

                    remarks:
                        remarks ||
                        decision,

                    timestamp
                }
            );


            let nextStatus =
                hold.status;

            let nextStage =
                hold.currentStage;

            let releaseTimestamp =
                hold.releaseTimestamp || null;


            if (decision === "REJECT") {

                nextStatus =
                    "REJECTED";

                nextStage =
                    "REJECTED";

                releaseTimestamp =
                    timestamp;
            }


            else if (stage === "PRINTING_MANAGER") {

                nextStatus =
                    "SHADE_APPROVAL";

                nextStage =
                    "QC_MANAGER";
            }


            else if (stage === "QC_MANAGER") {

                nextStatus =
                    "SHADE_APPROVAL";

                nextStage =
                    "GM";
            }


            else if (stage === "GM") {

                nextStatus =
                    "RELEASED";

                nextStage =
                    "RELEASED";

                releaseTimestamp =
                    timestamp;
            }


            await update(
                ref(
                    db,
                    `holdRolls/${currentHoldId}`
                ),
                {

                    status:
                        nextStatus,

                    currentStage:
                        nextStage,

                    releaseTimestamp
                }
            );


            if (
                nextStatus === "RELEASED" ||
                nextStatus === "REJECTED"
            ) {

                closeDetailsModal();

            } else {

                renderDetailsModal(
                    {
                        ...hold,

                        status:
                            nextStatus,

                        currentStage:
                            nextStage
                    }
                );
            }


            alert(
                decision === "REJECT"
                    ? "Roll rejected."
                    : "Approval recorded."
            );


        } catch (error) {

            console.error(
                error
            );

            alert(
                "Failed to record approval."
            );
        }
    };


/* =====================================================
   REVIEW WORKFLOW
===================================================== */

window.submitReview =
    async function (
        decision
    ) {

        if (!currentHoldId) {
            return;
        }


        const hold =
            holds[currentHoldId];

        if (!hold) {
            return;
        }


        const nameInput =
            document.getElementById(
                "reviewPerson"
            );

        const remarksInput =
            document.getElementById(
                "reviewRemarks"
            );


        const person =
            nameInput
                ? nameInput.value.trim()
                : "";

        const remarks =
            remarksInput
                ? remarksInput.value.trim()
                : "";


        if (!person) {

            alert(
                "Please enter your name."
            );

            return;
        }


        if (
            decision === "REJECT" &&
            !remarks
        ) {

            alert(
                "Please enter rejection reason."
            );

            return;
        }


        const timestamp =
            Date.now();


        try {

            const actionRef =
                push(
                    ref(
                        db,
                        `holdRolls/${currentHoldId}/actions`
                    )
                );


            await set(
                actionRef,
                {

                    type:
                        "REVIEW DECISION",

                    person,

                    decision,

                    remarks:
                        remarks ||
                        decision,

                    timestamp
                }
            );


            let status =
                "REVIEW";

            let stage =
                "REVIEW";

            let releaseTimestamp =
                hold.releaseTimestamp || null;


            if (decision === "RELEASE") {

                status =
                    "RELEASED";

                stage =
                    "RELEASED";

                releaseTimestamp =
                    timestamp;
            }


            if (decision === "REJECT") {

                status =
                    "REJECTED";

                stage =
                    "REJECTED";

                releaseTimestamp =
                    timestamp;
            }


            await update(
                ref(
                    db,
                    `holdRolls/${currentHoldId}`
                ),
                {

                    status,

                    currentStage:
                        stage,

                    releaseTimestamp
                }
            );


            if (
                status === "RELEASED" ||
                status === "REJECTED"
            ) {

                closeDetailsModal();

            } else {

                renderDetailsModal(
                    {
                        ...hold,

                        status,

                        currentStage:
                            stage
                    }
                );
            }


            alert(
                decision === "RELEASE"
                    ? "Roll released."
                    : decision === "REJECT"
                        ? "Roll rejected."
                        : "Review recorded."
            );


        } catch (error) {

            console.error(
                error
            );

            alert(
                "Failed to record review."
            );
        }
    };


/* =====================================================
   DETAILS MODAL
===================================================== */

function renderDetailsModal(hold) {

    if (!detailsContent) {
        return;
    }


    const age =
        getHoldDuration(hold);

    const ageClass =
        getAgeClass(hold);


    const photoUrl =
        getPhotoUrl(
            hold.labelPhoto
        );


    const actions =
        hold.actions
            ? Object.values(hold.actions)
            : [];


    actions.sort(
        (a, b) =>
            Number(a.timestamp || 0) -
            Number(b.timestamp || 0)
    );


    let html = `

        <div class="details-container">

            <div class="details-summary">

                <div class="detail-title">
                    <span class="detail-label">
                        Job Number
                    </span>

                    <strong>
                        ${escapeHtml(hold.jobNo)}
                    </strong>
                </div>

                <div class="detail-title">
                    <span class="detail-label">
                        Roll Number
                    </span>

                    <strong>
                        ${escapeHtml(hold.rollNo)}
                    </strong>
                </div>

                <div class="detail-title">
                    <span class="detail-label">
                        Status
                    </span>

                    <strong>
                        ${escapeHtml(
                            formatStatus(
                                hold.status
                            )
                        )}
                    </strong>
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
                        ${Number(
                            hold.netWeight || 0
                        ).toFixed(2)}
                        kg
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
                    <span>Current Stage</span>
                    <strong>
                        ${escapeHtml(
                            formatStage(
                                hold.currentStage
                            )
                        )}
                    </strong>
                </div>

                <div>
                    <span>Hold Time</span>
                    <strong class="${ageClass}">
                        ${age.text}
                    </strong>
                </div>

                <div>
                    <span>Hold Created</span>
                    <strong>
                        ${formatDateTime(
                            hold.holdTimestamp
                        )}
                    </strong>
                </div>

                <div>
                    <span>Released / Closed</span>
                    <strong>
                        ${hold.releaseTimestamp
                            ? formatDateTime(
                                hold.releaseTimestamp
                            )
                            : "-"
                        }
                    </strong>
                </div>

            </div>


            <div class="details-section">

                <h3>Observation</h3>

                <div class="observation-box">
                    ${escapeHtml(
                        hold.observation || "-"
                    )}
                </div>

            </div>
    `;


    /* =================================================
       PHOTO
    ================================================= */

    if (photoUrl) {

        html += `

            <div class="details-section">

                <h3>Label Photo</h3>

                <div class="photo-container">

                    <img
                        src="${escapeHtml(photoUrl)}"
                        alt="Hold roll label"
                        class="hold-photo"
                        onclick="window.open('${escapeHtml(photoUrl)}', '_blank')"
                    >

                </div>

            </div>

        `;
    }


    /* =================================================
       WORKFLOW ACTION PANEL
    ================================================= */

    if (
        hold.status !== "RELEASED" &&
        hold.status !== "REJECTED"
    ) {

        html += renderActionPanel(
            hold
        );
    }


    /* =================================================
       TIMELINE
    ================================================= */

    html += `

        <div class="details-section">

            <h3>Action History</h3>

            <div class="timeline">
    `;


    if (actions.length === 0) {

        html += `
            <div class="timeline-empty">
                No actions recorded.
            </div>
        `;

    } else {

        actions.forEach(
            action => {

                html += `

                    <div class="timeline-item">

                        <div class="timeline-dot"></div>

                        <div class="timeline-content">

                            <div class="timeline-top">

                                <strong>
                                    ${escapeHtml(
                                        action.type ||
                                        "ACTION"
                                    )}
                                </strong>

                                <span>
                                    ${formatDateTime(
                                        action.timestamp
                                    )}
                                </span>

                            </div>

                            <div>
                                <strong>
                                    Person:
                                </strong>

                                ${escapeHtml(
                                    action.person || "-"
                                )}
                            </div>

                `;


                if (
                    action.inspectionOperator
                ) {

                    html += `

                        <div>
                            <strong>
                                Inspection Operator:
                            </strong>

                            ${escapeHtml(
                                action.inspectionOperator
                            )}
                        </div>

                    `;
                }


                if (action.decision) {

                    html += `

                        <div>
                            <strong>
                                Decision:
                            </strong>

                            ${escapeHtml(
                                action.decision
                            )}
                        </div>

                    `;
                }


                if (action.remarks) {

                    html += `

                        <div>
                            <strong>
                                Remarks:
                            </strong>

                            ${escapeHtml(
                                action.remarks
                            )}
                        </div>

                    `;
                }


                html += `

                        </div>

                    </div>

                `;
            }
        );
    }


    html += `

            </div>

        </div>

    </div>

    `;


    detailsContent.innerHTML =
        html;
}


/* =====================================================
   ACTION PANEL
===================================================== */

function renderActionPanel(hold) {

    let html = `

        <div class="action-panel">

    `;


    /* =================================================
       INSPECTION
    ================================================= */

    if (
        hold.workflowType === "inspection" &&
        (
            hold.status === "HOLD" ||
            hold.status === "INSPECTION"
        )
    ) {

        html += `

            <h3>
                Inspection Required
            </h3>

            <div class="action-form">

                <label>
                    Inspection Operator
                    <input
                        type="text"
                        id="inspectionOperator"
                        placeholder="Enter actual inspection operator"
                    >
                </label>

                <label>
                    Supervisor
                    <input
                        type="text"
                        id="inspectionSupervisor"
                        placeholder="Enter supervisor name"
                    >
                </label>

                <label>
                    Remarks
                    <textarea
                        id="inspectionRemarks"
                        placeholder="Inspection remarks"
                    ></textarea>
                </label>

                <button
                    type="button"
                    class="primary-btn"
                    onclick="markInspectionDone()"
                >
                    MARK INSPECTION DONE
                </button>

            </div>

        `;
    }


    /* =================================================
       AFTER INSPECTION
    ================================================= */

    else if (
        hold.workflowType === "inspection" &&
        hold.status === "INSPECTION_DONE"
    ) {

        html += `

            <h3>
                Inspection Completed
            </h3>

            <div class="action-form">

                <label>
                    Supervisor
                    <input
                        type="text"
                        id="releaseSupervisor"
                        placeholder="Enter supervisor name"
                    >
                </label>

                <label>
                    Remarks
                    <textarea
                        id="releaseRemarks"
                        placeholder="Release remarks"
                    ></textarea>
                </label>

                <div class="action-buttons">

                    <button
                        type="button"
                        class="primary-btn"
                        onclick="releaseInspectionHold()"
                    >
                        RELEASE FOR PRODUCTION
                    </button>

                    <button
                        type="button"
                        class="danger-btn"
                        onclick="rejectInspectionHold()"
                    >
                        REJECT
                    </button>

                </div>

                <label>
                    Rejection Reason
                    <textarea
                        id="rejectRemarks"
                        placeholder="Enter rejection reason if rejecting"
                    ></textarea>
                </label>

                <label>
                    Supervisor for Rejection
                    <input
                        type="text"
                        id="rejectSupervisor"
                        placeholder="Enter supervisor name"
                    >
                </label>

            </div>

        `;
    }


    /* =================================================
       SHADE APPROVAL
    ================================================= */

    else if (
        hold.workflowType === "shadeApproval"
    ) {

        if (
            hold.currentStage ===
            "PRINTING_MANAGER"
        ) {

            html += `

                <h3>
                    Printing Manager Approval
                </h3>

                <div class="action-form">

                    <label>
                        Printing Manager
                        <input
                            type="text"
                            id="printingManagerName"
                            placeholder="Enter name"
                        >
                    </label>

                    <label>
                        Remarks
                        <textarea
                            id="printingManagerRemarks"
                            placeholder="Enter remarks"
                        ></textarea>
                    </label>

                    <div class="action-buttons">

                        <button
                            type="button"
                            class="primary-btn"
                            onclick="submitShadeApproval('PRINTING_MANAGER','APPROVE')"
                        >
                            APPROVE
                        </button>

                        <button
                            type="button"
                            class="danger-btn"
                            onclick="submitShadeApproval('PRINTING_MANAGER','REJECT')"
                        >
                            REJECT
                        </button>

                    </div>

                </div>

            `;
        }


        else if (
            hold.currentStage ===
            "QC_MANAGER"
        ) {

            html += `

                <h3>
                    QC Manager Approval
                </h3>

                <div class="action-form">

                    <label>
                        QC Manager
                        <input
                            type="text"
                            id="qcManagerName"
                            placeholder="Enter name"
                        >
                    </label>

                    <label>
                        Remarks
                        <textarea
                            id="qcManagerRemarks"
                            placeholder="Enter remarks"
                        ></textarea>
                    </label>

                    <div class="action-buttons">

                        <button
                            type="button"
                            class="primary-btn"
                            onclick="submitShadeApproval('QC_MANAGER','APPROVE')"
                        >
                            APPROVE
                        </button>

                        <button
                            type="button"
                            class="danger-btn"
                            onclick="submitShadeApproval('QC_MANAGER','REJECT')"
                        >
                            REJECT
                        </button>

                    </div>

                </div>

            `;
        }


        else if (
            hold.currentStage === "GM"
        ) {

            html += `

                <h3>
                    GM Approval
                </h3>

                <div class="action-form">

                    <label>
                        GM
                        <input
                            type="text"
                            id="gmName"
                            placeholder="Enter name"
                        >
                    </label>

                    <label>
                        Remarks
                        <textarea
                            id="gmRemarks"
                            placeholder="Enter remarks"
                        ></textarea>
                    </label>

                    <div class="action-buttons">

                        <button
                            type="button"
                            class="primary-btn"
                            onclick="submitShadeApproval('GM','APPROVE')"
                        >
                            RELEASE
                        </button>

                        <button
                            type="button"
                            class="danger-btn"
                            onclick="submitShadeApproval('GM','REJECT')"
                        >
                            REJECT
                        </button>

                    </div>

                </div>

            `;
        }
    }


    /* =================================================
       GENERAL REVIEW
    ================================================= */

    else if (
        hold.workflowType === "review" &&
        hold.status === "REVIEW"
    ) {

        html += `

            <h3>
                Review Required
            </h3>

            <div class="action-form">

                <label>
                    Reviewer
                    <input
                        type="text"
                        id="reviewPerson"
                        placeholder="Enter reviewer name"
                    >
                </label>

                <label>
                    Remarks
                    <textarea
                        id="reviewRemarks"
                        placeholder="Enter review remarks"
                    ></textarea>
                </label>

                <div class="action-buttons">

                    <button
                        type="button"
                        class="primary-btn"
                        onclick="submitReview('RELEASE')"
                    >
                        RELEASE
                    </button>

                    <button
                        type="button"
                        class="danger-btn"
                        onclick="submitReview('REJECT')"
                    >
                        REJECT
                    </button>

                </div>

            </div>

        `;
    }


    html += `

        </div>

    `;


    return html;
}


/* =====================================================
   CREATE ACTIVE HOLD CARD
===================================================== */

function createHoldCard(hold) {

    const age =
        getHoldDuration(hold);

    const ageClass =
        getAgeClass(hold);


    const actionRequired =
        requiresAction(hold);


    return `

        <div
            class="hold-card ${ageClass}"
            data-hold-id="${escapeHtml(
                hold.holdId
            )}"
        >

            <div class="hold-card-header">

                <div>

                    <span class="hold-job">
                        ${escapeHtml(
                            hold.jobNo
                        )}
                    </span>

                    <span class="hold-roll">
                        Roll:
                        ${escapeHtml(
                            hold.rollNo
                        )}
                    </span>

                </div>

                <span class="status-badge">
                    ${escapeHtml(
                        formatStatus(
                            hold.status
                        )
                    )}
                </span>

            </div>


            <div class="hold-card-body">

                <div class="hold-info">

                    <span>
                        Job Name
                    </span>

                    <strong>
                        ${escapeHtml(
                            hold.jobName || "-"
                        )}
                    </strong>

                </div>


                <div class="hold-info">

                    <span>
                        Weight
                    </span>

                    <strong>
                        ${Number(
                            hold.netWeight || 0
                        ).toFixed(2)}
                        kg
                    </strong>

                </div>


                <div class="hold-info">

                    <span>
                        Process
                    </span>

                    <strong>
                        ${escapeHtml(
                            hold.process || "-"
                        )}
                    </strong>

                </div>


                <div class="hold-info">

                    <span>
                        Machine
                    </span>

                    <strong>
                        ${escapeHtml(
                            hold.machine || "-"
                        )}
                    </strong>

                </div>


                <div class="hold-info">

                    <span>
                        Shift
                    </span>

                    <strong>
                        ${escapeHtml(
                            hold.shift || "-"
                        )}
                    </strong>

                </div>


                <div class="hold-info">

                    <span>
                        QC Inspector
                    </span>

                    <strong>
                        ${escapeHtml(
                            hold.qcInspector || "-"
                        )}
                    </strong>

                </div>


                <div class="hold-info">

                    <span>
                        Hold Reason
                    </span>

                    <strong>
                        ${escapeHtml(
                            hold.holdReason || "-"
                        )}
                    </strong>

                </div>


                <div class="hold-info">

                    <span>
                        Waiting For
                    </span>

                    <strong>
                        ${escapeHtml(
                            formatStage(
                                hold.currentStage
                            )
                        )}
                    </strong>

                </div>


                <div class="hold-age ${ageClass}">

                    <span>
                        Hold Age
                    </span>

                    <strong>
                        ${age.text}
                    </strong>

                </div>

            </div>


            <div class="hold-card-footer">

                <span>
                    Held:
                    ${formatDateTime(
                        hold.holdTimestamp
                    )}
                </span>

                <button
                    type="button"
                    class="primary-btn small-btn"
                    onclick="openDetails('${escapeHtml(
                        hold.holdId
                    )}')"
                >
                    VIEW DETAILS
                </button>

            </div>

        </div>

    `;
}


/* =====================================================
   HISTORY CARD
===================================================== */

function createHistoryCard(hold) {

    const duration =
        getHoldDuration(hold);


    return `

        <div class="hold-card history-card">

            <div class="hold-card-header">

                <div>

                    <span class="hold-job">
                        ${escapeHtml(
                            hold.jobNo
                        )}
                    </span>

                    <span class="hold-roll">
                        Roll:
                        ${escapeHtml(
                            hold.rollNo
                        )}
                    </span>

                </div>

                <span class="status-badge">
                    ${escapeHtml(
                        formatStatus(
                            hold.status
                        )
                    )}
                </span>

            </div>


            <div class="hold-card-body">

                <div class="hold-info">

                    <span>
                        Job Name
                    </span>

                    <strong>
                        ${escapeHtml(
                            hold.jobName || "-"
                        )}
                    </strong>

                </div>


                <div class="hold-info">

                    <span>
                        Weight
                    </span>

                    <strong>
                        ${Number(
                            hold.netWeight || 0
                        ).toFixed(2)}
                        kg
                    </strong>

                </div>


                <div class="hold-info">

                    <span>
                        Process
                    </span>

                    <strong>
                        ${escapeHtml(
                            hold.process || "-"
                        )}
                    </strong>

                </div>


                <div class="hold-info">

                    <span>
                        Hold Reason
                    </span>

                    <strong>
                        ${escapeHtml(
                            hold.holdReason || "-"
                        )}
                    </strong>

                </div>


                <div class="hold-info">

                    <span>
                        Total Hold Time
                    </span>

                    <strong>
                        ${duration.text}
                    </strong>

                </div>


                <div class="hold-info">

                    <span>
                        Closed
                    </span>

                    <strong>
                        ${formatDateTime(
                            hold.releaseTimestamp
                        )}
                    </strong>

                </div>

            </div>


            <div class="hold-card-footer">

                <button
                    type="button"
                    class="primary-btn small-btn"
                    onclick="openDetails('${escapeHtml(
                        hold.holdId
                    )}')"
                >
                    VIEW DETAILS
                </button>

            </div>

        </div>

    `;
}


/* =====================================================
   FILTER MATCH
===================================================== */

function matchesFilters(hold) {

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


    if (search) {

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
            .join(" ")
            .toLowerCase();


        if (
            !searchableText.includes(
                search
            )
        ) {

            return false;
        }
    }


    if (
        process &&
        process !== "ALL" &&
        hold.process !== process
    ) {

        return false;
    }


    if (
        status &&
        status !== "ALL" &&
        hold.status !== status
    ) {

        return false;
    }


    if (
        reason &&
        reason !== "ALL" &&
        hold.holdReason !== reason
    ) {

        return false;
    }


    return true;
}


/* =====================================================
   SORT HOLDS
===================================================== */

function sortHoldsDescending(list) {

    return [...list].sort(
        (a, b) =>
            Number(
                b.holdTimestamp || 0
            ) -
            Number(
                a.holdTimestamp || 0
            )
    );
}


/* =====================================================
   RENDER ACTIVE HOLDS
===================================================== */

function renderActiveHolds() {

    if (!holdList) {
        return;
    }


    const active =
        Object.values(holds)
            .filter(
                hold =>
                    hold.status !== "RELEASED" &&
                    hold.status !== "REJECTED"
            )
            .filter(
                matchesFilters
            );


    const sorted =
        sortHoldsDescending(
            active
        );


    if (sorted.length === 0) {

        holdList.innerHTML = `

            <div class="empty-state">

                <h3>
                    No Active Holds
                </h3>

                <p>
                    There are currently no QC hold rolls matching your filters.
                </p>

            </div>

        `;

        return;
    }


    holdList.innerHTML =
        sorted
            .map(
                createHoldCard
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
        Object.values(holds)
            .filter(
                hold =>
                    hold.status === "RELEASED" ||
                    hold.status === "REJECTED"
            )
            .filter(
                matchesFilters
            );


    const sorted =
        [...history].sort(
            (a, b) =>
                Number(
                    b.releaseTimestamp ||
                    b.holdTimestamp ||
                    0
                ) -
                Number(
                    a.releaseTimestamp ||
                    a.holdTimestamp ||
                    0
                )
        );


    if (sorted.length === 0) {

        historyList.innerHTML = `

            <div class="empty-state">

                <h3>
                    No History
                </h3>

                <p>
                    No released or rejected rolls found.
                </p>

            </div>

        `;

        return;
    }


    historyList.innerHTML =
        sorted
            .map(
                createHistoryCard
            )
            .join("");
}


/* =====================================================
   SUMMARY
===================================================== */

function updateSummary() {

    const all =
        Object.values(holds);


    const active =
        all.filter(
            hold =>
                hold.status !== "RELEASED" &&
                hold.status !== "REJECTED"
        );


    const closed =
        all.filter(
            hold =>
                hold.status === "RELEASED"
        );


    const actionRequired =
        active.filter(
            requiresAction
        );


    const over24 =
        active.filter(
            hold =>
                getHoldDuration(
                    hold
                ).hours >= 24
        );


    const over48 =
        active.filter(
            hold =>
                getHoldDuration(
                    hold
                ).hours >= 48
        );


    const totalWeight =
        active.reduce(
            (
                total,
                hold
            ) =>
                total +
                Number(
                    hold.netWeight || 0
                ),
            0
        );


    if (activeHoldsElement) {

        activeHoldsElement.textContent =
            active.length;
    }


    if (actionRequiredElement) {

        actionRequiredElement.textContent =
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
            closed.length;
    }


    if (totalWeightElement) {

        /* FIX:
           HTML already contains "kg",
           so JS must NOT add kg again.
        */

        totalWeightElement.textContent =
            totalWeight.toFixed(2);
    }
}


/* =====================================================
   RENDER EVERYTHING
===================================================== */

function renderAll() {

    updateSummary();

    renderActiveHolds();

    renderHistory();


    /* Refresh currently opened details modal */

    if (currentHoldId) {

        const currentHold =
            holds[currentHoldId];

        if (currentHold) {

            renderDetailsModal(
                currentHold
            );
        }
    }
}


/* =====================================================
   TAB SWITCHING
===================================================== */

function switchTab(tabName) {

    currentTab =
        tabName;


    tabButtons.forEach(
        button => {

            button.classList.toggle(
                "active",
                button.dataset.tab === tabName
            );
        }
    );


    const activeSection =
        document.querySelector(
            '[data-tab-content="active"]'
        );

    const historySection =
        document.querySelector(
            '[data-tab-content="history"]'
        );


    if (activeSection) {

        activeSection.style.display =
            tabName === "active"
                ? ""
                : "none";
    }


    if (historySection) {

        historySection.style.display =
            tabName === "history"
                ? ""
                : "none";
    }


    /* Support common IDs if they exist */

    const activeTabContent =
        document.getElementById(
            "activeTabContent"
        );

    const historyTabContent =
        document.getElementById(
            "historyTabContent"
        );


    if (activeTabContent) {

        activeTabContent.style.display =
            tabName === "active"
                ? ""
                : "none";
    }


    if (historyTabContent) {

        historyTabContent.style.display =
            tabName === "history"
                ? ""
                : "none";
    }


    renderAll();
}


/* =====================================================
   LOAD FIREBASE DATA
===================================================== */

function loadHolds() {

    const holdsRef =
        ref(
            db,
            "holdRolls"
        );


    onValue(
        holdsRef,
        snapshot => {

            const data =
                snapshot.val();


            holds =
                data || {};


            renderAll();
        },

        error => {

            console.error(
                "Firebase read error:",
                error
            );


            if (holdList) {

                holdList.innerHTML = `

                    <div class="empty-state">

                        <h3>
                            Database Error
                        </h3>

                        <p>
                            Unable to load QC hold data.
                        </p>

                    </div>

                `;
            }
        }
    );
}


/* =====================================================
   EVENT LISTENERS
===================================================== */


/* Add Hold */

if (addHoldBtn) {

    addHoldBtn.addEventListener(
        "click",
        openAddHoldModal
    );
}


/* Add Hold X */

if (closeModalBtn) {

    closeModalBtn.addEventListener(
        "click",
        closeAddHoldModal
    );
}


/* Add Hold Cancel */

if (cancelHoldBtn) {

    cancelHoldBtn.addEventListener(
        "click",
        closeAddHoldModal
    );
}


/* Details X */

if (closeDetailsBtn) {

    closeDetailsBtn.addEventListener(
        "click",
        closeDetailsModal
    );
}


/* Form */

if (holdForm) {

    holdForm.addEventListener(
        "submit",
        createHold
    );
}


/* Tabs */

tabButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                switchTab(
                    button.dataset.tab
                );
            }
        );
    }
);


/* Search */

if (searchInput) {

    searchInput.addEventListener(
        "input",
        renderAll
    );
}


/* Filters */

if (processFilter) {

    processFilter.addEventListener(
        "change",
        renderAll
    );
}


if (statusFilter) {

    statusFilter.addEventListener(
        "change",
        renderAll
    );
}


if (reasonFilter) {

    reasonFilter.addEventListener(
        "change",
        renderAll
    );
}


/* =====================================================
   BACKGROUND CLICK CLOSE
===================================================== */

window.addEventListener(
    "click",
    event => {

        if (
            addHoldModal &&
            event.target === addHoldModal
        ) {

            closeAddHoldModal();
        }


        if (
            detailsModal &&
            event.target === detailsModal
        ) {

            closeDetailsModal();
        }
    }
);


/* =====================================================
   ESCAPE KEY
===================================================== */

window.addEventListener(
    "keydown",
    event => {

        if (
            event.key !== "Escape"
        ) {

            return;
        }


        closeAddHoldModal();

        closeDetailsModal();
    }
);


/* =====================================================
   LIVE AGE REFRESH
===================================================== */

setInterval(
    () => {

        updateSummary();

        renderActiveHolds();

        renderHistory();


        if (currentHoldId) {

            const currentHold =
                holds[currentHoldId];

            if (currentHold) {

                renderDetailsModal(
                    currentHold
                );
            }
        }

    },
    60000
);


/* =====================================================
   START APPLICATION
===================================================== */

loadHolds();

renderAll();


console.log(
    "Apex QC Hold Roll Monitor loaded successfully."
);
