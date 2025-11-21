import { supabaseClient } from "../supabaseClient.js";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("sign-up-form");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const firstName = document.getElementById("firstName").value;
        const lastName = document.getElementById("lastName").value;
        const emailAddress = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        const accountType = document.querySelector('input[name="accountType"]:checked').value;

        let { data, error } = await supabaseClient.auth.signUp({
            email: emailAddress,
            password: password,
        });
        console.log(accountType);

        if (error) {
            alert("Signup failed: " + error.message);
            return;
        }

        form.reset();
        alert("Account created!");
    });
});
