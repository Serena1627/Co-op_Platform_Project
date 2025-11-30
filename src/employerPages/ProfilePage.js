import { supabaseClient } from "../supabaseClient.js";


const { data: { user } } = await supabaseClient.auth.getUser();

async function loadProfile() {
    const { data, error } = await supabaseClient
        .from("companies")
        .select("*")
        .overlaps("associates", [user.id])
        .maybeSingle();

    if (error) {
        console.error("Error loading profile:", error);
        alert("Failed to load employer profile.");
        return;
    }
    document.getElementById("first_name").textContent = user.user_metadata.firstName;
    document.getElementById("last_name").textContent = user.user_metadata.lastName;
    document.getElementById("email_address").textContent = user.email;
    document.getElementById("company_name").textContent = data.company_name;
    document.getElementById("company_type").textContent = data.company_type ?? "N/a";
    document.getElementById("company_rating").textContent = data.company_rating ?? "Not yet Established";
}

loadProfile();