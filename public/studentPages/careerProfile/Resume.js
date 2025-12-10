import { supabaseClient } from "../../supabaseClient.js";

let uploadLocalButton = document.getElementById("upload-local-btn");
let resumeInput = document.getElementById("resume-input");
let resumeList = document.getElementById("resume-list");
let previewOverlay = document.getElementById("resume-preview-overlay");
let previewFrame = document.getElementById("resume-preview-frame");
let resumeInputTitle = document.getElementById("resume-title");
let confirmUploadButton = document.getElementById("confirm-upload-btn");
let cancelUploadButton = document.getElementById("cancel-upload-btn");
let closeButton = document.querySelector(".close-btn");

let selectedFile = null;
let user = null;

async function loginUser() {
    let { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href="../SignIn.html";
        return;
    }


    user = session.user;

    loadResumes();
}

uploadLocalButton.addEventListener("click", () => {
    resumeInput.click();
});

resumeInput.addEventListener("change", (event) => {
    selectedFile = event.target.files[0];
    if (!selectedFile) return;

    previewOverlay.style.display = "block";

    previewFrame.src = URL.createObjectURL(selectedFile);

    resumeInputTitle.value = "";
});

confirmUploadButton.addEventListener("click", async () => {
    if (!selectedFile) return alert("No file selected.");
    if (!resumeInputTitle.value.trim()) return alert("Please enter a title for your resume.");

    const fileName = encodeURIComponent(selectedFile.name);
    const filePath = `resume/${user.id}/${Date.now()}_${fileName}`;

    
    const { error: uploadError } = await supabaseClient.storage
        .from("resumes")
        .upload(filePath, selectedFile);

    if (uploadError) {
        console.error(uploadError);
        alert("Upload failed.");
        return;
    }

    const { data: existingResumes } = await supabaseClient
        .from("resume_files")
        .select("id")
        .eq("user_id", user.id);

    const isDefault = existingResumes.length === 0;

    const { data: newResume, error: dbError } = await supabaseClient
        .from("resume_files")
        .insert({
            user_id: user.id,
            file_path: filePath,
            name: resumeInputTitle.value.trim(),
            is_default: isDefault
        })
        .select()
        .single();

    if (dbError) {
        console.error(dbError);
        alert("Database Error");
        return;
    }

    alert("Resume uploaded!");
    previewOverlay.style.display = "none";
    selectedFile = null;

    addResumeToList(newResume);
});


async function addResumeToList(resume) {
    const { data: signedUrlData, error: signedError } = await supabaseClient
        .storage
        .from("resumes")
        .createSignedUrl(resume.file_path, 3600);

    if (signedError) {
        console.error("Error creating signed URL:", signedError);
        return;
    }

    const url = signedUrlData.signedUrl;

    const li = document.createElement("li");
    li.className = "resume-item";
    li.dataset.resumeId = resume.id;
    li.dataset.isDefault = resume.is_default;

    const leftContainer = document.createElement("div");
    leftContainer.className = "resume-left";

    const defaultCheck = document.createElement("input");
    defaultCheck.id = `default-${resume.id}`;
    defaultCheck.type = "radio";
    defaultCheck.name = "default-resume";
    defaultCheck.checked = resume.is_default;

    defaultCheck.addEventListener("change", async () => {
        await supabaseClient
            .from("resume_files")
            .update({ is_default: false })
            .eq("user_id", user.id);

        await supabaseClient
            .from("resume_files")
            .update({ is_default: true })
            .eq("id", resume.id);

        loadResumes();
    });

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.innerText = resume.name || resume.file_path.split("/").pop();
    link.className = "resume-link";

    leftContainer.appendChild(defaultCheck);
    leftContainer.appendChild(link);

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.innerText = "Delete";

    deleteButton.addEventListener("click", async () => {
        if (!confirm("Delete this resume?")) return;

        const { data: resumeCountData } = await supabaseClient
            .from("resume_files")
            .select("id", { count: "exact" })
            .eq("user_id", user.id);

        if (resumeCountData.length <= 1) {
            alert("You must have at least one resume. You cannot delete your only resume.");
            return;
        }


        const wasDefault = resume.is_default;

        await supabaseClient.storage
            .from("resumes")
            .remove([resume.file_path]);

        await supabaseClient
            .from("resume_files")
            .delete()
            .eq("id", resume.id);

        if (wasDefault) {
            const { data: latestResume, error: latestErr } = await supabaseClient
                .from("resume_files")
                .select("*")
                .eq("user_id", user.id)
                .order("id", { ascending: false })
                .limit(1)
                .single();

            if (!latestErr && latestResume) {
                await supabaseClient
                    .from("resume_files")
                    .update({ is_default: true })
                    .eq("id", latestResume.id);
            }
        }
        loadResumes();
    });


    li.appendChild(leftContainer);
    li.appendChild(deleteButton);
    resumeList.prepend(li);
}


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

    if (!data || data.length === 0) {
        resumeList.innerHTML = "<li>No resumes uploaded yet.</li>";
        return;
    }

    for (let resume of data) {
        let { data: signedUrlData, error: signedError } = await supabaseClient
            .storage
            .from("resumes")
            .createSignedUrl(resume.file_path, 3600);

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
                .eq("id", resume.id);
            
            loadResumes();    
   
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
            if (!confirm("Delete this resume?")) return;

            const { data: resumeCountData } = await supabaseClient
                .from("resume_files")
                .select("id", { count: "exact" })
                .eq("user_id", user.id);

            if (resumeCountData.length <= 1) {
                alert("You must have at least one resume. You cannot delete your only resume.");
                return;
            }


            const wasDefault = resume.is_default;

            await supabaseClient.storage
                .from("resumes")
                .remove([resume.file_path]);

            await supabaseClient
                .from("resume_files")
                .delete()
                .eq("id", resume.id);

            if (wasDefault) {
                const { data: latestResume, error: latestErr } = await supabaseClient
                    .from("resume_files")
                    .select("*")
                    .eq("user_id", user.id)
                    .order("id", { ascending: false })
                    .limit(1)
                    .single();

                if (!latestErr && latestResume) {
                    await supabaseClient
                        .from("resume_files")
                        .update({ is_default: true })
                        .eq("id", latestResume.id);
                }
            }
            loadResumes();
        });

        li.appendChild(leftContainer);
        li.appendChild(deleteButton);
        resumeList.appendChild(li);
    }

    
}

loginUser();