import { supabaseClient } from "../supabaseClient.js";

const recordsRoot = document.getElementById("records");
const loadingEl = document.getElementById("loading");
const totalCoopsEl = document.getElementById("total-coops");
const userStatusEl = document.getElementById("user-status");
const emptyState = document.getElementById("empty-state");
const recordTpl = document.getElementById("record-template");

let warnBeforeExit = false;

window.addEventListener("beforeunload", function (e) {
  if (!warnBeforeExit) return;
  e.preventDefault();
  return "";
});


const reviewQuestions = [
  { name: "professional_development", label: "This co-op significantly enhanced my technical and professional skills" },
  { name: "mentorship_support", label: "I received helpful mentorship and support" },
  { name: "work_life_balance", label: "The co-op provided a healthy work-life balance" },
  { name: "workplace_culture", label: "The workplace culture was positive and inclusive" },
  { name: "learning_opportunities", label: "I had opportunities to learn and grow" },
  { name: "feedback_communication", label: "Feedback and communication were clear and constructive" },
  { name: "career_relevance", label: "The work was relevant to my career goals" },
  { name: "resource_access", label: "I had access to the resources I needed" },
  { name: "team_integration", label: "I felt integrated and part of the team" },
  { name: "future_recommendation", label: "I would recommend this co-op to other students" },
];

function setText(el, text) {
  if (!el) return;
  el.textContent = text ?? "";
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

function yesNo(value) {
  return value ? "Yes" : "No";
}

function formatPay(job) {
  if (!job) return "—";
  if (job.is_paid === false) return "Unpaid";
  if (job.is_paid === true) {
    if (job.is_range && job.hourly_pay && typeof job.hourly_pay === "object") {
      if (job.hourly_pay.min && job.hourly_pay.max) {
        return `$${job.hourly_pay.min} - $${job.hourly_pay.max}/hr`;
      }
    }
    if (job.hourly_pay) {
      return typeof job.hourly_pay === "number" ? `$${job.hourly_pay}/hr` : `${job.hourly_pay}`;
    }
    return "Paid (amount not specified)";
  }
  return "—";
}


function createRecordNode(application, job, recruiter) {
  const clone = recordTpl.content.firstElementChild.cloneNode(true);
  clone.dataset.jobId = job?.id ?? "";

  const logo = clone.querySelector(".logo");
  const initials = (recruiter?.company_name ?? job?.job_title ?? "Co-op")
    .split(" ")
    .map(s => s[0])
    .slice(0,2)
    .join("")
    .toUpperCase();
  logo.textContent = initials;

  setText(clone.querySelector(".job-title"), job?.job_title ?? "Untitled role");
  setText(clone.querySelector(".company-name"), recruiter?.company_name ?? ("Company #" + (job?.company_id ?? "—")));
  setText(clone.querySelector(".location"), job?.location ?? "—");
  setText(clone.querySelector(".work-type"), job?.work_type ?? (job?.is_full_time ? "Full-time" : "Part-time / unspecified"));

  const termText = [job?.term ?? null, job?.start_date ? `${formatDate(job.start_date)} — ${job.end_date ? formatDate(job.end_date) : "ongoing"}` : null]
    .filter(Boolean)
    .join(" • ");
  setText(clone.querySelector(".term-and-dates"), termText);

  setText(clone.querySelector(".job-description"), job?.job_description ?? job?.job_qualifications ?? "No description provided.");
  setText(clone.querySelector(".compensation"), formatPay(job));
  setText(clone.querySelector(".openings"), job?.no_of_open_positions ?? "—");
  setText(clone.querySelector(".majors"), Array.isArray(job?.desired_majors) ? job.desired_majors.join(", ") : (job?.desired_majors ?? "—"));
  setText(clone.querySelector(".gpa"), job?.gpa ?? "—");
  setText(clone.querySelector(".qualifications"), job?.job_qualifications ?? "—");
  setText(clone.querySelector(".recruiter-name"), recruiter ? `${recruiter.first_name ?? ""} ${recruiter.last_name ?? ""}`.trim() : "Recruiter");
  setText(clone.querySelector(".recruiter-company"), recruiter?.company_name ?? "");
  const emailLink = clone.querySelector(".recruiter-email");
  if (recruiter?.email) {
    emailLink.href = `mailto:${recruiter.email}`;
    emailLink.textContent = recruiter.email;
  } else {
    emailLink.removeAttribute("href");
    emailLink.textContent = "Email not provided";
    emailLink.classList.add("muted");
  }

  setText(clone.querySelector(".in-person"), yesNo(job?.requires_in_person_interviews));
  setText(clone.querySelector(".transport"), yesNo(job?.requires_transportation));
  setText(clone.querySelector(".scdc"), yesNo(job?.follows_scdc_calendar));

  const expandBtn = clone.querySelector(".expand-btn");
  const body = clone.querySelector(".card-body");

  expandBtn.addEventListener("click", () => {
    const expanded = expandBtn.getAttribute("aria-expanded") === "true";
    expandBtn.setAttribute("aria-expanded", String(!expanded));
    expandBtn.textContent = expanded ? "+" : "-";
    if (expanded) {
      body.hidden = true;
    } else {
      body.hidden = false;
      body.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  initTabs(clone);
  initReviewSystem(clone, application, job);

  return clone;
}

async function loadEmploymentRecords() {
  try {
    const { data: userData, error: userErr } = await supabaseClient.auth.getUser();
    if (userErr) {
      console.error("Auth error:", userErr);
      userStatusEl.textContent = "Not signed in";
      loadingEl.textContent = "Please sign in to view your employment records.";
      return;
    }
    const user = userData?.user ?? null;
    const { data: appsData, error: appsErr } = await supabaseClient
      .from("current_applications")
      .select("*, job_listings(*)")
      .eq("student_id", user.id)
      .eq("offer_decision", "offer accepted")
      .order("applied_date", { ascending: false });

    if (appsErr) {
      console.warn("Error fetching applications with joined job_lists:", appsErr);
      const { data: appsOnly, error: appsOnlyErr } = await supabaseClient
        .from("current_applications")
        .select("*")
        .eq("student_id", user.id)
        .eq("offer_decision", "offer accepted")
        .order("applied_date", { ascending: false });

      if (appsOnlyErr) throw appsOnlyErr;
      return renderApplicationsFallback(appsOnly);
    }

    const applications = appsData ?? [];

    if (!applications.length) {
      totalCoopsEl.textContent = "0";
      loadingEl.hidden = true;
      emptyState.hidden = false;
      return;
    }

    recordsRoot.innerHTML = "";
    loadingEl.hidden = true;
    emptyState.hidden = true;

    const nodes = [];
    for (const app of applications) {
      let job = app.job_lists ?? null;

      if (!job && app.job_id) {
        const { data: jobData, error: jobErr } = await supabaseClient
          .from("job_listings")
          .select("*")
          .eq("id", app.job_id)
          .limit(1)
          .maybeSingle();

        if (jobErr) {
          console.warn("Error fetching job for app", app.id, jobErr);
        } else {
          job = jobData;
        }
      }

      let recruiter = null;
      try {
        const companyId = job?.company_id ?? null;
        if (companyId !== null && companyId !== undefined) {
          const { data: recData, error: recErr } = await supabaseClient
            .from("recruiters")
            .select("*")
            .eq("company_id", companyId)
            .limit(1)
            .maybeSingle();
          if (recErr) {
            console.warn("Recruiter fetch error for company", companyId, recErr);
          } else {
            recruiter = recData ?? null;
          }
        }
      } catch (err) {
        console.warn("Recruiter lookup failed", err);
      }

      const node = createRecordNode(app, job ?? {}, recruiter ?? {});
      recordsRoot.appendChild(node);
    }

    totalCoopsEl.textContent = String(applications.length);

  } catch (err) {
    console.error("Error loading employment records:", err);
    loadingEl.textContent = "An error occurred while loading records. Check console for details.";
  }
}


async function renderApplicationsFallback(appsOnly) {
  recordsRoot.innerHTML = "";
  loadingEl.hidden = true;

  const apps = appsOnly ?? [];
  if (!apps.length) {
    totalCoopsEl.textContent = "0";
    emptyState.hidden = false;
    return;
  }

  for (const app of apps) {
    const { data: jobData, error: jobErr } = await supabaseClient
      .from("job_lists")
      .select("*")
      .eq("id", app.job_id)
      .limit(1)
      .maybeSingle();

    const job = jobData ?? {};
    let recruiter = null;
    if (job.company_id) {
      const { data: recData } = await supabaseClient
        .from("recruiters")
        .select("*")
        .eq("company_id", job.company_id)
        .limit(1)
        .maybeSingle();
      recruiter = recData ?? null;
    }

    const node = createRecordNode(app, job, recruiter);
    recordsRoot.appendChild(node);
  }

  totalCoopsEl.textContent = String(apps.length);
}
async function loadReviewData(studentId, jobId) {
  const { data, error } = await supabaseClient
    .from("student_reviews")
    .select("*")
    .eq("student_id", studentId)
    .eq("job_id", jobId)
    .limit(1);

  if (error) {
    console.error("Review load error:", error);
    return null;
  }

  return data?.[0] ?? null;
}

function populateReviewDisplay(display, review) {
  display.innerHTML = `
    <h4>Your Review<h4>
    ${reviewQuestions.map(q => `<p><strong>${q.label}:</strong> ${review[q.name]}</p>`).join('')}
    <h4>Highlights of Experience</h4>
    <p>${review.highlights_experience}</p>

    <h4>Opportunities for Improvement</h4>
    <p>${review.opportunities_improvement}</p>
  `;
}

async function submitReview(form, studentId, jobId) {
  const fd = new FormData(form);
  const payload = { is_submitted: true };

  reviewQuestions.forEach(q => {
    payload[q.name] = fd.get(q.name);
  });

  // Check if a review already exists
  const { data: existingReview, error: fetchErr } = await supabaseClient
    .from("student_reviews")
    .select("*")
    .eq("student_id", studentId)
    .eq("job_id", jobId)
    .limit(1);

  if (fetchErr) {
    alert("Error checking existing review: " + fetchErr.message);
    return false;
  }

  if (existingReview?.length) {
    // Update existing review
    const { error } = await supabaseClient
      .from("student_reviews")
      .update(payload)
      .eq("student_id", studentId)
      .eq("job_id", jobId);

    if (error) {
      alert("Error submitting review: " + error.message);
      return false;
    }
  } else {
    // Create new review
    payload.student_id = studentId;
    payload.job_id = jobId;

    const { error } = await supabaseClient
      .from("student_reviews")
      .insert(payload);

    if (error) {
      alert("Error creating review: " + error.message);
      return false;
    }
  }

  return true;
}

async function initReviewSystem(clone, application, job) {
  const reviewTab = clone.querySelector(".tab-student-review");
  if (!reviewTab) return;

  const studentId = application.student_id;
  const jobId = job.id;

  const statusText = reviewTab.querySelector(".review-status-text");
  const actionBtn = reviewTab.querySelector(".review-action-btn");
  const form = reviewTab.querySelector("#studentReviewForm");
  const display = reviewTab.querySelector(".review-display");

  const review = await loadReviewData(studentId, jobId);

  // Warn user if they try to leave with unsaved changes
  form.querySelectorAll("textarea").forEach(t => {
    t.addEventListener("input", () => {
        warnBeforeExit = true;
    });
  });


  if (!review) {
    // New review
    statusText.textContent = "Please complete your review.";
    actionBtn.hidden = true;
    form.hidden = false;
    display.hidden = true;
    renderRatingQuestions(form);
  } else {
    // Existing review
    const readOnly = review.is_submitted === true;
    statusText.textContent = readOnly ? "Review completed." : "Your review (editable)";

    actionBtn.hidden = true;
    form.hidden = false;
    display.hidden = true;

    renderRatingQuestions(form, review, readOnly);

    // Prefill textareas
    const highlights = form.querySelector("[name='highlights_experience']");
    const opportunities = form.querySelector("[name='opportunities_improvement']");
    if (highlights) {
      highlights.value = review.highlights_experience || "";
      highlights.disabled = readOnly;
    }
    if (opportunities) {
      opportunities.value = review.opportunities_improvement || "";
      opportunities.disabled = readOnly;
    }

    // Hide submit button if read-only
    const submitBtn = form.querySelector("button[type='submit']");
    if (submitBtn) submitBtn.hidden = readOnly;
  }

  // Add submit handler
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = await submitReview(form, studentId, jobId);
    if (ok) {
      // Reload only the review section instead of whole page if you want
      location.reload();
    }
  });
}




function renderRatingQuestions(form, review = null, readOnly = false, namespace = "") {
  const oldContainer = form.querySelector(".rating-container");
  if (oldContainer) oldContainer.remove();

  const container = document.createElement("div");
  container.classList.add("rating-container");

  reviewQuestions.forEach(q => {
    const group = document.createElement("div");
    group.classList.add("rating-group");

    const label = document.createElement("div");
    label.classList.add("rating-label");
    label.textContent = q.label;
    group.appendChild(label);

    const scale = document.createElement("div");
    scale.classList.add("rating-scale");

    for (let i = 1; i <= 5; i++) {
      const option = document.createElement("div");
      option.classList.add("rating-option");
      if (readOnly) option.classList.add("readonly");

      const input = document.createElement("input");
      input.type = "radio";
      input.name = `${namespace}-${q.name}`; // namespace the name too
      input.value = i;
      input.id = `${namespace}-${q.name}-${i}`;
      if (readOnly) input.disabled = true;

      const labelEl = document.createElement("label");
      labelEl.htmlFor = input.id;
      labelEl.classList.add("rating-label-inner");
      labelEl.innerHTML = `<span class="rating-number">${i}</span><span class="rating-text">${
        ["Strongly Disagree","Disagree","Neutral","Agree","Strongly Agree"][i-1]
      }</span>`;

      if (!readOnly) {
        labelEl.addEventListener("click", () => {
          const siblings = scale.querySelectorAll(".rating-option");
          siblings.forEach(sib => sib.classList.remove("active"));
          option.classList.add("active");
          warnBeforeExit = true;
        });
      }

      if (review && review[q.name] == String(i)) {
        option.classList.add("active");
        input.checked = true;
      }

      option.appendChild(input);
      option.appendChild(labelEl);
      scale.appendChild(option);
    }

    group.appendChild(scale);
    container.appendChild(group);
  });

  form.prepend(container);
}





function initTabs(clone) {
  const buttons = clone.querySelectorAll(".tab-btn");
  const tabContents = clone.querySelectorAll(".tab-content");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      tabContents.forEach(c => {
        c.hidden = !c.classList.contains(`tab-${tab}`);
      });
    });
  });
}




document.addEventListener("DOMContentLoaded", () => {
  loadEmploymentRecords();
});
