import { supabaseClient } from "../../supabaseClient.js";

document.addEventListener("DOMContentLoaded", async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
        alert("You are not logged in.");
        window.location.assign("/co-op-portal-project-cs-375/src/sign-in/login.html");
        return;
    }
    
    await calculateProgressTimeline(user.id);
    setupAppFilters();

    await loadApplications(user.id);
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
        
        const existingCard = contentContainer.querySelector(".application-card");
        if (existingCard) {
            existingCard.remove();
        }

        if (data.length === 0) {
            const emptyState = document.createElement("div");
            emptyState.className = "empty-state";
            emptyState.innerHTML = `
                <p>You haven't applied to any jobs yet.</p>
                <a href="../JobPostings.html">Browse Available Jobs</a>
            `;
            contentContainer.appendChild(emptyState);
            return;
        }

        data.forEach(application => {
            const card = createApplicationCard(application);
            contentContainer.appendChild(card);
        });

    } catch (err) {
        console.error("Unexpected error loading applications:", err);
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
                    <!-- Resumes will be loaded here -->
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
            throw new Error(`Couldn't Update Applicate: ${error.message}`);
        }
        
        
        showNotification("Application submitted successfully!");
        window.location.reload();
        
        
    } catch (error) {
        console.error("Error submitting application:", error);
        alert("Failed to submit application. Please try again.");
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

        const today = new Date();
        let currentRound = null;

        for (let round of rounds) {
            if (today >= round.job_postings_available &&
                today <= round.results_available) {
                currentRound = round;
                break;
            }
        }

        if (!currentRound) {
            throw new Error("Current date does not fall within any round range.");
        }

        let stage = 1;

        if (today >= currentRound.job_postings_available && today < currentRound.view_interviews_granted) {
            stage = 1;
        }
        else if (today >= currentRound.view_interviews_granted && today < currentRound.interview_period_end) {
            stage = 2;
        }
        else if (today >= currentRound.interview_period_end && today < currentRound.rankings_due) {
            stage = 3;
        }
        else if (today >= currentRound.rankings_due && today < currentRound.results_available) {
            stage = 4;
        }
        else if (today >= currentRound.results_available) {
            stage = 5;
        }

        setProgressBar(stage);

    } catch (error) {
        alert(`Error generating Coop Timeline: ${error.message}`);
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
        'interview': { text: 'Interview Scheduled', class: 'status-interview' },
        'offer': { text: 'Offer Received', class: 'status-offer' },
        'accepted': { text: 'Offer Accepted', class: 'status-accepted' },
        'rejected': { text: 'Not Selected', class: 'status-rejected' },
        'withdrawn': { text: 'Withdrawn', class: 'status-withdrawn' }
    };

    const statusInfo = statusMap[application.status] || statusMap['pending'];

    const card = document.createElement("div");
    card.className = "application-card";
    card.dataset.status = application.status;
    card.dataset.applicationId = application.id;

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
        const completeBtn = card.querySelector(".complete-application-btn");
        completeBtn.addEventListener("click", () => {
            createResumeSelectionPopup(
                application.id, 
                job.job_title, 
                companyName
            );
        });
    }

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


function showNotification(message) {
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