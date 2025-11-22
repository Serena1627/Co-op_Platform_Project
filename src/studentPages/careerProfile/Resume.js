import { supabaseClient } from "../../supabaseClient.js";

let uploadLocalButton = document.getElementById("upload-local-btn");
let uploadCloudButton = document.getElementById("upload-cloud-btn")
let resumeInput = document.getElementById("resume-input");
let resumeList = document.getElementById("resume-list");

let test_email = "na929@drexel.edu";
let test_password = "1234567890";

let user = null;

async function loginUser() {
    let { data, error } = await supabaseClient.auth.signInWithPassword({
        email: test_email,
        password: test_password
    });

    if (error) {
        console.error("Login failed:", error);
        alert("Login failed. Check console.");
        return;
    }

    user = data.user;

    loadResumes();
}



uploadLocalButton.addEventListener("click", () => {
    resumeInput.click();
})

resumeInput.addEventListener("change", async (event) => {
    let file = event.target.files[0];
    if (!file) return;

    //let { data : { user}} = await supabaseClient.auth.getUser();
    
    
    if (!user) {
        alert("You must be logged in to upload a resume.");
        return;
    }
        
    

    let fileName = encodeURIComponent(file.name);
    let filePath = `resume/${user.id}/${Date.now()}_${fileName}`;

    let { error: uploadError} = await supabaseClient.storage
        .from("resumes")
        .upload(filePath, file);
    
    if (uploadError) {
        console.error(uploadError);
        alert("Upload failed.");
        return;
    }

    let {error: dbError } = await supabaseClient
        .from("resume_files")
        .insert({
            user_id: user.id,
            file_path: filePath
    });

    if (dbError) {
        console.error(dbError);
        alert("Database Error");
        return;
    }


    alert("Resume uploaded!");

    loadResumes();

});

async function loadResumes() {
    if (!user) return;

    let { data, error } = await supabaseClient
        .from("resume_files")
        .select("*")
        .eq("user_id", user.id)
        .order("id", { ascending: false});

    if (error) {
        console.error("Failed to fetch resumes:", error);
        return;
    }

    resumeList.innerHTML = "";

    for (let resume of data) {
        let { data: signedUrlData, error: signedError } = await supabaseClient
            .storage
            .from("resumes")
            .createSignedUrl(resume.file_path, 60 * 60);

        if (signedError) {
            console.error("Error creating signed URL:", signedError);
            continue;
        }

        let url = signedUrlData.signedUrl;

        let li = document.createElement("li");

        li.innerHTML = `<a href="${url}" target="_blank">${resume.file_path.split("/").pop()}</a>`;
        
        resumeList.appendChild(li);
    }

    
}

loginUser();