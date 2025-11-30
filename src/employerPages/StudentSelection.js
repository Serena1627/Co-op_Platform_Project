import { supabaseClient } from "../supabaseClient.js";

document.addEventListener("DOMContentLoaded", async () => {
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

    const { data: applications, error } = await supabaseClient
        .from("application_submissions")
        .select("*")
        .eq("company_id", companyData.id);

    if (error) {
        console.error("Error Getting Applications:", error);
        return;
    }

    const applicationGrid = document.querySelector(".application-grid");

    if (!applications || applications.length === 0) {
        document.getElementById('no-applications').innerHTML = `
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
        .in("id", studentIds);

    if (studentError) {
        console.error("Error Getting Students:", studentError);
        return;
    }

    const studentMap = new Map(studentData.map(s => [s.id, s]));

    applicationGrid.innerHTML = "";

    for (let app of applications) {
        const student = studentMap.get(app.student_id);
        if (!student) continue;
        applicationGrid.appendChild(createApplicationCard(app, student));
    }
});
