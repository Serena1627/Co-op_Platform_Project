import { supabaseClient } from "../supabaseClient.js";

const currentDate = new Date().toISOString().split("T")[0];
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
const companyNameEl = document.getElementById("company-name");
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

const btnMessage = document.getElementById("message-student");
const messageNote = document.getElementById("message-availability-note");

let applicationRecord = null;
let studentRecord = null;
let jobRecord = null;
let coop_experience = null;
let calendarRecord = null;
let resumeFile = null;
let resumeSignedUrl = null;

function isBefore(dateStr) {
    if (!dateStr) return false;
    return new Date() < new Date(dateStr);
}

if (!applicationId || !studentId) {
    showError("Missing applicationId or studentId in URL.");
} else {
    init();
}

async function init() {
    try {
        showLoading("Loading application...");
        const { data: appData, error: appError } = await supabaseClient
            .from("current_applications")
            .select("*")
            .eq("id", applicationId)
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
    companyNameEl.innerText = applicationRecord.company_name || "N/A";
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
}

function applyCoopCalendarGating(){
    const interviews_start = calendarRecord.interview_period_start;
    const ranking_period_start = calendarRecord.interview_period_end;
    const ranking_period_end = calendarRecord.view_rankings;
    const offer_granting_period = calendarRecord.rankings_due;

    if (currentDate <= interviews_start){
        btnOffer.remove();
        btnRanked.remove();
    }else if (currentDate <= ranking_period_end){
        btnInReview.remove();
        btnInterview.remove();
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

async function updateStatus(newStatus) {
    try {
        showLoading("Updating status...");
        const { data, error } = await supabaseClient
            .from("current_applications")
            .update({ status: newStatus })
            .eq("id", applicationId)
            .select()
            .maybeSingle();
        if (!data || error) throw error || new Error("Failed to update status.");
        applicationRecord = data;
        setStatusBadge(applicationRecord.status);
        alert(`Status updated to "${newStatus}".`);

        if (newStatus === "offer" && applicationRecord.no_of_open_positions){
            const { data: updatedData, error: updatedError} = await supabaseClient
                .from("job_listings")
                .update({ no_of_open_positions: applicationRecord.no_of_open_positions-1 })
                .eq("id", job_id)
                .select()
                .maybeSingle();
            if (!updatedData || updatedError) throw updatedError || new Error("Failed to update Open Positions.");
        }
    } finally { hideLoading(); }
}

function evaluateMessagingAvailability() {
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

function showLoading(msg="Loading..."){ loadingEl.style.display="block"; loadingEl.innerText=msg; }
function hideLoading(){ loadingEl.style.display="none"; }
function showError(msg){ errorEl.style.display="block"; errorEl.innerText=msg; loadingEl.style.display="none"; }
