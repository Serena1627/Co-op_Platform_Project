import { supabaseClient } from "../supabaseClient.js";
import { getCurrentCoopInformation } from "../components/coop-information.js";

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
    
    const today = new Date();
    const currentCoopInformation = await getCurrentCoopInformation(profile.coop_cycle, today);

    const alertsDiv = document.getElementById('alerts');
    const deadlineInfo = alertsDiv.querySelector('ul li');
    const allAlerts = alertsDiv.querySelector('ul');

    await updateJobAlerts(allAlerts, userId);

    if (currentCoopInformation == null || currentCoopInformation.round == null){
        deadlineInfo.textContent = `You are not currently in an active co-op cycle.`;
    }
    else{
        deadlineInfo.textContent = currentCoopInformation.message;
    }

    document.getElementById("coop-cycle").textContent = profile.coop_cycle;
    document.getElementById("coop-round").textContent = `${currentCoopInformation.round} Round`;
    document.getElementById("coop-advisor").textContent = profile.coop_advisor && profile.coop_advisor !== "" ? profile.coop_advisor : "N/A";
    document.getElementById("intro").textContent  += profile.first_name;
});

async function updateJobAlerts(alertsList, userId) {
    const { data, error } = await supabaseClient
        .from("job_notifications")
        .select("*")
        .eq("student_id", userId);

    if (error) {
        console.error("Error getting jobAlerts", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No job alerts found.");
        return;
    }

    for (let alert of data) {
        const li = document.createElement('li');
        li.textContent = alert.message;
        li.classList.add("jobNotice");
        alertsList.prepend(li);
    }
}
