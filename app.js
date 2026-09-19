/* =====================================================
   APEX QC HOLD ROLL MONITOR
   app.js
===================================================== */


/* =====================================================
   FIREBASE CONFIG
===================================================== */

const firebaseConfig = {
    apiKey: "AIzaSyBZC1ln8lQxkq_JJBHpMF8Fzy850T3rHcg",
    authDomain: "apex-qc-hold-monitor.firebaseapp.com",
    databaseURL: "https://apex-qc-hold-monitor-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "apex-qc-hold-monitor",
    storageBucket: "apex-qc-hold-monitor.firebasestorage.app",
    messagingSenderId: "1006270751442",
    appId: "1:1006270751442:web:dca6ce7f3b3a235ee9030b"
};


/* =====================================================
   WEBSITE URL
===================================================== */

const WEBSITE_URL =
    "https://dd1432.github.io/apex-qc-hold-monitor/";


/* =====================================================
   CLOUDINARY CONFIG
===================================================== */

const CLOUDINARY_CLOUD_NAME =
    "org593vv";

const CLOUDINARY_UPLOAD_PRESET =
    "apex_qc_hold";

const CLOUDINARY_UPLOAD_URL =
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;


/* =====================================================
   FIREBASE INITIALIZATION
===================================================== */

if (!firebase.apps.length) {

    firebase.initializeApp(
        firebaseConfig
    );

}

const db =
    firebase.database();

const holdsRef =
    db.ref("holds");


/* =====================================================
   GLOBAL VARIABLES
===================================================== */

let holds = {};

let currentHoldId = null;


/* =====================================================
   DOM READY
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupTabs();

        setupModals();

        setupFilters();

        setupHoldForm();

        setupPhotoPreview();

        initFirebaseListener();

    }
);


/* =====================================================
   FIREBASE LISTENER
===================================================== */

function initFirebaseListener() {

    holdsRef.on(

        "value",

        (snapshot) => {

            holds =
                snapshot.val() || {};

            renderDashboard();

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


/* =====================================================
   STATUS FORMAT
===================================================== */

function formatStatus(status) {

    if (!status) {
        return "Unknown";
    }

    const value =
        String(status)
            .replace(/_/g, " ")
            .toLowerCase();

    return value.replace(
        /\b\w/g,
        char => char.toUpperCase()
    );

}


/* =====================================================
   STAGE FORMAT
===================================================== */

function formatStage(stage) {

    if (!stage) {
        return "Unknown";
    }

    const value =
        String(stage)
            .replace(/_/g, " ")
            .toLowerCase();

    return value.replace(
        /\b\w/g,
        char => char.toUpperCase()
    );

}


/* =====================================================
   DATE / TIME FORMAT
===================================================== */

function formatDateTime(timestamp) {

    if (!timestamp) {
        return "N/A";
    }

    const date =
        new Date(timestamp);

    if (isNaN(date.getTime())) {
        return "N/A";
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


/* =====================================================
   HOLD DURATION
===================================================== */

function getHoldDurationMs(hold) {

    if (!hold) {
        return 0;
    }

    const start =
        Number(
            hold.holdTimestamp ||
            hold.createdAt ||
            0
        );

    if (!start) {
        return 0;
    }

    const status =
        String(
            hold.status || ""
        ).toUpperCase();

    const end =
        (
            status === "RELEASED" ||
            status === "REJECTED"
        )
            ? Number(
                hold.releaseTimestamp ||
                Date.now()
            )
            : Date.now();

    return Math.max(
        0,
        end - start
    );

}


/* =====================================================
   DURATION FORMAT
===================================================== */

function formatDuration(milliseconds) {

    if (
        !milliseconds ||
        milliseconds < 0
    ) {
        return "0h 0m";
    }

    const totalMinutes =
        Math.floor(
            milliseconds / 60000
        );

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

        return (
            `${days}d ${hours}h ${minutes}m`
        );

    }

    return (
        `${hours}h ${minutes}m`
    );

}


/* =====================================================
   DIRECT HOLD LINK
===================================================== */

function getHoldLink(holdId) {

    if (!holdId) {

        return WEBSITE_URL;

    }

    return (
        WEBSITE_URL +
        "?hold=" +
        encodeURIComponent(
            holdId
        )
    );

}


/* =====================================================
   TABS
===================================================== */

function setupTabs() {

    const tabs =
        document.querySelectorAll(
            ".tab"
        );


    tabs.forEach(tab => {

        tab.addEventListener(
            "click",
            () => {

                tabs.forEach(item => {

                    item.classList.remove(
                        "active"
                    );

                });


                tab.classList.add(
                    "active"
                );


                const tabName =
                    tab.dataset.tab;


                const activeList =
                    document.getElementById(
                        "holdList"
                    );

                const historyList =
                    document.getElementById(
                        "historyList"
                    );


                if (
                    tabName ===
                    "active"
                ) {

                    activeList?.classList.remove(
                        "hidden"
                    );

                    historyList?.classList.add(
                        "hidden"
                    );

                }


                if (
                    tabName ===
                    "history"
                ) {

                    activeList?.classList.add(
                        "hidden"
                    );

                    historyList?.classList.remove(
                        "hidden"
                    );

                }

            }
        );

    });

}


/* =====================================================
   MODALS
===================================================== */

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

    const closeDetails =
        document.getElementById(
            "closeDetails"
        );

    const addHoldModal =
        document.getElementById(
            "addHoldModal"
        );

    const detailsModal =
        document.getElementById(
            "detailsModal"
        );


    addHoldBtn?.addEventListener(
        "click",
        () => {

            openModal(
                "addHoldModal"
            );

        }
    );


    closeAddHold?.addEventListener(
        "click",
        () => {

            closeModal(
                "addHoldModal"
            );

        }
    );


    cancelHold?.addEventListener(
        "click",
        () => {

            closeModal(
                "addHoldModal"
            );

        }
    );


    closeDetails?.addEventListener(
        "click",
        () => {

            closeModal(
                "detailsModal"
            );

        }
    );


    window.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                addHoldModal
            ) {

                closeModal(
                    "addHoldModal"
                );

            }


            if (
                event.target ===
                detailsModal
            ) {

                closeModal(
                    "detailsModal"
                );

            }

        }
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape"
            ) {

                closeModal(
                    "addHoldModal"
                );

                closeModal(
                    "detailsModal"
                );

            }

        }
    );

}


/* =====================================================
   OPEN MODAL
===================================================== */

function openModal(id) {

    const modal =
        document.getElementById(id);

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "hidden"
    );

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

}


/* =====================================================
   CLOSE MODAL
===================================================== */

function closeModal(id) {

    const modal =
        document.getElementById(id);

    if (!modal) {
        return;
    }

    modal.classList.add(
        "hidden"
    );

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* =====================================================
   DASHBOARD
===================================================== */

function renderDashboard() {

    renderSummary();

    renderHoldList();

    renderHistoryList();

}


/* =====================================================
   SUMMARY
===================================================== */

function renderSummary() {

    const allHolds =
        Object.values(
            holds
        );


    const active =
        allHolds.filter(
            hold => {

                const status =
                    String(
                        hold.status || ""
                    ).toUpperCase();

                return (
                    status !== "RELEASED" &&
                    status !== "REJECTED"
                );

            }
        );


    const released =
        allHolds.filter(
            hold =>
                String(
                    hold.status || ""
                ).toUpperCase() ===
                "RELEASED"
        );


    const now =
        Date.now();


    const over24 =
        active.filter(
            hold => {

                const timestamp =
                    Number(
                        hold.holdTimestamp ||
                        hold.createdAt ||
                        0
                    );

                return (
                    timestamp &&
                    now - timestamp >=
                    24 * 60 * 60 * 1000
                );

            }
        );


    const over48 =
        active.filter(
            hold => {

                const timestamp =
                    Number(
                        hold.holdTimestamp ||
                        hold.createdAt ||
                        0
                    );

                return (
                    timestamp &&
                    now - timestamp >=
                    48 * 60 * 60 * 1000
                );

            }
        );


    const actionRequired =
        active.filter(
            hold => {

                const status =
                    String(
                        hold.status || ""
                    ).toUpperCase();

                return (
                    status === "INSPECTION" ||
                    status === "SHADE_APPROVAL" ||
                    status === "REVIEW"
                );

            }
        );


    const totalWeight =
        active.reduce(
            (
                sum,
                hold
            ) => {

                return (
                    sum +
                    (
                        parseFloat(
                            hold.netWeight
                        ) || 0
                    )
                );

            },
            0
        );


    setText(
        "activeHolds",
        active.length
    );

    setText(
        "actionRequired",
        actionRequired.length
    );

    setText(
        "over24",
        over24.length
    );

    setText(
        "over48",
        over48.length
    );

    setText(
        "released",
        released.length
    );

    setText(
        "totalWeight",
        `${totalWeight.toFixed(2)} kg`
    );

}


/* =====================================================
   SET TEXT
===================================================== */

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );

    if (element) {

        element.textContent =
            value;

    }

}


/* =====================================================
   ACTIVE HOLD LIST
===================================================== */

function renderHoldList() {

    const container =
        document.getElementById(
            "holdList"
        );

    if (!container) {
        return;
    }


    const search =
        getFilterValue(
            "searchInput"
        ).toLowerCase();


    const processFilter =
        getFilterValue(
            "processFilter"
        );


    const statusFilter =
        getFilterValue(
            "statusFilter"
        );


    const reasonFilter =
        getFilterValue(
            "reasonFilter"
        );


    const activeHolds =
        Object.entries(
            holds
        )

        .filter(
            ([id, hold]) => {

                const status =
                    String(
                        hold.status || ""
                    ).toUpperCase();

                return (
                    status !== "RELEASED" &&
                    status !== "REJECTED"
                );

            }
        )

        .filter(
            ([id, hold]) =>
                matchesFilters(
                    id,
                    hold,
                    search,
                    processFilter,
                    statusFilter,
                    reasonFilter
                )
        )

        .sort(
            (
                [idA, holdA],
                [idB, holdB]
            ) => {

                const a =
                    Number(
                        holdA.holdTimestamp ||
                        holdA.createdAt ||
                        0
                    );

                const b =
                    Number(
                        holdB.holdTimestamp ||
                        holdB.createdAt ||
                        0
                    );

                return b - a;

            }
        );


    if (
        !activeHolds.length
    ) {

        container.innerHTML = `
            <div class="empty-state">
                No active QC hold rolls found.
            </div>
        `;

        return;

    }


    container.innerHTML =
        activeHolds
            .map(
                ([id, hold]) =>
                    createHoldCard(
                        id,
                        hold
                    )
            )
            .join("");

}


/* =====================================================
   HISTORY LIST
===================================================== */

function renderHistoryList() {

    const container =
        document.getElementById(
            "historyList"
        );

    if (!container) {
        return;
    }


    const search =
        getFilterValue(
            "searchInput"
        ).toLowerCase();


    const processFilter =
        getFilterValue(
            "processFilter"
        );


    const statusFilter =
        getFilterValue(
            "statusFilter"
        );


    const reasonFilter =
        getFilterValue(
            "reasonFilter"
        );


    const history =
        Object.entries(
            holds
        )

        .filter(
            ([id, hold]) => {

                const status =
                    String(
                        hold.status || ""
                    ).toUpperCase();

                return (
                    status === "RELEASED" ||
                    status === "REJECTED"
                );

            }
        )

        .filter(
            ([id, hold]) =>
                matchesFilters(
                    id,
                    hold,
                    search,
                    processFilter,
                    statusFilter,
                    reasonFilter
                )
        )

        .sort(
            (
                [idA, holdA],
                [idB, holdB]
            ) => {

                const a =
                    Number(
                        holdA.releaseTimestamp ||
                        holdA.holdTimestamp ||
                        holdA.createdAt ||
                        0
                    );

                const b =
                    Number(
                        holdB.releaseTimestamp ||
                        holdB.holdTimestamp ||
                        holdB.createdAt ||
                        0
                    );

                return b - a;

            }
        );


    if (!history.length) {

        container.innerHTML = `
            <div class="empty-state">
                No history records found.
            </div>
        `;

        return;

    }


    container.innerHTML =
        history
            .map(
                ([id, hold]) =>
                    createHoldCard(
                        id,
                        hold
                    )
            )
            .join("");

}


/* =====================================================
   CREATE HOLD CARD
===================================================== */

function createHoldCard(
    id,
    hold
) {

    const status =
        String(
            hold.status || ""
        ).toUpperCase();


    const age =
        formatDuration(
            getHoldDurationMs(
                hold
            )
        );


    return `

        <div
            class="hold-card"
            data-hold-id="${escapeHtml(id)}"
            onclick="openDetails('${escapeJs(id)}')"
        >

            <div class="hold-card-header">

                <div>

                    <strong>
                        Job:
                        ${escapeHtml(
                            hold.jobNo ||
                            "N/A"
                        )}
                    </strong>

                    <div>

                        Roll:
                        ${escapeHtml(
                            hold.rollNo ||
                            "N/A"
                        )}

                    </div>

                </div>


                <span
                    class="status-badge status-${status.toLowerCase()}"
                >

                    ${escapeHtml(
                        formatStatus(
                            hold.status
                        )
                    )}

                </span>

            </div>


            <div class="hold-card-body">

                <div>

                    <strong>
                        Job Name
                    </strong>

                    <span>
                        ${escapeHtml(
                            hold.jobName ||
                            "N/A"
                        )}
                    </span>

                </div>


                <div>

                    <strong>
                        Process
                    </strong>

                    <span>
                        ${escapeHtml(
                            hold.process ||
                            "N/A"
                        )}
                    </span>

                </div>


                <div>

                    <strong>
                        Machine
                    </strong>

                    <span>
                        ${escapeHtml(
                            hold.machine ||
                            "N/A"
                        )}
                    </span>

                </div>


                <div>

                    <strong>
                        Weight
                    </strong>

                    <span>
                        ${escapeHtml(
                            hold.netWeight ||
                            "0"
                        )} kg
                    </span>

                </div>


                <div>

                    <strong>
                        Hold Reason
                    </strong>

                    <span>
                        ${escapeHtml(
                            hold.holdReason ||
                            "N/A"
                        )}
                    </span>

                </div>


                <div>

                    <strong>
                        Hold Age
                    </strong>

                    <span>
                        ${escapeHtml(
                            age
                        )}
                    </span>

                </div>

            </div>


            <div class="hold-card-footer">

                <span>

                    QC:
                    ${escapeHtml(
                        hold.qcInspector ||
                        "N/A"
                    )}

                </span>


                <span>

                    ${formatDateTime(
                        hold.holdTimestamp ||
                        hold.createdAt
                    )}

                </span>

            </div>

        </div>

    `;

}


/* =====================================================
   FILTER SETUP
===================================================== */

function setupFilters() {

    const filterIds = [

        "searchInput",
        "processFilter",
        "statusFilter",
        "reasonFilter"

    ];


    filterIds.forEach(
        id => {

            const element =
                document.getElementById(
                    id
                );

            if (!element) {
                return;
            }


            element.addEventListener(
                "input",
                renderDashboard
            );


            element.addEventListener(
                "change",
                renderDashboard
            );

        }
    );

}


/* =====================================================
   GET FILTER VALUE
===================================================== */

function getFilterValue(id) {

    const element =
        document.getElementById(
            id
        );

    if (!element) {
        return "";
    }

    return String(
        element.value || ""
    ).trim();

}


/* =====================================================
   FILTER MATCH
===================================================== */

function matchesFilters(
    id,
    hold,
    search,
    processFilter,
    statusFilter,
    reasonFilter
) {

    if (search) {

        const searchableText = [

            id,
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
            !searchableText.includes(
                search
            )
        ) {

            return false;

        }

    }


    if (
        processFilter &&
        processFilter !== "ALL"
    ) {

        if (
            String(
                hold.process || ""
            ).toLowerCase() !==
            processFilter.toLowerCase()
        ) {

            return false;

        }

    }


    if (
        statusFilter &&
        statusFilter !== "ALL"
    ) {

        if (
            String(
                hold.status || ""
            ).toLowerCase() !==
            statusFilter.toLowerCase()
        ) {

            return false;

        }

    }


    if (
        reasonFilter &&
        reasonFilter !== "ALL"
    ) {

        if (
            String(
                hold.holdReason || ""
            ).toLowerCase() !==
            reasonFilter.toLowerCase()
        ) {

            return false;

        }

    }


    return true;

}


/* =====================================================
   OPEN HOLD DETAILS
===================================================== */

function openDetails(
    holdId
) {

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


    const detailsContent =
        document.getElementById(
            "detailsContent"
        );


    if (!detailsContent) {

        console.error(
            "detailsContent element not found."
        );

        return;

    }


    const directLink =
        getHoldLink(
            holdId
        );


    const duration =
        formatDuration(
            getHoldDurationMs(
                hold
            )
        );


    let photoHtml = "";


    if (hold.labelPhoto) {

        const photoUrl =
            getPhotoUrl(
                hold.labelPhoto
            );


        if (photoUrl) {

            photoHtml = `

                <div
                    class="detail-item full-width"
                >

                    <label>
                        Label Photo
                    </label>

                    <div>

                        <a
                            href="${escapeAttribute(photoUrl)}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >

                            <img
                                src="${escapeAttribute(photoUrl)}"
                                alt="Label Photo"
                                style="
                                    max-width:250px;
                                    max-height:250px;
                                    object-fit:contain;
                                    border-radius:8px;
                                    cursor:pointer;
                                "
                            >

                        </a>

                    </div>

                </div>

            `;

        }

    }


    detailsContent.innerHTML = `

        <div class="hold-details">


            <div class="detail-item">

                <label>
                    Job Number
                </label>

                <span>
                    ${escapeHtml(
                        hold.jobNo ||
                        "N/A"
                    )}
                </span>

            </div>


            <div class="detail-item">

                <label>
                    Job Name
                </label>

                <span>
                    ${escapeHtml(
                        hold.jobName ||
                        "N/A"
                    )}
                </span>

            </div>


            <div class="detail-item">

                <label>
                    Roll Number
                </label>

                <span>
                    ${escapeHtml(
                        hold.rollNo ||
                        "N/A"
                    )}
                </span>

            </div>


            <div class="detail-item">

                <label>
                    Net Weight
                </label>

                <span>
                    ${escapeHtml(
                        hold.netWeight ||
                        "0"
                    )} kg
                </span>

            </div>


            <div class="detail-item">

                <label>
                    Process
                </label>

                <span>
                    ${escapeHtml(
                        hold.process ||
                        "N/A"
                    )}
                </span>

            </div>


            <div class="detail-item">

                <label>
                    Machine
                </label>

                <span>
                    ${escapeHtml(
                        hold.machine ||
                        "N/A"
                    )}
                </span>

            </div>


            <div class="detail-item">

                <label>
                    Production Date
                </label>

                <span>
                    ${escapeHtml(
                        hold.productionDate ||
                        "N/A"
                    )}
                </span>

            </div>


            <div class="detail-item">

                <label>
                    Shift
                </label>

                <span>
                    ${escapeHtml(
                        hold.shift ||
                        "N/A"
                    )}
                </span>

            </div>


            <div class="detail-item">

                <label>
                    Operator
                </label>

                <span>
                    ${escapeHtml(
                        hold.operator ||
                        "N/A"
                    )}
                </span>

            </div>


            <div class="detail-item">

                <label>
                    Supervisor
                </label>

                <span>
                    ${escapeHtml(
                        hold.supervisor ||
                        "N/A"
                    )}
                </span>

            </div>


            <div class="detail-item">

                <label>
                    QC Inspector
                </label>

                <span>
                    ${escapeHtml(
                        hold.qcInspector ||
                        "N/A"
                    )}
                </span>

            </div>


            <div class="detail-item">

                <label>
                    Hold Reason
                </label>

                <span>
                    ${escapeHtml(
                        hold.holdReason ||
                        "N/A"
                    )}
                </span>

            </div>


            <div class="detail-item">

                <label>
                    Status
                </label>

                <span>
                    ${escapeHtml(
                        formatStatus(
                            hold.status
                        )
                    )}
                </span>

            </div>


            <div class="detail-item">

                <label>
                    Current Stage
                </label>

                <span>
                    ${escapeHtml(
                        formatStage(
                            hold.currentStage
                        )
                    )}
                </span>

            </div>


            <div class="detail-item">

                <label>
                    Hold Created
                </label>

                <span>
                    ${formatDateTime(
                        hold.holdTimestamp ||
                        hold.createdAt
                    )}
                </span>

            </div>


            <div class="detail-item">

                <label>
                    Current Hold Age
                </label>

                <span>
                    ${escapeHtml(
                        duration
                    )}
                </span>

            </div>


            <div
                class="detail-item full-width"
            >

                <label>
                    Observation
                </label>

                <span>
                    ${escapeHtml(
                        hold.observation ||
                        "No observation provided."
                    )}
                </span>

            </div>


            ${photoHtml}


        </div>


        <div
            style="
                margin-top:20px;
                display:flex;
                flex-wrap:wrap;
                gap:10px;
            "
        >

            <a
                href="${escapeAttribute(directLink)}"
                target="_blank"
                rel="noopener noreferrer"
                class="btn-primary"
            >

                🔗 Open Direct Roll Link

            </a>


            <button
                type="button"
                class="btn-primary"
                onclick="copyHoldLink('${escapeJs(holdId)}')"
            >

                📋 Copy Roll Link

            </button>


            <button
                type="button"
                class="btn-primary"
                onclick="sendReminder('${escapeJs(holdId)}')"
            >

                📧 Send Reminder

            </button>

        </div>


        <div
            style="
                margin-top:15px;
                padding:12px;
                background:#f5f5f5;
                border-radius:8px;
                word-break:break-all;
            "
        >

            <strong>
                Direct Roll Link:
            </strong>

            <br>

            <a
                href="${escapeAttribute(directLink)}"
                target="_blank"
                rel="noopener noreferrer"
            >

                ${escapeHtml(
                    directLink
                )}

            </a>

        </div>

    `;


    openModal(
        "detailsModal"
    );

}


/* =====================================================
   OPEN HOLD FROM URL
===================================================== */

function openHoldFromUrl() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const holdId =
        params.get(
            "hold"
        );


    if (!holdId) {
        return;
    }


    console.log(
        "Deep link requested for hold:",
        holdId
    );


    if (holds[holdId]) {

        setTimeout(
            () => {

                openDetails(
                    holdId
                );

            },
            300
        );

        return;

    }


    console.log(
        "Waiting for Firebase data for hold:",
        holdId
    );

}


/* =====================================================
   HOLD FORM
===================================================== */

function setupHoldForm() {

    const form =
        document.getElementById(
            "holdForm"
        );


    if (!form) {
        return;
    }


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const saveButton =
                document.getElementById(
                    "saveHoldBtn"
                );


            try {

                if (saveButton) {

                    saveButton.disabled =
                        true;

                    saveButton.textContent =
                        "Saving...";

                }


                const formData =
                    new FormData(
                        form
                    );


                const jobNo =
                    getFormValue(
                        formData,
                        "jobNo"
                    );


                const jobName =
                    getFormValue(
                        formData,
                        "jobName"
                    );


                const rollNo =
                    getFormValue(
                        formData,
                        "rollNo"
                    );


                const netWeight =
                    getFormValue(
                        formData,
                        "netWeight"
                    );


                const process =
                    getFormValue(
                        formData,
                        "process"
                    );


                const machine =
                    getFormValue(
                        formData,
                        "machine"
                    );


                const productionDate =
                    getFormValue(
                        formData,
                        "productionDate"
                    );


                const shift =
                    getFormValue(
                        formData,
                        "shift"
                    );


                const operator =
                    getFormValue(
                        formData,
                        "operator"
                    );


                const supervisor =
                    getFormValue(
                        formData,
                        "supervisor"
                    );


                const qcInspector =
                    getFormValue(
                        formData,
                        "qcInspector"
                    );


                const holdReason =
                    getFormValue(
                        formData,
                        "holdReason"
                    );


                const observation =
                    getFormValue(
                        formData,
                        "observation"
                    );


                const photoInput =
                    document.getElementById(
                        "labelPhoto"
                    );


                let labelPhoto = "";


                if (
                    photoInput &&
                    photoInput.files &&
                    photoInput.files.length
                ) {

                    labelPhoto =
                        await uploadPhoto(
                            photoInput.files[0]
                        );

                }


                if (!jobNo) {

                    alert(
                        "Please enter Job Number."
                    );

                    return;

                }


                if (!rollNo) {

                    alert(
                        "Please enter Roll Number."
                    );

                    return;

                }


                if (!holdReason) {

                    alert(
                        "Please select Hold Reason."
                    );

                    return;

                }


                if (!qcInspector) {

                    alert(
                        "Please enter QC Inspector."
                    );

                    return;

                }


                const workflow =
                    determineWorkflow(
                        holdReason
                    );


                const timestamp =
                    firebase.database.ServerValue.TIMESTAMP;


                const newHold = {

                    jobNo:
                        jobNo,

                    jobName:
                        jobName,

                    rollNo:
                        rollNo,

                    netWeight:
                        netWeight,

                    process:
                        process,

                    machine:
                        machine,

                    productionDate:
                        productionDate,

                    shift:
                        shift,

                    operator:
                        operator,

                    supervisor:
                        supervisor,

                    qcInspector:
                        qcInspector,

                    holdReason:
                        holdReason,

                    observation:
                        observation,

                    labelPhoto:
                        labelPhoto,

                    workflowType:
                        workflow.type,

                    status:
                        workflow.status,

                    currentStage:
                        workflow.stage,

                    holdTimestamp:
                        timestamp,

                    createdAt:
                        timestamp,

                    updatedAt:
                        timestamp

                };


                const newRef =
                    holdsRef.push();


                await newRef.set(
                    newHold
                );


                await newRef
                    .child("actions")
                    .push()
                    .set({

                        type:
                            "HOLD CREATED",

                        person:
                            qcInspector,

                        decision:
                            "HOLD",

                        remarks:
                            observation ||
                            "Roll placed on QC hold.",

                        timestamp:
                            firebase.database.ServerValue.TIMESTAMP

                    });


                form.reset();


                const preview =
                    document.getElementById(
                        "photoPreview"
                    );


                if (preview) {

                    preview.src = "";

                    preview.style.display =
                        "none";

                }


                const progress =
                    document.getElementById(
                        "uploadProgress"
                    );


                if (progress) {

                    progress.textContent =
                        "";

                }


                closeModal(
                    "addHoldModal"
                );


                alert(
                    "QC Hold Roll added successfully."
                );


                setTimeout(
                    () => {

                        openDetails(
                            newRef.key
                        );

                    },
                    300
                );

            }
            catch (error) {

                console.error(
                    "Error creating hold:",
                    error
                );


                alert(
                    "Unable to create QC Hold.\n\n" +
                    error.message
                );

            }
            finally {

                if (saveButton) {

                    saveButton.disabled =
                        false;

                    saveButton.textContent =
                        "Save QC Hold";

                }

            }

        }
    );

}


/* =====================================================
   GET FORM VALUE
===================================================== */

function getFormValue(
    formData,
    field
) {

    const value =
        formData.get(
            field
        );


    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(
        value
    ).trim();

}


/* =====================================================
   DETERMINE WORKFLOW
===================================================== */

function determineWorkflow(
    holdReason
) {

    const reason =
        String(
            holdReason || ""
        ).trim();


    if (
        reason.toLowerCase() ===
        "shade mismatch"
    ) {

        return {

            type:
                "shadeApproval",

            status:
                "SHADE_APPROVAL",

            stage:
                "PRINTING_MANAGER"

        };

    }


    if (
        reason.toLowerCase() ===
        "gsm / weight"
    ) {

        return {

            type:
                "review",

            status:
                "REVIEW",

            stage:
                "REVIEW"

        };

    }


    return {

        type:
            "inspection",

        status:
            "HOLD",

        stage:
            "INSPECTION"

    };

}


/* =====================================================
   PHOTO UPLOAD
===================================================== */

async function uploadPhoto(
    file
) {

    if (!file) {
        return "";
    }


    if (
        file.size >
        10 * 1024 * 1024
    ) {

        throw new Error(
            "Photo size must be less than 10 MB."
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


    const progress =
        document.getElementById(
            "uploadProgress"
        );


    if (progress) {

        progress.textContent =
            "Uploading photo...";

    }


    const response =
        await fetch(
            CLOUDINARY_UPLOAD_URL,
            {

                method:
                    "POST",

                body:
                    formData

            }
        );


    if (!response.ok) {

        throw new Error(
            "Photo upload failed."
        );

    }


    const data =
        await response.json();


    if (progress) {

        progress.textContent =
            "Photo uploaded successfully.";

    }


    return (
        data.secure_url ||
        data.url ||
        ""
    );

}


/* =====================================================
   PHOTO URL
===================================================== */

function getPhotoUrl(
    photo
) {

    if (!photo) {
        return "";
    }


    if (
        typeof photo ===
        "string"
    ) {

        return photo;

    }


    if (photo.secure_url) {

        return photo.secure_url;

    }


    if (photo.url) {

        return photo.url;

    }


    if (photo.imageUrl) {

        return photo.imageUrl;

    }


    if (photo.downloadURL) {

        return photo.downloadURL;

    }


    return "";

}


/* =====================================================
   PHOTO PREVIEW
===================================================== */

function setupPhotoPreview() {

    const input =
        document.getElementById(
            "labelPhoto"
        );


    const preview =
        document.getElementById(
            "photoPreview"
        );


    if (
        !input ||
        !preview
    ) {

        return;

    }


    input.addEventListener(
        "change",
        () => {

            const file =
                input.files &&
                input.files[0];


            if (!file) {

                preview.src = "";

                preview.style.display =
                    "none";

                return;

            }


            const reader =
                new FileReader();


            reader.onload =
                event => {

                    preview.src =
                        event.target.result;

                    preview.style.display =
                        "block";

                };


            reader.readAsDataURL(
                file
            );

        }
    );

}


/* =====================================================
   COPY HOLD LINK
===================================================== */

window.copyHoldLink =
    async function (
        holdId
    ) {

        const link =
            getHoldLink(
                holdId
            );


        try {

            await navigator.clipboard.writeText(
                link
            );


            alert(
                "Direct roll link copied."
            );

        }
        catch (error) {

            const textarea =
                document.createElement(
                    "textarea"
                );


            textarea.value =
                link;


            textarea.style.position =
                "fixed";


            textarea.style.opacity =
                "0";


            document.body.appendChild(
                textarea
            );


            textarea.select();


            document.execCommand(
                "copy"
            );


            textarea.remove();


            alert(
                "Direct roll link copied."
            );

        }

    };


/* =====================================================
   SEND REMINDER
===================================================== */

window.sendReminder =
    function (
        holdId
    ) {

        const hold =
            holds[holdId];


        if (!hold) {

            alert(
                "Hold record not found."
            );

            return;

        }


        const responsiblePerson =
            prompt(
                "Enter responsible person's name:"
            );


        if (
            responsiblePerson ===
            null
        ) {

            return;

        }


        const toInput =
            prompt(
                "Enter To email address(es).\n\n" +
                "For multiple emails, separate with comma or semicolon:"
            );


        if (
            toInput ===
            null
        ) {

            return;

        }


        const ccInput =
            prompt(
                "Enter CC email address(es) - optional.\n\n" +
                "Separate multiple emails with comma or semicolon:"
            );


        if (
            ccInput ===
            null
        ) {

            return;

        }


        const customMessage =
            prompt(
                "Enter optional message:"
            );


        if (
            customMessage ===
            null
        ) {

            return;

        }


        const toEmails =
            normalizeEmails(
                toInput
            );


        const ccEmails =
            normalizeEmails(
                ccInput
            );


        if (!toEmails.length) {

            alert(
                "Please enter at least one valid To email address."
            );

            return;

        }


        if (
            !validateEmails(
                toEmails
            )
        ) {

            alert(
                "One or more To email addresses are invalid."
            );

            return;

        }


        if (
            ccEmails.length &&
            !validateEmails(
                ccEmails
            )
        ) {

            alert(
                "One or more CC email addresses are invalid."
            );

            return;

        }


        const directLink =
            getHoldLink(
                holdId
            );


        const subject =
            `QC HOLD REMINDER - Job ${hold.jobNo || "N/A"} - Roll ${hold.rollNo || "N/A"}`;


        const body =
            buildReminderEmail(
                hold,
                responsiblePerson,
                customMessage,
                directLink
            );


        let mailto =
            "mailto:" +
            encodeURIComponent(
                toEmails.join(",")
            );


        const query = [];


        query.push(
            "subject=" +
            encodeURIComponent(
                subject
            )
        );


        query.push(
            "body=" +
            encodeURIComponent(
                body
            )
        );


        if (
            ccEmails.length
        ) {

            query.push(
                "cc=" +
                encodeURIComponent(
                    ccEmails.join(",")
                )
            );

        }


        mailto +=
            "?" +
            query.join("&");


        window.location.href =
            mailto;

    };


/* =====================================================
   BUILD REMINDER EMAIL
===================================================== */

function buildReminderEmail(
    hold,
    responsiblePerson,
    customMessage,
    directLink
) {

    const status =
        formatStatus(
            hold.status
        );


    const stage =
        formatStage(
            hold.currentStage
        );


    const holdAge =
        formatDuration(
            getHoldDurationMs(
                hold
            )
        );


    return (

        `Dear ${responsiblePerson || "Sir/Madam"},\n\n` +

        `This is a reminder regarding the following QC Hold Roll.\n\n` +

        `========================================\n` +

        `QC HOLD ROLL DETAILS\n` +

        `========================================\n\n` +

        `Job Number       : ${hold.jobNo || "N/A"}\n` +

        `Job Name         : ${hold.jobName || "N/A"}\n` +

        `Roll Number      : ${hold.rollNo || "N/A"}\n` +

        `Net Weight       : ${hold.netWeight || "0"} kg\n` +

        `Process          : ${hold.process || "N/A"}\n` +

        `Machine          : ${hold.machine || "N/A"}\n` +

        `Production Date  : ${hold.productionDate || "N/A"}\n` +

        `Shift            : ${hold.shift || "N/A"}\n` +

        `Operator         : ${hold.operator || "N/A"}\n` +

        `Supervisor       : ${hold.supervisor || "N/A"}\n` +

        `QC Inspector     : ${hold.qcInspector || "N/A"}\n` +

        `Hold Reason      : ${hold.holdReason || "N/A"}\n` +

        `Status           : ${status}\n` +

        `Current Stage    : ${stage}\n` +

        `Hold Created     : ${formatDateTime(hold.holdTimestamp || hold.createdAt)}\n` +

        `Current Hold Age : ${holdAge}\n\n` +

        `Observation:\n` +

        `${hold.observation || "No observation provided."}\n\n` +

        `========================================\n` +

        `OPEN THIS SPECIFIC ROLL\n` +

        `========================================\n\n` +

        `${directLink}\n\n` +

        `Click the link above to open the exact QC Hold Roll directly in the APEX QC Hold Roll Monitor.\n\n` +

        (
            customMessage
                ? `Additional Message:\n${customMessage}\n\n`
                : ""
        ) +

        `Regards,\n` +

        `APEX QC Hold Roll Monitor`

    );

}


/* =====================================================
   NORMALIZE EMAILS
===================================================== */

function normalizeEmails(
    input
) {

    if (!input) {
        return [];
    }


    return String(input)

        .split(
            /[,;]+/
        )

        .map(
            email =>
                email.trim()
        )

        .filter(Boolean);

}


/* =====================================================
   VALIDATE EMAILS
===================================================== */

function validateEmails(
    emails
) {

    const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    return emails.every(
        email =>
            emailRegex.test(
                email
            )
    );

}


/* =====================================================
   HTML ESCAPE
===================================================== */

function escapeHtml(
    value
) {

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
   ATTRIBUTE ESCAPE
===================================================== */

function escapeAttribute(
    value
) {

    return escapeHtml(
        value
    );

}


/* =====================================================
   JAVASCRIPT ESCAPE
===================================================== */

function escapeJs(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)

        .replace(
            /\\/g,
            "\\\\"
        )

        .replace(
            /'/g,
            "\\'"
        )

        .replace(
            /"/g,
            '\\"'
        )

        .replace(
            /\r/g,
            "\\r"
        )

        .replace(
            /\n/g,
            "\\n"
        );

}


/* =====================================================
   GLOBAL FUNCTIONS
===================================================== */

window.openDetails =
    openDetails;


window.openHoldFromUrl =
    openHoldFromUrl;


window.getHoldLink =
    getHoldLink;
