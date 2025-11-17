import { supabaseClient } from "../supabaseClient.js";
document.addEventListener("DOMContentLoaded", async () => {
    const { data, error } = await supabaseClient
        .from("job_listings")
        .select(`
            job_title,
            location,
            hourly_pay,
            company:company_id (
                name,
                rating
            )
        `);

    if (error) {
        console.error("Error loading jobs:", error);
        return;
    }

    const tableBody = document.getElementById("table-body");
    tableBody.innerHTML = "";

    data.forEach(job => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${job.company?.name ?? "Unknown"}</td>
            <td>${job.job_title}</td>
            <td>${job.company?.rating ? job.company.rating + "/5" : "N/A"}</td>
            <td>${job.location}</td>
            <td>${job.hourly_pay}</td>
            <td><button class="add-btn">+</button></td>
        `;

        tableBody.appendChild(row);
    });
});
