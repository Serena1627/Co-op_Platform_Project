import { supabaseClient } from "../supabaseClient.js";

document.addEventListener("DOMContentLoaded", async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
        alert("You are not logged in.");
        window.location.assign("../sign-in/login.html");
        return;
    }

    const { data: existingProfile, error: profileError } = await supabaseClient
        .from('recruiters')
        .select('company_id, company_name')
        .eq("id", user.id)
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
    let userEmail = user.email;
    let possibleCompName = userEmail.substring(userEmail.indexOf("@") + 1, userEmail.lastIndexOf("."));
    const { data:possibleCompData, error: possibleError } = await supabaseClient
        .from('companies')
        .select('id, company_name')
        .ilike('company_name', possibleCompName)
        .maybeSingle();
    
    if (possibleError) {
        console.error("Error checking email-matching company:", possibleError);
        return;
    }

    if (possibleCompData) {
        const confirmed = confirm(
            `We found a company named "${possibleCompData.company_name}".\n` +
            `Are you associated with this company?`
        );

        if (confirmed) {
            const { error } = await supabaseClient
                .from("recruiters")
                .insert({
                    id: user.id,
                    company_id: possibleCompData.id,
                    email: user.email,
                    first_name: user.user_metadata.firstName,
                    last_name: user.user_metadata.lastName,
                });
        
            if (error) {
                throw new Error(`Couldn't add recruiter: ${error.message}`);
            }

            showMessage(`You are now associated with ${possibleCompData.company_name}. Redirecting...`, 'info');
            setTimeout(() => {
                window.location.assign(`../employerPages/JobPosts.html?company_id=${possibleCompData.id}`);
            }, 2000);
            return;
        }
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
            window.location.assign("../sign-in/login.html");
            return;
        }

        const companyName = document.getElementById("company_name").value.trim();
        const associatesCount = parseInt(document.getElementById("associates").value);
        const companyDescription = document.getElementById("company_description").value.trim();
        const companyType = document.getElementById("company_type").value;
        const isNonProfit = document.getElementById("non_profit").checked;

        if (!companyName || !companyDescription || !companyType) {
            showMessage("Please fill in all required fields.", "error");
            return;
        }

        const { data: existingCompany, error: checkError } = await supabaseClient
            .from('companies')
            .select('id, company_name')
            .eq('company_name', companyName)
            .maybeSingle();

        if (checkError) {
            throw new Error(`Error checking company: ${checkError.message}`);
        }

        if (existingCompany) {
            const { error:updateError } = await supabaseClient
                .from("recruiters")
                .insert({
                    id: user.id,
                    company_id: existingCompany.id,
                    email: user.email,
                    first_name: user.user_metadata.firstName,
                    last_name: user.user_metadata.lastName,
                });

            if (updateError) {
                throw new Error(`Error joining company: ${updateError.message}`);
            }

            showMessage(`The Company ${existingCompany.company_name} already exists. Successfully joined ${existingCompany.company_name}!`, 'success');
            
            setTimeout(() => {
                window.location.assign(`../employerPages/JobPosts.html?company_id=${existingCompany.id}`);
            }, 2000);

        } else {
            const companyData = {
                company_name: companyName,
                company_description: companyDescription,
                company_type: companyType,
                is_NonProfit: isNonProfit,
                primary_contact: user.id,
            };

            const { data: newCompany, error: insertError } = await supabaseClient
                .from("companies")
                .insert([companyData])
                .select()
                .single();

            if (insertError) {
                throw new Error(`Error creating company: ${insertError.message}`);
            }

            const { error:recruiterError } = await supabaseClient
                .from("recruiters")
                .insert({
                    id: user.id,
                    company_id: newCompany.id,
                    email: user.email,
                    first_name: user.user_metadata.firstName,
                    last_name: user.user_metadata.lastName,
                });
            
            if (insertError) {
                throw new Error(`Error creating recruiter record: ${recruiterError.message}`);
            }

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
function showMessage(message, type = 'info') {
    const messageEl = document.getElementById('message');
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 5000);
    }
}