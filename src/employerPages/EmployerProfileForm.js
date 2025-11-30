import { supabaseClient } from "../supabaseClient.js";

document.addEventListener("DOMContentLoaded", async () => {
    // Check if user already has an employer profile
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
        alert("You are not logged in.");
        window.location.assign("../sign-in/SignIn.html");
        return;
    }

    // Check if user already belongs to a company
    const { data: existingProfile, error: profileError } = await supabaseClient
        .from('companies')
        .select('id, company_name')
        .contains('associates', [user.id])
        .maybeSingle();

    if (profileError) {
        console.error("Error checking existing profile:", profileError);
        return;
    }

    if (existingProfile) {
        showMessage(`You are already associated with ${existingProfile.company_name}. Redirecting...`, 'info');
        setTimeout(() => {
            window.location.assign(`../employerPages/JobPosts.html?company_id=${existingProfile.id}`);
        }, 2000);
        return;
    }
});

document.getElementById("employer-form").addEventListener("submit", async function (e) {
    e.preventDefault();

    const submitBtn = document.getElementById("submit-btn");
    const originalText = submitBtn.textContent;
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = "Processing...";

        const { data: { user } } = await supabaseClient.auth.getUser();

        if (!user) {
            alert("You are not logged in.");
            window.location.assign("../sign-in/SignIn.html");
            return;
        }

        const companyName = document.getElementById("company_name").value.trim();
        const associatesCount = parseInt(document.getElementById("associates").value);
        const companyDescription = document.getElementById("company_description").value.trim();
        const companyType = document.getElementById("company_type").value;
        const isNonProfit = document.getElementById("non_profit").checked;

        // Validate required fields
        if (!companyName || !companyDescription || !companyType) {
            showMessage("Please fill in all required fields.", "error");
            return;
        }

        // Check if company already exists
        const { data: existingCompany, error: checkError } = await supabaseClient
            .from('companies')
            .select('id, company_name, associates')
            .eq('company_name', companyName)
            .maybeSingle();

        if (checkError) {
            throw new Error(`Error checking company: ${checkError.message}`);
        }

        if (existingCompany) {
            // Join existing company
            const { error: updateError } = await supabaseClient
                .from('companies')
                .update({ 
                    associates: supabaseClient.raw('array_append(associates, ?)', [user.id])
                })
                .eq('id', existingCompany.id);

            if (updateError) {
                throw new Error(`Error joining company: ${updateError.message}`);
            }

            showMessage(`Successfully joined ${existingCompany.company_name}!`, 'success');
            
            // Also create employer profile
            await createEmployerProfile(user.id, existingCompany.id);
            
            setTimeout(() => {
                window.location.assign(`../employerPages/JobPosts.html?company_id=${existingCompany.id}`);
            }, 2000);

        } else {
            // Create new company
            const companyData = {
                company_name: companyName,
                company_description: companyDescription,
                company_type: companyType,
                is_NonProfit: isNonProfit,
                associates: [user.id],
            };

            const { data: newCompany, error: insertError } = await supabaseClient
                .from("companies")
                .insert([companyData])
                .select()
                .single();

            if (insertError) {
                throw new Error(`Error creating company: ${insertError.message}`);
            }

            // Create employer profile
            await createEmployerProfile(user.id, newCompany.id);

            showMessage("Company profile created successfully!", 'success');
            
            setTimeout(() => {
                window.location.assign(`../employerPages/JobPosts.html?company_id=${newCompany.id}`);
            }, 2000);
        }

    } catch (error) {
        console.error("Error:", error);
        showMessage(error.message || "An error occurred. Please try again.", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});

// Create employer profile record
async function createEmployerProfile(userId, companyId) {
    const { error } = await supabaseClient
        .from('employer_profile')
        .upsert([{
            employer_id: userId,
            company_id: companyId,
            is_primary_contact: true, // First person to create is primary
            updated_at: new Date().toISOString()
        }], {
            onConflict: 'employer_id',
            ignoreDuplicates: false
        });

    if (error) {
        console.error("Error creating employer profile:", error);
        throw new Error("Failed to create employer profile");
    }
}

// Utility function to show messages
function showMessage(message, type = 'info') {
    const messageEl = document.getElementById('message');
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';
    
    // Auto-hide success messages
    if (type === 'success') {
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 5000);
    }
}