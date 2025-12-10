import { supabaseClient } from "../../public/supabaseClient.js";


const { data: { user } } = await supabaseClient.auth.getUser();
    
if (!user) {
    alert("You are not logged in.");
    window.location.assign("../sign-in/login.html");
}

async function loadProfile() {
    const { data, error } = await supabaseClient
        .from("recruiters")
        .select(`
            id,
            first_name,
            last_name,
            company_id,
            companies:company_id (
                id,
                company_name,
                company_type,
                rating,
                primary_contact,
                recruiters:recruiters (
                    id,
                    first_name,
                    last_name
                )
            )
        `)
        .eq("id", user.id)
        .single();

    if (error) {
        console.error("Error loading profile:", error);
        alert(`Failed to load profile. ${user.id}`);
        return;
    }

    const company = data.companies;
    const associates = company.recruiters;

    document.getElementById("first_name").textContent = user.user_metadata.firstName;
    document.getElementById("last_name").textContent = user.user_metadata.lastName;
    document.getElementById("email_address").textContent = user.email;

    document.getElementById("company_name").textContent = company.company_name;
    document.getElementById("company_type").textContent = company.company_type ?? "N/a";
    document.getElementById("company_rating").textContent = company.rating ?? "Not yet Established";
    document.getElementById("primary_contact").textContent = company.primary_contact == user.id ? "True" : "False";

    document.getElementById("main-page-link").href =
        `/public/employerPages/JobPosts.html?company_id=${company.id}`;

    let associatesList = document.createElement("ul");
    for (let recruiter of associates) {
        const li = document.createElement("li");
        li.textContent = `${recruiter.first_name} ${recruiter.last_name}`;
        associatesList.appendChild(li);
    }

    document.getElementById("company_associates").appendChild(associatesList);
}
loadProfile();