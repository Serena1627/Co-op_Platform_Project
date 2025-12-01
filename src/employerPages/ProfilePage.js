import { supabaseClient } from "../supabaseClient.js";


const { data: { user } } = await supabaseClient.auth.getUser();
    
if (!user) {
    alert("You are not logged in.");
    window.location.assign("../sign-in/login.html");
}

async function loadProfile() {
    const { data, error } = await supabaseClient
        .from("companies")
        .select("*")
        .overlaps("associates", [`${user.user_metadata.firstName} ${user.user_metadata.lastName}`])
        .maybeSingle();

    if (error) {
        console.error("Error loading profile:", error);
        alert("Failed to load employer profile.");
        return;
    }

    const mainPageLink = document.getElementById('main-page-link');
    if (mainPageLink) {
        mainPageLink.href = `JobPosts.html?company_id=${data.id}`;
    }



    document.getElementById("first_name").textContent = user.user_metadata.firstName;
    document.getElementById("last_name").textContent = user.user_metadata.lastName;
    document.getElementById("email_address").textContent = user.email;
    document.getElementById("company_name").textContent = data.company_name;
    document.getElementById("company_type").textContent = data.company_type ?? "N/a";
    document.getElementById("company_rating").textContent = data.company_rating ?? "Not yet Established";
    document.getElementById("primary_contact").textContent = data.primary_contact == user.id ? "True" : "False";

    let associatesList = document.createElement("ul");
    for (let name of data.associates){
        const li = document.createElement("li");
        li.textContent = name;
        associatesList.appendChild(li);
    }

    document.getElementById("company_associates").appendChild(associatesList);
}

loadProfile();