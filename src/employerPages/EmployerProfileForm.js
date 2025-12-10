import { supabaseClient } from "../supabaseClient.js";

document.addEventListener("DOMContentLoaded", async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        alert("You are not logged in.");
        window.location.assign("../sign-in/login.html");
        return;
    }

    const { data: existingProfile, error: profileError } = await supabaseClient
        .from("recruiters")
        .select("company_id, company_name")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
        console.error("Error checking recruiter profile:", profileError);
        return;
    }

    if (existingProfile) {
        showMessage(
            `You are already associated with ${existingProfile.company_name}. Redirecting...`,
            "info"
        );
        setTimeout(() => {
            window.location.assign(
                `../employerPages/JobPosts.html?company_id=${existingProfile.company_id}`
            );
        }, 2000);
        return;
    }

    let userEmail = user.email;
    let domain = userEmail.substring(userEmail.indexOf("@") + 1, userEmail.lastIndexOf("."));

    const { data: autoCompany, error: autoError } = await supabaseClient
        .from("companies")
        .select("id, company_name")
        .ilike("company_name", domain)
        .maybeSingle();

    if (autoError) {
        console.error("Error checking email-detected company:", autoError);
    }

    if (autoCompany) {
        const confirmJoin = confirm(
            `We detected a company named "${autoCompany.company_name}" from your email domain.\n` +
            `Would you like to join this company?`
        );

        if (confirmJoin) {
            await joinExistingCompany(autoCompany, user);
            return;
        }
    }
});


document.getElementById("next-btn").addEventListener("click", async () => {
    const companyName = document.getElementById("company_name").value.trim();

    if (!companyName) {
        showMessage("Please enter a company name.", "error");
        return;
    }

    const { data: existingCompany, error } = await supabaseClient
        .from("companies")
        .select("id, company_name")
        .eq("company_name", companyName)
        .maybeSingle();

    if (error) {
        showMessage("Error checking company. Try again.", "error");
        console.error("Company lookup error:", error);
        return;
    }

    if (existingCompany) {
        const confirmed = confirm(
            `We found an existing company named "${existingCompany.company_name}".\n\n` +
            `Would you like to join this company instead of creating a new one?`
        );

        if (confirmed) {
            const { data: { user } } = await supabaseClient.auth.getUser();
            await joinExistingCompany(existingCompany, user);
            return;
        }
    }

    document.getElementById("panel-1").style.display = "none";
    document.getElementById("panel-2").style.display = "block";
});


document.getElementById("employer-form").addEventListener("submit", async function (e) {
    e.preventDefault();

    const submitBtn = document.getElementById("submit-btn");
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Processing...";

    try {
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

        const newCompanyData = {
            company_name: companyName,
            company_description: companyDescription,
            company_type: companyType,
            is_NonProfit: isNonProfit,
            primary_contact: user.id,
        };

        const { data: newCompany, error: insertError } = await supabaseClient
            .from("companies")
            .insert([newCompanyData])
            .select()
            .single();

        if (insertError) {
            throw new Error(`Error creating company: ${insertError.message}`);
        }

        const { error: recruiterErr } = await supabaseClient
            .from("recruiters")
            .insert({
                id: user.id,
                company_id: newCompany.id,
                email: user.email,
                first_name: user.user_metadata.firstName,
                last_name: user.user_metadata.lastName,
                company_name: newCompany.company_name
            });

        if (recruiterErr) {
            throw new Error(`Error adding recruiter: ${recruiterErr.message}`);
        }

        showMessage("Company created successfully! Redirecting…", "success");

        setTimeout(() => {
            window.location.assign(
                `../employerPages/JobPosts.html?company_id=${newCompany.id}`
            );
        }, 1500);

    } catch (err) {
        console.error("Error submitting company:", err);
        showMessage(err.message, "error");

    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});


async function joinExistingCompany(company, user) {
    try {
        const { error } = await supabaseClient
            .from("recruiters")
            .insert({
                id: user.id,
                company_id: company.id,
                email: user.email,
                first_name: user.user_metadata.firstName,
                last_name: user.user_metadata.lastName,
                company_name: company.company_name
            });

        if (error) {
            throw new Error(`Error joining company: ${error.message}`);
        }

        showMessage(`Successfully joined ${company.company_name}! Redirecting…`, "success");

        setTimeout(() => {
            window.location.assign(`../employerPages/JobPosts.html?company_id=${company.id}`);
        }, 1500);

    } catch (err) {
        console.error("Join company error:", err);
        showMessage(err.message, "error");
    }
}


function showMessage(message, type = "info") {
    const msg = document.getElementById("message");
    msg.textContent = message;
    msg.className = `message ${type}`;
    msg.style.display = "block";

    if (type === "success") {
        setTimeout(() => {
            msg.style.display = "none";
        }, 5000);
    }
}
