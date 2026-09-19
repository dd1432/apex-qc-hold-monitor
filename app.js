/* =========================================================
   APEX QC HOLD ROLL MONITOR - APP LOGIC
   ========================================================= */

// --- GLOBAL STATE ---
let holds = {};
let currentHoldId = null;


// =========================================================
// WEBSITE URL
// =========================================================
// IMPORTANT:
// Change this ONLY if your GitHub Pages URL is different.
const WEBSITE_URL =
    "https://dd1432.github.io/apex-qc-hold-monitor/";


/* =========================================================
   FIREBASE INITIALIZATION & DB REFERENCE
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


// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const holdsRef = db.ref("holds");


/* =========================================================
   INITIALIZATION & EVENT LISTENERS
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    setupTabs();

    setupModals();

    setupFilters();

    setupHoldForm();

    initFirebaseListener();

});


function initFirebaseListener() {

    holdsRef.on(
        "value",

        (snapshot) => {

            holds = snapshot.val() || {};

            renderDashboard();

            // Existing deep-link logic
            openHoldFromUrl();

        },

        (error) => {

            console.error(
                "Firebase Database Read Error:",
                error
            );

        }
    );

}


/* =========================================================
   HELPER & FORMATTING FUNCTIONS
========================================================= */

function formatStatus(status) {

    if (!status) return "N/A";

    const statusMap = {

        "hold": "ON HOLD",

        "released": "RELEASED",

        "rejected": "REJECTED",

        "inspection_done": "INSPECTION DONE",

        "shade_approval": "SHADE APPROVAL",

        "review": "REVIEW"

    };

    return (
        statusMap[status.toLowerCase()] ||
        status.toUpperCase()
    );

}


function formatStage(stage) {

    if (!stage) return "N/A";

    const stageMap = {

        "inspection":
            "QC Inspection Required",

        "review":
            "Manager Review Required",

        "shade_approval":
            "Shade Approval Required",

        "completed":
            "Completed"

    };

    return (
        stageMap[stage.toLowerCase()] ||
        stage
    );

}


function formatDateTime(timestamp) {

    if (!timestamp) return "N/A";

    const date = new Date(timestamp);

    return date.toLocaleString(
        "en-US",
        {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


function getHoldDurationMs(hold) {

    if (!hold || !hold.holdTimestamp) {
        return 0;
    }

    const endTime =
        hold.closedTimestamp ||
        Date.now();

    return endTime - hold.holdTimestamp;

}


function formatDuration(ms) {

    if (!ms || ms <= 0) {
        return "0h 0m";
    }

    const totalMinutes =
        Math.floor(
            ms / (1000 * 60)
        );

    const hours =
        Math.floor(
            totalMinutes / 60
        );

    const minutes =
        totalMinutes % 60;

    const days =
        Math.floor(hours / 24);

    if (days > 0) {

        return `${days}d ${hours % 24}h ${minutes}m`;

    }

    return `${hours}h ${minutes}m`;

}


/* =========================================================
   DASHBOARD & TABS
========================================================= */

function setupTabs() {

    const tabButtons =
        document.querySelectorAll(
            ".tabs .tab"
        );

    tabButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const targetTab =
                    button.getAttribute(
                        "data-tab"
                    );


                tabButtons.forEach(btn => {

                    btn.classList.remove(
                        "active"
                    );

                    btn.setAttribute(
                        "aria-selected",
                        "false"
                    );

                });


                button.classList.add(
                    "active"
                );

                button.setAttribute(
                    "aria-selected",
                    "true"
                );


                document
                    .querySelectorAll(
                        "[data-tab-content]"
                    )
                    .forEach(content => {

                        if (
                            content.getAttribute(
                                "data-tab-content"
                            ) === targetTab
                        ) {

                            content.classList.remove(
                                "hidden"
                            );

                        } else {

                            content.classList.add(
                                "hidden"
                            );

                        }

                    });

            }
        );

    });

}


function renderDashboard() {

    updateSummaryCards();

    renderHoldList();

    renderHistoryList();

}


/* =========================================================
   SUMMARY CARDS
========================================================= */

function updateSummaryCards() {

    let activeHoldsCount = 0;

    let actionRequiredCount = 0;

    let over24Count = 0;

    let over48Count = 0;

    let releasedCount = 0;

    let totalWeight = 0;


    Object.values(holds).forEach(
        hold => {

            const status =
                (hold.status || "")
                    .toLowerCase();


            if (status === "hold") {

                activeHoldsCount++;

                totalWeight +=
                    Number(
                        hold.netWeight
                    ) || 0;


                const durationHours =
                    getHoldDurationMs(hold) /
                    (1000 * 60 * 60);


                if (durationHours > 48) {

                    over48Count++;

                } else if (
                    durationHours > 24
                ) {

                    over24Count++;

                }


                const stage =
                    (hold.currentStage || "")
                        .toLowerCase();


                if (
                    stage === "inspection" ||
                    stage === "review"
                ) {

                    actionRequiredCount++;

                }

            } else if (
                status === "released"
            ) {

                releasedCount++;

            }

        }
    );


    const activeEl =
        document.getElementById(
            "activeHolds"
        );

    const actionEl =
        document.getElementById(
            "actionRequired"
        );

    const over24El =
        document.getElementById(
            "over24"
        );

    const over48El =
        document.getElementById(
            "over48"
        );

    const releasedEl =
        document.getElementById(
            "released"
        );

    const weightEl =
        document.getElementById(
            "totalWeight"
        );


    if (activeEl) {
        activeEl.textContent =
            activeHoldsCount;
    }

    if (actionEl) {
        actionEl.textContent =
            actionRequiredCount;
    }

    if (over24El) {
        over24El.textContent =
            over24Count;
    }

    if (over48El) {
        over48El.textContent =
            over48Count;
    }

    if (releasedEl) {
        releasedEl.textContent =
            releasedCount;
    }

    if (weightEl) {
        weightEl.textContent =
            `${totalWeight.toFixed(2)} kg`;
    }

}


/* =========================================================
   LIST RENDERING
========================================================= */

function renderHoldList() {

    const holdList =
        document.getElementById(
            "holdList"
        );

    if (!holdList) return;

    holdList.innerHTML = "";


    const activeHolds =
        Object.entries(holds)

            .filter(
                ([_, hold]) =>
                    (
                        hold.status || ""
                    ).toLowerCase() === "hold"
            )

            .sort(
                (a, b) =>
                    (
                        b[1].holdTimestamp || 0
                    ) -
                    (
                        a[1].holdTimestamp || 0
                    )
            );


    if (activeHolds.length === 0) {

        holdList.innerHTML =
            `<div class="empty-state">
                No active holds found.
             </div>`;

        return;
    }


    activeHolds.forEach(
        ([id, hold]) => {

            const durationMs =
                getHoldDurationMs(hold);


            const durationHours =
                durationMs /
                (1000 * 60 * 60);


            let severityClass =
                "normal";


            if (durationHours > 48) {

                severityClass =
                    "critical";

            } else if (
                durationHours > 24
            ) {

                severityClass =
                    "warning";

            }


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                `hold-card ${severityClass}`;


            card.innerHTML = `

                <div class="hold-card-header">

                    <div class="hold-card-title">

                        <h3>
                            Job #${hold.jobNo || "N/A"}
                            —
                            Roll #${hold.rollNo || "N/A"}
                        </h3>

                        <p>
                            ${hold.jobName || "N/A"}
                        </p>

                    </div>

                    <span class="badge badge-hold">
                        AGE:
                        ${formatDuration(durationMs)}
                    </span>

                </div>


                <div class="hold-details">

                    <div class="detail-item">

                        <label>
                            Process / Machine
                        </label>

                        <span>
                            ${hold.process || "N/A"}
                            (${hold.machine || "N/A"})
                        </span>

                    </div>


                    <div class="detail-item">

                        <label>
                            Weight
                        </label>

                        <span>
                            ${hold.netWeight || 0} kg
                        </span>

                    </div>


                    <div class="detail-item">

                        <label>
                            Reason
                        </label>

                        <span>
                            ${hold.holdReason || "N/A"}
                        </span>

                    </div>


                    <div class="detail-item">

                        <label>
                            Stage
                        </label>

                        <span>
                            ${formatStage(
                                hold.currentStage
                            )}
                        </span>

                    </div>


                    <div class="detail-item">

                        <label>
                            Inspector
                        </label>

                        <span>
                            ${hold.qcInspector || "N/A"}
                        </span>

                    </div>

                </div>


                <div class="hold-card-footer">

                    <span class="waiting-action">
                        Stage:
                        ${formatStage(
                            hold.currentStage
                        )}
                    </span>


                    <button
                        class="view-details-btn"
                        onclick="openDetails('${id}')">

                        View Details

                    </button>

                </div>

            `;


            holdList.appendChild(card);

        }
    );

}


function renderHistoryList() {

    const historyList =
        document.getElementById(
            "historyList"
        );

    if (!historyList) return;

    historyList.innerHTML = "";


    const historyHolds =
        Object.entries(holds)

            .filter(
                ([_, hold]) =>
                    (
                        hold.status || ""
                    ).toLowerCase() !== "hold"
            )

            .sort(
                (a, b) =>
                    (
                        b[1].closedTimestamp || 0
                    ) -
                    (
                        a[1].closedTimestamp || 0
                    )
            );


    if (historyHolds.length === 0) {

        historyList.innerHTML =
            `<div class="empty-state">
                No history records found.
             </div>`;

        return;
    }


    historyHolds.forEach(
        ([id, hold]) => {

            const isReleased =
                (
                    hold.status || ""
                ).toLowerCase() === "released";


            const badgeClass =
                isReleased
                    ? "badge-released"
                    : "badge-rejected";


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "hold-card normal";


            card.innerHTML = `

                <div class="hold-card-header">

                    <div class="hold-card-title">

                        <h3>
                            Job #${hold.jobNo || "N/A"}
                            —
                            Roll #${hold.rollNo || "N/A"}
                        </h3>

                        <p>
                            ${hold.jobName || "N/A"}
                        </p>

                    </div>


                    <span class="badge ${badgeClass}">
                        ${formatStatus(
                            hold.status
                        )}
                    </span>

                </div>


                <div class="hold-details">

                    <div class="detail-item">

                        <label>
                            Process / Machine
                        </label>

                        <span>
                            ${hold.process || "N/A"}
                            (${hold.machine || "N/A"})
                        </span>

                    </div>


                    <div class="detail-item">

                        <label>
                            Weight
                        </label>

                        <span>
                            ${hold.netWeight || 0} kg
                        </span>

                    </div>


                    <div class="detail-item">

                        <label>
                            Total Hold Time
                        </label>

                        <span>
                            ${formatDuration(
                                getHoldDurationMs(hold)
                            )}
                        </span>

                    </div>


                    <div class="detail-item">

                        <label>
                            Closed Date
                        </label>

                        <span>
                            ${formatDateTime(
                                hold.closedTimestamp
                            )}
                        </span>

                    </div>

                </div>


                <div class="hold-card-footer">

                    <span class="waiting-action">
                        Closed
                    </span>


                    <button
                        class="view-details-btn"
                        onclick="openDetails('${id}')">

                        View Details

                    </button>

                </div>

            `;


            historyList.appendChild(card);

        }
    );

}


/* =========================================================
   MODAL CONTROL & ACCESSIBILITY
========================================================= */

function setupModals() {

    const addHoldBtn =
        document.getElementById(
            "addHoldBtn"
        );

    const closeAddHold =
        document.getElementById(
            "closeAddHold"
        );

    const cancelHold =
        document.getElementById(
            "cancelHold"
        );


    if (addHoldBtn) {

        addHoldBtn.addEventListener(
            "click",
            () => openModal(
                "addHoldModal"
            )
        );

    }


    if (closeAddHold) {

        closeAddHold.addEventListener(
            "click",
            () =>
                closeModal(
                    "addHoldModal",
                    addHoldBtn
                )
        );

    }


    if (cancelHold) {

        cancelHold.addEventListener(
            "click",
            () =>
                closeModal(
                    "addHoldModal",
                    addHoldBtn
                )
        );

    }


    const closeDetails =
        document.getElementById(
            "closeDetails"
        );


    if (closeDetails) {

        closeDetails.addEventListener(
            "click",
            () =>
                closeModal(
                    "detailsModal"
                )
        );

    }

}


function openModal(modalId) {

    const modal =
        document.getElementById(
            modalId
        );

    if (!modal) return;


    modal.classList.remove(
        "hidden"
    );

    modal.removeAttribute(
        "aria-hidden"
    );

    modal.removeAttribute(
        "inert"
    );


    const focusTarget =
        modal.querySelector(
            "input, select, textarea, button"
        );


    if (focusTarget) {

        setTimeout(
            () =>
                focusTarget.focus(),
            50
        );

    }

}


function closeModal(
    modalId,
    returnFocusElement = null
) {

    const modal =
        document.getElementById(
            modalId
        );

    if (!modal) return;


    if (
        document.activeElement &&
        modal.contains(
            document.activeElement
        )
    ) {

        document.activeElement.blur();

    }


    if (
        returnFocusElement &&
        typeof returnFocusElement.focus ===
        "function"
    ) {

        returnFocusElement.focus();

    } else {

        document.body.focus();

    }


    modal.classList.add(
        "hidden"
    );

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    modal.setAttribute(
        "inert",
        ""
    );

}


/* =========================================================
   DIRECT HOLD LINK
========================================================= */

function getHoldLink(holdId) {

    if (!holdId) return WEBSITE_URL;

    return (
        WEBSITE_URL +
        "?hold=" +
        encodeURIComponent(holdId)
    );

}


/* =========================================================
   DETAILS MODAL
========================================================= */

function openDetails(holdId) {

    currentHoldId = holdId;

    const hold =
        holds[holdId];


    if (!hold) return;


    const detailJobNo =
        document.getElementById(
            "detailJobNo"
        );

    const detailRollNo =
        document.getElementById(
            "detailRollNo"
        );

    const detailJobName =
        document.getElementById(
            "detailJobName"
        );

    const detailStatus =
        document.getElementById(
            "detailStatus"
        );

    const detailStage =
        document.getElementById(
            "detailStage"
        );


    if (detailJobNo) {

        detailJobNo.textContent =
            hold.jobNo || "-";

    }


    if (detailRollNo) {

        detailRollNo.textContent =
            hold.rollNo || "-";

    }


    if (detailJobName) {

        detailJobName.textContent =
            hold.jobName || "-";

    }


    if (detailStatus) {

        detailStatus.textContent =
            formatStatus(
                hold.status
            );

    }


    if (detailStage) {

        detailStage.textContent =
            formatStage(
                hold.currentStage
            );

    }


    /*
       Existing details modal structure may be
       handled by your upgraded version of app.js.

       If detailsContent exists and no content has
       been generated by another details renderer,
       show a basic roll summary so the deep link
       still works.
    */

    const detailsContent =
        document.getElementById(
            "detailsContent"
        );


    if (
        detailsContent &&
        !detailsContent.innerHTML.trim()
    ) {

        detailsContent.innerHTML = `

            <div class="hold-details">

                <div class="detail-item">
                    <label>Job Number</label>
                    <span>${hold.jobNo || "-"}</span>
                </div>

                <div class="detail-item">
                    <label>Roll Number</label>
                    <span>${hold.rollNo || "-"}</span>
                </div>

                <div class="detail-item">
                    <label>Job Name</label>
                    <span>${hold.jobName || "-"}</span>
                </div>

                <div class="detail-item">
                    <label>Process</label>
                    <span>${hold.process || "-"}</span>
                </div>

                <div class="detail-item">
                    <label>Machine</label>
                    <span>${hold.machine || "-"}</span>
                </div>

                <div class="detail-item">
                    <label>Net Weight</label>
                    <span>${hold.netWeight || 0} kg</span>
                </div>

                <div class="detail-item">
                    <label>Hold Reason</label>
                    <span>${hold.holdReason || "-"}</span>
                </div>

                <div class="detail-item">
                    <label>Status</label>
                    <span>${formatStatus(hold.status)}</span>
                </div>

                <div class="detail-item">
                    <label>Current Stage</label>
                    <span>${formatStage(hold.currentStage)}</span>
                </div>

            </div>

            <div style="margin-top:20px;">

                <a
                    href="${getHoldLink(holdId)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-primary">

                    Open Direct Roll Link

                </a>

            </div>

        `;

    }


    openModal(
        "detailsModal"
    );

}


/* =========================================================
   FORM SUBMISSION & DATABASE WRITE
========================================================= */

function setupHoldForm() {

    const holdForm =
        document.getElementById(
            "holdForm"
        );


    if (!holdForm) return;


    holdForm.addEventListener(
        "submit",
        (e) => {

            e.preventDefault();


            const newHold = {

                jobNo:
                    document.getElementById(
                        "jobNo"
                    )?.value || "",


                rollNo:
                    document.getElementById(
                        "rollNo"
                    )?.value || "",


                jobName:
                    document.getElementById(
                        "jobName"
                    )?.value || "",


                process:
                    document.getElementById(
                        "process"
                    )?.value || "",


                machine:
                    document.getElementById(
                        "machine"
                    )?.value || "",


                netWeight:
                    Number(
                        document.getElementById(
                            "netWeight"
                        )?.value
                    ) || 0,


                holdReason:
                    document.getElementById(
                        "holdReason"
                    )?.value || "",


                qcInspector:
                    document.getElementById(
                        "qcInspector"
                    )?.value || "",


                status:
                    "hold",


                currentStage:
                    "inspection",


                holdTimestamp:
                    firebase.database.ServerValue.TIMESTAMP

            };


            holdsRef
                .push(newHold)

                .then(() => {

                    holdForm.reset();

                    closeModal(
                        "addHoldModal",
                        document.getElementById(
                            "addHoldBtn"
                        )
                    );

                })

                .catch(
                    (error) => {

                        console.error(
                            "Error creating hold entry:",
                            error
                        );

                        alert(
                            "Failed to save QC Hold. Check console for details."
                        );

                    }
                );

        }
    );

}


/* =========================================================
   FILTERS & SEARCH
========================================================= */

function setupFilters() {

    const searchInput =
        document.getElementById(
            "searchInput"
        );

    const processFilter =
        document.getElementById(
            "processFilter"
        );

    const statusFilter =
        document.getElementById(
            "statusFilter"
        );

    const reasonFilter =
        document.getElementById(
            "reasonFilter"
        );


    const applyFilters = () => {

        const query =
            searchInput
                ? searchInput.value
                    .toLowerCase()
                    .trim()
                : "";


        const selectedProcess =
            processFilter
                ? processFilter.value
                    .toLowerCase()
                : "";


        const selectedStatus =
            statusFilter
                ? statusFilter.value
                    .toLowerCase()
                : "";


        const selectedReason =
            reasonFilter
                ? reasonFilter.value
                    .toLowerCase()
                : "";


        const cards =
            document.querySelectorAll(
                "#holdList .hold-card, #historyList .hold-card"
            );


        cards.forEach(card => {

            const text =
                card.textContent
                    .toLowerCase();


            const matchesQuery =
                !query ||
                text.includes(query);


            const matchesProcess =
                !selectedProcess ||
                text.includes(
                    selectedProcess
                );


            const matchesStatus =
                !selectedStatus ||
                text.includes(
                    selectedStatus
                );


            const matchesReason =
                !selectedReason ||
                text.includes(
                    selectedReason
                );


            if (
                matchesQuery &&
                matchesProcess &&
                matchesStatus &&
                matchesReason
            ) {

                card.style.display =
                    "";

            } else {

                card.style.display =
                    "none";

            }

        });

    };


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            applyFilters
        );

    }


    if (processFilter) {

        processFilter.addEventListener(
            "change",
            applyFilters
        );

    }


    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            applyFilters
        );

    }


    if (reasonFilter) {

        reasonFilter.addEventListener(
            "change",
            applyFilters
        );

    }

}


/* =========================================================
   EMAIL REMINDER
   ========================================================= */

function normalizeEmailList(value) {

    return (value || "")
        .split(/[;,]/)
        .map(email => email.trim())
        .filter(Boolean);

}


function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);

}


/*
   Creates the email body.

   The direct roll URL is included as plain text.
   Gmail / Outlook normally detects this URL and
   makes it clickable automatically.
*/

function buildReminderEmail(
    hold,
    person,
    message,
    holdId
) {

    const rollLink =
        getHoldLink(holdId);


    const body =

`QC HOLD REMINDER

Responsible Person: ${person}

Job No: ${hold.jobNo || "N/A"}
Job Name: ${hold.jobName || "N/A"}
Roll No: ${hold.rollNo || "N/A"}
Net Weight: ${hold.netWeight || 0} kg

Process: ${hold.process || "N/A"}
Machine: ${hold.machine || "N/A"}

Production Date: ${hold.productionDate || "N/A"}
Shift: ${hold.shift || "N/A"}

Operator: ${hold.operator || "N/A"}
Supervisor: ${hold.supervisor || "N/A"}
QC Inspector: ${hold.qcInspector || "N/A"}

Hold Reason: ${hold.holdReason || "N/A"}

Status: ${formatStatus(hold.status)}
Current Stage: ${formatStage(hold.currentStage)}

Hold Created:
${formatDateTime(hold.holdTimestamp)}

Current Hold Age:
${formatDuration(getHoldDurationMs(hold))}

Observation:
${hold.observation || "No observation provided."}


OPEN THIS SPECIFIC ROLL IN APEX QC HOLD MONITOR:

${rollLink}


${message ? `Additional Message:
${message}
` : ""}

This is an automatically generated QC Hold reminder.`;


    return {
        subject:
            `QC HOLD REMINDER - Job ${hold.jobNo || "N/A"} - Roll ${hold.rollNo || "N/A"}`,

        body,

        rollLink

    };

}


/* =========================================================
   REMINDER PANEL
========================================================= */

function renderReminderPanel(hold) {

    if (!currentHoldId) {
        return "";
    }


    return `

        <div class="reminder-panel">

            <div class="reminder-panel-header">

                <h3>
                    Send Reminder
                </h3>

            </div>


            <div class="form-group">

                <label for="reminderPerson">
                    Responsible Person *
                </label>

                <input
                    type="text"
                    id="reminderPerson"
                    placeholder="Responsible person name">

            </div>


            <div class="form-group">

                <label for="reminderTo">
                    To Email ID(s) *
                </label>

                <input
                    type="text"
                    id="reminderTo"
                    placeholder="person@example.com, person2@example.com">

                <small>
                    Separate multiple email IDs with comma or semicolon.
                </small>

            </div>


            <div class="form-group">

                <label for="reminderCc">
                    CC Email ID(s)
                </label>

                <input
                    type="text"
                    id="reminderCc"
                    placeholder="Optional CC email IDs">

                <small>
                    Separate multiple email IDs with comma or semicolon.
                </small>

            </div>


            <div class="form-group">

                <label for="reminderMessage">
                    Additional Message
                </label>

                <textarea
                    id="reminderMessage"
                    rows="3"
                    placeholder="Optional message..."></textarea>

            </div>


            <div class="form-group">

                <label>
                    Direct Roll Link
                </label>

                <a
                    href="${getHoldLink(currentHoldId)}"
                    target="_blank"
                    rel="noopener noreferrer">

                    Open this specific roll

                </a>

            </div>


            <button
                type="button"
                class="btn-primary"
                onclick="sendReminder()">

                ✉ Send Reminder

            </button>


            <div class="reminder-helper">
                The email contains a direct link to this specific QC hold.
            </div>

        </div>

    `;

}


/* =========================================================
   SEND REMINDER
========================================================= */

window.sendReminder = function () {

    if (!currentHoldId) {

        alert(
            "No QC hold selected."
        );

        return;

    }


    const hold =
        holds[currentHoldId];


    if (!hold) {

        alert(
            "QC hold data could not be found."
        );

        return;

    }


    const person =
        document.getElementById(
            "reminderPerson"
        )?.value.trim() || "";


    const toValue =
        document.getElementById(
            "reminderTo"
        )?.value || "";


    const ccValue =
        document.getElementById(
            "reminderCc"
        )?.value || "";


    const message =
        document.getElementById(
            "reminderMessage"
        )?.value.trim() || "";


    if (!person) {

        alert(
            "Please enter the Responsible Person name."
        );

        return;

    }


    const toEmails =
        normalizeEmailList(
            toValue
        );


    const ccEmails =
        normalizeEmailList(
            ccValue
        );


    if (toEmails.length === 0) {

        alert(
            "Please enter at least one To email ID."
        );

        return;

    }


    const invalidTo =
        toEmails.filter(
            email =>
                !isValidEmail(email)
        );


    if (invalidTo.length > 0) {

        alert(
            "Invalid To email ID(s):\n\n" +
            invalidTo.join("\n")
        );

        return;

    }


    const invalidCc =
        ccEmails.filter(
            email =>
                !isValidEmail(email)
        );


    if (invalidCc.length > 0) {

        alert(
            "Invalid CC email ID(s):\n\n" +
            invalidCc.join("\n")
        );

        return;

    }


    const email =
        buildReminderEmail(
            hold,
            person,
            message,
            currentHoldId
        );


    let mailto =
        "mailto:" +
        encodeURIComponent(
            toEmails.join(",")
        ) +

        "?subject=" +
        encodeURIComponent(
            email.subject
        ) +

        "&body=" +
        encodeURIComponent(
            email.body
        );


    if (ccEmails.length > 0) {

        mailto +=
            "&cc=" +
            encodeURIComponent(
                ccEmails.join(",")
            );

    }


    /*
       Standard mailto behavior:
       - PC: opens the configured default mail application.
       - Mobile: opens the configured mail handler.
       - Gmail/Outlook can automatically recognize
         the direct website URL in the message body.
    */

    window.location.href =
        mailto;

};


/* =========================================================
   DEEP LINK AUTO-OPEN HANDLER
========================================================= */

function openHoldFromUrl() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const holdId =
        params.get("hold");


    if (
        holdId &&
        holds[holdId]
    ) {

        setTimeout(
            () => {

                openDetails(
                    holdId
                );

            },
            500
        );

    }

}
