import { supabaseClient } from "../../public/supabaseClient.js";

async function loadHomepage() {
    const { data: { user }, error: sessionError } = await supabaseClient.auth.getUser();
    if (sessionError || !user) {
        console.error('User not signed in', sessionError);
        return;
    }


    const { data: recruiterData, error: recruiterError } = await supabaseClient
        .from("recruiters")
        .select(`
            id,
            first_name,
            last_name,
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
                    last_name
                )
            ),
            email
        `)
        .eq('id', user.id)
        .single();
    
    if (recruiterError) {
        console.error('Failed to fetch recruiter info:', recruiterError);
        return;
    }

    const mainPageLink = document.getElementById('main-page-link');
    if (mainPageLink) {
        mainPageLink.href = `/public/employerPages/JobPosts.html?company_id=${recruiterData.company_id}`;
    }

    const recruiter = recruiterData;
    document.getElementById('welcome-message').textContent = `Welcome, ${recruiter.first_name}`;

    const newJobButtons = document.getElementsByClassName("btn btn-primary");

    for (let btn of newJobButtons) {
        btn.addEventListener("click", () => {
            if (recruiter.company_id) {
                window.location.href = `JobPosts.html?company_id=${recruiter.company_id}`;
            } else {
                alert("Please complete your company profile before creating jobs.");
                window.location.href = "EmployerProfileForm.html";
            }
        });
    }

    const { data: jobsData, error: jobsError } = await supabaseClient
        .from('job_listings')
        .select('*')
        .eq('recruiter_id', recruiter.id);

    if (jobsError) {
        console.error('Failed to fetch jobs:', jobsError);
        return;
    }
    

    const jobsCount = jobsData.length;
    document.getElementById('jobs-count').textContent = jobsCount;

    const jobIds = jobsData.map(job => job.id);
    let applicationsData = [];
    if (jobIds.length > 0) {
        const { data: appsData, error: appsError } = await supabaseClient
            .from('current_applications')
            .select('*')
            .in('job_id', jobIds);

        if (appsError) {
            console.error('Failed to fetch applications:', appsError);
            return;
        }
        applicationsData = appsData;
    }

    const company = recruiter.companies;

    if (company) {
        document.getElementById("company-snapshot").innerHTML = `
            <p><strong>Company:</strong> ${company.company_name}</p>
            <p><strong>Type:</strong> ${company.company_type || "N/A"}</p>
            <p><strong>Rating:</strong> ${company.rating || "Unrated"}</p>
            <p><strong>Recruiter Name:</strong> ${recruiter.first_name || "N/A"} ${recruiter.last_name || "N/A"}</p>
            <p><strong>Recruiter Contact:</strong> ${recruiter.email || "N/A"}</p>
        `;
    } else {
        document.getElementById("company-snapshot").innerHTML =
            "<p>No company profile found.</p>";
    }

}



loadHomepage();


