import { supabaseClient } from "../supabaseClient.js";
document.addEventListener("DOMContentLoaded", async () => {
    const { data, error } = await supabaseClient
        .from("job_listings")
        .select(`
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
        row.company_rating = row.company?.rating ?? null;
        row.hourly_pay = row.hourly_pay !== undefined && row.hourly_pay !== null ? Number(row.hourly_pay) : null;
    });

    const table = new Tabulator("#student-jobs", {
        data: data,
        layout:"fitColumns",
        columns: [
            {
                title: "Available Jobs",
                headerHozAlign: "center",
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
                            button.addEventListener("click", function(){
                                let cellElement = cell.getElement();
                                cellElement.innerText= "✔️";
                            });
                            return button;
                        }
                    }
                ],
            },
        ],
        pagination: "local",
        paginationSize: 10,
    });

    addCustomFilterControls(table);
});

function addCustomFilterControls(table) {
    // Define filter configuration for each column using flattened field names
    const filterConfig = {
        "company_name": {
            label: "Company Name",
            type: "dropdown", // Dropdown list
            operators: [
                { value: "=", label: "equals" },
                { value: "!=", label: "not equals" }
            ]
        },
        "job_title": {
            label: "Job Title", 
            type: "string",
            operators: [
                { value: "like", label: "contains" } // Only "like" operator
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
            type: "dropdown", // Dropdown list
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

    // No need to create container - it already exists in HTML
    const filterContainer = document.getElementById('custom-filter-container');
    const filterRows = document.getElementById('filter-rows');

    let activeFilters = [];

    // Add first filter row by default
    addFilterRow();

    // Event listeners - elements already exist in HTML
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

        // Add event listeners for the new row
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

        // For input fields, use debounced input
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
            // Get unique values from table data for dropdown fields
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
            // For number fields, use number input
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
            // For string fields (Job Title), use text input
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
                    // For job title, use "like" operator which does contains search by default
                    filterConfig.type = 'like';
                } else if (field === 'company_rating' || field === 'hourly_pay') {
                    // For number fields
                    filterConfig.type = operator;
                    filterConfig.value = parseFloat(value);
                } else {
                    // For other fields
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
        addFilterRow(); // Add one empty filter row back
    }
}