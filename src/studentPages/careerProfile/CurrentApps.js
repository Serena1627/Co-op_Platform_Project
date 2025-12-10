import { supabaseClient } from "../../supabaseClient.js";
import { getDate } from "../../components/coop-information.js";

let selectedApplications = new Set();

let currentDate = getDate();

document.addEventListener("DOMContentLoaded", async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
        alert("You are not logged in.");
        window.location.assign("/src/sign-in/login.html");
        return;
    }
    
    setupAppFilters();
    await loadApplications(user.id);
    await calculateProgressTimeline(user.id);
    
});

async function loadApplications(studentId) {
    try {
        const { data, error } = await supabaseClient
            .from("current_applications")
            .select(`
                id,
                status,
                applied_date,
                job_id,
                job_listings!inner (
                    id,
                    job_title,
                    location,
                    hourly_pay,
                    company:company_id (
                        company_name
                    )
                )
            `)
            .eq("student_id", studentId)
            .order("applied_date", { ascending: false });

        if (error) {
            console.error("Error loading applications:", error);
            return;
        }

        const headerElement = document.querySelector(".applications-header h2");
        headerElement.textContent = `My Applications (${data.length})`;

        const contentContainer = document.querySelector(".content");
        
        const existingCards = contentContainer.querySelectorAll(".application-card");
        existingCards.forEach(card => card.remove());

        if (data.length === 0) {
            const emptyState = document.createElement("div");
            emptyState.className = "empty-state";
            emptyState.innerHTML = `
                <p>You haven't applied to any jobs yet.</p>
                <a href="../JobPostings.html">Browse Available Jobs</a>
            `;
            contentContainer.appendChild(emptyState);
            hideSelectApplySection();
            return;
        }

        const pendingCount = data.filter(app => app.status === 'pending').length;

        if (pendingCount > 0) {
            showSelectApplySection(pendingCount);
        } else {
            hideSelectApplySection();
        }

        data.forEach(application => {
            const card = createApplicationCard(application);
            contentContainer.appendChild(card);
        });

    } catch (err) {
        console.error("Unexpected error loading applications:", err);
    }
}

function showSelectApplySection(pendingCount) {
    const selectApplyContainer = document.getElementById("mass-apply");
    selectApplyContainer.innerHTML = `
        <div class="select-apply-section">
            <div class="select-apply-header">
                <input type="checkbox" id="select-all-checkbox" class="select-apply-checkbox">
                <label for="select-all-checkbox">
                    <strong>Select All Pending Applications</strong>
                </label>
                <span class="select-apply-info">(${pendingCount} pending)</span>
            </div>
            <div class="select-apply-actions">
                <span id="selected-count" class="selected-count">0 selected</span>
                <button id="apply-selected-btn" class="select-apply-btn" disabled>
                    <i class="fas fa-paper-plane"></i>
                    Apply to Selected
                </button>
            </div>
        </div>
    `;

    setupSelectApplyListeners();
}

function hideSelectApplySection() {
    const selectApplyContainer = document.getElementById("mass-apply");
    selectApplyContainer.innerHTML = '';
    selectedApplications.clear();
}

function setupSelectApplyListeners() {
    const selectAllCheckbox = document.getElementById("select-all-checkbox");
    const applySelectedBtn = document.getElementById("apply-selected-btn");

    selectAllCheckbox.addEventListener("change", (e) => {
        const pendingCards = document.querySelectorAll('.application-card[data-status="pending"]');
        
        if (e.target.checked) {
            pendingCards.forEach(card => {
                const appId = card.dataset.applicationId;
                selectedApplications.add(appId);
                card.classList.add("selected");
                const checkbox = card.querySelector(".card-select-checkbox");
                if (checkbox) checkbox.checked = true;
            });
        } else {
            pendingCards.forEach(card => {
                const appId = card.dataset.applicationId;
                selectedApplications.delete(appId);
                card.classList.remove("selected");
                const checkbox = card.querySelector(".card-select-checkbox");
                if (checkbox) checkbox.checked = false;
            });
        }
        
        updateSelectApplyUI();
    });

    applySelectedBtn.addEventListener("click", () => {
        if (selectedApplications.size === 0) return;
        
        const selectedApps = Array.from(selectedApplications);
        createMultiResumeSelectionPopup(selectedApps);
    });
}

function updateSelectApplyUI() {
    const selectedCount = document.getElementById("selected-count");
    const applyBtn = document.getElementById("apply-selected-btn");
    const selectAllCheckbox = document.getElementById("select-all-checkbox");
    
    const count = selectedApplications.size;
    selectedCount.textContent = `${count} selected`;
    applyBtn.disabled = count === 0;

    const pendingCards = document.querySelectorAll('.application-card[data-status="pending"]');
    const allSelected = pendingCards.length > 0 && 
                       Array.from(pendingCards).every(card => 
                           selectedApplications.has(card.dataset.applicationId)
                       );
    selectAllCheckbox.checked = allSelected;
}

function createMultiResumeSelectionPopup(applicationIds) {
    const popup = document.createElement("div");
    popup.className = "resume-selection-popup";
    popup.innerHTML = `
        <div class="popup-content">
            <div class="popup-header">
                <h3>Apply to ${applicationIds.length} Selected Position${applicationIds.length > 1 ? 's' : ''}</h3>
                <p>Choose a resume to submit with all selected applications</p>
                <span class="close-popup">&times;</span>
            </div>
            <div class="popup-body">
                <div class="selected-apps-summary">
                    <h4>Selected Applications:</h4>
                    <div id="apps-summary-list" class="apps-summary-list">
                        <!-- Will be populated -->
                    </div>
                </div>
                <h4>Select a Resume</h4>
                <div id="resume-options" class="resume-options">
                    <p>Loading resumes...</p>
                </div>
                <div id="resume-preview-container" class="resume-preview-container" style="display: none;">
                    <h4>Resume Preview</h4>
                    <iframe id="selected-resume-preview" style="width:100%; height:300px; border:1px solid #ccc;"></iframe>
                </div>
            </div>
            <div class="popup-footer">
                <button id="confirm-application-btn" class="btn btn-primary" disabled>
                    Submit ${applicationIds.length} Application${applicationIds.length > 1 ? 's' : ''}
                </button>
                <button id="cancel-application-btn" class="btn btn-outline">
                    Cancel
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    populateAppsSummary(applicationIds);
    loadUserResumesForMulti(applicationIds);
    setupMultiPopupListeners(popup, applicationIds);
    
    return popup;
}

async function populateAppsSummary(applicationIds) {
    const summaryList = document.getElementById("apps-summary-list");
    summaryList.innerHTML = '<p>Loading...</p>';

    try {
        const { data, error } = await supabaseClient
            .from("current_applications")
            .select(`
                id,
                job_listings!inner (
                    job_title,
                    company:company_id (
                        company_name
                    )
                )
            `)
            .in('id', applicationIds);

        if (error) throw error;

        summaryList.innerHTML = data.map(app => {
            const job = app.job_listings;
            const company = job.company?.company_name || 'Unknown Company';
            return `
                <div class="summary-app-item">
                    <i class="fas fa-briefcase"></i>
                    <span><strong>${job.job_title}</strong> at ${company}</span>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("Error loading applications summary:", error);
        summaryList.innerHTML = '<p>Error loading applications</p>';
    }
}

async function loadUserResumesForMulti(applicationIds) {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (!user) {
            alert("You are not logged in.");
            window.location.assign("../sign-in/login.html");
            return;
        }
        
        const { data: resumes, error } = await supabaseClient
            .from("resume_files")
            .select("*")
            .eq("user_id", user.id)
            .order("is_default", { ascending: false });
        
        if (error) throw error;
        
        const resumeOptions = document.getElementById("resume-options");
        resumeOptions.innerHTML = "";
        
        if (resumes.length === 0) {
            resumeOptions.innerHTML = '<p>No resumes found. Please upload a resume first.</p>';
            return;
        }
        
        resumes.forEach((resume, index) => {
            const resumeOption = document.createElement("div");
            resumeOption.className = "resume-option";
            resumeOption.dataset.resumeId = resume.id;
            resumeOption.dataset.filePath = resume.file_path;
            resumeOption.innerHTML = `
                <input type="radio" name="selected-resume" id="resume-${resume.id}" 
                       ${index === 0 ? 'checked' : ''}>
                <label for="resume-${resume.id}">
                    <strong>${resume.name}</strong>
                    ${resume.is_default ? '<span class="default-badge">Default</span>' : ''}
                </label>
            `;
            
            resumeOption.addEventListener("click", async () => {
                resumeOption.querySelector('input').checked = true;
                await previewSelectedResume(resume.file_path);
                document.getElementById("confirm-application-btn").disabled = false;
            });
            
            resumeOptions.appendChild(resumeOption);
        });
        
        if (resumes.length > 0) {
            await previewSelectedResume(resumes[0].file_path);
            document.getElementById("confirm-application-btn").disabled = false;
        }
        
    } catch (error) {
        console.error("Error loading resumes:", error);
        document.getElementById("resume-options").innerHTML = 
            '<p>Error loading resumes. Please try again.</p>';
    }
}

function setupMultiPopupListeners(popup, applicationIds) {
    const closeBtn = popup.querySelector(".close-popup");
    const cancelBtn = popup.querySelector("#cancel-application-btn");
    const confirmBtn = popup.querySelector("#confirm-application-btn");
    
    const closePopup = () => popup.remove();
    
    closeBtn.addEventListener("click", closePopup);
    cancelBtn.addEventListener("click", closePopup);
    
    popup.addEventListener("click", (e) => {
        if (e.target === popup) closePopup();
    });
    
    confirmBtn.addEventListener("click", async () => {
        const selectedResume = document.querySelector('input[name="selected-resume"]:checked');
        if (!selectedResume) {
            alert("Please select a resume");
            return;
        }
        
        const resumeId = selectedResume.parentElement.dataset.resumeId;
        await submitMultipleApplications(applicationIds, resumeId);
        closePopup();
    });
}

async function submitMultipleApplications(applicationIds, resumeId) {
    try {
        const confirmBtn = document.getElementById("confirm-application-btn");
        const originalText = confirmBtn.textContent;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

        const { data, error } = await supabaseClient
            .from("current_applications")
            .update({ 
                status: 'submitted',
                resume_submitted: resumeId,
                applied_date: new Date().toISOString()
            })
            .in('id', applicationIds);
        
        if (error) {
            throw new Error(`Couldn't update applications: ${error.message}`);
        }
        
        showNotification(`Successfully submitted ${applicationIds.length} application${applicationIds.length > 1 ? 's' : ''}!`);
        
        selectedApplications.clear();
        setTimeout(() => window.location.reload(), 1000);
        
    } catch (error) {
        console.error("Error submitting applications:", error);
        alert(`Failed to submit applications: ${error.message}`);
    }
}

function createResumeSelectionPopup(applicationId, jobTitle, companyName) {
    const popup = document.createElement("div");
    popup.className = "resume-selection-popup";
    popup.innerHTML = `
        <div class="popup-content">
            <div class="popup-header">
                <h3>Complete Application for ${jobTitle}</h3>
                <p>${companyName}</p>
                <span class="close-popup">&times;</span>
            </div>
            <div class="popup-body">
                <h4>Select a Resume</h4>
                <div id="resume-options" class="resume-options">
                    <p>Loading resumes...</p>
                </div>
                <div id="resume-preview-container" class="resume-preview-container" style="display: none;">
                    <h4>Resume Preview</h4>
                    <iframe id="selected-resume-preview" style="width:100%; height:300px; border:1px solid #ccc;"></iframe>
                </div>
            </div>
            <div class="popup-footer">
                <button id="confirm-application-btn" class="btn btn-primary" disabled>
                    Submit Application
                </button>
                <button id="cancel-application-btn" class="btn btn-outline">
                    Cancel
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    loadUserResumes(applicationId);
    setupPopupListeners(popup, applicationId);
    
    return popup;
}

async function loadUserResumes(applicationId) {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (!user) {
            alert("You are not logged in.");
            window.location.assign("../sign-in/login.html");
            return;
        }
        
        const { data: resumes, error } = await supabaseClient
            .from("resume_files")
            .select("*")
            .eq("user_id", user.id)
            .order("is_default", { ascending: false });
        
        if (error) throw error;
        
        const resumeOptions = document.getElementById("resume-options");
        resumeOptions.innerHTML = "";
        
        if (resumes.length === 0) {
            resumeOptions.innerHTML = '<p>No resumes found. Please upload a resume first.</p>';
            return;
        }
        
        resumes.forEach((resume, index) => {
            const resumeOption = document.createElement("div");
            resumeOption.className = "resume-option";
            resumeOption.dataset.resumeId = resume.id;
            resumeOption.dataset.filePath = resume.file_path;
            resumeOption.innerHTML = `
                <input type="radio" name="selected-resume" id="resume-${resume.id}" 
                       ${index === 0 ? 'checked' : ''}>
                <label for="resume-${resume.id}">
                    <strong>${resume.name}</strong>
                    ${resume.is_default ? '<span class="default-badge">Default</span>' : ''}
                </label>
            `;
            
            resumeOption.addEventListener("click", async () => {
                resumeOption.querySelector('input').checked = true;
                await previewSelectedResume(resume.file_path);
                document.getElementById("confirm-application-btn").disabled = false;
            });
            
            resumeOptions.appendChild(resumeOption);
        });
        
        if (resumes.length > 0) {
            await previewSelectedResume(resumes[0].file_path);
            document.getElementById("confirm-application-btn").disabled = false;
        }
        
    } catch (error) {
        console.error("Error loading resumes:", error);
        document.getElementById("resume-options").innerHTML = 
            '<p>Error loading resumes. Please try again.</p>';
    }
}

async function previewSelectedResume(filePath) {
    try {
        const { data: signedUrlData, error } = await supabaseClient
            .storage
            .from("resumes")
            .createSignedUrl(filePath, 60);
        
        if (error) throw error;
        
        const previewContainer = document.getElementById("resume-preview-container");
        const previewFrame = document.getElementById("selected-resume-preview");
        
        previewFrame.src = signedUrlData.signedUrl;
        previewContainer.style.display = "block";
        
    } catch (error) {
        console.error("Error loading resume preview:", error);
    }
}

function setupPopupListeners(popup, applicationId) {
    const closeBtn = popup.querySelector(".close-popup");
    const cancelBtn = popup.querySelector("#cancel-application-btn");
    const confirmBtn = popup.querySelector("#confirm-application-btn");
    
    const closePopup = () => popup.remove();
    
    closeBtn.addEventListener("click", closePopup);
    cancelBtn.addEventListener("click", closePopup);
    
    popup.addEventListener("click", (e) => {
        if (e.target === popup) closePopup();
    });
    
    confirmBtn.addEventListener("click", async () => {
        const selectedResume = document.querySelector('input[name="selected-resume"]:checked');
        if (!selectedResume) {
            alert("Please select a resume");
            return;
        }
        
        const resumeId = selectedResume.parentElement.dataset.resumeId;
        await submitApplicationWithResume(applicationId, resumeId);
        closePopup();
    });
}

async function submitApplicationWithResume(applicationId, resumeId) {
    try {
        const { data, error } = await supabaseClient
            .from("current_applications")
            .update({ 
                status: 'submitted',
                resume_submitted: resumeId,
                applied_date: new Date().toISOString()
            })
            .eq("id", applicationId);
        
        if (error){
            throw new Error(`Couldn't Update Application: ${error.message}`);
        }
        
        showNotification("Application submitted successfully!");
        
        setTimeout(() => window.location.reload(), 1000);
        
    } catch (error) {
        console.error("Error submitting application:", error);
        alert(`Failed to submit application: ${error.message}`);
    }
}

async function calculateProgressTimeline(studentId) {
    try {
        const { data: student, error: cycleError } = await supabaseClient
            .from("student_profile")
            .select("coop_cycle")
            .eq("student_id", studentId)
            .single();

        if (cycleError || !student) {
            throw new Error("Could not fetch student coop cycle.");
        }

        const coopCycle = student.coop_cycle.toLowerCase();

        document.querySelector(".progress-title").textContent = `Current Co-op Cycle: ${student.coop_cycle}`;

        const { data: coopData, error: calendarError } = await supabaseClient
            .from("coop_calendar")
            .select("*")
            .ilike("coop_cycle", coopCycle);
        
        if (calendarError || !coopData || coopData.length === 0) {
            throw new Error("No coop calendar entries found for this cycle.");
        }

        const rounds = coopData.map(round => ({
            ...round,
            job_postings_available: new Date(round.job_postings_available),
            view_interviews_granted: new Date(round.view_interviews_granted),
            interview_period_end: new Date(round.interview_period_end),
            rankings_due: new Date(round.rankings_due),
            results_available: new Date(round.results_available),
        }));
        let currentRound = null;

        for (let round of rounds) {
            if (currentDate >= round.job_postings_available &&
                currentDate <= round.results_available) {
                currentRound = round;
                break;
            }
        }

        if (!currentRound) {
            throw new Error("Current date does not fall within any round range.");
        }

        let stage = 1;

        if (currentDate >= currentRound.job_postings_available && currentDate < currentRound.view_interviews_granted) {
            stage = 1;
        }
        else if (currentDate >= currentRound.view_interviews_granted && currentDate < currentRound.interview_period_end) {
            stage = 2;
            const { data: pendingApplications } = await supabaseClient
                .from("current_applications")
                .select("id")
                .eq("student_id", studentId)

            for (let app of pendingApplications) {
                await updateApplicationStatus(app.id, stage);
            }
            reapplyCurrentFilter();
        }
        else if (currentDate >= currentRound.interview_period_end && currentDate < currentRound.rankings_due) {
            stage = 3;
            const { data: interviewApplications } = await supabaseClient
                .from("current_applications")
                .select("id")
                .eq("student_id", studentId)

            for (let app of interviewApplications) {
                await updateApplicationStatus(app.id, stage);
            }

            reapplyCurrentFilter();
            
            showRankingMode(studentId);
        }
        else if (currentDate >= currentRound.rankings_due && currentDate < currentRound.results_available) {
            stage = 4;
            handleOffers(app.id);
        }
        else if (currentDate >= currentRound.results_available) {
            stage = 5;
            const { data: interviewApplications } = await supabaseClient
                .from("current_applications")
                .select("id")
                .eq("student_id", studentId)

            for (let app of interviewApplications) {
                await updateApplicationStatus(app.id, stage);
            }

            reapplyCurrentFilter();
        }

        setProgressBar(stage);

    } catch (error) {
        alert(`Error generating Coop Timeline: ${error.message}`);
    }
}


function reapplyCurrentFilter() {
    const activeTab = document.querySelector("#app-filters .tab.active");
    
    if (activeTab) {
        const filter = activeTab.textContent.trim().toLowerCase();
        filterApplications(filter);
    } else {
        filterApplications("all");
    }
}

function setProgressBar(stageNumber) {
    let progressBar = document.querySelector(".timeline-progress");
    progressBar.style.width = `${20 * stageNumber}%`;

    const periods = document.querySelectorAll(".timeline-step");

    periods.forEach(period => {
        const circle = period.querySelector(".timeline-circle");
        const num = parseInt(circle.textContent, 10);

        if (circle.textContent === "✓") return;

        if (stageNumber > num) {
            period.classList.add("completed");
            circle.textContent = "✓";
        } else if (stageNumber === num) {
            period.classList.add("active");
        }
    });
}

function createApplicationCard(application) {
    const job = application.job_listings;
    const companyName = job.company?.company_name || "Unknown Company";
    const appliedDate = new Date(application.applied_date).toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit' 
    });

    const statusMap = {
        'pending': { text: 'Application Pending', class: 'status-pending' },
        'submitted': { text: 'Submitted', class: 'status-submitted' },
        'in-review': { text: 'Application In Review', class: 'status-in-review' },
        'interview': { text: 'Interview Requested', class: 'status-interview' },
        'offer': { text: 'Offer Received', class: 'status-offer' },
        'ranked': { text: 'Qualified Alternate', class: 'status-ranked' },
        'accepted': { text: 'Offer Accepted', class: 'status-accepted' },
        'rejected': { text: 'Not Selected', class: 'status-rejected' },
        'withdrawn': { text: 'Withdrawn', class: 'status-withdrawn' }
    };

    const statusInfo = statusMap[application.status] || statusMap['pending'];

    const card = document.createElement("div");
    card.className = "application-card";
    card.dataset.status = application.status;
    card.dataset.applicationId = application.id;

    const selectCheckbox = application.status === 'pending' 
        ? `<input type="checkbox" class="card-select-checkbox" data-app-id="${application.id}">` 
        : '';

    let actionButtons = '';
    if (application.status === 'pending') {
        actionButtons = `
            <button class="btn btn-primary complete-application-btn" data-app-id="${application.id}">
                Complete Application
            </button>
            <button class="btn btn-outline withdraw-btn" data-app-id="${application.id}">
                Withdraw Application
            </button>`;
    } else if (application.status === 'withdrawn'){
        actionButtons = `
            <button class="btn btn-outline withdraw-btn" data-app-id="${application.id}" disabled>
                Withdraw Application
            </button>`;
    } else {
        actionButtons = `
            <button class="btn btn-outline withdraw-btn" data-app-id="${application.id}">
                Withdraw Application
            </button>`;
    }

    card.innerHTML = `
        <div class="card-header">
            ${selectCheckbox}
            <div class="company-info">
                <h3>${job.job_title}</h3>
                <p>${companyName} • ${job.location} • $${job.hourly_pay}/hr</p>
            </div>
            <span class="status-badge ${statusInfo.class}">${statusInfo.text}</span>
        </div>
        
        <div class="card-timeline">
            <div class="card-stage">
                <div class="stage-icon completed">✓</div>
                <span>Applied ${appliedDate}</span>
            </div>
            <div class="card-stage">
                <div class="stage-icon ${application.status !== 'pending' ? 'completed' : ''}">
                    ${application.status !== 'pending' ? '✓' : '⏱'}
                </div>
                <span>Under Review</span>
            </div>
            <div class="card-stage">
                <div class="stage-icon ${application.status === 'interview' || application.status === 'offer' || application.status === 'accepted' ? 'active' : ''}">
                    ${application.status === 'interview' ? '📅' : '3'}
                </div>
                <span>${application.status === 'interview' ? 'Interview' : 'Next Steps'}</span>
            </div>
        </div>
        
        <div class="card-actions">
            ${actionButtons}
        </div>
    `;

    if (application.status === 'pending') {
        const checkbox = card.querySelector(".card-select-checkbox");
        checkbox.addEventListener("change", (e) => {
            const appId = e.target.dataset.appId;
            if (e.target.checked) {
                selectedApplications.add(appId);
                card.classList.add("selected");
            } else {
                selectedApplications.delete(appId);
                card.classList.remove("selected");
            }
            updateSelectApplyUI();
        });

        const completeBtn = card.querySelector(".complete-application-btn");
        completeBtn.addEventListener("click", () => {
            createResumeSelectionPopup(
                application.id, 
                job.job_title, 
                companyName
            );
        });
    }

    card.addEventListener("click", (e) => {
        if (e.target.tagName === 'BUTTON' || 
            e.target.closest('button') || 
            e.target.tagName === 'INPUT') {
            return;
        }
        
        window.location.href = `../JobDetails.html?jobId=${job.id}&applicationId=${application.id}&source=applications`;
    });

    const withdrawBtn = card.querySelector(".withdraw-btn");
    withdrawBtn.addEventListener("click", () => withdrawApplication(application.id, card));

    return card;
}

async function withdrawApplication(applicationId, cardElement) {
    if (!confirm("Are you sure you want to withdraw this application?")) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("current_applications")
            .update({ status: 'withdrawn' })
            .eq("id", applicationId);

        if (error) {
            console.error("Error withdrawing application:", error);
            alert("Failed to withdraw application. Please try again.");
            return;
        }

        const statusBadge = cardElement.querySelector(".status-badge");
        statusBadge.textContent = "Withdrawn";
        statusBadge.className = "status-badge status-withdrawn";

        const withdrawBtn = cardElement.querySelector(".withdraw-btn");
        withdrawBtn.disabled = true;
        withdrawBtn.textContent = "Application Withdrawn";

        selectedApplications.delete(applicationId);
        cardElement.classList.remove("selected");
        updateSelectApplyUI();

        showNotification("Application withdrawn successfully");

    } catch (err) {
        console.error("Unexpected error:", err);
        alert("An unexpected error occurred. Please try again.");
    }
}

function setupAppFilters() {
    const tabs = document.querySelectorAll("#app-filters .tab");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            const filter = tab.textContent.trim().toLowerCase();
            filterApplications(filter);
        });
    });
}

function filterApplications(filter) {
    const cards = document.querySelectorAll(".application-card");

    cards.forEach(card => {
        const status = card.dataset.status;

        if (filter === "all") {
            card.style.display = "block";
        } 
        else if (filter === "active") {
            const activeStatuses = ["submitted", "interview", "offer"];
            card.style.display = activeStatuses.includes(status)
                ? "block"
                : "none";
        }
        else if (filter === "pending") {
            card.style.display = status === "pending" ? "block" : "none";
        }
        else if (filter === "completed") {
            const completedStatuses = ["accepted", "rejected", "withdrawn"];
            card.style.display = completedStatuses.includes(status)
                ? "block"
                : "none";
        }
    });
}

function showNotification(message){
    const notification = document.createElement("div");
    notification.className = "notification";
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 1000;
    `;

    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

async function updateApplicationStatus(applicationId, stage){
    try {
        const response = await supabaseClient
                .from("current_applications")
                .select("status, student_rank_position")
                .eq("id", applicationId)
                .single();

        if (response.error) throw response.error;

        const data = response.data;
        const application_status = data.status;
        const card = document.querySelector(`.application-card[data-application-id="${applicationId}"]`);
        if (card) {
            const statusBadge = card.querySelector(".status-badge");
            
            if (stage === 2) {
                if (application_status === "interview") {
                    statusBadge.textContent = "Interview Requested";
                    statusBadge.className = "status-badge status-interview";
                } else {
                    await supabaseClient
                        .from("current_applications")
                        .update({ status: "not_selected" })
                        .eq("id", applicationId);
                    statusBadge.textContent = "Not Selected";
                    statusBadge.className = "status-badge status-rejected";
                }
                card.dataset.status = application_status;
            }
            
            else if (stage === 3) {
                if (application_status === "offer") {
                    statusBadge.textContent = "Offer Received";
                    statusBadge.className = "status-badge status-offer";
                }
                else if (application_status === "ranked") {
                    statusBadge.textContent = "Ranked";
                    statusBadge.className = "status-badge status-ranked";
                }
                else {
                    await supabaseClient
                        .from("current_applications")
                        .update({ status: "not_selected" })
                        .eq("id", applicationId);
                    statusBadge.textContent = "Not Selected";
                    statusBadge.className = "status-badge status-rejected";
                }
                card.dataset.status = application_status;
            }

            if (stage === 5){
                if (application_status === "offer") {
                    statusBadge.textContent = "Offer Received";
                    statusBadge.className = "status-badge status-offer";
                }
                else {
                    await supabaseClient
                        .from("current_applications")
                        .update({ status: "not_selected" })
                        .eq("id", applicationId);
                    statusBadge.textContent = "Not Selected";
                    statusBadge.className = "status-badge status-rejected";
                }
                card.dataset.status = application_status;
            }
        } else {
            console.log(`Card not found for application ${applicationId}`);
        }
        return data;
    } catch (error){
        console.error("Error updating application status:", error);
        throw error;
    }
}

async function showRankingMode(studentId) {
    const { data: rankedApps, error } = await supabaseClient
        .from("current_applications")
        .select(`
            id,
            status,
            student_rank_position,
            job_id,
            applied_date,
            job_listings!inner (
                id,
                job_title,
                location,
                hourly_pay,
                company:company_id (
                    company_name
                )
            )
        `)
        .eq("student_id", studentId)
        .in("status", ["offer", "ranked"])
        .order("student_rank_position", { ascending: true, nullsFirst: false });

    if (error) {
        console.error("Error loading ranked applications:", error);
        return;
    }

    const headerElement = document.querySelector(".applications-header h2");
    headerElement.innerHTML = `
        🎯 Rank Your Job Offers (${rankedApps.length})
        <span style="font-size: 0.8em; font-weight: normal; display: block; margin-top: 5px;">
            Drag to reorder by preference. Top = most preferred (Rank 1)
        </span>
    `;
    
    hideSelectApplySection();
    
    const contentContainer = document.querySelector(".content");
    contentContainer.innerHTML = "";

    if (rankedApps.length === 0) {
        contentContainer.innerHTML = `
            <div class="empty-state">
                <p>You don't have any job offers to rank at this time.</p>
            </div>
        `;
        return;
    }

    const instructionsBanner = document.createElement("div");
    instructionsBanner.className = "ranking-instructions-banner";
    instructionsBanner.innerHTML = `
        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2196F3;">
            <strong>📋 Instructions:</strong> Drag the cards below to rank your job preferences. 
            Your top choice should be at the top (Rank 1). Click "Save Rankings" when done.
        </div>
    `;
    contentContainer.appendChild(instructionsBanner);

    const rankingContainer = document.createElement("div");
    rankingContainer.id = "ranking-container";
    rankingContainer.className = "ranking-container";
    contentContainer.appendChild(rankingContainer);

    rankedApps.forEach((app, index) => {
        const card = createRankingCard(app, index + 1);
        rankingContainer.appendChild(card);
    });
    setupRankingDragAndDrop();

    const saveSection = document.createElement("div");
    saveSection.className = "ranking-save-section";
    saveSection.innerHTML = `
        <button id="save-rankings-btn" class="btn btn-primary" style="padding: 15px 30px; font-size: 16px;">
            <i class="fas fa-save"></i> Save Rankings
        </button>
    `;
    contentContainer.appendChild(saveSection);

    document.getElementById("save-rankings-btn").addEventListener("click", async () => {
        await saveRankingsFromPage();
    });
}


function createRankingCard(application, currentRank) {
    const job = application.job_listings;
    const companyName = job.company?.company_name || "Unknown Company";
    const appliedDate = new Date(application.applied_date).toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit' 
    });

    const card = document.createElement("div");
    card.className = "application-card ranking-card";
    card.dataset.applicationId = application.id;
    card.setAttribute("draggable", "true");

    const statusClass = application.status === 'offer' ? 'status-offer' : 'status-ranked';
    const statusText = application.status === 'offer' ? 'Offer Received' : 'Ranked';

    card.innerHTML = `
        <div class="ranking-handle">
            <div class="rank-number">${currentRank}</div>
            <i class="fas fa-grip-vertical"></i>
        </div>
        <div class="card-content">
            <div class="card-header">
                <div class="company-info">
                    <h3>${job.job_title}</h3>
                    <p>${companyName} • ${job.location} • $${job.hourly_pay}/hr</p>
                </div>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="card-footer">
                <span style="color: #666; font-size: 0.9em;">Applied ${appliedDate}</span>
            </div>
        </div>
    `;
    return card;
}

function setupRankingDragAndDrop() {
    const container = document.getElementById("ranking-container");
    if (!container) return;

    let draggedItem = null;

    container.addEventListener("dragstart", (e) => {
        const card = e.target.closest(".ranking-card");
        if (!card) return;
        draggedItem = card;
        card.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", card.dataset.applicationId);
    });

    container.addEventListener("dragend", () => {
        if (draggedItem) draggedItem.classList.remove("dragging");
        draggedItem = null;
        updateRankNumbersOnPage();
    });

    container.addEventListener("dragover", (e) => {
        e.preventDefault();
        const after = getDragAfterElement(container, e.clientY);
        if (!draggedItem) return;

        if (after == null) {
            container.appendChild(draggedItem);
        } else {
            container.insertBefore(draggedItem, after);
        }
    });

    function getDragAfterElement(container, y) {
        const els = [...container.querySelectorAll(".ranking-card:not(.dragging)")];

        return els.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
}

function updateRankNumbersOnPage() {
    const rankingContainer = document.getElementById("ranking-container");
    if (!rankingContainer) return;
    
    const items = rankingContainer.querySelectorAll('.ranking-card');
    
    items.forEach((item, index) => {
        const rankNumber = item.querySelector('.rank-number');
        if (rankNumber) {
            rankNumber.textContent = index + 1;
        }
    });
}

async function saveRankingsFromPage() {
    try {
        const saveBtn = document.getElementById("save-rankings-btn");
        const originalText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        const rankingContainer = document.getElementById("ranking-container");
        const items = rankingContainer.querySelectorAll('.ranking-card');
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const appId = item.dataset.applicationId;
            const rankingOrder = i + 1;
        
            const { error } = await supabaseClient
                .from("current_applications")
                .update({ 
                    student_rank_position: rankingOrder,
                    status: 'ranked'
                })
                .eq("id", appId);

            if (error) throw error;
        }

        showNotification("Rankings saved successfully!");
        
        setTimeout(() => window.location.reload(), 1000);

    } catch (error) {
        console.error("Error saving rankings:", error);
        alert(`Failed to save rankings: ${error.message}`);
        
        const saveBtn = document.getElementById("save-rankings-btn");
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Rankings';
    }
}

async function handleOffers(studentId) {
    try {
        const { data: applications, error } = await supabaseClient
            .from("current_applications")
            .select(`
                id,
                student_id,
                job_id,
                status,
                student_rank_position,
                employer_rank_position,
                cumulative_score,
                job_listings!inner (
                    id,
                    job_title,
                    no_of_open_positions,
                    company:company_id (
                        company_name
                    )
                )
            `)
            .in("status", ["offer", "ranked"]);

        if (error) throw error;
        const jobGroups = {};
        applications.forEach(app => {
            if (!jobGroups[app.job_id]) {
                jobGroups[app.job_id] = {
                    jobInfo: app.job_listings,
                    offers: [],
                    qas: []
                };
            }
            
            if (app.status === "offer") {
                jobGroups[app.job_id].offers.push(app);
            } else if (app.status === "ranked") {
                jobGroups[app.job_id].qas.push(app);
            }
        });

        for (const [jobId, group] of Object.entries(jobGroups)) {
            await processEmployerMatching(jobId, group);
        }

        showNotification("Job assignments processed successfully!");
        
    } catch (error) {
        console.error("Error handling offers:", error);
        alert(`Failed to process offers: ${error.message}`);
    }
}

async function processEmployerMatching(jobId, group) {
    const { jobInfo, offers, qas } = group;
    const positionsAvailable = jobInfo.positions_available;
    
    const acceptedOffers = [];
    const rejectedOfferStudents = [];
    
    for (const offer of offers) {
        const studentPreference = await checkStudentPreference(offer.student_id, offer.job_id);
        
        if (studentPreference.acceptsOffer) {
            acceptedOffers.push(offer);

            await supabaseClient
                .from("current_applications")
                .update({ status: "accepted" })
                .eq("id", offer.id);
        } else {
            rejectedOfferStudents.push(offer.student_id);
            await supabaseClient
                .from("current_applications")
                .update({ status: "rejected_by_student" })
                .eq("id", offer.id);
        }
    }
    
    const qaSpots = positionsAvailable - acceptedOffers.length;
    
    if (qaSpots <= 0) {
        for (const qa of qas) {
            await supabaseClient
                .from("current_applications")
                .update({ status: "not_selected" })
                .eq("id", qa.id);
        }
        return;
    }
    
    const sortedQAs = qas.sort((a, b) => {
        if (a.cumulative_score !== b.cumulative_score) {
            return a.cumulative_score - b.cumulative_score;
        }
        if (a.employer_rank_position !== b.employer_rank_position) {
            return a.employer_rank_position - b.employer_rank_position;
        }
        return a.student_rank_position - b.student_rank_position;
    });

    const assignments = await assignQAPositions(sortedQAs, qaSpots, jobId);
    
    for (const assignment of assignments) {
        if (assignment.assigned) {
            await supabaseClient
                .from("current_applications")
                .update({ status: "offer" })
                .eq("id", assignment.applicationId);
        } else {
            await supabaseClient
                .from("current_applications")
                .update({ status: "not_selected" })
                .eq("id", assignment.applicationId);
        }
    }
}

async function checkStudentPreference(studentId, currentJobId) {
    const { data: studentApps, error } = await supabaseClient
        .from("current_applications")
        .select("id, job_id, status, student_rank_position")
        .eq("student_id", studentId)
        .in("status", ["offer", "ranked"])
        .order("student_rank_position", { ascending: true });
    
    if (error || !studentApps || studentApps.length === 0) {
        return { acceptsOffer: true };
    }
    
    const currentOffer = studentApps.find(app => app.job_id === currentJobId && app.status === "offer");
    
    if (!currentOffer) {
        return { acceptsOffer: true };
    }
    
    const betterQA = studentApps.find(app => 
        app.status === "ranked" && 
        app.student_rank_position < currentOffer.student_rank_position
    );
    
    return {
        acceptsOffer: !betterQA,
        preferredJobId: betterQA ? betterQA.job_id : currentJobId
    };
}

async function assignQAPositions(sortedQAs, availableSpots, jobId) {
    const assignments = [];
    const assignedStudents = new Map();
    
    for (const qa of sortedQAs) {
        const studentId = qa.student_id;
        if (assignedStudents.has(studentId)) {
            const currentAssignment = assignedStudents.get(studentId);
        
            if (qa.cumulative_score < currentAssignment.cumulativeScore) {
                const oldAssignmentIndex = assignments.findIndex(
                    a => a.applicationId === currentAssignment.applicationId
                );
                if (oldAssignmentIndex !== -1) {
                    assignments[oldAssignmentIndex].assigned = false;
                }
                await freeUpPosition(currentAssignment.jobId);
            
                assignedStudents.set(studentId, {
                    applicationId: qa.id,
                    cumulativeScore: qa.cumulative_score,
                    jobId: jobId
                });
                
                assignments.push({
                    applicationId: qa.id,
                    studentId: studentId,
                    assigned: true
                });
            } else {
                assignments.push({
                    applicationId: qa.id,
                    studentId: studentId,
                    assigned: false
                });
            }
        } else {
            const currentAssignedCount = Array.from(assignedStudents.values())
                .filter(a => a.jobId === jobId).length;
            
            if (currentAssignedCount < availableSpots) {
                assignedStudents.set(studentId, {
                    applicationId: qa.id,
                    cumulativeScore: qa.cumulative_score,
                    jobId: jobId
                });
                
                assignments.push({
                    applicationId: qa.id,
                    studentId: studentId,
                    assigned: true
                });
            } else {
                assignments.push({
                    applicationId: qa.id,
                    studentId: studentId,
                    assigned: false
                });
            }
        }
    }
    return assignments;
}

async function freeUpPosition(jobId) {
    console.log(`Position freed up for job ${jobId} - may need reprocessing`);
}








