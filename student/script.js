// ==========================================
// CONFIGURATION
// Paste your Google Apps Script Web App URL here
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxWoj00cxKwK-rZt5ZaKdm6iERbFXwP2c3XSzVayz-lk4dF-6WqWPOAssZeqPoBcNIEUQ/exec";
// ==========================================

// State
let studentLat = null;
let studentLng = null;
let currentQRData = null;

// DOM Elements
const locationStatus = document.getElementById('locationStatus');
const locationText = document.getElementById('locationText');
const statusBox = document.getElementById('statusBox');
const instructionText = document.getElementById('instructionText');

const scannerSection = document.getElementById('scannerSection');
const formSection = document.getElementById('formSection');
const successSection = document.getElementById('successSection');

const sessionBadge = document.getElementById('sessionBadge');
const attendanceForm = document.getElementById('attendanceForm');
const btnCancel = document.getElementById('btnCancel');
const btnSubmit = document.getElementById('btnSubmit');
const btnRequestLocation = document.getElementById('btnRequestLocation');

// Init
function init() {
    btnRequestLocation.addEventListener('click', getStudentLocation);
    btnCancel.addEventListener('click', () => location.reload());
    attendanceForm.addEventListener('submit', submitAttendance);

    // Read URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const dataParam = urlParams.get('data');

    if (dataParam) {
        try {
            // Decode the base64 encoded JSON string
            currentQRData = JSON.parse(atob(dataParam));
            
            // Validate basic structure
            if (!currentQRData.session || !currentQRData.lat || !currentQRData.lng || !currentQRData.exp || !currentQRData.token) {
                throw new Error("Invalid format.");
            }

            // Immediately ask for location
            getStudentLocation();

        } catch (e) {
            showError("Invalid or corrupted Attendance Link.");
            if(instructionText) instructionText.innerText = "Please scan a valid QR code provided by your teacher.";
            btnRequestLocation.classList.add('hidden');
        }
    } else {
        // No data param, means they just went to /student/ manually
        showError("Missing Attendance Data.");
        if(instructionText) instructionText.innerText = "Please use Google Lens or your phone camera to scan the QR code displayed by your teacher. Do not open this page manually.";
        btnRequestLocation.classList.add('hidden');
    }
}

function getStudentLocation() {
    if (!navigator.geolocation) {
        showLocationError("Geolocation is not supported by your browser.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            studentLat = position.coords.latitude;
            studentLng = position.coords.longitude;
            
            locationStatus.className = 'location-status success';
            locationText.innerText = `Location Acquired. Verifying...`;
            btnRequestLocation.classList.add('hidden');
            
            // Proceed to validation
            validateAndShowForm();
        },
        (error) => {
            let msg = "Location access is required for attendance.";
            showLocationError(msg);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function showLocationError(msg) {
    locationStatus.className = 'location-status error';
    locationText.innerText = msg;
    btnRequestLocation.classList.remove('hidden');
    showError(msg);
}

function validateAndShowForm() {
    if (!currentQRData) return;

    // Validate Expiry
    if (Date.now() > currentQRData.exp) {
        showError("This Attendance Link has expired. Please ask the teacher for a new one.");
        return;
    }

    // Validate Location (Distance)
    const distance = calculateDistance(studentLat, studentLng, currentQRData.lat, currentQRData.lng);
    if (distance > 50) {
        showError(`Invalid Attendance: You are outside the classroom attendance zone. (${Math.round(distance)}m away)`);
        return;
    }

    // Validate Duplicate natively (localStorage)
    if (localStorage.getItem('attendance_' + currentQRData.token)) {
        showError("Attendance already marked for this session on this device.");
        return;
    }

    // All Validations passed
    showForm();
}

// Haversine Formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const d = R * c; // in metres
    return d;
}

function showForm() {
    hideError();
    scannerSection.classList.add('hidden');
    formSection.classList.remove('hidden');

    sessionBadge.innerText = `${currentQRData.session} Session`;
    sessionBadge.style.backgroundColor = currentQRData.session === 'Morning' ? 'var(--secondary)' : 'var(--primary)';
    
    // Pre-fill from localStorage if available
    const savedRoll = localStorage.getItem('student_roll');
    const savedName = localStorage.getItem('student_name');
    const savedBranch = localStorage.getItem('student_branch');
    const savedSem = localStorage.getItem('student_sem');

    if(savedRoll) document.getElementById('rollNumber').value = savedRoll;
    if(savedName) document.getElementById('studentName').value = savedName;
    if(savedBranch) document.getElementById('branch').value = savedBranch;
    if(savedSem) document.getElementById('semester').value = savedSem;
}

async function submitAttendance(e) {
    e.preventDefault();
    hideError();

    if (APPS_SCRIPT_URL === "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE") {
        showError("Error: Server URL is not configured. Please contact admin.");
        return;
    }

    const rollNumber = document.getElementById('rollNumber').value.trim();
    const studentName = document.getElementById('studentName').value.trim();
    const branch = document.getElementById('branch').value;
    const semester = document.getElementById('semester').value;

    if (!rollNumber || !studentName || !branch || !semester) {
        showError("Please fill all fields.");
        return;
    }

    // Save details to localStorage for future pre-filling
    localStorage.setItem('student_roll', rollNumber);
    localStorage.setItem('student_name', studentName);
    localStorage.setItem('student_branch', branch);
    localStorage.setItem('student_sem', semester);

    btnSubmit.disabled = true;
    btnSubmit.innerText = "Submitting...";

    const payload = {
        date: currentQRData.date,
        rollNumber: rollNumber,
        studentName: studentName,
        branch: branch,
        semester: semester,
        session: currentQRData.session,
        time: new Date().toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})
    };

    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8', // Using text/plain avoids CORS preflight issues in Apps Script
            }
        });

        const result = await response.json();

        if (result.success) {
            // Mark token as used natively
            localStorage.setItem('attendance_' + currentQRData.token, 'true');
            
            formSection.classList.add('hidden');
            successSection.classList.remove('hidden');
        } else {
            showError(result.message || "Failed to mark attendance.");
            btnSubmit.disabled = false;
            btnSubmit.innerText = "Submit Attendance";
        }
    } catch (error) {
        showError("Server connection failed. Please try again.");
        btnSubmit.disabled = false;
        btnSubmit.innerText = "Submit Attendance";
        console.error(error);
    }
}

function showError(msg) {
    statusBox.innerText = msg;
    statusBox.className = 'alert alert-error';
    statusBox.classList.remove('hidden');
}

function hideError() {
    statusBox.classList.add('hidden');
}

// Start
init();
