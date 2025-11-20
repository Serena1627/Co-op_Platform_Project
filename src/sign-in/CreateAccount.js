import { supabaseClient } from "../../supabaseClient.js";
let form = document.getElementById('sign-up-form');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let firstName = document.getElementById('firstName').value;
    let lastName = document.getElementById('lastName').value;
    let emailAddress = document.getElementById('email').value;
    let password = document.getElementById('password').value;
    let accountType = document.querySelector('input[name="accountType"]:checked').value;

    try {
        let { data, error } = await supabase.auth.signUp({
            email: emailAddress,
            password: password,
            options: {
                data: { firstName, lastName, accountType }
            }
        });
        if (error) {
            alert("Signup failed: " + error.message);
            return;
        } 

        form.reset();
        alert("Account created");
    } catch (error) {
        alert("Error");
    }
    

});
