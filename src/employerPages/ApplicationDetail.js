import { supabaseClient } from "../supabaseClient.js";
import { getDate } from "../components/coop-information.js";
const FORCE_ENABLE_MESSAGES = true;

const currentDate = getDate().toISOString().split("T")[0];
const queryParams = new URLSearchParams(window.location.search);
const applicationId = queryParams.get("applicationId");
const studentId = queryParams.get("studentId");

const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const appContentEl = document.getElementById("app-content");

const studentNameEl = document.getElementById("student-name");
const studentAvatarEl = document.getElementById("student-avatar");
const studentMajorEl = document.getElementById("student-major");
const studentYearEl = document.getElementById("student-year");
const studentEmailEl = document.getElementById("student-email");
const drexelIdEl = document.getElementById("drexel-id");
const studentGpaEl = document.getElementById("student-gpa");
const studentIntlEl = document.getElementById("student-international");
const studentAdvisorEl = document.getElementById("student-advisor");

const jobTitleEl = document.getElementById("job-title");
const requiresCitizenshipEl = document.getElementById("requires-citizenship");
const openPositionsEl = document.getElementById("open-positions");
const noApplicantsEl = document.getElementById("no-applicants");
const applicationStatusEl = document.getElementById("application-status");

const resumeNoteEl = document.getElementById("resume-note");
const viewResumeBtn = document.getElementById("view-resume-btn");
const downloadResumeBtn = document.getElementById("download-resume-btn");

const jobLocationEl = document.getElementById("job-location");
const jobPayEl = document.getElementById("job-pay");
const jobExperienceEl = document.getElementById("job-experience");
const jobQualificationsEl = document.getElementById("job-qualifications");
const jobDescriptionEl = document.getElementById("job-description");

const btnInReview = document.getElementById("mark-in-review");
const btnInterview = document.getElementById("mark-interview");
const btnOffer = document.getElementById("mark-offer");
const btnRanked = document.getElementById("mark-ranked");
const btnReject = document.getElementById("mark-rejected");
const offerRankingNote = document.getElementById("offer-ranking-note");

const btnMessage = document.getElementById("message-student");
const messageNote = document.getElementById("message-availability-note");

let applicationRecord = null;
let studentRecord = null;
let jobRecord = null;
let coop_experience = null;
let calendarRecord = null;
let resumeFile = null;
let resumeSignedUrl = null;

if (!applicationId || !studentId) {
    showError("Missing applicationId or studentId in URL.");
} else {
    init();
}

async function init() {
    try {
        showLoading("Loading application...");
        const { data: appData, error: appError } = await supabaseClient
            .from("application_submissions")
            .select("*")
            .eq("application_id", applicationId)
            .maybeSingle();

        if (appError) throw appError;
        if (!appData) throw new Error("Application not found.");
        applicationRecord = appData;


        const { data: studentData, error: studentError } = await supabaseClient
            .from("student_profile")
            .select("*")
            .eq("student_id", studentId)
            .maybeSingle();

        if (studentError) throw studentError;
        if (!studentData) throw new Error("Student profile not found.");
        studentRecord = studentData;

        if (applicationRecord.job_id) {
            const { data: jobData, error: jobError } = await supabaseClient
                .from("job_listings")
                .select("*")
                .eq("id", applicationRecord.job_id)
                .maybeSingle();

            if (jobError) throw jobError;
            jobRecord = jobData;
        }

        const mainPageLink = document.getElementById('main-page-link');
        if (mainPageLink) {
            mainPageLink.href = `JobPosts.html?company_id=${jobRecord.company_id}`;
        }

        if (studentRecord.coop_number){
            if (studentRecord.coop_number == 1){
                coop_experience = "First Co-op";
            } else if (studentRecord.coop_number === 2){
                coop_experience = "Second Co-op";
            } else if (studentRecord.coop_number === 3){
                coop_experience = "Third Co-op";
            }
        }
        

        const { data: defaultResume, error: defaultError } = await supabaseClient
            .from("resume_files")
            .select("*")
            .eq("user_id", studentId)
            .eq("is_default", true)
            .maybeSingle();

        if (defaultError) throw defaultError;
        if (defaultResume) resumeFile = defaultResume;
        else {
            const { data: resumes, error: resError } = await supabaseClient
                .from("resume_files")
                .select("*")
                .eq("user_id", studentId)
                .order("id", { ascending: false })
                .limit(1);

            if (resError) throw resError;
            if (resumes && resumes.length > 0) resumeFile = resumes[0];
        }

        if (resumeFile) {
            const { data: signedUrlData, error: signedError } = await supabaseClient
                .storage
                .from("resumes")
                .createSignedUrl(resumeFile.file_path, 60 * 60);

            if (!signedError) resumeSignedUrl = signedUrlData.signedUrl;
        }

        if (studentRecord.coop_cycle) {
            const { data: calendarData } = await supabaseClient
                .from("coop_calendar")
                .select("*")
                .eq("coop_cycle", studentRecord.coop_cycle)
                .gte("results_available", currentDate)
                .lte("job_postings_available", currentDate)
                .maybeSingle();

            calendarRecord = calendarData;
        }

        renderAll();
    } catch (err) {
        showError(err.message || "An error occurred while loading data.");
    } finally {
        hideLoading();
    }
}

function renderAll() {
    applyCoopCalendarGating();
    applyStatusGating();
    studentNameEl.innerText = `${studentRecord.first_name || ""} ${studentRecord.last_name || ""}`;
    studentAvatarEl.innerText = `${(studentRecord.first_name?.charAt(0) || "")}${(studentRecord.last_name?.charAt(0) || "")}`;
    studentMajorEl.innerText = studentRecord.major || "N/A";
    studentYearEl.innerText = `${studentRecord.college_year || "N/A"} · ${coop_experience || "-"}`;
    studentEmailEl.innerText = studentRecord.email_address || "N/A";
    drexelIdEl.innerText = studentRecord.drexel_student_id || "N/A";
    studentGpaEl.innerText = (studentRecord.gpa !== null && studentRecord.gpa !== undefined) ? studentRecord.gpa : "N/A";
    studentIntlEl.innerText = studentRecord.is_international ? "Yes" : "No";
    studentAdvisorEl.innerText = studentRecord.coop_advisor || `${studentRecord.coop_advisor_email || ""}`;

    jobTitleEl.innerText = applicationRecord.job_title || (jobRecord ? jobRecord.job_title : "N/A");
    requiresCitizenshipEl.innerText = applicationRecord.requires_citizenship ? "Yes" : "No";
    openPositionsEl.innerText = applicationRecord.no_of_open_positions ?? "N/A";
    noApplicantsEl.innerText = applicationRecord.no_o_applications ?? (jobRecord?.no_applicants ?? "N/A");

    setStatusBadge(applicationRecord.status || "new");

    if (resumeSignedUrl) {
        resumeNoteEl.style.display = "none";
        viewResumeBtn.style.display = "inline-block";
        downloadResumeBtn.style.display = "inline-block";
        viewResumeBtn.href = resumeSignedUrl;
        downloadResumeBtn.onclick = () => window.open(resumeSignedUrl, "_blank");
    } else {
        resumeNoteEl.innerText = "No resume uploaded for this student.";
        viewResumeBtn.style.display = "none";
        downloadResumeBtn.style.display = "none";
    }

    if (jobRecord) {
        jobLocationEl.innerText = jobRecord.location || "N/A";
        jobPayEl.innerText = jobRecord.is_paid ? (jobRecord.is_range ? `Range: ${jobRecord.hourly_pay || "N/A"}` : (jobRecord.hourly_pay ? `${jobRecord.hourly_pay}/hr` : "N/A")) : "Unpaid / Not specified";
        jobExperienceEl.innerText = jobRecord.experience_level || "N/A";
        jobQualificationsEl.innerText = jobRecord.job_qualifications || "N/A";
        jobDescriptionEl.innerText = jobRecord.job_description || "N/A";
    } else {
        jobLocationEl.innerText = "-";
        jobPayEl.innerText = "-";
        jobExperienceEl.innerText = "-";
        jobQualificationsEl.innerText = "-";
        jobDescriptionEl.innerText = "-";
    }

    btnInReview.onclick = () => updateStatus("in-review");
    btnInterview.onclick = () => updateStatus("interview");
    btnOffer.onclick = () => updateStatus("offer");
    btnRanked.onclick = () => updateStatus("ranked");
    btnReject.onclick = () => { if(confirm("Reject this application?")) updateStatus("rejected"); };

    evaluateMessagingAvailability();

    appContentEl.style.display = "block";
    autoRejectIfInterviewNotGranted();
}

function applyCoopCalendarGating(){
    const interviews_start = calendarRecord.interview_period_start;
    const ranking_period_start = calendarRecord.interview_period_end;
    const ranking_period_end = calendarRecord.view_rankings;
    const offer_granting_period = calendarRecord.rankings_due;

    if (currentDate <= interviews_start){
        btnOffer.remove();
        btnRanked.remove();
    } else if (currentDate >= ranking_period_start){
        btnInReview.remove();
        btnInterview.remove();
    }

    const TEST_MODE = true;
    if (TEST_MODE) {
    btnInReview.disabled = false;
    btnInterview.disabled = false;
    btnReject.disabled = false;
    btnOffer.disabled = false;
    btnRanked.disabled = false;
    return;
}

    
}

function applyStatusGating(){
    if (applicationRecord.status === "ranked" || applicationRecord.status === "offer"){
        btnOffer.disabled = true;
        offerRankingNote.innerText = "An offer has already been sent out for this student";
    }
}

function setStatusBadge(status) {
    applicationStatusEl.innerText = status || "new";
    applicationStatusEl.className = "status-badge";
    switch (status) {
        case "in-review": applicationStatusEl.classList.add("status-reviewed"); break;
        case "interview": applicationStatusEl.classList.add("status-interview"); break;
        case "offer": applicationStatusEl.classList.add("status-offer"); break;
        case "ranked": applicationStatusEl.classList.add("status-ranked"); break;
        case "rejected": applicationStatusEl.classList.add("status-rejected"); break;
        default: applicationStatusEl.classList.add("status-new");
    }
}

async function validateOfferNumber() {
    const openPositions = jobRecord?.no_of_open_positions ?? 0;

    const { count: currentOffers, error: offerError } = await supabaseClient
        .from("current_applications")
        .select("*", { count: "exact", head: true })
        .eq("job_id", applicationRecord.job_id)
        .eq("status", "offer");

    if (offerError) {
        alert("Could not verify available positions.");
        console.error(offerError);
        return false;
    }

    if (currentOffers < openPositions) return true;

    const choice = await showOfferLimitDialog(currentOffers, openPositions);

    if (choice === "replace") {
        await showReplaceOfferDialog();
        return false;
    }

    if (choice === "rank") {
        await updateStatus("ranked");
        return false;
    }

    return false;
}


async function validateRanking() {
    const openPositions = jobRecord?.no_of_open_positions ?? 0;

    const { count: offerCount } = await supabaseClient
        .from("current_applications")
        .select("*", { count: "exact", head: true })
        .eq("job_id", applicationRecord.job_id)
        .eq("status", "offer");

    if (offerCount < openPositions) {
        alert(`You must give all ${openPositions} offers before ranking candidates.`);
        return false;
    }

    const { count: rankCount } = await supabaseClient
        .from("current_applications")
        .select("*", { count: "exact", head: true })
        .eq("job_id", applicationRecord.job_id)
        .eq("status", "ranked");

    if (rankCount >= 3) {
        alert("You may only rank up to three candidates.");
        return false;
    }

    return true;
}


function showOfferLimitDialog(currentOffers, maxOffers) {
    return new Promise(resolve => {
        const overlay = document.createElement("div");
        overlay.className = "dialog-overlay";

        const dialog = document.createElement("div");
        dialog.className = "offer-limit-dialog";

        dialog.innerHTML = `
            <h3>No Offer Slots Available</h3>
            <p>You currently have <strong>${currentOffers}</strong> offers given, 
            but only <strong>${maxOffers}</strong> positions available.</p>

            <p>What would you like to do?</p>

            <div class="dialog-actions">
                <button id="replace-offer">Replace another student's offer</button>
                <button id="rank-student">Rank this student instead</button>
                <button id="cancel">Cancel</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        document.getElementById("replace-offer").onclick = () => {
            document.body.removeChild(overlay);
            resolve("replace");
        };
        document.getElementById("rank-student").onclick = () => {
            document.body.removeChild(overlay);
            resolve("rank");
        };
        document.getElementById("cancel").onclick = () => {
            document.body.removeChild(overlay);
            resolve("cancel");
        };
    });
}


async function showReplaceOfferDialog() {
    try {
        const { data: offers, error } = await supabaseClient
            .from("current_applications")
            .select(`
                id,
                student_id,
                student_profile:student_id(first_name, last_name)
            `)
            .eq("job_id", applicationRecord.job_id)
            .eq("status", "offer")
            .order("created_at", { ascending: true });

        if (error) throw error;

        if (!offers?.length) {
            alert("No existing offers available to replace.");
            return;
        }

        return new Promise(resolve => {
            const overlay = document.createElement("div");
            overlay.className = "dialog-overlay";

            const dialog = document.createElement("div");
            dialog.className = "replace-offer-dialog";

            let listHTML = "";
            offers.forEach(o => {
                const name = o.student_profile
                    ? `${o.student_profile.first_name} ${o.student_profile.last_name}`
                    : `Student ${o.student_id}`;

                listHTML += `
                    <div class="offer-item">
                        <span>${name}</span>
                        <button class="replace-btn" data-offer-id="${o.id}">
                            Replace
                        </button>
                    </div>`;
            });

            dialog.innerHTML = `
                <h3>Select Offer to Replace</h3>
                ${listHTML}
                <button id="cancel-replace">Cancel</button>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            dialog.querySelectorAll(".replace-btn").forEach(btn => {
                btn.onclick = async () => {
                    const offerId = btn.dataset.offerId;

                    showLoading("Updating offers...");

                    await supabaseClient
                        .from("current_applications")
                        .update({ status: "ranked" })
                        .eq("id", offerId);

                    await supabaseClient
                        .from("current_applications")
                        .update({ status: "offer" })
                        .eq("id", applicationId);

                    hideLoading();
                    alert("Offer replaced successfully.");
                    document.body.removeChild(overlay);

                    applicationRecord.status = "offer";
                    setStatusBadge("offer");

                    resolve(true);
                };
            });

            document.getElementById("cancel-replace").onclick = () => {
                document.body.removeChild(overlay);
                resolve(false);
            };
        });

    } catch (err) {
        console.error(err);
        alert("Failed to load existing offers.");
    }
}


async function updateStatus(newStatus) {
    try {
        showLoading("Updating...");

        if (newStatus === "offer") {
            const canOffer = await validateOfferNumber();
            if (!canOffer) return hideLoading();
            await updateOpenPositions();
            await setOfferDecision("offer sent");
        }

        if (newStatus === "ranked") {
            const canRank = await validateRanking();
            if (!canRank) return hideLoading();
            await setOfferDecision("ranked");
        }

        if (newStatus === "reject"){
            await setOfferDecision("Not offered");
        }

        const { data, error } = await supabaseClient
            .from("current_applications")
            .update({ status: newStatus })
            .eq("id", applicationId)
            .select()
            .maybeSingle();

        if (error || !data) throw error;
        applicationRecord = data;
        setStatusBadge(data.status);

        alert(`Status updated to "${newStatus}".`);

    } catch (err) {
        console.error(err);
        alert("Could not update status.");
    } finally {
        hideLoading();
    }
}


async function setOfferDecision(decision) {
    try {
        if (decision === "ranked") {
            const { data: rankedRow, error: rankedError } = await supabaseClient
                .from("current_applications")
                .select("employer_rank_position")
                .order("employer_rank_position", { ascending: false })
                .limit(1)
                .single();

            if (rankedError) {
                console.error("Offer Decision Error", rankedError);
                throw new Error(`Could not get previous rank position. ${rankedError.message}`);
            }

            const lastRank = rankedRow?.employer_rank_position ?? 0;

            const { error: updateRankError } = await supabaseClient
                .from("current_applications")
                .update({ employer_rank_position: lastRank + 1 })
                .eq("id", applicationId)
                .maybeSingle();

            if (updateRankError) {
                console.error("Offer Decision Error", updateRankError);
                throw new Error(`Could not update rank position. ${updateRankError.message}`);
            }
        }

        const { error: updateDecisionError } = await supabaseClient
            .from("current_applications")
            .update({ offer_decision: decision })
            .eq("id", applicationId)
            .maybeSingle();

        if (updateDecisionError) {
            console.error("Offer Decision Error", updateDecisionError);
            throw new Error(`Could not set offer decision. ${updateDecisionError.message}`);
        }

    } catch (error) {
        showError(error.message || "An error occurred while setting the offer decision.");
    }
}


function evaluateMessagingAvailability() {
    if (FORCE_ENABLE_MESSAGES) {
        enableMessaging();
        return;
    }
    btnMessage.disabled = true;
    messageNote.innerText = "Messaging available after interview view period.";
    if (!calendarRecord) { messageNote.innerText = "Messaging unavailable (calendar not found)."; return; }
    if (calendarRecord.view_interviews_granted === true) enableMessaging();
    else if(calendarRecord.interview_period_start && currentDate >= new Date(calendarRecord.interview_period_start)) enableMessaging();
    else messageNote.innerText = `Messaging opens on: ${calendarRecord.interview_period_start ? new Date(calendarRecord.interview_period_start).toLocaleString() : "TBD"}`;
}

function enableMessaging() {
    btnMessage.disabled = false;
    messageNote.innerText = "Messaging is available for this student.";
    btnMessage.onclick = () => window.location.href = `Messaging.html?studentId=${encodeURIComponent(studentId)}&applicationId=${encodeURIComponent(applicationId)}`;
}

async function autoRejectIfInterviewNotGranted() {
    if (!calendarRecord || !calendarRecord.interview_period_start) return;
    const today = new Date(2025, 10, 5);
    const interviewStart = new Date(calendarRecord.view_interviews_granted);
    if (today >= interviewStart) {
        if (applicationRecord.status !== "interview") {
            const { data, error } = await supabaseClient
                .from("current_applications")
                .update({ status: "not-selected" })
                .eq("id", applicationId)
                .select()
                .maybeSingle();

            if (error) {
                console.error("Failed to auto-update:", error);
            } else {
                applicationRecord = data;
                setStatusBadge(applicationRecord.status);
            }
        }
    }
}

function showLoading(msg="Loading..."){ loadingEl.style.display="block"; loadingEl.innerText=msg; }
function hideLoading(){ loadingEl.style.display="none"; }
function showError(msg){ errorEl.style.display="block"; errorEl.innerText=msg; loadingEl.style.display="none"; }
