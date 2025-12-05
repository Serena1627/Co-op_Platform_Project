import { supabaseClient } from "../supabaseClient.js";

export async function parseCalendar(coop_cycle) {
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

export function isBetween(date, start, end) {
    if (!start || !end) return false;
    return date >= start && date <= end;
}