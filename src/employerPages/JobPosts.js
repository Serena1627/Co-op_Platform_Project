import { supabaseClient } from "../supabaseClient.js";

let currentEditingId = null;
let table = null;

function showForm(jobId = null) {
    document.getElementById('tableView').classList.add('hidden');
    document.getElementById('formView').classList.add('active');
    
    if (jobId) {
        document.getElementById('formTitle').textContent = 'Edit Job Posting';
        currentEditingId = jobId;
        loadJobData(jobId);
    } else {
        document.getElementById('formTitle').textContent = 'Create Job Posting';
        currentEditingId = null;
        document.getElementById('jobForm').reset();
    }
}

function hideForm() {
    document.getElementById('tableView').classList.remove('hidden');
    document.getElementById('formView').classList.remove('active');
    document.getElementById('jobForm').reset();
    currentEditingId = null;
}

async function loadJobData(jobId) {
    try {
        const { data, error } = await supabaseClient
            .from("job_listings")
            .select("*")
            .eq("id", jobId)
            .single();
        
        if (error) throw error;
        
        document.getElementById('job_title').value = data.job_title || '';
        document.getElementById('location').value = data.location || '';
        document.getElementById('job_description').value = data.job_description || '';
        document.getElementById('job_qualifications').value = data.job_qualifications || '';
        document.getElementById('desired_majors').value = data.desired_majors ? data.desired_majors.join(', ') : '';
        document.getElementById('experience_level').value = data.experience_level ? data.experience_level.join(', ') : '';
        document.getElementById('gpa').value = data.gpa || '';
        document.getElementById('requires_citizenship').checked = data.requires_citizenship || false;
        document.getElementById('is_paid').value = data.is_paid ? 'true' : 'false';
        document.getElementById('hourly_pay').value = data.hourly_pay || '';
        document.getElementById('is_range').checked = data.is_range || false;
        document.getElementById('no_of_open_positions').value = data.no_of_open_positions || '';
        document.getElementById('is_full_time').checked = data.is_full_time || false;
        document.getElementById('job_rating').value = data.job_rating || '';
        document.getElementById('requires_in_person_interviews').checked = data.requires_in_person_interviews || false;
        document.getElementById('requires_transportation').checked = data.requires_transportation || false;
        document.getElementById('follows_scdc_calendar').checked = data.follows_scdc_calendar || false;
        document.getElementById('perks').value = data.perks || '';
    } catch (error) {
        console.error('Error loading job data:', error);
        alert('Error loading job data. Check console for details.');
    }
}

async function saveJobPosting(event) {
    event.preventDefault();

    const formData = {
        job_title: document.getElementById('job_title').value,
        location: document.getElementById('location').value,
        job_description: document.getElementById('job_description').value || null,
        job_qualifications: document.getElementById('job_qualifications').value || null,
        desired_majors: document.getElementById('desired_majors').value ? document.getElementById('desired_majors').value.split(',').map(s => s.trim()) : null,
        experience_level: document.getElementById('experience_level').value ? document.getElementById('experience_level').value.split(',').map(s => s.trim()) : null,
        gpa: document.getElementById('gpa').value ? parseFloat(document.getElementById('gpa').value) : null,
        requires_citizenship: document.getElementById('requires_citizenship').checked,
        is_paid: document.getElementById('is_paid').value === 'true',
        hourly_pay: document.getElementById('hourly_pay').value ? parseFloat(document.getElementById('hourly_pay').value) : null,
        is_range: document.getElementById('is_range').checked,
        no_of_open_positions: document.getElementById('no_of_open_positions').value ? parseInt(document.getElementById('no_of_open_positions').value) : null,
        is_full_time: document.getElementById('is_full_time').checked,
        job_rating: document.getElementById('job_rating').value ? parseFloat(document.getElementById('job_rating').value) : null,
        requires_in_person_interviews: document.getElementById('requires_in_person_interviews').checked,
        requires_transportation: document.getElementById('requires_transportation').checked,
        follows_scdc_calendar: document.getElementById('follows_scdc_calendar').checked,
        perks: document.getElementById('perks').value || null
    };

    try {
        if (currentEditingId) {
            await updateJobPosting(currentEditingId, formData);
            alert('Job posting updated!');
        } else {
            await insertJobPosting(formData);
            alert('Job posting created!');
        }
        hideForm();
        loadTable();
    } catch (error) {
        console.error('Error saving job posting:', error);
        alert('Error saving job posting. Check console for details.');
    }
}

async function insertJobPosting(formData) {

    const { data, error } = await supabaseClient
        .from("job_listings")
        .insert([
            {
                ...formData,
                company_id: "665a6a1a-262f-4e19-adf5-ad7c8fc7ed6a"
            }
        ]);
    
    if (error) {
        throw new Error(`Insert failed: ${error.message}`);
    }
    return data;
}

async function updateJobPosting(jobId, formData) {
    const { data, error } = await supabaseClient
        .from("job_listings")
        .update(formData)
        .eq("id", jobId);
    
    if (error) {
        throw new Error(`Update failed: ${error.message}`);
    }
    return data;
}

async function deleteJobPosting(jobId) {
    if (!confirm('Are you sure you want to delete this job posting?')) return;
    
    try {
        const { error } = await supabaseClient
            .from("job_listings")
            .delete()
            .eq("id", jobId);
        
        if (error) throw error;
        
        alert('Job posting deleted!');
        loadTable();
    } catch (error) {
        console.error('Error deleting job posting:', error);
        alert('Error deleting job posting. Check console for details.');
    }
}

async function loadTable() {
    const { data, error } = await supabaseClient
        .from("job_listings")
        .select(`
            id,
            job_title,
            location,
            hourly_pay,
            company:company_id (
                company_name,
                rating
            )
        `)
        .eq("company_id", "665a6a1a-262f-4e19-adf5-ad7c8fc7ed6a");
    
    if (error) {
        console.error("Error loading jobs:", error);
        return;
    }
    
    data.forEach(row => {
        row.company_name = row.company?.company_name || "";
        row.company_rating = row.company?.rating ?? null;
        row.hourly_pay = row.hourly_pay !== undefined && row.hourly_pay !== null ? Number(row.hourly_pay) : null;
    });
    
    table = new Tabulator("#student-jobs", {
        data: data,
        layout: "fitColumns",
        columns: [
            {
                title: "Available Jobs",
                headerHozAlign: "center",
                columns: [
                    { title: "Company Name", field: "company_name" },
                    { title: "Job Title", field: "job_title" },
                    { title: "Company Rating", field: "company_rating" },
                    { title: "Company Location", field: "location" },
                    { title: "Pay(/hr)", field: "hourly_pay" },
                    {
                        title: "Actions",
                        field: "actions",
                        formatter: function(cell) {
                            let container = document.createElement("div");
                            
                            let editButton = document.createElement("button");
                            editButton.innerHTML = "Edit";
                            editButton.className = "edit-btn";
                            editButton.addEventListener("click", function() {
                                const jobId = cell.getRow().getData().id;
                                showForm(jobId);
                            });
                            
                            let deleteButton = document.createElement("button");
                            deleteButton.innerHTML = "Delete";
                            deleteButton.className = "delete-btn";
                            deleteButton.addEventListener("click", function() {
                                const jobId = cell.getRow().getData().id;
                                deleteJobPosting(jobId);
                            });
                            
                            container.appendChild(editButton);
                            container.appendChild(deleteButton);
                            return container;
                        }
                    }
                ],
            },
        ],
        pagination: "local",
        paginationSize: 10,
    });
}

window.showForm = showForm;
window.hideForm = hideForm;
window.saveJobPosting = saveJobPosting;

document.addEventListener("DOMContentLoaded", async () => {
    loadTable();
});