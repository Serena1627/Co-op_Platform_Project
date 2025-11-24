import { supabaseClient } from "../supabaseClient.js";

document.addEventListener("DOMContentLoaded", async () => {
    // Get the token from URL (Supabase will handle this automatically)
    const { data, error } = await supabaseClient.auth.getSession();
    
    if (error) {
        console.error("Error getting session:", error);
        alert("Confirmation failed. Please try signing in.");
        window.location.assign("./login.html");
        return;
    }

    if (data.session) {
        // User is confirmed and has a session
        const user = data.session.user;
        const accountType = user.user_metadata?.accountType;

        if (!accountType) {
            console.error("No account type found in user metadata");
            alert("Account type not found. Please contact support.");
            return;
        }
        
        // Use the account type from user metadata (stored during signup)
        if (accountType === "student") {
            await handleStudentRedirect(user);
        } else if (accountType === "employer") {
            window.location.assign("../employerPages/JobPosts.html");
        }
    } else {
        // No session - might need manual confirmation
        alert("Email confirmed! Please sign in.");
        window.location.assign("./login.html");
    }
});

async function handleStudentRedirect(user) {
    // Check if student profile exists
    const { data, error } = await supabaseClient
        .from("student_profile")
        .select("*")
        .eq("student_id", user.id)
        .maybeSingle();

    if (error) {
        console.error("Error checking profile:", error);
        return;
    }

    if (!data) {
        // No profile → redirect to profile form
        window.location.assign("../studentPages/StudentProfileForm.html");
    } else {
        // Profile exists → redirect to homepage
        window.location.assign("../studentPages/StudentHomepage.html");
    }
}