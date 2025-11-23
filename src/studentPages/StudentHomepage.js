import { supabaseClient } from "../supabaseClient.js";

document.addEventListener("DOMContentLoaded", async () => {
    const { data, error } = await supabaseClient.auth.getUser();
    if (error || !data.user) {
        console.error("No user found.");
        return;
    }

    const userId = data.user.id;

    const { data: profile, error: profileError } = await supabaseClient
        .from("student_profile")
        .select("*")
        .eq("student_id", userId)
        .single();

    if (profileError) {
        console.error("Error loading profile:", profileError);
        return;
    }

    // 3. Inject data into HTML
    document.getElementById("coop-cycle").textContent = profile.coop_cycle;
    document.getElementById("coop-advisor").textContent = profile.coop_advisor && profile.coop_advisor !== "" ? profile.coop_advisor : "N/A";
    document.getElementById("intro").textContent  += profile.first_name
});