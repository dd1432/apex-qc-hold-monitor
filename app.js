/* =========================================================
   APEX QC HOLD ROLL MONITOR
   COMPLETE APPLICATION JAVASCRIPT
========================================================= */


/* =========================================================
   FIREBASE
========================================================= */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getDatabase,
    ref,
    push,
    set,
    update,
    onValue
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyBZC1ln8lQxkq_JJBHpMtF8zy850T3rHcg",
  authDomain: "apex-qc-hold-monitor.firebaseapp.com",
  databaseURL: "https://apex-qc-hold-monitor-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "apex-qc-hold-monitor",
  storageBucket: "apex-qc-hold-monitor.firebasestorage.app",
  messagingSenderId: "1006270751442",
  appId: "1:1006270751442:web:dca6ce7f3b3a235ee9030b"
};


/*
   IMPORTANT:
   Replace the placeholder Firebase values above with the
   exact Firebase config from your Firebase console.
*/

const app = initializeApp(firebaseConfig);

const db = getDatabase(app);


/* =========================================================
   CLOUDINARY
========================================================= */

const CLOUDINARY_CLOUD_NAME = "org593vv";

const CLOUDINARY_UPLOAD_PRESET = "apex_qc_hold";

const CLOUDINARY_UPLOAD_URL =
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;


/* =========================================================
   DOM REFERENCES
========================================================= */

const addHoldBtn =
    document.getElementById("addHoldBtn");

const addHoldModal =
    document.getElementById("addHoldModal");

const closeAddHold =
    document.getElementById("closeAddHold");

const cancelHold =
    document.getElementById("cancelHold");

const holdForm =
    document.getElementById("holdForm");

const detailsModal =
    document.getElementById("detailsModal");

const closeDetails =
    document.getElementById("closeDetails");

const detailsContent =
    document.getElementById("detailsContent");

const holdList =
    document.getElementById("holdList");

const historyList =
    document.getElementById("historyList");

const searchInput =
    document.getElementById("searchInput");

const processFilter =
    document.getElementById("processFilter");

const statusFilter =
    document.getElementById("statusFilter");

const reasonFilter =
    document.getElementById("reasonFilter");

const labelPhoto =
    document.getElementById("labelPhoto");

const photoPreview =
    document.getElementById("photoPreview");

const uploadProgress =
    document.getElementById("uploadProgress");

const saveHoldBtn =
    document.getElementById("saveHoldBtn");


/* SUMMARY */

const activeHoldsEl =
    document.getElementById("activeHolds");

const actionRequiredEl =
    document.getElementById("actionRequired");

const over24El =
    document.getElementById("over24");

const over48El =
    document.getElementById("over48");

const releasedEl =
    document.getElementById("released");

const totalWeightEl =
    document.getElementById("totalWeight");


/* =========================================================
   GLOBAL STATE
========================================================= */

let holds = {};

let currentHoldId = null;

let currentTab = "active";


/* =========================================================
   HELPERS
========================================================= */

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


/* =========================================================
   PHOTO URL
========================================================= */

function getPhotoUrl(photo) {

    if (!photo) {
        return "";
    }

    if (typeof photo === "string") {
        return photo;
    }

    return (
        photo.secure_url ||
        photo.url ||
        photo.imageUrl ||
        photo.downloadURL ||
        ""
    );
}


/* =========================================================
   WORKFLOW
========================================================= */

function determineWorkflow(holdReason) {

    if (holdReason === "Shade Mismatch") {
        return "shadeApproval";
    }

    if (
        holdReason === "GSM / Weight"
    ) {
        return "review";
    }

    return "inspection";
}


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


/* =========================================================
   STATUS LABEL
========================================================= */

function formatStatus(status) {

    const labels = {

        HOLD: "HOLD",

        INSPECTION: "INSPECTION",

        INSPECTION_DONE:
            "INSPECTION DONE",

        SHADE_APPROVAL:
            "SHADE APPROVAL",

        REVIEW:
            "REVIEW",

        RELEASED:
            "RELEASED",

        REJECTED:
            "REJECTED"
    };

    return labels[status] || status || "UNKNOWN";
}


/* =========================================================
   STATUS BADGE CLASS
========================================================= */

function getBadgeClass(status) {

    const classes = {

        HOLD:
            "badge-hold",

        INSPECTION:
            "badge-inspection",

        INSPECTION_DONE:
            "badge-inspection-done",

        SHADE_APPROVAL:
            "badge-shade-approval",

        REVIEW:
            "badge-review",

        RELEASED:
            "badge-released",

        REJECTED:
            "badge-rejected"
    };

    return classes[status] || "badge-hold";
}


/* =========================================================
   STAGE LABEL
========================================================= */

function formatStage(stage) {

    const labels = {

        INSPECTION:
            "INSPECTION REQUIRED",

        INSPECTION_DONE:
            "INSPECTION COMPLETED",

        PRINTING_MANAGER:
            "PRINTING MANAGER",

        QC_MANAGER:
            "QC MANAGER",

        GM:
            "GENERAL MANAGER",

        REVIEW:
            "REVIEW",

        RELEASED:
            "RELEASED",

        REJECTED:
            "REJECTED"
    };

    return labels[stage] || stage || "-";
}


/* =========================================================
   DATE / TIME
========================================================= */

function formatDateTime(timestamp) {

    if (!timestamp) {
        return "-";
    }

    const date =
        new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleString(
        "en-IN",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        }
    );
}


/* =========================================================
   HOLD DURATION
========================================================= */

function getHoldDurationMs(hold) {

    const start =
        Number(hold?.holdTimestamp || 0);

    if (!start) {
        return 0;
    }

    const end =
        Number(
            hold?.releaseTimestamp ||
            Date.now()
        );

    return Math.max(
        0,
        end - start
    );
}


function formatDuration(ms) {

    if (!ms) {
        return "0h 0m";
    }

    const totalMinutes =
        Math.floor(ms / 60000);

    const days =
        Math.floor(
            totalMinutes / 1440
        );

    const hours =
        Math.floor(
            (totalMinutes % 1440) / 60
        );

    const minutes =
        totalMinutes % 60;

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    }

    return `${hours}h ${minutes}m`;
}


function getAgeClass(hold) {

    const ms =
        getHoldDurationMs(hold);

    const hours =
        ms / 3600000;

    if (hours >= 48) {
        return "critical";
    }

    if (hours >= 24) {
        return "warning";
    }

    return "normal";
}


/* =========================================================
   ACTION REQUIREMENT
========================================================= */

function requiresAction(hold) {

    return (
        hold &&
        hold.status !== "RELEASED" &&
        hold.status !== "REJECTED"
    );
}


/* =========================================================
   MODAL CONTROL
========================================================= */

function openModal(modal) {

    if (!modal) {
        return;
    }

    modal.classList.remove("hidden");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );
}


function closeModal(modal) {

    if (!modal) {
        return;
    }

    modal.classList.add("hidden");

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    if (
        addHoldModal.classList.contains("hidden") &&
        detailsModal.classList.contains("hidden")
    ) {
        document.body.classList.remove(
            "modal-open"
        );
    }
}


/* =========================================================
   ADD HOLD MODAL
========================================================= */

function openAddHoldModal() {

    holdForm.reset();

    photoPreview.innerHTML = "";

    uploadProgress.textContent = "";

    saveHoldBtn.disabled = false;

    saveHoldBtn.textContent =
        "Save Hold";

    openModal(addHoldModal);
}


function closeAddHoldModal() {

    closeModal(addHoldModal);

    holdForm.reset();

    photoPreview.innerHTML = "";

    uploadProgress.textContent = "";
}


/* =========================================================
   PHOTO PREVIEW
========================================================= */

labelPhoto.addEventListener(
    "change",
    () => {

        photoPreview.innerHTML = "";

        uploadProgress.textContent = "";

        const file =
            labelPhoto.files?.[0];

        if (!file) {
            return;
        }

        if (
            !file.type.startsWith("image/")
        ) {

            alert(
                "Please select a valid image file."
            );

            labelPhoto.value = "";

            return;
        }

        const reader =
            new FileReader();

        reader.onload = event => {

            photoPreview.innerHTML = `
                <img
                    src="${event.target.result}"
                    alt="Label photo preview"
                >
            `;
        };

        reader.readAsDataURL(file);
    }
);


/* =========================================================
   CLOUDINARY UPLOAD
========================================================= */

async function uploadPhoto(file) {

    if (!file) {
        throw new Error(
            "Label photo is required."
        );
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


    uploadProgress.textContent =
        "Uploading photo...";


    const response =
        await fetch(
            CLOUDINARY_UPLOAD_URL,
            {
                method: "POST",
                body: formData
            }
        );


    if (!response.ok) {

        let errorMessage =
            "Photo upload failed.";

        try {

            const errorData =
                await response.json();

            errorMessage =
                errorData?.error?.message ||
                errorMessage;

        } catch {
            // Ignore JSON parsing error
        }

        throw new Error(
            errorMessage
        );
    }


    const result =
        await response.json();


    if (!result.secure_url) {

        throw new Error(
            "Cloudinary did not return a valid image URL."
        );
    }


    uploadProgress.textContent =
        "Photo uploaded successfully.";

    return result;
}


/* =========================================================
   CREATE ACTION OBJECT
========================================================= */

function createAction(
    action,
    person,
    remarks
) {

    return {

        action,

        person:
            person || "",

        remarks:
            remarks || "",

        timestamp:
            Date.now()
    };
}


/* =========================================================
   ADD ACTION + UPDATE HOLD
========================================================= */

async function updateHoldWithAction(
    holdId,
    action,
    person,
    remarks,
    changes = {}
) {

    const actionRef =
        push(
            ref(
                db,
                `holdRolls/${holdId}/actions`
            )
        );

    const actionId =
        actionRef.key;

    const actionData =
        createAction(
            action,
            person,
            remarks
        );

    const updates = {

        [`holdRolls/${holdId}/actions/${actionId}`]:
            actionData,

        [`holdRolls/${holdId}/updatedAt`]:
            Date.now()
    };


    Object.keys(changes).forEach(
        key => {

            updates[
                `holdRolls/${holdId}/${key}`
            ] =
                changes[key];

        }
    );


    await update(
        ref(db),
        updates
    );
}


/* =========================================================
   CREATE HOLD
========================================================= */

async function createHold(event) {

    event.preventDefault();

    if (!holdForm.checkValidity()) {

        holdForm.reportValidity();

        return;
    }


    const formData =
        new FormData(holdForm);


    const jobNo =
        String(
            formData.get("jobNo") || ""
        ).trim();

    const jobName =
        String(
            formData.get("jobName") || ""
        ).trim();

    const rollNo =
        String(
            formData.get("rollNo") || ""
        ).trim();

    const netWeight =
        Number(
            formData.get("netWeight") || 0
        );

    const process =
        String(
            formData.get("process") || ""
        ).trim();

    const machine =
        String(
            formData.get("machine") || ""
        ).trim();

    const productionDate =
        String(
            formData.get("productionDate") || ""
        ).trim();

    const shift =
        String(
            formData.get("shift") || ""
        ).trim();

    const operator =
        String(
            formData.get("operator") || ""
        ).trim();

    const supervisor =
        String(
            formData.get("supervisor") || ""
        ).trim();

    const qcInspector =
        String(
            formData.get("qcInspector") || ""
        ).trim();

    const holdReason =
        String(
            formData.get("holdReason") || ""
        ).trim();

    const observation =
        String(
            formData.get("observation") || ""
        ).trim();

    const photoFile =
        labelPhoto.files?.[0];


    /* VALIDATION */

    if (!jobNo) {

        alert("Please enter Job Number.");

        return;
    }

    if (!rollNo) {

        alert("Please enter Roll Number.");

        return;
    }

    if (!process) {

        alert("Please select Process.");

        return;
    }

    if (!productionDate) {

        alert("Please select Production Date.");

        return;
    }

    if (!shift) {

        alert("Please select Shift.");

        return;
    }

    if (!qcInspector) {

        alert("Please enter QC Inspector.");

        return;
    }

    if (!holdReason) {

        alert("Please select Hold Reason.");

        return;
    }

    if (!observation) {

        alert("Please enter Observation.");

        return;
    }

    if (!photoFile) {

        alert(
            "Please upload the roll label photo."
        );

        return;
    }


    try {

        saveHoldBtn.disabled = true;

        saveHoldBtn.textContent =
            "Saving...";


        /* UPLOAD PHOTO */

        const photo =
            await uploadPhoto(
                photoFile
            );


        /* WORKFLOW */

        const workflowType =
            determineWorkflow(
                holdReason
            );

        const workflowState =
            getInitialWorkflowState(
                workflowType
            );


        /* HOLD ID */

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


        /* FIRST ACTION */

        const actionRef =
            push(
                ref(
                    db,
                    `holdRolls/${holdId}/actions`
                )
            );


        const initialAction =
            createAction(
                "HOLD CREATED",
                qcInspector,
                observation
            );


        const holdData = {

            holdId,

            jobNo,

            jobName,

            rollNo,

            netWeight:
                Number.isFinite(netWeight)
                    ? netWeight
                    : 0,

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

                secure_url:
                    photo.secure_url,

                public_id:
                    photo.public_id || "",

                original_filename:
                    photo.original_filename || ""
            },

            workflowType,

            status:
                workflowState.status,

            currentStage:
                workflowState.currentStage,

            holdTimestamp,

            releaseTimestamp:
                null,

            createdAt:
                holdTimestamp,

            updatedAt:
                holdTimestamp,

            actions: {

                [actionRef.key]:
                    initialAction
            }
        };


        await set(
            holdRef,
            holdData
        );


        closeAddHoldModal();

        alert(
            `Hold created successfully.\n\nJob: ${jobNo}\nRoll: ${rollNo}`
        );


    } catch (error) {

        console.error(
            "Create hold error:",
            error
        );

        alert(
            "Unable to create hold.\n\n" +
            (
                error?.message ||
                "Please try again."
            )
        );

    } finally {

        saveHoldBtn.disabled = false;

        saveHoldBtn.textContent =
            "Save Hold";
    }
}


/* =========================================================
   DETAILS MODAL
========================================================= */

window.openDetails = function (holdId) {

    currentHoldId =
        holdId;

    const hold =
        holds[holdId];

    if (!hold) {

        alert(
            "Hold record not found."
        );

        return;
    }

    renderDetailsModal(
        hold
    );

    openModal(
        detailsModal
    );
};


/* =========================================================
   CLOSE DETAILS
========================================================= */

function closeDetailsModal() {

    closeModal(
        detailsModal
    );

    currentHoldId =
        null;
}


/* =========================================================
   INSPECTION DONE
========================================================= */

window.markInspectionDone =
    async function () {

        const hold =
            holds[currentHoldId];

        if (!hold) {
            return;
        }


        const operator =
            document
                .getElementById(
                    "inspectionOperator"
                )
                ?.value
                .trim();

        const supervisor =
            document
                .getElementById(
                    "inspectionSupervisor"
                )
                ?.value
                .trim();

        const remarks =
            document
                .getElementById(
                    "inspectionRemarks"
                )
                ?.value
                .trim();


        if (!operator) {

            alert(
                "Please enter Inspection Operator."
            );

            return;
        }

        if (!supervisor) {

            alert(
                "Please enter Inspection Supervisor."
            );

            return;
        }


        try {

            await updateHoldWithAction(

                currentHoldId,

                "INSPECTION DONE",

                `${operator} / ${supervisor}`,

                remarks,

                {
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

            console.error(error);

            alert(
                "Unable to update inspection."
            );
        }
    };


/* =========================================================
   RELEASE INSPECTION HOLD
========================================================= */

window.releaseInspectionHold =
    async function () {

        const hold =
            holds[currentHoldId];

        if (!hold) {
            return;
        }


        const supervisor =
            document
                .getElementById(
                    "releaseSupervisor"
                )
                ?.value
                .trim();

        const remarks =
            document
                .getElementById(
                    "releaseRemarks"
                )
                ?.value
                .trim();


        if (!supervisor) {

            alert(
                "Please enter Release Supervisor."
            );

            return;
        }


        try {

            await updateHoldWithAction(

                currentHoldId,

                "RELEASED FOR PRODUCTION",

                supervisor,

                remarks,

                {
                    status:
                        "RELEASED",

                    currentStage:
                        "RELEASED",

                    releaseTimestamp:
                        Date.now()
                }
            );


            alert(
                "Roll released for production."
            );


        } catch (error) {

            console.error(error);

            alert(
                "Unable to release hold."
            );
        }
    };


/* =========================================================
   REJECT INSPECTION HOLD
========================================================= */

window.rejectInspectionHold =
    async function () {

        const supervisor =
            document
                .getElementById(
                    "rejectSupervisor"
                )
                ?.value
                .trim();

        const remarks =
            document
                .getElementById(
                    "rejectRemarks"
                )
                ?.value
                .trim();


        if (!supervisor) {

            alert(
                "Please enter Reject Supervisor."
            );

            return;
        }

        if (!remarks) {

            alert(
                "Please enter rejection reason."
            );

            return;
        }


        try {

            await updateHoldWithAction(

                currentHoldId,

                "REJECTED",

                supervisor,

                remarks,

                {
                    status:
                        "REJECTED",

                    currentStage:
                        "REJECTED",

                    releaseTimestamp:
                        Date.now()
                }
            );


            alert(
                "Roll marked as rejected."
            );


        } catch (error) {

            console.error(error);

            alert(
                "Unable to reject hold."
            );
        }
    };


/* =========================================================
   SHADE APPROVAL
========================================================= */

window.submitShadeApproval =
    async function (
        stage,
        decision
    ) {

        const hold =
            holds[currentHoldId];

        if (!hold) {
            return;
        }


        const fieldMap = {

            PRINTING_MANAGER: {
                nameId:
                    "printingManagerName",

                remarksId:
                    "printingManagerRemarks"
            },

            QC_MANAGER: {
                nameId:
                    "qcManagerName",

                remarksId:
                    "qcManagerRemarks"
            },

            GM: {
                nameId:
                    "gmName",

                remarksId:
                    "gmRemarks"
            }
        };


        const fields =
            fieldMap[stage];

        if (!fields) {
            return;
        }


        const name =
            document
                .getElementById(
                    fields.nameId
                )
                ?.value
                .trim();

        const remarks =
            document
                .getElementById(
                    fields.remarksId
                )
                ?.value
                .trim();


        if (!name) {

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
                "Please enter rejection remarks."
            );

            return;
        }


        let actionText =
            "SHADE APPROVED";

        let changes = {};


        if (decision === "REJECT") {

            actionText =
                "SHADE REJECTED";

            changes = {

                status:
                    "REJECTED",

                currentStage:
                    "REJECTED",

                releaseTimestamp:
                    Date.now()
            };

        } else {

            if (
                stage ===
                "PRINTING_MANAGER"
            ) {

                changes = {

                    status:
                        "SHADE_APPROVAL",

                    currentStage:
                        "QC_MANAGER"
                };

            } else if (
                stage === "QC_MANAGER"
            ) {

                changes = {

                    status:
                        "SHADE_APPROVAL",

                    currentStage:
                        "GM"
                };

            } else if (
                stage === "GM"
            ) {

                changes = {

                    status:
                        "RELEASED",

                    currentStage:
                        "RELEASED",

                    releaseTimestamp:
                        Date.now()
                };
            }
        }


        try {

            await updateHoldWithAction(

                currentHoldId,

                actionText,

                name,

                remarks,

                changes
            );


            if (
                decision === "REJECT"
            ) {

                alert(
                    "Roll rejected."
                );

            } else if (
                stage === "GM"
            ) {

                alert(
                    "Shade approved and roll released."
                );

            } else {

                alert(
                    "Approval recorded successfully."
                );
            }


        } catch (error) {

            console.error(error);

            alert(
                "Unable to submit approval."
            );
        }
    };


/* =========================================================
   REVIEW WORKFLOW
========================================================= */

window.submitReview =
    async function (
        decision
    ) {

        const reviewer =
            document
                .getElementById(
                    "reviewPerson"
                )
                ?.value
                .trim();

        const remarks =
            document
                .getElementById(
                    "reviewRemarks"
                )
                ?.value
                .trim();


        if (!reviewer) {

            alert(
                "Please enter Reviewer name."
            );

            return;
        }


        if (
            decision === "REJECT" &&
            !remarks
        ) {

            alert(
                "Please enter rejection remarks."
            );

            return;
        }


        const changes = {

            status:
                decision === "RELEASE"
                    ? "RELEASED"
                    : "REJECTED",

            currentStage:
                decision === "RELEASE"
                    ? "RELEASED"
                    : "REJECTED",

            releaseTimestamp:
                Date.now()
        };


        try {

            await updateHoldWithAction(

                currentHoldId,

                decision === "RELEASE"
                    ? "REVIEW APPROVED"
                    : "REVIEW REJECTED",

                reviewer,

                remarks,

                changes
            );


            alert(
                decision === "RELEASE"
                    ? "Review approved. Roll released."
                    : "Roll rejected."
            );


        } catch (error) {

            console.error(error);

            alert(
                "Unable to submit review."
            );
        }
    };


/* =========================================================
   DETAILS MODAL RENDER
========================================================= */

function renderDetailsModal(hold) {

    const photoUrl =
        getPhotoUrl(
            hold.labelPhoto
        );


    const isClosed =
        hold.status === "RELEASED" ||
        hold.status === "REJECTED";


    detailsContent.innerHTML = `

        <div class="details-top">

            <div class="details-top-item">

                <label>Job Number</label>

                <strong>
                    ${escapeHtml(hold.jobNo)}
                </strong>

            </div>


            <div class="details-top-item">

                <label>Roll Number</label>

                <strong>
                    ${escapeHtml(hold.rollNo)}
                </strong>

            </div>


            <div class="details-top-item">

                <label>Status</label>

                <strong>
                    <span class="badge ${getBadgeClass(hold.status)}">
                        ${escapeHtml(formatStatus(hold.status))}
                    </span>
                </strong>

            </div>


            <div class="details-top-item">

                <label>Age</label>

                <strong>
                    ${escapeHtml(formatDuration(
                        getHoldDurationMs(hold)
                    ))}
                </strong>

            </div>

        </div>


        <section class="details-section">

            <h3>Roll Information</h3>

            <div class="hold-details">

                ${detailHtml(
                    "Job Name",
                    hold.jobName
                )}

                ${detailHtml(
                    "Net Weight",
                    hold.netWeight
                        ? `${hold.netWeight} kg`
                        : "-"
                )}

                ${detailHtml(
                    "Process",
                    hold.process
                )}

                ${detailHtml(
                    "Machine",
                    hold.machine
                )}

                ${detailHtml(
                    "Production Date",
                    hold.productionDate
                )}

                ${detailHtml(
                    "Shift",
                    hold.shift
                )}

                ${detailHtml(
                    "Operator",
                    hold.operator
                )}

                ${detailHtml(
                    "Supervisor",
                    hold.supervisor
                )}

                ${detailHtml(
                    "QC Inspector",
                    hold.qcInspector
                )}

                ${detailHtml(
                    "Current Stage",
                    formatStage(
                        hold.currentStage
                    )
                )}

            </div>

        </section>


        <section class="details-section">

            <h3>Hold Details</h3>

            <div class="hold-details">

                ${detailHtml(
                    "Hold Reason",
                    hold.holdReason
                )}

                ${detailHtml(
                    "Hold Created",
                    formatDateTime(
                        hold.holdTimestamp
                    )
                )}

                ${detailHtml(
                    "Release / Closed",
                    hold.releaseTimestamp
                        ? formatDateTime(
                            hold.releaseTimestamp
                        )
                        : "-"
                )}

            </div>

            <div class="detail-item observation-box">

                <label>Observation</label>

                <span>
                    ${escapeHtml(
                        hold.observation || "-"
                    )}
                </span>

            </div>

        </section>


        ${
            photoUrl
                ? `
                    <section class="details-section">

                        <h3>Roll Label Photo</h3>

                        <img
                            src="${escapeHtml(photoUrl)}"
                            class="label-photo"
                            alt="Roll label photo"
                        >

                    </section>
                `
                : ""
        }


        ${
            !isClosed
                ? renderActionPanel(hold)
                : ""
        }


        <section class="details-section">

            <h3>Action History</h3>

            ${renderTimeline(
                hold.actions
            )}

        </section>
    `;
}


/* =========================================================
   DETAIL ITEM
========================================================= */

function detailHtml(
    label,
    value
) {

    return `

        <div class="detail-item">

            <label>
                ${escapeHtml(label)}
            </label>

            <span>
                ${escapeHtml(
                    value === null ||
                    value === undefined ||
                    value === ""
                        ? "-"
                        : value
                )}
            </span>

        </div>
    `;
}


/* =========================================================
   ACTION PANEL
========================================================= */

function renderActionPanel(hold) {

    if (
        hold.workflowType ===
        "inspection"
    ) {

        if (
            hold.status === "HOLD" ||
            hold.currentStage === "INSPECTION"
        ) {

            return `

                <section class="action-panel">

                    <h3>
                        Action Required: Inspection
                    </h3>

                    <div class="action-subtitle">
                        Complete inspection before the roll can
                        be released or rejected.
                    </div>

                    <div class="form-grid">

                        <div class="form-group">

                            <label>
                                Inspection Operator *
                            </label>

                            <input
                                type="text"
                                id="inspectionOperator"
                                placeholder="Enter operator name"
                            >

                        </div>


                        <div class="form-group">

                            <label>
                                Inspection Supervisor *
                            </label>

                            <input
                                type="text"
                                id="inspectionSupervisor"
                                placeholder="Enter supervisor name"
                            >

                        </div>


                        <div class="form-group full-width">

                            <label>
                                Inspection Remarks
                            </label>

                            <textarea
                                id="inspectionRemarks"
                                placeholder="Enter inspection findings..."
                            ></textarea>

                        </div>

                    </div>


                    <div class="action-buttons">

                        <button
                            type="button"
                            class="btn-primary"
                            onclick="markInspectionDone()"
                        >
                            Mark Inspection Done
                        </button>

                    </div>

                </section>
            `;
        }


        if (
            hold.status ===
            "INSPECTION_DONE"
        ) {

            return `

                <section class="action-panel">

                    <h3>
                        Action Required: Final Decision
                    </h3>

                    <div class="action-subtitle">
                        Inspection is complete. Decide whether
                        the roll should be released or rejected.
                    </div>

                    <div class="form-grid">

                        <div class="form-group">

                            <label>
                                Supervisor *
                            </label>

                            <input
                                type="text"
                                id="releaseSupervisor"
                                placeholder="Supervisor name"
                            >

                        </div>


                        <div class="form-group">

                            <label>
                                Release Remarks
                            </label>

                            <input
                                type="text"
                                id="releaseRemarks"
                                placeholder="Release remarks"
                            >

                        </div>


                        <div class="form-group">

                            <label>
                                Reject Supervisor *
                            </label>

                            <input
                                type="text"
                                id="rejectSupervisor"
                                placeholder="Supervisor name"
                            >

                        </div>


                        <div class="form-group">

                            <label>
                                Rejection Reason *
                            </label>

                            <input
                                type="text"
                                id="rejectRemarks"
                                placeholder="Reason for rejection"
                            >

                        </div>

                    </div>


                    <div class="action-buttons">

                        <button
                            type="button"
                            class="btn-success"
                            onclick="releaseInspectionHold()"
                        >
                            Release for Production
                        </button>

                        <button
                            type="button"
                            class="btn-danger"
                            onclick="rejectInspectionHold()"
                        >
                            Reject
                        </button>

                    </div>

                </section>
            `;
        }
    }


    /* =====================================================
       SHADE APPROVAL
    ====================================================== */

    if (
        hold.workflowType ===
        "shadeApproval"
    ) {

        const stage =
            hold.currentStage;


        if (
            stage ===
            "PRINTING_MANAGER"
        ) {

            return shadeApprovalPanel(
                "PRINTING_MANAGER",
                "Printing Manager"
            );
        }


        if (
            stage ===
            "QC_MANAGER"
        ) {

            return shadeApprovalPanel(
                "QC_MANAGER",
                "QC Manager"
            );
        }


        if (
            stage === "GM"
        ) {

            return shadeApprovalPanel(
                "GM",
                "General Manager"
            );
        }
    }


    /* =====================================================
       REVIEW
    ====================================================== */

    if (
        hold.workflowType ===
        "review"
    ) {

        return `

            <section class="action-panel">

                <h3>
                    Action Required: Review
                </h3>

                <div class="action-subtitle">
                    Review the GSM / Weight issue and decide
                    whether the roll can be released.
                </div>

                <div class="form-grid">

                    <div class="form-group">

                        <label>
                            Reviewer *
                        </label>

                        <input
                            type="text"
                            id="reviewPerson"
                            placeholder="Enter reviewer name"
                        >

                    </div>


                    <div class="form-group full-width">

                        <label>
                            Review Remarks
                        </label>

                        <textarea
                            id="reviewRemarks"
                            placeholder="Enter review remarks..."
                        ></textarea>

                    </div>

                </div>


                <div class="action-buttons">

                    <button
                        type="button"
                        class="btn-success"
                        onclick="submitReview('RELEASE')"
                    >
                        Approve & Release
                    </button>

                    <button
                        type="button"
                        class="btn-danger"
                        onclick="submitReview('REJECT')"
                    >
                        Reject
                    </button>

                </div>

            </section>
        `;
    }


    return "";
}


/* =========================================================
   SHADE APPROVAL PANEL
========================================================= */

function shadeApprovalPanel(
    stage,
    stageName
) {

    const nameId =
        stage === "PRINTING_MANAGER"
            ? "printingManagerName"
            : stage === "QC_MANAGER"
                ? "qcManagerName"
                : "gmName";


    const remarksId =
        stage === "PRINTING_MANAGER"
            ? "printingManagerRemarks"
            : stage === "QC_MANAGER"
                ? "qcManagerRemarks"
                : "gmRemarks";


    return `

        <section class="action-panel">

            <h3>
                Shade Approval: ${escapeHtml(stageName)}
            </h3>

            <div class="action-subtitle">
                Shade mismatch requires approval from
                ${escapeHtml(stageName)}.
            </div>


            <div class="form-grid">

                <div class="form-group">

                    <label>
                        Name *
                    </label>

                    <input
                        type="text"
                        id="${nameId}"
                        placeholder="Enter name"
                    >

                </div>


                <div class="form-group full-width">

                    <label>
                        Remarks
                    </label>

                    <textarea
                        id="${remarksId}"
                        placeholder="Enter approval / rejection remarks..."
                    ></textarea>

                </div>

            </div>


            <div class="action-buttons">

                <button
                    type="button"
                    class="btn-success"
                    onclick="submitShadeApproval(
                        '${stage}',
                        'APPROVE'
                    )"
                >
                    Approve
                </button>

                <button
                    type="button"
                    class="btn-danger"
                    onclick="submitShadeApproval(
                        '${stage}',
                        'REJECT'
                    )"
                >
                    Reject
                </button>

            </div>

        </section>
    `;
}


/* =========================================================
   TIMELINE
========================================================= */

function renderTimeline(actions) {

    if (!actions) {

        return `
            <div class="empty-state">
                No action history available.
            </div>
        `;
    }


    const actionArray =
        Object.entries(actions)
            .map(
                ([id, action]) => ({
                    id,
                    ...action
                })
            )
            .sort(
                (a, b) =>
                    Number(a.timestamp || 0) -
                    Number(b.timestamp || 0)
            );


    if (!actionArray.length) {

        return `
            <div class="empty-state">
                No action history available.
            </div>
        `;
    }


    return `

        <div class="timeline">

            ${actionArray
                .map(
                    action => `

                        <div class="timeline-item">

                            <strong>
                                ${escapeHtml(
                                    action.action ||
                                    "ACTION"
                                )}
                            </strong>

                            <p>
                                ${
                                    action.person
                                        ? escapeHtml(
                                            action.person
                                        )
                                        : ""
                                }

                                ${
                                    action.person &&
                                    action.remarks
                                        ? " — "
                                        : ""
                                }

                                ${
                                    action.remarks
                                        ? escapeHtml(
                                            action.remarks
                                        )
                                        : ""
                                }
                            </p>

                            <small>
                                ${escapeHtml(
                                    formatDateTime(
                                        action.timestamp
                                    )
                                )}
                            </small>

                        </div>
                    `
                )
                .join("")}

        </div>
    `;
}


/* =========================================================
   HOLD CARD
========================================================= */

function createHoldCard(
    hold
) {

    const ageClass =
        getAgeClass(hold);

    const actionText =
        getWaitingActionText(
            hold
        );


    return `

        <article
            class="hold-card ${ageClass}"
        >

            <div class="hold-card-header">

                <div class="hold-card-title">

                    <h3>
                        Job:
                        ${escapeHtml(
                            hold.jobNo
                        )}
                        —
                        Roll:
                        ${escapeHtml(
                            hold.rollNo
                        )}
                    </h3>

                    <p>
                        ${escapeHtml(
                            hold.jobName ||
                            "No Job Name"
                        )}
                    </p>

                </div>


                <span
                    class="badge ${getBadgeClass(
                        hold.status
                    )}"
                >
                    ${escapeHtml(
                        formatStatus(
                            hold.status
                        )
                    )}
                </span>

            </div>


            <div class="hold-details">

                ${detailHtml(
                    "Process",
                    hold.process
                )}

                ${detailHtml(
                    "Machine",
                    hold.machine
                )}

                ${detailHtml(
                    "Weight",
                    hold.netWeight
                        ? `${hold.netWeight} kg`
                        : "-"
                )}

                ${detailHtml(
                    "Reason",
                    hold.holdReason
                )}

                ${detailHtml(
                    "Age",
                    formatDuration(
                        getHoldDurationMs(
                            hold
                        )
                    )
                )}

                ${detailHtml(
                    "Stage",
                    formatStage(
                        hold.currentStage
                    )
                )}

                ${detailHtml(
                    "Production Date",
                    hold.productionDate
                )}

                ${detailHtml(
                    "Shift",
                    hold.shift
                )}

                ${detailHtml(
                    "QC Inspector",
                    hold.qcInspector
                )}

                ${detailHtml(
                    "Hold Time",
                    formatDateTime(
                        hold.holdTimestamp
                    )
                )}

            </div>


            <div class="hold-card-footer">

                <div class="waiting-action">
                    ${escapeHtml(
                        actionText
                    )}
                </div>

                <button
                    type="button"
                    class="view-details-btn"
                    onclick="openDetails(
                        '${escapeHtml(
                            hold.holdId
                        )}'
                    )"
                >
                    View Details
                </button>

            </div>

        </article>
    `;
}


/* =========================================================
   HISTORY CARD
========================================================= */

function createHistoryCard(
    hold
) {

    const ageClass =
        getAgeClass(hold);


    return `

        <article
            class="hold-card ${ageClass}"
        >

            <div class="hold-card-header">

                <div class="hold-card-title">

                    <h3>
                        Job:
                        ${escapeHtml(
                            hold.jobNo
                        )}
                        —
                        Roll:
                        ${escapeHtml(
                            hold.rollNo
                        )}
                    </h3>

                    <p>
                        ${escapeHtml(
                            hold.jobName ||
                            "No Job Name"
                        )}
                    </p>

                </div>


                <span
                    class="badge ${getBadgeClass(
                        hold.status
                    )}"
                >
                    ${escapeHtml(
                        formatStatus(
                            hold.status
                        )
                    )}
                </span>

            </div>


            <div class="hold-details">

                ${detailHtml(
                    "Process",
                    hold.process
                )}

                ${detailHtml(
                    "Machine",
                    hold.machine
                )}

                ${detailHtml(
                    "Weight",
                    hold.netWeight
                        ? `${hold.netWeight} kg`
                        : "-"
                )}

                ${detailHtml(
                    "Reason",
                    hold.holdReason
                )}

                ${detailHtml(
                    "Duration",
                    formatDuration(
                        getHoldDurationMs(
                            hold
                        )
                    )
                )}

                ${detailHtml(
                    "Closed",
                    formatDateTime(
                        hold.releaseTimestamp
                    )
                )}

            </div>


            <div class="hold-card-footer">

                <div class="waiting-action">

                    ${
                        hold.status ===
                        "RELEASED"
                            ? "Released for production"
                            : "Roll rejected"
                    }

                </div>


                <button
                    type="button"
                    class="view-details-btn"
                    onclick="openDetails(
                        '${escapeHtml(
                            hold.holdId
                        )}'
                    )"
                >
                    View Details
                </button>

            </div>

        </article>
    `;
}


/* =========================================================
   WAITING ACTION
========================================================= */

function getWaitingActionText(
    hold
) {

    if (
        hold.status ===
        "RELEASED"
    ) {

        return "Released";
    }


    if (
        hold.status ===
        "REJECTED"
    ) {

        return "Rejected";
    }


    if (
        hold.workflowType ===
        "inspection"
    ) {

        if (
            hold.status ===
            "HOLD"
        ) {

            return "Inspection required";
        }

        if (
            hold.status ===
            "INSPECTION_DONE"
        ) {

            return "Final decision required";
        }
    }


    if (
        hold.workflowType ===
        "shadeApproval"
    ) {

        return (
            "Waiting for " +
            formatStage(
                hold.currentStage
            )
        );
    }


    if (
        hold.workflowType ===
        "review"
    ) {

        return "Review required";
    }


    return "Action required";
}


/* =========================================================
   FILTER MATCH
========================================================= */

function matchesFilters(
    hold
) {

    const search =
        (
            searchInput?.value ||
            ""
        )
            .trim()
            .toLowerCase();


    const process =
        processFilter?.value ||
        "";

    const status =
        statusFilter?.value ||
        "";

    const reason =
        reasonFilter?.value ||
        "";


    if (search) {

        const searchable = [

            hold.jobNo,

            hold.jobName,

            hold.rollNo,

            hold.process,

            hold.machine,

            hold.operator,

            hold.supervisor,

            hold.qcInspector,

            hold.holdReason,

            hold.observation

        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


        if (
            !searchable.includes(
                search
            )
        ) {

            return false;
        }
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
}


/* =========================================================
   SORT
========================================================= */

function sortHoldsDescending(
    list
) {

    return list.sort(
        (a, b) =>
            Number(
                b.holdTimestamp || 0
            ) -
            Number(
                a.holdTimestamp || 0
            )
    );
}


/* =========================================================
   GET HOLD ARRAY
========================================================= */

function getHoldArray() {

    return Object.values(
        holds || {}
    )
        .filter(Boolean);
}


/* =========================================================
   RENDER ACTIVE HOLDS
========================================================= */

function renderActiveHolds() {

    if (!holdList) {
        return;
    }


    let active =
        getHoldArray()
            .filter(
                hold =>
                    hold.status !==
                        "RELEASED" &&
                    hold.status !==
                        "REJECTED"
            )
            .filter(
                matchesFilters
            );


    active =
        sortHoldsDescending(
            active
        );


    if (!active.length) {

        holdList.innerHTML = `

            <div class="empty-state">

                ${
                    getHoldArray().length
                        ? "No active holds match the selected filters."
                        : "No active QC holds."
                }

            </div>
        `;

        return;
    }


    holdList.innerHTML =
        active
            .map(
                createHoldCard
            )
            .join("");
}


/* =========================================================
   RENDER HISTORY
========================================================= */

function renderHistory() {

    if (!historyList) {
        return;
    }


    let history =
        getHoldArray()
            .filter(
                hold =>
                    hold.status ===
                        "RELEASED" ||
                    hold.status ===
                        "REJECTED"
            )
            .filter(
                matchesFilters
            )
            .sort(
                (a, b) =>
                    Number(
                        b.releaseTimestamp ||
                        b.updatedAt ||
                        b.holdTimestamp ||
                        0
                    ) -
                    Number(
                        a.releaseTimestamp ||
                        a.updatedAt ||
                        a.holdTimestamp ||
                        0
                    )
            );


    if (!history.length) {

        historyList.innerHTML = `

            <div class="empty-state">

                No released or rejected
                rolls found.

            </div>
        `;

        return;
    }


    historyList.innerHTML =
        history
            .map(
                createHistoryCard
            )
            .join("");
}


/* =========================================================
   SUMMARY
========================================================= */

function updateSummary() {

    const all =
        getHoldArray();


    const active =
        all.filter(
            hold =>
                hold.status !==
                    "RELEASED" &&
                hold.status !==
                    "REJECTED"
        );


    const released =
        all.filter(
            hold =>
                hold.status ===
                "RELEASED"
        );


    const over24 =
        active.filter(
            hold =>
                getHoldDurationMs(
                    hold
                ) >=
                24 * 60 * 60 * 1000
        );


    const over48 =
        active.filter(
            hold =>
                getHoldDurationMs(
                    hold
                ) >=
                48 * 60 * 60 * 1000
        );


    const totalWeight =
        active.reduce(
            (
                total,
                hold
            ) =>
                total +
                (
                    Number(
                        hold.netWeight
                    ) || 0
                ),
            0
        );


    activeHoldsEl.textContent =
        active.length;

    actionRequiredEl.textContent =
        active.filter(
            requiresAction
        ).length;

    over24El.textContent =
        over24.length;

    over48El.textContent =
        over48.length;

    releasedEl.textContent =
        released.length;

    totalWeightEl.textContent =
        `${totalWeight.toFixed(2)} kg`;
}


/* =========================================================
   RENDER ALL
========================================================= */

function renderAll() {

    updateSummary();

    renderActiveHolds();

    renderHistory();


    if (
        currentHoldId &&
        holds[currentHoldId] &&
        !detailsModal.classList.contains(
            "hidden"
        )
    ) {

        renderDetailsModal(
            holds[currentHoldId]
        );
    }
}


/* =========================================================
   TAB SWITCH
========================================================= */

function switchTab(
    tabName
) {

    currentTab =
        tabName;


    document
        .querySelectorAll(
            ".tabs .tab"
        )
        .forEach(
            tab => {

                tab.classList.toggle(
                    "active",
                    tab.dataset.tab ===
                        tabName
                );
            }
        );


    document
        .querySelectorAll(
            "[data-tab-content]"
        )
        .forEach(
            section => {

                section.classList.toggle(
                    "hidden",
                    section.dataset.tabContent !==
                        tabName
                );
            }
        );
}


/* =========================================================
   LOAD HOLDS
========================================================= */

function loadHolds() {

    const holdsRef =
        ref(
            db,
            "holdRolls"
        );


    onValue(
        holdsRef,
        snapshot => {

            holds =
                snapshot.val() ||
                {};

            renderAll();

        },
        error => {

            console.error(
                "Firebase read error:",
                error
            );

            holdList.innerHTML = `

                <div class="empty-state">

                    Unable to load QC hold data.

                    <br><br>

                    Check Firebase configuration
                    and database rules.

                </div>
            `;
        }
    );
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

addHoldBtn.addEventListener(
    "click",
    openAddHoldModal
);


closeAddHold.addEventListener(
    "click",
    closeAddHoldModal
);


cancelHold.addEventListener(
    "click",
    closeAddHoldModal
);


closeDetails.addEventListener(
    "click",
    closeDetailsModal
);


holdForm.addEventListener(
    "submit",
    createHold
);


/* TABS */

document
    .querySelectorAll(
        ".tabs .tab"
    )
    .forEach(
        tab => {

            tab.addEventListener(
                "click",
                () => {

                    switchTab(
                        tab.dataset.tab
                    );

                }
            );

        }
    );


/* FILTERS */

[
    searchInput,
    processFilter,
    statusFilter,
    reasonFilter
]
    .forEach(
        element => {

            if (!element) {
                return;
            }

            element.addEventListener(
                "input",
                renderAll
            );

            element.addEventListener(
                "change",
                renderAll
            );

        }
    );


/* MODAL BACKGROUND CLICK */

addHoldModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            addHoldModal
        ) {

            closeAddHoldModal();
        }
    }
);


detailsModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            detailsModal
        ) {

            closeDetailsModal();
        }
    }
);


/* ESCAPE */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key !==
            "Escape"
        ) {
            return;
        }


        if (
            !addHoldModal.classList.contains(
                "hidden"
            )
        ) {

            closeAddHoldModal();

            return;
        }


        if (
            !detailsModal.classList.contains(
                "hidden"
            )
        ) {

            closeDetailsModal();
        }
    }
);


/* =========================================================
   LIVE AGE REFRESH
========================================================= */

setInterval(
    () => {

        updateSummary();

        if (
            currentTab ===
            "active"
        ) {

            renderActiveHolds();

        }

        if (
            currentTab ===
            "history"
        ) {

            renderHistory();
        }


        if (
            currentHoldId &&
            !detailsModal.classList.contains(
                "hidden"
            ) &&
            holds[currentHoldId]
        ) {

            renderDetailsModal(
                holds[currentHoldId]
            );
        }

    },
    60000
);


/* =========================================================
   START APPLICATION
========================================================= */

loadHolds();

renderAll();


console.log(
    "APEX QC HOLD ROLL MONITOR loaded successfully."
);
