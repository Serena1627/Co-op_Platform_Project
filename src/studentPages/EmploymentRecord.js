import { supabaseClient } from "../supabaseClient.js";

const mockData = [
    {
        id: 1,
        company_name: "Tech Innovations Inc.",
        job_title: "Software Engineering Co-op",
        start_date: "2024-01-15",
        end_date: "2024-06-30",
        rating: 5,
        location: "Boston, MA",
        department: "Engineering",
        salary: "$25/hour",
        description: "Worked on full-stack development projects using React and Node.js"
    },
    {
        id: 2,
        company_name: "DataCorp Solutions",
        job_title: "Data Science Co-op",
        start_date: "2023-06-01",
        end_date: "2023-12-15",
        rating: 4,
        location: "San Francisco, CA",
        department: "Analytics",
        salary: "$28/hour",
        description: "Analyzed large datasets and created predictive models"
    },
    {
        id: 3,
        company_name: "Green Energy Labs",
        job_title: "Research Assistant Co-op",
        start_date: "2023-01-10",
        end_date: "2023-05-20",
        rating: 5,
        location: "Cambridge, MA",
        department: "Research & Development",
        salary: "$22/hour",
        description: "Conducted research on renewable energy solutions"
    }
];

async function getUserId() {
// return (await supabaseClient.auth.getUser()).data?.user?.id ?? null;
    return "mock-user-id"; // Mock for demonstration
}

function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    let stars = '★'.repeat(fullStars);
    if (hasHalf){
        stars += '☆';
    }
    stars += '☆'.repeat(5 - Math.ceil(rating));
    return stars;
}

function calculateMonths(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return Math.max(1, months);
}

function formatDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const options = { month: 'short', year: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
}

async function loadEmploymentHistory() {
    const userId = await getUserId();
    if (!userId) {
        document.getElementById('loading').textContent = 'Please sign in to view your employment history.';
        return;
    }

    try {
        /* Real Supabase query:
        const { data: applications, error } = await supabaseClient
        .from("current_applications")
        .select(`
            id,
            start_date,
            end_date,
            rating,
            job_listings (
            job_title,
            location,
            department,
            salary,
            description,
            recruiters (
                company_name
            )
            )
        `)
        .eq("student_id", userId)
        .eq("status", "offer_accepted")
        .not("rating", "is", null)
        .order("end_date", { ascending: false });

        if (error) throw error;
        const history = applications || [];
        */

        // Using mock data for demonstration
        const history = mockData;

        document.getElementById('loading').style.display = 'none';

        if (history.length === 0) {
            document.getElementById('empty-state').style.display = 'block';
            return;
        }

        // Calculate statistics
        const totalCoops = history.length;
        const avgRating = (history.reduce((sum, item) => sum + item.rating, 0) / totalCoops).toFixed(1);
        const totalMonths = history.reduce((sum, item) => 
            sum + calculateMonths(item.start_date, item.end_date), 0
        );

        document.getElementById('total-coops').textContent = totalCoops;
        document.getElementById('avg-rating').textContent = avgRating;
        document.getElementById('total-months').textContent = totalMonths;

        // Render history cards
        const historyList = document.getElementById('history-list');
        historyList.style.display = 'flex';
        historyList.innerHTML = '';

        history.forEach(item => {
            const card = document.createElement('div');
            card.className = 'history-card';
            card.onclick = () => showDetails(item);

            const months = calculateMonths(item.start_date, item.end_date);
            
            card.innerHTML = `
                <div class="history-header">
                <div class="history-left">
                    <div class="company-name">${item.company_name}</div>
                    <div class="job-title">${item.job_title}</div>
                    <div class="date-range">${formatDateRange(item.start_date, item.end_date)}</div>
                </div>
                <div class="rating-display">
                    <div class="stars">${renderStars(item.rating)}</div>
                    <div class="rating-text">${item.rating}/5</div>
                </div>
                </div>
                <div class="history-details">
                <div class="detail-item">
                    <div class="detail-label">Location</div>
                    <div class="detail-value">${item.location}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Duration</div>
                    <div class="detail-value">${months} month${months !== 1 ? 's' : ''}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Department</div>
                    <div class="detail-value">${item.department}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Compensation</div>
                    <div class="detail-value">${item.salary}</div>
                </div>
                </div>
            `;

            historyList.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading employment history:', error);
        document.getElementById('loading').textContent = 'Error loading employment history. Please try again.';
    }
}

function showDetails(item) {
    const modal = document.getElementById('detail-modal');
    const modalBody = document.getElementById('modal-body');

    const months = calculateMonths(item.start_date, item.end_date);

    modalBody.innerHTML = `
        <h2>${item.job_title}</h2>
        <div class="company">${item.company_name}</div>
        
        <div class="info-grid">
        <div class="info-row">
            <label>Rating</label>
            <div class="value">
            <span style="color: #fbbf24; font-size: 18px;">${renderStars(item.rating)}</span>
            <span style="margin-left: 8px;">${item.rating}/5</span>
            </div>
        </div>
        
        <div class="info-row">
            <label>Duration</label>
            <div class="value">${formatDateRange(item.start_date, item.end_date)} (${months} month${months !== 1 ? 's' : ''})</div>
        </div>
        
        <div class="info-row">
            <label>Location</label>
            <div class="value">${item.location}</div>
        </div>
        
        <div class="info-row">
            <label>Department</label>
            <div class="value">${item.department}</div>
        </div>
        
        <div class="info-row">
            <label>Compensation</label>
            <div class="value">${item.salary}</div>
        </div>
        
        ${item.description ? `
        <div class="info-row">
            <label>Description</label>
            <div class="value">${item.description}</div>
        </div>
        ` : ''}
        </div>
    `;

    modal.classList.add('active');
    }

    window.closeModal = function() {
    document.getElementById('detail-modal').classList.remove('active');
    };

    // Close modal when clicking outside
    document.getElementById('detail-modal').addEventListener('click', (e) => {
    if (e.target.id === 'detail-modal') {
        closeModal();
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', loadEmploymentHistory);
