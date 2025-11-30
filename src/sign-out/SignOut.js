import { supabaseClient } from "../supabaseClient.js";

let inactivityTimer;
let LOGOUT_TIME = 10 * 60 * 1000;

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(async () => {
        console.log("User inactive for 10 minutes. Logging out..");
        await supabaseClient.auth.signOut();
        window.location.assign("../sign-in/login.html");
    }, LOGOUT_TIME);
}

["mousemove", "keydown", "click", "touchstart"].forEach(event => {
    window.addEventListener(event, resetInactivityTimer);
});

resetInactivityTimer();

document.addEventListener("DOMContentLoaded", () => {
    let logoutButton = document.getElementById("logout-button");

    if (logoutButton) {
        logoutButton.addEventListener("click", async (e) => {
            e.preventDefault();
            await supabaseClient.auth.signOut();
            window.location.assign("../sign-in/login.html");
        });
    }
});

