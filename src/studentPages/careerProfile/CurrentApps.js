import { supabaseClient } from "../../supabaseClient.js";

document.addEventListener("DOMContentLoaded", async () => {
    // Get current user ID (replace with actual auth)
    const CURRENT_USER_ID = "6ca88f98-01e0-4153-a0af-988a1d270d30"; 

    await loadApplications(CURRENT_USER_ID);
});

async function loadApplications(studentId) {
    try {
        // Fetch all applications for the current student with job details
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

        // Update the header count
        const headerElement = document.querySelector(".applications-header h2");
        headerElement.textContent = `My Applications (${data.length})`;

        // Get the content container (after the header)
        const contentContainer = document.querySelector(".content");
        
        // Remove existing dummy card
        const existingCard = contentContainer.querySelector(".application-card");
        if (existingCard) {
            existingCard.remove();
        }

        // If no applications, show empty state
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

        // Create a card for each application
        data.forEach(application => {
            const card = createApplicationCard(application);
            contentContainer.appendChild(card);
        });

    } catch (err) {
        console.error("Unexpected error loading applications:", err);
    }
}

function createApplicationCard(application) {
    const job = application.job_listings;
    const companyName = job.company?.company_name || "Unknown Company";
    const appliedDate = new Date(application.applied_date).toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit' 
    });

    // Map status to display text and class
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

    // Add event listener for withdraw button
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

        // Update the status badge in the card
        const statusBadge = cardElement.querySelector(".status-badge");
        statusBadge.textContent = "Withdrawn";
        statusBadge.className = "status-badge status-withdrawn";

        // Disable the withdraw button
        const withdrawBtn = cardElement.querySelector(".withdraw-btn");
        withdrawBtn.disabled = true;
        withdrawBtn.textContent = "Application Withdrawn";

        showNotification("Application withdrawn successfully");

    } catch (err) {
        console.error("Unexpected error:", err);
        alert("An unexpected error occurred. Please try again.");
    }
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