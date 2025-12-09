import { supabaseClient } from "../supabaseClient.js";
import { parseCalendar, isBetween } from "../components/coop-information.js";

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
    
    const coopData = await parseCalendar(profile.coop_cycle);
    const currentCoopInformation = getCurrentCoopInformation(coopData, profile.coop_cycle);

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

function getCurrentCoopInformation(coopCalendar, coopCycle) {
    const today = new Date();
    
    const rounds = Object.entries(coopCalendar);
    
    for (const [roundName, r] of rounds) {
        const roundLetter = roundName.split('_')[0];

        if (isBetween(today, r.jobPostingsAvailable, r.interviewRequestsDue)) {
            return {
                round: roundLetter,
                stage: "Job Postings Available",
                message: `View ${coopCycle} job postings starting ${r.jobPostingsAvailable.toDateString()}.`
            };
        }

        if (today <= r.interviewRequestsDue) {
            return {
                round: roundLetter,
                stage: "Interview Requests Due",
                message: `Submit all ${coopCycle} job interview requests before ${r.interviewRequestsDue.toDateString()}.`
            };
        }

        if (r.viewInterviewsGranted && today <= r.viewInterviewsGranted) {
            return {
                round: roundLetter,
                stage: "View Interviews Granted",
                message: `View your granted interviews on ${r.viewInterviewsGranted.toDateString()}.`
            };
        }

        if (r.interviewPeriod && isBetween(today, r.interviewPeriod.start, r.interviewPeriod.end)) {
            return {
                round: roundLetter,
                stage: "Interview Period",
                message: `Complete all your interviews before ${r.interviewPeriod.end.toDateString()}.`
            };
        }

        if (r.viewRankings && today <= r.viewRankings) {
            return {
                round: roundLetter,
                stage: "View Rankings",
                message: `View job rankings starting ${r.viewRankings.toDateString()}.`
            };
        }

        if (r.rankingsDue && today <= r.rankingsDue) {
            return {
                round: roundLetter,
                stage: "Rankings Due",
                message: `Submit your rankings before ${r.rankingsDue.toDateString()}.`
            };
        }

        if (r.resultsAvailable && today <= r.resultsAvailable) {
            return {
                round: roundLetter,
                stage: "Results Available",
                message: `Your co-op results will be available on ${r.resultsAvailable.toDateString()}.`
            };
        }
    }

    return {
        round: null,
        stage: "No Active Round",
        message: "You are not currently in an active co-op cycle."
    };
}