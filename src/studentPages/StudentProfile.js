const SUPABASE_URL = "https://xvdbeuqgtyonbbsdkcqu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_YCdz1MriD7YHIEP3LmybDA_CtlDZPo1"; 
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.getElementById("student-form").addEventListener("submit", async function (e) {
    e.preventDefault();

    const studentData = {
        first_name: document.getElementById("first_name").value,
        last_name: document.getElementById("last_name").value,
        student_id: document.getElementById("drexel_student_id").value,
        is_international: document.getElementById("is_international").value === "Non U.S Citizen",
        major: document.getElementById("major").value,
        college_year: document.getElementById("college_year").value,
        gpa: parseFloat(document.getElementById("gpa").value),
        coop_cycle: document.getElementById("coop_cycle").value,
    };

    const { data, error } = await supabase
        .from('students')  
        .insert([studentData]);

    if (error) {
        console.error("Error inserting data:", error);
        alert("Failed to save student profile.");
    } else {
        console.log("Student saved:", data);
        alert("Student profile saved successfully!");
    }
});
