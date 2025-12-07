import { supabaseClient } from "../supabaseClient.js";

const recordsRoot = document.getElementById("records");
const loadingEl = document.getElementById("loading");
const totalCoopsEl = document.getElementById("total-coops");
const userStatusEl = document.getElementById("user-status");
const emptyState = document.getElementById("empty-state");
const recordTpl = document.getElementById("record-template");

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

  expandBtn.addEventListener("click", (e) => {
    const expanded = expandBtn.getAttribute("aria-expanded") === "true";
    expandBtn.setAttribute("aria-expanded", String(!expanded));
    expandBtn.textContent = expanded ? "+" : "−";
    if (expanded) {
      body.hidden = true;
    } else {
      body.hidden = false;
      body.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

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
      nodes.push(node);
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
        .from("recruiter")
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

document.addEventListener("DOMContentLoaded", () => {
  loadEmploymentRecords();
});
