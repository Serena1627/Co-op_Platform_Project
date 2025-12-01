import { supabaseClient } from "../supabaseClient.js";

async function loadInternships() {
    const container = document.getElementById("jobs-container");
    try {
        const { data, error } = await supabaseClient.functions.invoke('get-internships');
        
        if (error) {
            throw error;
        }
        
        container.innerHTML = "";
        
        if (!data.jobs || data.jobs.length === 0) {
            container.innerHTML = `
                <div class="no-jobs">
                    <i class="fa fa-briefcase"></i>
                    <h2>No Opportunities Available</h2>
                    <p>Check back soon for new internship postings.</p>
                </div>`;
            return;
        }
    
        data.jobs.forEach(job => {
            const div = document.createElement("div");
            div.className = "job-card";
            
            const postedDate = job.posted_date ? new Date(job.posted_date).toLocaleDateString() : 'Recently posted';
            const companyLogo = job.organization_logo || null;
            
            div.innerHTML = `
                <div class="job-header">
                    ${companyLogo ? `<img src="${companyLogo}" alt="${job.company}" class="company-logo" onerror="this.style.display='none'">` : ''}
                    <div class="job-title-section">
                        <h3>${job.title}</h3>
                        <p class="company-name"><i class="fa fa-building"></i> ${job.company}</p>
                    </div>
                </div>
                
                <div class="job-meta">
                    <span class="meta-item">
                        <i class="fa fa-map-marker-alt"></i> ${job.location}
                    </span>
                    ${job.remote ? '<span class="meta-item remote-badge"><i class="fa fa-home"></i> Remote</span>' : ''}
                    <span class="meta-item">
                        <i class="fa fa-clock"></i> ${postedDate}
                    </span>
                    <span class="meta-item">
                        <i class="fa fa-briefcase"></i> ${job.employment_type}
                    </span>
                </div>
                
                ${job.salary ? `
                    <div class="salary-info">
                        <i class="fa fa-dollar-sign"></i> ${job.salary}
                    </div>
                ` : ''}
                
                <div class="job-description">
                    ${job.description}
                </div>
                
                <div class="job-footer">
                    <span class="source-badge">${job.source}</span>
                    <a href="${job.apply_link}" target="_blank" rel="noopener noreferrer">
                        Apply Now <i class="fa fa-external-link-alt"></i>
                    </a>
                </div>
            `;
            container.appendChild(div);
        });

        if (data.metadata) {
            const metadataDiv = document.createElement("div");
            metadataDiv.className = "metadata-info";
            metadataDiv.innerHTML = `
                <p><i class="fa fa-info-circle"></i> Showing ${data.metadata.total} opportunities from the last 90 days</p>
            `;
            container.appendChild(metadataDiv);
        }

    } catch (error) {
        console.error("Error loading internships:", error);
        container.innerHTML = `
            <div class="no-jobs">
                <i class="fa fa-exclamation-circle"></i>
                <h2>Error Loading Jobs</h2>
                <p>${error.message || 'Please try again later.'}</p>
            </div>`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadInternships();
});