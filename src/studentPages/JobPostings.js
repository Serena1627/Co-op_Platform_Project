
const supabaseClient = window.supabase.createClient(
    "https://xvdbeuqgtyonbbsdkcqu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZGJldXFndHlvbmJic2RrY3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjUwNjYsImV4cCI6MjA3ODY0MTA2Nn0.ZF-zhsVH2OCyhljoC_G3Rlug5IwZS_OTcdkYwfL1d84"
);

document.addEventListener("DOMContentLoaded", async () => {
    const { data, error } = await supabaseClient
        .from("job_listings")
        .select(`
            companies:company_id ( name, rating ),
            job_title,
            location,
            hourly_pay
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
