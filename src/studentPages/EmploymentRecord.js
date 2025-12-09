import { supabaseClient } from "../supabaseClient.js";

const recordsRoot = document.getElementById("records");
const loadingEl = document.getElementById("loading");
const totalCoopsEl = document.getElementById("total-coops");
const userStatusEl = document.getElementById("user-status");
const emptyState = document.getElementById("empty-state");
const recordTpl = document.getElementById("record-template");

const reviewQuestions = [
  {
    name: "professional_development",
    label:
      "This co-op significantly enhanced my technical and professional skills",
  },
  {
    name: "mentorship_support",
    label: "I received helpful mentorship and support",
  },
  {
    name: "work_life_balance",
    label: "The co-op provided a healthy work-life balance",
  },
  {
    name: "workplace_culture",
    label: "The workplace culture was positive and inclusive",
  },
  {
    name: "learning_opportunities",
    label: "I had opportunities to learn and grow",
  },
  {
    name: "feedback_communication",
    label: "Feedback and communication were clear and constructive",
  },
  {
    name: "career_relevance",
    label: "The work was relevant to my career goals",
  },
  { name: "resource_access", label: "I had access to the resources I needed" },
  { name: "team_integration", label: "I felt integrated and part of the team" },
  {
    name: "future_recommendation",
    label: "I would recommend this co-op to other students",
  },
];

class ReviewManager {
  constructor(jobId, studentId) {
    this.jobId = jobId;
    this.studentId = studentId;
    this.review = null;
  }

  async load() {
    try {
      const { data, error } = await supabaseClient
        .from("student_reviews")
        .select("*")
        .eq("student_id", this.studentId)
        .eq("job_id", this.jobId)
        .maybeSingle(); // Use maybeSingle instead of single

      if (error) {
        console.error("Error loading review:", error);
        return null;
      }

      this.review = data;
      return this.review;
    } catch (err) {
      console.error("Error in ReviewManager.load:", err);
      return null;
    }
  }

  async save(formData) {
    try {
      const payload = {
        student_id: this.studentId,
        job_id: this.jobId,
        is_submitted: true,
        highlights_experience: formData.get("highlights_experience") || "",
        opportunities_improvement:
          formData.get("opportunities_improvement") || "",
      };

      // Add rating values
      reviewQuestions.forEach((q) => {
        const value = formData.get(q.name);
        payload[q.name] = value ? parseInt(value) : null;
      });

      if (this.review?.id) {
        // Update existing review
        const { error } = await supabaseClient
          .from("student_reviews")
          .update(payload)
          .eq("id", this.review.id);

        if (error) throw error;
        this.review = { ...this.review, ...payload };
        return true;
      } else {
        // Create new review
        const { data, error } = await supabaseClient
          .from("student_reviews")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        this.review = data;
        return true;
      }
    } catch (error) {
      console.error("Error saving review:", error);
      return false;
    }
  }

  isSubmitted() {
    return this.review?.is_submitted === true;
  }
}

function setText(el, text) {
  if (el) el.textContent = text || "";
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
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
      return typeof job.hourly_pay === "number"
        ? `$${job.hourly_pay}/hr`
        : `${job.hourly_pay}`;
    }
    return "Paid (amount not specified)";
  }
  return "—";
}

function createRatingInput(name, label, value = null, readOnly = false) {
  const container = document.createElement("div");
  container.className = "rating-group";

  const labelEl = document.createElement("div");
  labelEl.className = "rating-label";
  labelEl.textContent = label;
  container.appendChild(labelEl);

  const scale = document.createElement("div");
  scale.className = "rating-scale";

  const ratingTexts = [
    "Strongly Disagree",
    "Disagree",
    "Neutral",
    "Agree",
    "Strongly Agree",
  ];

  for (let i = 1; i <= 5; i++) {
    const option = document.createElement("div");
    option.className = "rating-option";
    if (readOnly) option.classList.add("readonly");

    // Check if this option should be selected
    const isSelected = value !== null && (value === i || value === String(i));
    if (isSelected) {
      option.classList.add("active");
    }

    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = i;
    input.id = `${name}-${i}`;
    input.required = true;
    if (readOnly) input.disabled = true;
    if (isSelected) input.checked = true;

    const inputLabel = document.createElement("label");
    inputLabel.htmlFor = `${name}-${i}`;
    inputLabel.className = "rating-label-inner";
    inputLabel.innerHTML = `
      <span class="rating-number">${i}</span>
      <span class="rating-text">${ratingTexts[i - 1]}</span>
    `;

    if (!readOnly) {
      input.addEventListener("change", (e) => {
        // Remove active class from all options in this group
        scale.querySelectorAll(".rating-option").forEach((opt) => {
          opt.classList.remove("active");
        });
        // Add active class to selected option
        option.classList.add("active");
      });
    }

    option.appendChild(input);
    option.appendChild(inputLabel);
    scale.appendChild(option);
  }

  container.appendChild(scale);
  return container;
}

function renderReviewForm(container, review, readOnly = false) {
  const ratingSection = container.querySelector(".rating-section");
  if (!ratingSection) return;

  ratingSection.innerHTML = "";

  reviewQuestions.forEach((q) => {
    const ratingValue = review ? review[q.name] : null;
    const ratingInput = createRatingInput(
      q.name,
      q.label,
      ratingValue,
      readOnly
    );
    ratingSection.appendChild(ratingInput);
  });
}

function renderReviewDisplay(container, review) {
  const display = container.querySelector("#review-display");
  if (!display) return;

  display.innerHTML = "";
  display.hidden = false;

  const ratingTexts = [
    "Strongly Disagree",
    "Disagree",
    "Neutral",
    "Agree",
    "Strongly Agree",
  ];

  reviewQuestions.forEach((q) => {
    const value = review[q.name];
    const ratingText = value ? ratingTexts[value - 1] : "Not rated";

    const questionDiv = document.createElement("div");
    questionDiv.className = "review-question";
    questionDiv.innerHTML = `
      <strong>${q.label}:</strong> 
      <span class="rating-value">${value || "—"} (${ratingText})</span>
    `;
    display.appendChild(questionDiv);
  });

  if (review.highlights_experience) {
    const highlightsDiv = document.createElement("div");
    highlightsDiv.innerHTML = `
      <h4>Highlights of Experience</h4>
      <p>${review.highlights_experience}</p>
    `;
    display.appendChild(highlightsDiv);
  }

  if (review.opportunities_improvement) {
    const improvementsDiv = document.createElement("div");
    improvementsDiv.innerHTML = `
      <h4>Opportunities for Improvement</h4>
      <p>${review.opportunities_improvement}</p>
    `;
    display.appendChild(improvementsDiv);
  }
}

async function setupReviewTab(tabElement, application, job) {
  try {
    const reviewManager = new ReviewManager(job.id, application.student_id);
    await reviewManager.load();

    const statusText = tabElement.querySelector(".review-status-text");
    const display = tabElement.querySelector("#review-display");
    const form = tabElement.querySelector("#review-form");
    const reviewActions = tabElement.querySelector(".review-actions");
    const editBtn = tabElement.querySelector("#edit-review-btn");
    const cancelEditBtn = tabElement.querySelector("#cancel-edit");

    if (!statusText || !display || !form || !reviewActions) {
      console.error("Review tab elements not found");
      return;
    }

    if (reviewManager.review && reviewManager.isSubmitted()) {
      // Show completed review - use the FORM view but make it read-only
      statusText.textContent = "Review completed.";
      display.hidden = true; // Hide the text display
      form.hidden = false; // Show the form (read-only)
      reviewActions.hidden = true; // Hide edit button completely
      if (cancelEditBtn) cancelEditBtn.hidden = true;

      // Render form in read-only mode
      renderReviewForm(tabElement, reviewManager.review, true);

      // Populate text fields as read-only
      const highlights = form.querySelector("#highlights");
      const improvements = form.querySelector("#improvements");
      if (highlights) {
        highlights.value = reviewManager.review.highlights_experience || "";
        highlights.readOnly = true;
        highlights.style.backgroundColor = "#f8f9fa";
        highlights.style.cursor = "not-allowed";
      }
      if (improvements) {
        improvements.value =
          reviewManager.review.opportunities_improvement || "";
        improvements.readOnly = true;
        improvements.style.backgroundColor = "#f8f9fa";
        improvements.style.cursor = "not-allowed";
      }

      // Hide the submit button
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.hidden = true;

      // Add a class to dim the entire form
      form.classList.add("readonly-form");
    } else if (reviewManager.review && !reviewManager.isSubmitted()) {
      // Show draft review
      statusText.textContent = "Draft review (not submitted)";
      display.hidden = true;
      form.hidden = false;
      reviewActions.hidden = true;
      if (cancelEditBtn) cancelEditBtn.hidden = true;

      // Remove readonly class if it exists
      form.classList.remove("readonly-form");

      renderReviewForm(tabElement, reviewManager.review, false);
      const highlights = form.querySelector("#highlights");
      const improvements = form.querySelector("#improvements");
      if (highlights) {
        highlights.value = reviewManager.review.highlights_experience || "";
        highlights.readOnly = false;
        highlights.style.backgroundColor = "";
        highlights.style.cursor = "";
      }
      if (improvements) {
        improvements.value =
          reviewManager.review.opportunities_improvement || "";
        improvements.readOnly = false;
        improvements.style.backgroundColor = "";
        improvements.style.cursor = "";
      }

      // Show submit button
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.hidden = false;
    } else {
      // New review
      statusText.textContent = "Please complete your review.";
      display.hidden = true;
      form.hidden = false;
      reviewActions.hidden = true;
      if (cancelEditBtn) cancelEditBtn.hidden = true;

      // Remove readonly class if it exists
      form.classList.remove("readonly-form");

      renderReviewForm(tabElement, null, false);

      // Show submit button
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.hidden = false;
    }

    // Handle form submission (only for non-submitted reviews)
    if (!reviewManager.isSubmitted()) {
      form.onsubmit = async (e) => {
        e.preventDefault();

        const success = await reviewManager.save(new FormData(form));
        if (success) {
          // Reload the review tab
          await setupReviewTab(tabElement, application, job);
        } else {
          alert("Failed to save review. Please try again.");
        }
      };
    } else {
      // Prevent form submission for completed reviews
      form.onsubmit = (e) => {
        e.preventDefault();
        return false;
      };
    }
  } catch (error) {
    console.error("Error setting up review tab:", error);
  }
}

function createRecordNode(application, job, recruiter) {
  const clone = recordTpl.content.cloneNode(true);
  const article = clone.querySelector(".job-card");
  article.dataset.jobId = job?.id || "";

  // Set basic info
  const logo = article.querySelector(".logo");
  if (logo) {
    const initials = (recruiter?.company_name || job?.job_title || "Co-op")
      .split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    logo.textContent = initials;
  }

  // Set text content for various elements
  const textMappings = [
    { selector: ".job-title", value: job?.job_title || "Untitled role" },
    {
      selector: ".company-name",
      value: recruiter?.company_name || "Company #" + (job?.company_id || "—"),
    },
    { selector: ".location", value: job?.location || "—" },
    {
      selector: ".work-type",
      value: job?.work_type || (job?.is_full_time ? "Full-time" : "Part-time"),
    },
    {
      selector: ".job-description",
      value: job?.job_description || "No description",
    },
    { selector: ".compensation", value: formatPay(job) },
    { selector: ".openings", value: job?.no_of_open_positions || "—" },
    {
      selector: ".majors",
      value: Array.isArray(job?.desired_majors)
        ? job.desired_majors.join(", ")
        : job?.desired_majors || "—",
    },
    { selector: ".gpa", value: job?.gpa || "—" },
    { selector: ".qualifications", value: job?.job_qualifications || "—" },
    {
      selector: ".in-person",
      value: yesNo(job?.requires_in_person_interviews),
    },
    { selector: ".transport", value: yesNo(job?.requires_transportation) },
    { selector: ".scdc", value: yesNo(job?.follows_scdc_calendar) },
  ];

  textMappings.forEach((mapping) => {
    const el = article.querySelector(mapping.selector);
    if (el) setText(el, mapping.value);
  });

  // Set recruiter info
  const recruiterName = article.querySelector(".recruiter-name");
  const recruiterCompany = article.querySelector(".recruiter-company");
  const recruiterEmail = article.querySelector(".recruiter-email");

  if (recruiterName && recruiter) {
    setText(
      recruiterName,
      `${recruiter.first_name || ""} ${recruiter.last_name || ""}`.trim() ||
        "Recruiter"
    );
  }
  if (recruiterCompany && recruiter) {
    setText(recruiterCompany, recruiter.company_name || "");
  }
  if (recruiterEmail && recruiter?.email) {
    recruiterEmail.href = `mailto:${recruiter.email}`;
    setText(recruiterEmail, recruiter.email);
  } else if (recruiterEmail) {
    recruiterEmail.href = "#";
    setText(recruiterEmail, "Email not provided");
  }

  // Term and dates
  const termAndDates = article.querySelector(".term-and-dates");
  if (termAndDates) {
    const termText = [
      job?.term,
      job?.start_date
        ? `${formatDate(job.start_date)} — ${
            job.end_date ? formatDate(job.end_date) : "ongoing"
          }`
        : null,
    ]
      .filter(Boolean)
      .join(" • ");
    setText(termAndDates, termText);
  }

  // Setup expand button
  const expandBtn = article.querySelector(".expand-btn");
  const body = article.querySelector(".card-body");
  if (expandBtn && body) {
    expandBtn.onclick = () => {
      const expanded = expandBtn.getAttribute("aria-expanded") === "true";
      expandBtn.setAttribute("aria-expanded", String(!expanded));
      expandBtn.textContent = expanded ? "+" : "−";
      body.hidden = expanded;
    };
  }

  // Setup tabs
  const tabBtns = article.querySelectorAll(".tab-btn");
  const tabContents = article.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.onclick = () => {
      const tab = btn.dataset.tab;

      // Update tab buttons
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Update tab content visibility
      tabContents.forEach((content) => {
        content.hidden = !content.classList.contains(`tab-${tab}`);
      });

      // If switching to review tab, initialize it
      if (tab === "student-review") {
        const reviewTab = article.querySelector(".tab-student-review");
        if (reviewTab) {
          // Use setTimeout to ensure the tab is visible before initializing
          setTimeout(() => {
            setupReviewTab(reviewTab, application, job);
          }, 100);
        }
      }
    };
  });

  return article;
}

async function loadEmploymentRecords() {
  try {
    const { data: userData, error: userErr } =
      await supabaseClient.auth.getUser();
    if (userErr) {
      console.error("Auth error:", userErr);
      userStatusEl.textContent = "Not signed in";
      loadingEl.textContent = "Please sign in to view your employment records.";
      return;
    }

    const user = userData.user;
    userStatusEl.textContent = `Signed in as ${user.email}`;

    // First try with join
    const { data: applications, error: appsErr } = await supabaseClient
      .from("current_applications")
      .select("*, job_listings(*)")
      .eq("student_id", user.id)
      .eq("offer_decision", "offer accepted")
      .order("applied_date", { ascending: false });

    if (appsErr) {
      console.error("Error fetching applications:", appsErr);
      loadingEl.textContent = "Error loading records. Please try again.";
      return;
    }

    loadingEl.hidden = true;

    if (!applications || applications.length === 0) {
      emptyState.hidden = false;
      totalCoopsEl.textContent = "0";
      return;
    }

    recordsRoot.innerHTML = "";
    totalCoopsEl.textContent = applications.length.toString();

    for (const app of applications) {
      const job = app.job_listings || {};

      // Get recruiter info if available
      let recruiter = null;
      if (job.company_id) {
        try {
          const { data: recData, error: recErr } = await supabaseClient
            .from("recruiters")
            .select("*")
            .eq("company_id", job.company_id)
            .limit(1);

          if (!recErr && recData && recData.length > 0) {
            recruiter = recData[0];
          }
        } catch (recError) {
          console.warn("Could not fetch recruiter:", recError);
        }
      }

      const recordNode = createRecordNode(app, job, recruiter);
      recordsRoot.appendChild(recordNode);
    }
  } catch (error) {
    console.error("Error loading records:", error);
    loadingEl.textContent =
      "Error loading records. Please check console for details.";
  }
}

// Initialize when DOM is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadEmploymentRecords);
} else {
  loadEmploymentRecords();
}
