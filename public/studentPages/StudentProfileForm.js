import { supabaseClient } from "../supabaseClient.js";

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

    const { data, error } = await supabaseClient
        .from("student_profile")
        .insert([studentData]);

    if (error) {
        console.error("Error inserting data:", error);
        alert("Failed to save student profile.");
    } else {
        alert("Student profile saved successfully!");
        window.location.assign("StudentHomepage.html");
    }
});
