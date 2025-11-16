const supabaseClient = window.supabase.createClient(
    "https://xvdbeuqgtyonbbsdkcqu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZGJldXFndHlvbmJic2RrY3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjUwNjYsImV4cCI6MjA3ODY0MTA2Nn0.ZF-zhsVH2OCyhljoC_G3Rlug5IwZS_OTcdkYwfL1d84"
);

document.addEventListener("DOMContentLoaded", async () => {

    document.querySelectorAll(".add-btn").forEach(button => {
        button.addEventListener("click", () => {
            document.getElementById("popup-overlay").classList.remove("hidden");
        });
    });

    document.getElementById("popup-cancel").addEventListener("click", () => {
        document.getElementById("popup-overlay").classList.add("hidden");
    });

    document.getElementById("popup-save").addEventListener("click", () => {
        alert("Save clicked!");
        document.getElementById("popup-overlay").classList.add("hidden");
    });
});
