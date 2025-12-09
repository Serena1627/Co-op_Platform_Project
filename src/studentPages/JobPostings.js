import { supabaseClient } from "../supabaseClient.js";

document.addEventListener("DOMContentLoaded", async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
        alert("You are not logged in.");
        window.location.assign("../sign-in/login.html");
        return;
    }

    const { data: studentData, error: studentError } = await supabaseClient
        .from("student_profile")
        .select("coop_cycle")
        .eq("student_id", user.id)

    if (studentError) {
        console.error("Error loading student profile:", studentError);
        return;
    }

    const student_coop_cycle = studentData[0].coop_cycle;
    const { data: coopData, error: coopError } = await supabaseClient
        .from("coop_calendar")
        .select("job_postings_available, interview_requests_due")
        .eq("coop_cycle", student_coop_cycle)

    if (coopError) {
        console.error("Error loading coop calendar:", coopError);
        return;
    }
    let applicationDeadline = null
    const today = new Date(2025, 9, 26);

    const banner = document.getElementById('application-status-banner');
    for (const round in coopData){
        const jobPostingsAvailable = new Date(coopData[round].job_postings_available);
        const interviewRequestsDue = new Date(coopData[round].interview_requests_due);
        if (today >= jobPostingsAvailable && today <= interviewRequestsDue){
            applicationDeadline = interviewRequestsDue;
            break;
        }
    }
    if (!applicationDeadline){
            banner.className = 'status-banner closed';
            banner.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        Sorry, you are not within the application period for this cycle.
    `;
    }
    else {
        banner.className = 'status-banner open';
        const daysLeft = Math.ceil((applicationDeadline - today) / (1000 * 60 * 60 * 24));
        banner.innerHTML = `
        <i class="fas fa-info-circle"></i>
        Application window closes in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.
        `;
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
        `);

        if (error) {
            console.error("Error loading jobs:", error);
            return;
        }

        data.forEach(row => {
            row.company_name = row.company?.company_name || "";
            row.company_rating = row.company?.rating ?? "Rating not established";
            row.hourly_pay = row.hourly_pay !== undefined && row.hourly_pay !== null ? Number(row.hourly_pay) : "Unpaid";
        });

        const table = new Tabulator("#student-jobs", {
            data: data,
            layout:"fitColumns",
            height: "auto",
            columns: [
                { title:"Company Name", field:"company_name" },
                { title:"Job Title", field:"job_title" },
                { title:"Company Rating", field: "company_rating" },
                { title:"Company Location", field:"location" },
                { title:"Pay(/hr)", field:"hourly_pay" },
                {
                    title: "Actions",
                    field: "actions",
                    formatter: function(cell, formatterParams, onRender){
                        let button = document.createElement("button");
                        button.innerHTML = "+";
                        button.classList.add("apply-btn");
                        
                        button.addEventListener("click", async function(){
                            const rowData = cell.getRow().getData();
                            await applyToJob(rowData, cell, user.id);
                        });
                        return button;
                    }
                }
            ],

            pagination: "local",
            paginationSize: 10,
        });

        addCustomFilterControls(table);
        table.on("rowClick", function(e, row){
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                return;
            }
            const rowData = row.getData();
            console.log("Row clicked:", rowData);
            window.location.href = `JobDetails.html?jobId=${rowData.id}`;
        });
    }
});

async function applyToJob(jobData, cell, studentId) {
    const button = cell.getElement().querySelector("button");
    
    button.disabled = true;
    button.innerHTML = "...";

    try {
        const { data, error } = await supabaseClient
            .from("current_applications")
            .insert([
                {
                    student_id: studentId,
                    job_id: jobData.id,
                    status: "pending"
                }
            ])
            .select();

        if (error) {
            if (error.code === '23505') {
                alert("You have already applied to this job!");
            } else {
                console.error("Error applying to job:", error);
                alert("Failed to apply. Please try again.");
            }
            button.disabled = false;
            button.innerHTML = "+";
            return;
        }

        button.innerHTML = "✓";
        button.classList.add("applied");
        
        showNotification("Application submitted successfully!");

    } catch (err) {
        console.error("Unexpected error:", err);
        alert("An unexpected error occurred. Please try again.");
        button.disabled = false;
        button.innerHTML = "+";
    }
    }



function showNotification(message) {
    const notification = document.createElement("div");
    notification.className = "notification";
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 1000;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function addCustomFilterControls(table) {
    const filterConfig = {
        "company_name": {
            label: "Company Name",
            type: "dropdown",
            operators: [
                { value: "=", label: "equals" },
                { value: "!=", label: "not equals" }
            ]
        },
        "job_title": {
            label: "Job Title", 
            type: "string",
            operators: [
                { value: "like", label: "contains" }
            ]
        },
        "company_rating": {
            label: "Company Rating",
            type: "number", 
            operators: [
                { value: "=", label: "equals" },
                { value: "!=", label: "not equals" },
                { value: ">", label: "greater than" },
                { value: ">=", label: "greater or equal" },
                { value: "<", label: "less than" },
                { value: "<=", label: "less or equal" }
            ]
        },
        "location": {
            label: "Location",
            type: "dropdown",
            operators: [
                { value: "=", label: "equals" },
                { value: "!=", label: "not equals" }
            ]
        },
        "hourly_pay": {
            label: "Hourly Pay",
            type: "number",
            operators: [
                { value: "=", label: "equals" },
                { value: "!=", label: "not equals" },
                { value: ">", label: "greater than" },
                { value: ">=", label: "greater or equal" },
                { value: "<", label: "less than" },
                { value: "<=", label: "less or equal" }
            ]
        }
    };

    const filterContainer = document.getElementById('custom-filter-container');
    const filterRows = document.getElementById('filter-rows');

    let activeFilters = [];

    addFilterRow();

    document.getElementById('add-filter-btn').addEventListener('click', addFilterRow);
    document.getElementById('clear-filters-btn').addEventListener('click', clearAllFilters);

    function addFilterRow() {
        const filterRow = document.createElement('div');
        filterRow.className = 'filter-row';
        filterRow.innerHTML = `
            <select class="filter-field">
                <option value="">Select Column</option>
                ${Object.entries(filterConfig).map(([field, config]) => 
                    `<option value="${field}">${config.label}</option>`
                ).join('')}
            </select>
            <select class="filter-operator" disabled>
                <option value="">Select Operator</option>
            </select>
            <div class="filter-value-container">
                <input type="text" class="filter-value" placeholder="Select column first" disabled>
            </div>
            <button class="remove-filter-btn">×</button>
        `;

        filterRows.appendChild(filterRow);

        const fieldSelect = filterRow.querySelector('.filter-field');
        const operatorSelect = filterRow.querySelector('.filter-operator');
        const valueInput = filterRow.querySelector('.filter-value');
        const removeBtn = filterRow.querySelector('.remove-filter-btn');

        fieldSelect.addEventListener('change', function() {
            updateFilterOperators(this);
            updateFilterValue(this);
        });

        operatorSelect.addEventListener('change', function() {
            applyFilters();
        });

        removeBtn.addEventListener('click', function() {
            filterRow.remove();
            applyFilters();
        });

        let inputTimeout;
        valueInput.addEventListener('input', function() {
            clearTimeout(inputTimeout);
            inputTimeout = setTimeout(() => {
                applyFilters();
            }, 500);
        });
    }

    function updateFilterOperators(selectElement) {
        const field = selectElement.value;
        const operatorSelect = selectElement.parentNode.querySelector('.filter-operator');
        
        operatorSelect.innerHTML = '<option value="">Select Operator</option>';
        operatorSelect.disabled = !field;
        
        if (field) {
            const operators = filterConfig[field].operators;
            operators.forEach(op => {
                const option = document.createElement('option');
                option.value = op.value;
                option.textContent = op.label;
                operatorSelect.appendChild(option);
            });
            operatorSelect.disabled = false;
        }
        
        updateFilterValue(selectElement);
    }

    function updateFilterValue(selectElement) {
        const field = selectElement.value;
        const valueContainer = selectElement.parentNode.querySelector('.filter-value-container');
        const operatorSelect = selectElement.parentNode.querySelector('.filter-operator');
        
        valueContainer.innerHTML = '';
        
        if (!field) {
            valueContainer.innerHTML = '<input type="text" class="filter-value" placeholder="Select column first" disabled>';
            return;
        }

        const config = filterConfig[field];
        
        if (config.type === 'dropdown') {
            const uniqueValues = [...new Set(table.getData().map(row => row[field]))].filter(val => val != null && val !== '').sort();
            
            const select = document.createElement('select');
            select.className = 'filter-value';
            select.innerHTML = '<option value="">All Values</option>';
            
            uniqueValues.forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                select.appendChild(option);
            });
            
            select.addEventListener('change', function() {
                if (operatorSelect.value) {
                    applyFilters();
                }
            });
            
            valueContainer.appendChild(select);
        } else if (config.type === 'number') {
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'filter-value';
            input.placeholder = `Enter ${config.label.toLowerCase()}...`;
            input.step = field === 'hourly_pay' ? '0.01' : '0.1';
            input.min = '0';
            
            let inputTimeout;
            input.addEventListener('input', function() {
                clearTimeout(inputTimeout);
                inputTimeout = setTimeout(() => {
                    if (operatorSelect.value) {
                        applyFilters();
                    }
                }, 500);
            });
            
            valueContainer.appendChild(input);
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'filter-value';
            input.placeholder = `Enter ${config.label.toLowerCase()}...`;
            
            let inputTimeout;
            input.addEventListener('input', function() {
                clearTimeout(inputTimeout);
                inputTimeout = setTimeout(() => {
                    if (operatorSelect.value) {
                        applyFilters();
                    }
                }, 500);
            });
            
            valueContainer.appendChild(input);
        }
    }

    function applyFilters() {
        const filterRows = document.querySelectorAll('.filter-row');
        activeFilters = [];
    
        filterRows.forEach(row => {
            const fieldSelect = row.querySelector('.filter-field');
            const operatorSelect = row.querySelector('.filter-operator');
            const valueElement = row.querySelector('.filter-value');
            
            const field = fieldSelect.value;
            const operator = operatorSelect.value;
            const value = valueElement.value;
            
            if (field && operator && value !== '') {
                let filterConfig = {
                    field: field,
                    value: value
                };
                
                if (field === 'job_title') {
                    filterConfig.type = 'like';
                } else if (field === 'company_rating' || field === 'hourly_pay') {
                    filterConfig.type = operator;
                    filterConfig.value = parseFloat(value);
                } else {
                    filterConfig.type = operator;
                }
                
                activeFilters.push(filterConfig);
            }
        });
        
        if (activeFilters.length > 0) {
            table.setFilter(activeFilters);
        } else {
            table.clearFilter();
        }
    }

    function clearAllFilters() {
        filterRows.innerHTML = '';
        activeFilters = [];
        table.clearFilter();
        addFilterRow();
    }
}