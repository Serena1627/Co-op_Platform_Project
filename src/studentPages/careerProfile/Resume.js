import { supabaseClient } from "../../supabaseClient.js";

let uploadLocalButton = document.getElementById("upload-local-btn");
let uploadCloudButton = document.getElementById("upload-cloud-btn")
let resumeInput = document.getElementById("resume-input");
let resumeList = document.getElementById("resume-list");
let previewOverlay = document.getElementById("resume-preview-overlay");
let previewFrame = document.getElementById("resume-preview-frame");
let resumeInputTitle = document.getElementById("resume-title");
let confirmUploadButton = document.getElementById("confirm-upload-btn");
let cancelUploadButton = document.getElementById("cancel-upload-btn");
let closeButton = document.querySelector(".close-btn");
let selectedFile = null;


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
});

resumeInput.addEventListener("change", (event) => {
    selectedFile = event.target.files[0];
    if (!selectedFile) return;

    if (!user) {
        alert("Must be logged in to upload a resume.")
    }

    previewOverlay.style.display = "block";

    previewFrame.src = URL.createObjectURL(selectedFile);

    resumeInputTitle.value = "";
});

confirmUploadButton.addEventListener("click", async (event) => {
    let file = selectedFile;
    if (!resumeInputTitle.value.trim()) {
        alert("Please enter a title for your resume.");
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
            file_path: filePath,
            name: resumeInputTitle.value.trim()
    });

    if (dbError) {
        console.error(dbError);
        alert("Database Error");
        return;
    }


    alert("Resume uploaded!");
    previewOverlay.style.display = "none";
    selectedFile = null;

    loadResumes();

});

cancelUploadButton.addEventListener("click", () => {
    previewOverlay.style.display = "none";
    selectedFile = null;
});

closeButton.addEventListener("click", () => {
    previewOverlay.style.display = "none";
    selectedFile = null;
});

window.addEventListener("click", (e) => {
    if (e.target === previewOverlay) {
        previewOverlay.style.display = "none";
        selectedFile = null;
    }
})

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
        li.className = "resume-item";

        let leftContainer = document.createElement("div");
        leftContainer.className = "resume-left";

        let defaultCheck = document.createElement("input");
        defaultCheck.type = "radio";
        defaultCheck.name = "default-resume";
        defaultCheck.checked = resume.is_default == true;

        defaultCheck.addEventListener("change", async () => {
            await supabaseClient
                .from("resume_files")
                .update({ is_default: false})
                .eq("user_id", user.id);

            await supabaseClient
                .from("resume_files")
                .update({ is_default: true})
                .eq("id", resume.id)
            
            document.querySelectorAll("input[name='default-resume']")
                .forEach(rb => rb.checked = false);
            
            defaultCheck.checked = true;
   
        });

        let link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.innerText = resume.name || resume.file_path.split("/").pop();
        link.className = "resume-link";

        leftContainer.appendChild(defaultCheck);
        leftContainer.appendChild(link);

        let deleteButton = document.createElement("button");
        deleteButton.className = "delete-button";
        deleteButton.innerText = "Delete";

        deleteButton.addEventListener("click", async () => {
            if (!confirm("Delete this resume?")) {
                return;
            }

            await supabaseClient.storage
                .from("resumes")
                .remove([ resume.file_path ]);

            await supabaseClient
                .from("resume_files")
                .delete()
                .eq("id", resume.id);
            
            li.remove();
        });

        //li.innerHTML = `<a href="${url}" target="_blank">${resume.file_path.split("/").pop()}</a>`;
        li.appendChild(leftContainer);
        li.appendChild(deleteButton);
        resumeList.appendChild(li);
    }

    
}

loginUser();