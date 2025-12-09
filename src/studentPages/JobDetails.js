import { supabaseClient } from "../supabaseClient.js";

function getJobIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("jobId");
}

function formatPay(jobData) {
    if (!jobData.is_paid) return "Unpaid";
    
    if (jobData.is_range && jobData.hourly_pay && typeof jobData.hourly_pay === "object") {
        const min = jobData.hourly_pay.min;
        const max = jobData.hourly_pay.max;
        if (min && max) {
            return `$${min} - $${max}/hr`;
        }
    }
    
    if (jobData.hourly_pay) {
        return typeof jobData.hourly_pay === "number" 
            ? `$${jobData.hourly_pay}/hr` 
            : jobData.hourly_pay;
    }
    
    return "Paid (amount not specified)";
}

document.addEventListener("DOMContentLoaded", async () => {
    const jobId = getJobIdFromURL();

    const { data, error } = await supabaseClient
        .from("job_listings")
        .select(`
            id,
            job_title,
            location,
            company_id,
            companies:company_id (
                id,
                company_name,
                company_type,
                rating,
                primary_contact,
                recruiters:recruiters (
                    id,
                    first_name,
                    last_name,
                    email
               )
            ),
            is_paid,
            hourly_pay,
            is_range,
            requires_citizenship,
            job_rating,
            job_description,
            job_qualifications,
            no_of_open_positions,
            desired_majors,
            gpa,
            no_of_applicants,
            experience_level,
            is_full_time,
            requires_in_person_interviews,
            requires_transportation,
            perks,
            follows_scdc_calendar,
            contact_email,
            allow_messaging
        `)
        .eq("id", jobId);

    if (error) {
        alert("Error fetching job details.");
        console.error("Error fetching job details", error);
        return;
    }

    const jobData = data[0];
    if (!jobData) return;

    // Basic info
    document.getElementById("job-title").textContent = jobData.job_title || "Job Title";
    document.getElementById("company-name").textContent = jobData.companies?.company_name || "Company Name";
    document.getElementById("location").textContent = jobData.location || "Location not specified";
    document.getElementById("pay").textContent = formatPay(jobData);
    document.getElementById("work-type").textContent = jobData.is_full_time ? "Full-time" : "Part-time";
    
    // Rating - use employer_rating if available, otherwise job_rating, otherwise N/A
    const rating = jobData.employer_rating || jobData.job_rating || jobData.companies?.rating;
    document.getElementById("rating").textContent = rating ? rating.toFixed(1) : "N/A";
    
    // Quick stats
    document.getElementById("open-positions").textContent = jobData.no_of_open_positions || "0";
    document.getElementById("applicants").textContent = jobData.no_of_applicants || "0";
    document.getElementById("experience").textContent = jobData.experience_level || "Not specified";
    document.getElementById("gpa-req").textContent = jobData.gpa ? `${jobData.gpa}+` : "N/A";
    
    // Job description - keep as HTML
    const descriptionContainer = document.getElementById("job-description");
    if (jobData.job_description) {
        descriptionContainer.innerHTML = `<p>${jobData.job_description}</p>`;
    } else {
        descriptionContainer.innerHTML = `<p>No description available.</p>`;
    }
    
    // Job qualifications - create proper list structure
    const qualificationsContainer = document.getElementById("job-qualifications");
    if (Array.isArray(jobData.job_qualifications) && jobData.job_qualifications.length > 0) {
        const ul = document.createElement("ul");
       jobData.job_qualifications.forEach(item => {
            const li = document.createElement("li");
            li.textContent = item;
            ul.appendChild(li);
        });
        qualificationsContainer.innerHTML = "";
        qualificationsContainer.appendChild(ul);
    } else {
        qualificationsContainer.innerHTML = `<p>No specific qualifications listed.</p>`;
    }
    
    // Perks - maintain proper structure
    const perksContainer = document.getElementById("perks-list");
    if (Array.isArray(jobData.perks) && jobData.perks.length > 0) {
        perksContainer.innerHTML = "";
        jobData.perks.forEach(perk => {
            const perkDiv = document.createElement("div");
            perkDiv.className = "perk";
            perkDiv.innerHTML = `
                <div class="perk-icon">✓</div>
                <span>${perk}</span>
            `;
            perksContainer.appendChild(perkDiv);
        });
    } else {
        // Hide the perks section if no perks
        const perksSection = document.getElementById("perks-section");
        if (perksSection) perksSection.style.display = "none";
    }
    document.getElementById("citizenship").textContent = jobData.requires_citizenship ? "Required" : "Not Required";
    document.getElementById("interview-format").textContent = jobData.requires_in_person_interviews ? "In Person" : "Virtual";
    document.getElementById("transportation").textContent = jobData.requires_transportation ? "Required" : "Not Required";
    
    const scdcElement = document.getElementById("scdc-calendar");
    if (jobData.follows_scdc_calendar) {
        scdcElement.textContent = "Follows";
        scdcElement.className = "info-value positive";
    } else {
        scdcElement.textContent = "Does Not Follow";
        scdcElement.className = "info-value";
    }
    
    // Desired majors - maintain tag structure
    const majorsContainer = document.getElementById("majors-list");
    if (Array.isArray(jobData.desired_majors) && jobData.desired_majors.length > 0) {
       majorsContainer.innerHTML = "";

        jobData.desired_majors.forEach(major => {
            const tag = document.createElement("span");
            tag.className = "tag";
            tag.textContent = major;
            majorsContainer.appendChild(tag);
       });
    } else {
        majorsContainer.innerHTML = `<span class="tag">All Majors Welcome</span>`;
    }
    document.getElementById("recruiter").textContent = jobData.recruiter || "N/A";

    const applyBtn = document.getElementById("apply-btn");

    if (!applyBtn) {
        console.error("Apply button not found in DOM.");
    } else {
        applyBtn.addEventListener("click", async () => {
            const { data: userData } = await supabaseClient.auth.getUser();
            const user = userData?.user;

            if (!user) {
                alert("You must be logged in to apply.");
                return;
            }

            const jobId = getJobIdFromURL();

            try {
                const { data, error } = await supabaseClient
                    .from("current_applications")
                    .insert([
                        {
                            student_id: user.id,
                            job_id: jobId,
                            status: "pending"
                        }
                    ])
                    .select();

                if (error) {
                    if (error.code === "23505") {
                        alert("You have already applied to this job!");
                    } else {
                        console.error("Error applying to job:", error);
                        alert("Failed to apply. Please try again.");
                    }
                    return;
                }

                // Success
                alert("Application submitted successfully!");
                window.location.href = "./careerProfile/CurrentApps.html";

            } catch (err) {
                console.error("Unexpected error:", err);
                alert("An unexpected error occurred. Please try again.");
            }
        });
    }
});
