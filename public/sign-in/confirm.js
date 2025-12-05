import { supabaseClient } from "../supabaseClient.js";

document.addEventListener("DOMContentLoaded", async () => {
    const { data, error } = await supabaseClient.auth.getSession();
    
    if (error) {
        console.error("Error getting session:", error);
        alert("Confirmation failed. Please try signing in.");
        window.location.assign("./login.html");
        return;
    }

    if (data.session) {
        const user = data.session.user;
        const accountType = user.user_metadata?.accountType;

        if (!accountType) {
            console.error("No account type found in user metadata");
            alert("Account type not found. Please contact support.");
            return;
        }
        if (accountType === "student") {
            await handleStudentRedirect(user);
        } else if (accountType === "employer") {
            await handleEmployerRedirect(user);
        }
    } else {
        alert("Email confirmed! Please sign in.");
        window.location.assign("./login.html");
    }
});

async function handleStudentRedirect(user) {
    const { data, error } = await supabaseClient
        .from("student_profile")
        .select("*")
        .eq("student_id", user.id)
        .maybeSingle();

    if (error) {
        console.error("Error checking student profile:", error);
        return;
    }

    if (!data) {
        window.location.assign("../studentPages/StudentProfileForm.html");
    } else {
        window.location.assign("../studentPages/StudentHomepage.html");
    }
}

async function handleEmployerRedirect(user){
    const { data, error } = await supabaseClient
        .from("companies")
        .select("*")
        .overlaps("associates", [`${user.user_metadata.firstName} ${user.user_metadata.lastName}`])
        .maybeSingle();
    
    if (error){
        console.error("Error checking employer profile:", error);
        return;
    }

    if (!data) {
        window.location.assign(`../employerPages/EmployerProfileForm.html`);
    } else {
        window.location.assign(`../employerPages/JobPosts.html?company_id=${data.id}`);
    }
}