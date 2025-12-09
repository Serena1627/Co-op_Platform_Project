import { supabaseClient } from "../supabaseClient.js";

let centralDate = loadDateFromStorage();

function loadDateFromStorage() {
    const saved = localStorage.getItem("centralDate");
    return saved ? new Date(saved) : null;
}

function saveDateToStorage(date) {
    if (!date) {
        localStorage.removeItem("centralDate");
    } else {
        localStorage.setItem("centralDate", date.toISOString());
    }
}

export function setDate(date = null) {
    if (date === null) {
        centralDate = new Date();
    } else {
        centralDate = new Date(date);
    }
    saveDateToStorage(centralDate);
}

export function getDate() {
    return centralDate || new Date();
}

export async function getCurrentCoopInformation(coopCycle, today) {
    const coopCalendar = await parseCalendar(coopCycle);
    const rounds = Object.entries(coopCalendar);
    
    for (const [roundName, r] of rounds) {
        const roundLetter = roundName.split('_')[0];

        if (isBetween(today, r.jobPostingsAvailable, r.interviewRequestsDue)) {
            return {
                round: roundLetter,
                stage: "Job Postings Available",
                stage_number: 1,
                message: `View ${coopCycle} job postings starting ${r.jobPostingsAvailable.toDateString()}.`
            };
        }

        if (today <= r.interviewRequestsDue) {
            return {
                round: roundLetter,
                stage: "Interview Requests Due",
                stage_number: 2,
                message: `Submit all ${coopCycle} job interview requests before ${r.interviewRequestsDue.toDateString()}.`
            };
        }

        if (r.viewInterviewsGranted && today <= r.viewInterviewsGranted) {
            return {
                round: roundLetter,
                stage: "View Interviews Granted",
                stage_number: 3,
                message: `View your granted interviews on ${r.viewInterviewsGranted.toDateString()}.`
            };
        }

        if (r.interviewPeriod && isBetween(today, r.interviewPeriod.start, r.interviewPeriod.end)) {
            return {
                round: roundLetter,
                stage: "Interview Period",
                stage_number: 4,
                message: `Complete all your interviews before ${r.interviewPeriod.end.toDateString()}.`
            };
        }

        if (r.viewRankings && today <= r.viewRankings) {
            return {
                round: roundLetter,
                stage: "View Rankings",
                stage_number: 5,
                message: `View job rankings starting ${r.viewRankings.toDateString()}.`
            };
        }

        if (r.rankingsDue && today <= r.rankingsDue) {
            return {
                round: roundLetter,
                stage: "Rankings Due",
                stage_number: 6,
                message: `Submit your rankings before ${r.rankingsDue.toDateString()}.`
            };
        }

        if (r.resultsAvailable && today <= r.resultsAvailable) {
            return {
                round: roundLetter,
                stage: "Results Available",
                stage_number: 7,
                message: `Your co-op results will be available on ${r.resultsAvailable.toDateString()}.`
            };
        }
    }

    return {
        round: null,
        stage: "No Active Round",
        stage_number: 0,
        message: "You are not currently in an active co-op cycle."
    };
}

async function parseCalendar(coop_cycle) {
    try {
        const { data, error } = await supabaseClient
            .from("coop_calendar")
            .select("*")
            .eq("coop_cycle", coop_cycle);
        
        if (error) {
            throw new Error("Couldn't fetch coop calendar: " + error.message);
        }

        const structured = {};
        data.forEach(row => {
            structured[row.round] = {
                jobPostingsAvailable: new Date(row.job_postings_available),
                interviewRequestsDue: new Date(row.interview_requests_due),
                viewInterviewsGranted: row.view_interviews_granted ? new Date(row.view_interviews_granted) : null,
                interviewPeriod: row.interview_period_start && row.interview_period_end ? {
                    start: new Date(row.interview_period_start),
                    end: new Date(row.interview_period_end)
                } : null,
                viewRankings: row.view_rankings ? new Date(row.view_rankings) : null,
                rankingsDue: row.rankings_due ? new Date(row.rankings_due) : null,
                resultsAvailable: row.results_available ? new Date(row.results_available) : null,
            };
        });

        return structured;

    } catch (error) {
        console.error("Error fetching calendar:", error);
        throw error;
    }
}

function isBetween(date, start, end) {
    if (!start || !end) return false;
    return date >= start && date <= end;
}