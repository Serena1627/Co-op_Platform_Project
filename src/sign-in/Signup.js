import { supabaseClient } from "../supabaseClient.js";

document.addEventListener("DOMContentLoaded", async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
        await handleLoggedIn(session.user);
    }

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_IN" && session) {
            await handleLoggedIn(session.user);
        }
    });
});

async function handleLoggedIn(user) {
    // Wait a moment for metadata to be fully loaded
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const accountType = user.user_metadata?.accountType;

    if (!accountType) {
        console.error("No account type found in user metadata");
        return;
    }

    if (accountType === "student") {
        await handleStudentRedirect(user);
    } else if (accountType === "employer") {
        window.location.assign("../employerPages/JobPosts.html");
    }
}

async function handleStudentRedirect(user) {
    try {
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
            window.location.assign("../studentPages/StudentProfileForm.html");
        } else {
            window.location.assign("../studentPages/StudentHomepage.html");
        }
    } catch (err) {
        console.error("Redirect error:", err);
    }
}