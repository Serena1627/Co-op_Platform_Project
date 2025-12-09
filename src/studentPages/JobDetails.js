import { supabaseClient } from "../supabaseClient.js";

function getJobIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("jobId");
}

document.addEventListener("DOMContentLoaded", async () => {
    const jobId = getJobIdFromURL();

    const { data, error } = await supabaseClient
        .from("job_listings")
        .select("*")
        .eq("id", jobId);

    if (error) {
        alert("Error fetching job details.");
        console.error("Error fetching job details", error);
        return;
    }

    const jobData = data[0];
    if (!jobData) return;

    // -----------------------------
    // BASIC FIELDS
    // -----------------------------
    document.getElementById("job-title").textContent = jobData.job_title;
    document.getElementById("company-name").textContent = jobData.company_name;
    document.getElementById("location").textContent = jobData.location;
    document.getElementById("pay").textContent = jobData.hourly_pay ?? "Unpaid";
    document.getElementById("work-type").textContent = jobData.is_full_time ? "Full-Time" : "Part-Time";
    document.getElementById("rating").textContent = jobData.rating || "N/A";

    // Quick stats
    document.getElementById("open-positions").textContent = jobData.no_of_open_positions;
    document.getElementById("applicants").textContent = jobData.no_of_applicants ?? "0";
    document.getElementById("experience").textContent = jobData.experience_level;
    document.getElementById("gpa-req").textContent = jobData.gpa;

    // Description
    document.getElementById("job-description").innerHTML = jobData.job_description;

    // -----------------------------
    // QUALIFICATIONS (array)
    // -----------------------------
    if (Array.isArray(jobData.job_qualifications)) {
        const ul = document.getElementById("job-qualifications");
        ul.innerHTML = "";

        jobData.job_qualifications.forEach(item => {
            const li = document.createElement("li");
            li.textContent = item;
            ul.appendChild(li);
        });
    }

    // -----------------------------
    // PERKS (array)
    // -----------------------------
    if (Array.isArray(jobData.perks)) {
        const perkContainer = document.getElementById("perks-list");
        perkContainer.innerHTML = "";

        jobData.perks.forEach(perk => {
            perkContainer.innerHTML += `
                <div class="perk">
                    <div class="perk-icon">✓</div>
                    <span>${perk}</span>
                </div>
            `;
        });
    }

    // -----------------------------
    // CITIZENSHIP, INTERVIEW, ETC.
    // -----------------------------
    document.getElementById("citizenship").textContent = jobData.requires_citizenship ? "Required" : "Not Required";
    document.getElementById("interview-format").textContent = jobData.requires_in_person_interviews ? "In Person" : "Virtual";
    document.getElementById("transportation").textContent = jobData.requires_transportation ? "Required" : "Not Required";
    document.getElementById("scdc-calendar").textContent = jobData.scdc_calendar ? "Follows" : "Does Not Follow";

    // -----------------------------
    // MAJORS (array)
    // -----------------------------
    if (Array.isArray(jobData.desired_majors)) {
        const majorsContainer = document.getElementById("majors-list");
        majorsContainer.innerHTML = "";

        jobData.desired_majors.forEach(major => {
            majorsContainer.innerHTML += `<span class="tag">${major}</span>`;
        });
    }

    // -----------------------------
    // RECRUITER
    // -----------------------------
    document.getElementById("recruiter").textContent = jobData.recruiter || "N/A";

    // -----------------------------
    // APPLY BUTTON
    // -----------------------------
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
