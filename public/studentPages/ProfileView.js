import { supabaseClient } from "../supabaseClient.js";


const { data: { user } } = await supabaseClient.auth.getUser();

async function loadProfile() {
    const { data, error } = await supabaseClient
        .from("student_profile")
        .select("*")
        .eq("student_id", user.id)
        .single();

    if (error) {
        console.error("Error loading profile:", error);
        alert("Failed to load student profile.");
        return;
    }
    document.getElementById("first_name").textContent = data.first_name;
    document.getElementById("last_name").textContent = data.last_name;
    document.getElementById("email_address").textContent = data.email_address;
    document.getElementById("drexel_student_id").textContent = data.drexel_student_id;
    document.getElementById("is_international").textContent = data.is_international ? "Non U.S Citizen" : "U.S Citizen";
    document.getElementById("major").textContent = data.major;
    document.getElementById("college_year").textContent = data.college_year;
    document.getElementById("gpa").textContent = data.gpa;
    document.getElementById("coop_cycle").textContent = data.coop_cycle;
}

document.querySelector(".edit-btn").addEventListener("click", function() {
    window.location.assign("StudentProfileForm.html?edit=true");
});

loadProfile();