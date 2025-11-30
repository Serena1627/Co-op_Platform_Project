import { supabaseClient } from "../supabaseClient.js";

document.addEventListener("DOMContentLoaded", async () => {
    await supabaseClient.auth.signOut();
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        await handlePostLoginRedirect(session.user);
        return;
    }

    const form = document.getElementById("login-in-form");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            alert("Login failed: " + error.message);
            return;
        }
        await handlePostLoginRedirect(data.user);
    });
});

async function handlePostLoginRedirect(user) {
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
    } else {
        alert("Unknown account type");
    }
}

async function handleStudentRedirect(user) {
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
}

async function handleEmployerRedirect(user) {
    const { data, error } = await supabaseClient
        .from("employer_profile")
        .select("*")
        .eq("employer_id", user.id)
        .maybeSingle();

    if (error) {
        console.error("Error checking employer profile:", error);
        return;
    }

    if (!data) {
        window.location.assign("../employerPages/EmployerProfileForm.html");
    } else {
        window.location.assign("../employerPages/JobPosts.html");
    }
}