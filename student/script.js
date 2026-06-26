// ==========================================
// CONFIGURATION
// Paste your Google Apps Script Web App URL here
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxWoj00cxKwK-rZt5ZaKdm6iERbFXwP2c3XSzVayz-lk4dF-6WqWPOAssZeqPoBcNIEUQ/exec";
// ==========================================

// State
let studentLat = null;
let studentLng = null;
let currentQRData = null;
let html5QrcodeScanner = null;

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
    btnCancel.addEventListener('click', () => {
        stopScanner();
        location.reload();
    });
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
        if (instructionText) {
            instructionText.innerText = "Please allow location access to start the QR code scanner.";
        }
        btnRequestLocation.classList.remove('hidden');
    }
}

function getStudentLocation() {
    if (!navigator.geolocation) {
        showLocationError("Geolocation is not supported by your browser.");
        return;
    }

    if (locationText) {
        locationText.innerText = "Acquiring location...";
    }
    locationStatus.className = 'location-status';
    hideError();

    const optionsHigh = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
    };

    const optionsLow = {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 10000
    };

    function success(position) {
        studentLat = position.coords.latitude;
        studentLng = position.coords.longitude;
        
        locationStatus.className = 'location-status success';
        btnRequestLocation.classList.add('hidden');
        
        if (currentQRData) {
            locationText.innerText = `Location Acquired. Verifying...`;
            validateAndShowForm();
        } else {
            locationText.innerText = `Location Acquired. Ready to scan.`;
            startScanner();
        }
    }

    function error(err) {
        console.warn(`Location error (${err.code}): ${err.message}`);
        
        if (err.code === 3 || err.code === 2) {
            // Timeout or position unavailable - retry with low accuracy
            if (locationText) {
                locationText.innerText = "GPS signal weak. Retrying with network location...";
            }
            navigator.geolocation.getCurrentPosition(
                success,
                (err2) => {
                    let msg = "Could not determine location. Please ensure location/GPS is turned ON and try again.";
                    if (err2.code === 1) {
                        msg = "Location access denied. Please enable location permissions in your browser/device settings.";
                    }
                    showLocationError(msg);
                },
                optionsLow
            );
        } else {
            let msg = "Location access is required for attendance.";
            if (err.code === 1) {
                msg = "Location access denied. Please enable location permissions in your browser/device settings.";
            }
            showLocationError(msg);
        }
    }

    navigator.geolocation.getCurrentPosition(success, error, optionsHigh);
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

function startScanner() {
    if (html5QrcodeScanner) return; // already started

    const readerElement = document.getElementById('reader');
    if (readerElement) {
        readerElement.classList.remove('hidden');
    }
    if (instructionText) {
        instructionText.innerText = "Scan the QR code displayed by your teacher.";
    }

    html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: {width: 250, height: 250} },
        /* verbose= */ false
    );
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
}

function stopScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(error => {
            console.error("Failed to clear html5QrcodeScanner. ", error);
        });
        html5QrcodeScanner = null;
    }
    const readerElement = document.getElementById('reader');
    if (readerElement) {
        readerElement.classList.add('hidden');
    }
}

function onScanSuccess(decodedText, decodedResult) {
    try {
        let dataParam = null;
        if (decodedText.startsWith("http")) {
            try {
                const url = new URL(decodedText);
                dataParam = url.searchParams.get("data");
            } catch(e) {}
        }
        if (!dataParam) {
            dataParam = decodedText;
        }

        let parsedData = null;
        try {
            parsedData = JSON.parse(atob(dataParam));
        } catch(e) {
            // Fallback: try parsing as raw JSON
            parsedData = JSON.parse(decodedText);
        }

        // Validate basic structure
        if (!parsedData.session || !parsedData.lat || !parsedData.lng || !parsedData.exp || !parsedData.token) {
            throw new Error("Invalid QR code format.");
        }

        // Validate Expiry
        if (Date.now() > parsedData.exp) {
            showError("This QR Code has expired. Please ask the teacher for a new one.");
            stopScanner();
            return;
        }

        // Validate Location (Distance)
        const distance = calculateDistance(studentLat, studentLng, parsedData.lat, parsedData.lng);
        if (distance > 50) {
            showError(`Invalid Attendance: You are outside the classroom attendance zone. (${Math.round(distance)}m away)`);
            stopScanner();
            return;
        }

        // Validate Duplicate natively (localStorage)
        if (localStorage.getItem('attendance_' + parsedData.token)) {
            showError("Attendance already marked for this session on this device.");
            stopScanner();
            return;
        }

        // All Validations passed
        currentQRData = parsedData;
        stopScanner();
        showForm();

    } catch (e) {
        showError("Invalid QR code scanned. Make sure you are scanning the attendance QR code.");
        stopScanner();
    }
}

function onScanFailure(error) {
    // Ignore scan failures to allow continuous scanner flow
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
    stopScanner();
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
