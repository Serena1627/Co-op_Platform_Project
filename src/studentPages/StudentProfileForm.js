import { supabaseClient } from "../supabaseClient.js";

const urlParams = new URLSearchParams(window.location.search);
const isEditMode = urlParams.get('edit') === 'true';
const { data: { user } } = await supabaseClient.auth.getUser();

if (isEditMode) {
    document.querySelector('h1').textContent = 'Edit Student Profile';
    document.querySelector('button[type="submit"]').textContent = 'Update';
    
    const { data, error } = await supabaseClient
        .from("student_profile")
        .select("*")
        .eq("student_id", user.id)
        .single();

    if (error) {
        console.error("Error loading profile:", error);
        alert("Failed to load student profile.");
    } else {
        document.getElementById("drexel_student_id").value = data.drexel_student_id || '';
        document.getElementById("coop_number").value = data.coop_number || '';
        document.getElementById("is_international").value = data.is_international ? "Non U.S Citizen" : "U.S Citizen";
        document.getElementById("major").value = data.major || '';
        document.getElementById("college_year").value = data.college_year || '';
        document.getElementById("gpa").value = data.gpa || '';
        document.getElementById("coop_cycle").value = data.coop_cycle || '';
        document.getElementById("coop-advisor").value = data.coop_advisor || '';
        document.getElementById("advisor-email").value = data.coop_advisor_email || '';
    }
}

document.getElementById("student-form").addEventListener("submit", async function (e) {
    e.preventDefault();

    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        alert("You are not logged in.");
        window.location.assign("../sign-in/login.html");
        return;
    }

    const studentData = {
        student_id: user.id,
        first_name: user.user_metadata.firstName,
        last_name: user.user_metadata.lastName,
        email_address: user.email,
        drexel_student_id: document.getElementById("drexel_student_id").value,
        coop_number: document.getElementById("coop_number").value,
        is_international: document.getElementById("is_international").value === "Non U.S Citizen",
        major: document.getElementById("major").value,
        college_year: document.getElementById("college_year").value,
        gpa: parseFloat(document.getElementById("gpa").value),
        coop_cycle: document.getElementById("coop_cycle").value,
        coop_advisor: document.getElementById("coop-advisor").value,
        coop_advisor_email: document.getElementById("advisor-email").value,
    };

    let result;
    
    if (isEditMode) {
        result = await supabaseClient
            .from("student_profile")
            .update(studentData)
            .eq("student_id", user.id);
    } else {
        result = await supabaseClient
            .from("student_profile")
            .insert([studentData]);
    }

    if (result.error) {
        console.error("Error saving data:", result.error);
        alert(`Failed to ${isEditMode ? 'update' : 'save'} student profile.`);
    } else {
        alert(`Student profile ${isEditMode ? 'updated' : 'saved'} successfully!`);
        window.location.assign(isEditMode ? "ProfileView.html" : "StudentHomepage.html");
    }
});
