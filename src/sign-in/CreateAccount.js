import { supabaseClient } from "../supabaseClient.js";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("sign-up-form");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const firstName = document.getElementById("firstName").value;
        const lastName = document.getElementById("lastName").value;
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        const accountType = document.querySelector('input[name="accountType"]:checked').value;

        let { error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    firstName,
                    lastName,
                    accountType
                },
                // Add email redirect for confirmation
                emailRedirectTo: `${window.location.origin}/src/sign-in/confirm.html`
            }
        });

        if (error) {
            alert("Signup failed: " + error.message);
            return;
        }

        // Only go to check email page
        window.location.assign("./CheckEmail.html");
    });
});