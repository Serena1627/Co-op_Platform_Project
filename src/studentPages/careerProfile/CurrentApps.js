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
            <button class="btn btn-outline withdraw-btn" data-app-id="${application.id}">
                Withdraw Application
            </button>
        </div>
    `;

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