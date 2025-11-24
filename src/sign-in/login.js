import { supabaseClient } from "../supabaseClient.js";

document.addEventListener("DOMContentLoaded", async () => {
    // Check if user is already logged in
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        // Already logged in - redirect immediately
        await handlePostLoginRedirect(session.user);
        return;
    }

    const form = document.getElementById("login-form");

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

        // Successfully logged in - redirect based on account type
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
    // Check if student profile exists (same logic as your signup flow)
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
        // No profile → redirect to profile form (first time login)
        window.location.assign("../studentPages/StudentProfileForm.html");
    } else {
        // Profile exists → redirect to student homepage
        window.location.assign("../studentPages/StudentHomepage.html");
    }
}

async function handleEmployerRedirect(user) {
    // Check if employer profile exists (you'll need to implement this)
    const { data, error } = await supabaseClient
        .from("employer_profile")  // You'll need to create this table
        .select("*")
        .eq("employer_id", user.id)
        .maybeSingle();

    if (error) {
        console.error("Error checking employer profile:", error);
        return;
    }

    if (!data) {
        // No employer profile → redirect to employer profile form
        window.location.assign("../employerPages/EmployerProfileForm.html");
    } else {
        // Profile exists → redirect to employer dashboard
        window.location.assign("../employerPages/JobPosts.html");
    }
}