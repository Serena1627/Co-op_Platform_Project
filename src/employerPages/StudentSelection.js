import { supabaseClient } from "../supabaseClient.js";

document.addEventListener("DOMContentLoaded", async () => {

    const params = new URLSearchParams(window.location.search);
    const jobId = params.get("jobId");

    const { data: userData } = await supabaseClient.auth.getUser();
    const user = userData?.user;

    const { data: companyData, error: companyError } = await supabaseClient
        .from("companies")
        .select("*")
        .overlaps("associates", [`${user.user_metadata.firstName} ${user.user_metadata.lastName}`])
        .maybeSingle();

    if (companyError) {
        console.error("Error Getting Company Profile:", companyError);
        return;
    }
    const companyName = companyData?.company_name;
    const companyId = companyData?.id;
    const mainPageLink = document.getElementById('main-page-link');
    if (mainPageLink) {
        mainPageLink.href = `JobPosts.html?company_id=${companyData.id}`;
    }else{
        console.log("here");
    }
    const title = document.querySelector(".container h1");
    const jobFilter = document.querySelector(".filters select:first-of-type");

    let applications;
    if (jobId) {
        jobFilter.disabled = true;
        const { data: jobData } = await supabaseClient
            .from("job_listings")
            .select("job_title")
            .eq("id", jobId)
            .maybeSingle();
        
        const jobTitle = jobData?.job_title || jobId;
        title.textContent = `Student Applications for ${companyName} - ${jobTitle}`;
        applications = (await getJobApplications(null, jobId)).data
    } else {
        title.textContent = `Student Applications for ${companyName}`;
        applications = (await getJobApplications(companyId, null)).data
    }

    const applicationGrid = document.getElementById("application-grid");
    if (!applications || applications.length === 0) {
        document.getElementById("no-applications").innerHTML = `
            <div class="no-applications">
                <i class="fa fa-inbox"></i>
                <h2>No Applications Yet</h2>
                <p>You haven't received any applications for your job postings.</p>
            </div>
        `;
        return;
    }

    const studentIds = applications.map(app => app.student_id);

    const { data: studentData, error: studentError } = await supabaseClient
        .from("student_profile")
        .select("*")
        .in("student_id", studentIds);

    if (studentError) {
        console.error("Error Getting Students:", studentError);
        return;
    }
    

    const studentMap = new Map(studentData.map(s => [s.student_id, s]));
    applicationGrid.innerHTML = "";

    for (let app of applications) {
        const student = studentMap.get(app.student_id);
        if (!student){
            continue;
        }
        let card = createApplicationCard(app, student)
        applicationGrid.appendChild(card);
    }
});


function createApplicationCard(application, student) {
    const card = document.createElement('div');
    card.className = 'application-card';
    
    const initials = `${student.first_name?.charAt(0) || ''}${student.last_name?.charAt(0) || ''}`;
    
    const statusClass = application.status === 'reviewed' ? 'status-reviewed' : 'status-new';
    const statusText = application.status === 'reviewed' ? 'Reviewed' : 'New Application';
    
    const citizenship = student.is_international ? 'Non-US Citizen' : 'US Citizen';
    let coop_experience = "";
    if (student.coop_number || student.coop_number == 1){
        coop_experience = "First Coop";
    } else if (student.coop_number == 2){
        coop_experience = "Second Coop";
    } else if (student.coop_number == 3){
        coop_experience = "Third Coop";
    }
    
    card.innerHTML = `
        <div class="card-header">
            <div class="avatar">${initials}</div>
            <div class="student-info">
                <h3>${student.first_name} ${student.last_name}</h3>
                <p class="major">${student.major || 'N/A'}</p>
            </div>
        </div>

        <span class="status-badge ${statusClass}">${statusText}</span>

        <div class="job-applied">
            <strong>Applied for:</strong> ${application.job_title || 'Job Position'}
        </div>

        <div class="details">
            <div class="detail-item">
                <i class="fa fa-graduation-cap"></i> ${student.college_year || 'N/A'}
            </div>
            <div class="detail-item">
                <i class="fa fa-calendar"></i> ${ coop_experience || 'First Coop'}
            </div>
            <div class="detail-item">
                <i class="fa fa-star"></i> GPA: ${student.gpa || 'N/A'}
            </div>
            <div class="detail-item">
                <i class="fa fa-globe"></i> ${citizenship}
            </div>
        </div>

        <button class="see-more-btn" onclick="viewApplication('${application.id}', '${student.id}')">
            <i class="fa fa-file-text"></i> View Full Application
        </button>
    `;
    
    return card;
}

function viewApplication(applicationId, studentId) {
    window.location.href = `ApplicationDetail.html?applicationId=${applicationId}&studentId=${studentId}`;
}

async function getJobApplications(companyId = null, jobId = null) {
    let filterId = companyId;
    let filterStatement = "company_id";
    if (jobId) {
        filterId = jobId;
        filterStatement = "job_id";
    }
    const { data, error } = await supabaseClient
        .from("application_submissions")
        .select("*")
        .eq(filterStatement, filterId);

    if (error) {
        console.error("Error Getting Applications:", error);
        return { data: [], error }; 
    }
    return { data: data, error: null };
}

window.viewApplication = viewApplication;