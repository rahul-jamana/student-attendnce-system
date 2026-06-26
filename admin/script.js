// ==========================================
// CONFIGURATION
// Paste your Google Apps Script Web App URL here
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxWoj00cxKwK-rZt5ZaKdm6iERbFXwP2c3XSzVayz-lk4dF-6WqWPOAssZeqPoBcNIEUQ/exec";
// ==========================================

// State
let adminLat = null;
let adminLng = null;
let qrCode = null;
let countdownInterval = null;
const ADMIN_PASSWORD = "Ayush#@26"; // Change this if needed

// DOM Elements
const locationStatus = document.getElementById('locationStatus');
const locationText = document.getElementById('locationText');
const btnMorning = document.getElementById('btnMorning');
const btnAfternoon = document.getElementById('btnAfternoon');
const qrContainer = document.getElementById('qrContainer');
const qrSessionTitle = document.getElementById('qrSessionTitle');
const qrcodeElement = document.getElementById('qrcode');
const countdownElement = document.getElementById('countdown');
const btnStopSession = document.getElementById('btnStopSession');
const errorBox = document.getElementById('errorBox');
const tableBody = document.getElementById('tableBody');
const btnRefresh = document.getElementById('btnRefresh');
const btnExport = document.getElementById('btnExport');
const qrExpiryTimeInput = document.getElementById('qrExpiryTime');

// Login Elements
const loginOverlay = document.getElementById('loginOverlay');
const appContent = document.getElementById('appContent');
const adminPassword = document.getElementById('adminPassword');
const btnLogin = document.getElementById('btnLogin');
const loginError = document.getElementById('loginError');

const statMorning = document.getElementById('statMorning');
const statAfternoon = document.getElementById('statAfternoon');
const statTotal = document.getElementById('statTotal');

// Initialize
function init() {
    btnLogin.addEventListener('click', checkLogin);
    adminPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkLogin();
    });

    btnMorning.addEventListener('click', () => generateQR('Morning'));
    btnAfternoon.addEventListener('click', () => generateQR('Afternoon'));
    btnStopSession.addEventListener('click', stopSession);
    btnRefresh.addEventListener('click', fetchData);
    btnExport.addEventListener('click', exportToExcel);
}

function checkLogin() {
    if (adminPassword.value === ADMIN_PASSWORD) {
        loginOverlay.classList.add('hidden');
        appContent.classList.remove('hidden');
        getAdminLocation();
        fetchData();
    } else {
        loginError.classList.remove('hidden');
    }
}

function getAdminLocation() {
    if (!navigator.geolocation) {
        showLocationError("Geolocation is not supported by your browser.");
        return;
    }

    if (locationText) {
        locationText.innerText = "Acquiring location...";
    }
    locationStatus.className = 'location-status';

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
        adminLat = position.coords.latitude;
        adminLng = position.coords.longitude;
        
        locationStatus.className = 'location-status success';
        locationText.innerText = `Location Acquired: ${adminLat.toFixed(5)}, ${adminLng.toFixed(5)}`;
        
        // Enable buttons
        btnMorning.disabled = false;
        btnAfternoon.disabled = false;
    }

    function error(err) {
        console.warn(`Admin location error (${err.code}): ${err.message}`);
        
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
                        msg = "Location access denied. Please enable location permissions.";
                    }
                    showLocationError(msg);
                },
                optionsLow
            );
        } else {
            let msg = "Failed to get location.";
            if (err.code === 1) {
                msg = "Location access denied. Please allow location access in your browser/device settings.";
            }
            showLocationError(msg);
        }
    }

    navigator.geolocation.getCurrentPosition(success, error, optionsHigh);
}

function showLocationError(msg) {
    locationStatus.className = 'location-status error';
    locationText.innerText = msg;
    btnMorning.disabled = true;
    btnAfternoon.disabled = true;
}

function generateQR(session) {
    if (!adminLat || !adminLng) {
        showError("Admin location is required to generate QR code.");
        return;
    }

    // Clear previous
    stopSession();

    // Get minutes from input, default to 25
    let minutes = parseInt(qrExpiryTimeInput.value);
    if (isNaN(minutes) || minutes < 1) minutes = 25;

    const expiryTime = Date.now() + minutes * 60 * 1000;
    const token = Math.random().toString(36).substring(2, 15);

    const qrData = {
        session: session,
        lat: adminLat,
        lng: adminLng,
        exp: expiryTime,
        token: token,
        date: new Date().toLocaleDateString('en-IN')
    };

    // Encode data and construct URL
    // Hardcode the Firebase URL so it works even if admin page is opened locally
    const FIREBASE_URL = "https://smart-qr-attendance-4.web.app";
    const encodedData = btoa(JSON.stringify(qrData));
    const qrUrl = FIREBASE_URL + "/student/?data=" + encodedData;

    qrSessionTitle.innerText = `${session} Session Active`;
    qrSessionTitle.style.color = session === 'Morning' ? 'var(--secondary)' : 'var(--primary)';
    
    qrCode = new QRCode(qrcodeElement, {
        text: qrUrl,
        width: 300,
        height: 300,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.M
    });

    qrContainer.classList.remove('hidden');
    startTimer(expiryTime);
    hideError();
}

function startTimer(expiryTime) {
    countdownInterval = setInterval(() => {
        const now = Date.now();
        const diff = expiryTime - now;

        if (diff <= 0) {
            stopSession();
            showError("QR Code has expired.");
            return;
        }

        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        countdownElement.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function stopSession() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    qrcodeElement.innerHTML = '';
    qrContainer.classList.add('hidden');
    hideError();
}

function showError(msg) {
    errorBox.innerText = msg;
    errorBox.classList.remove('hidden');
}

function hideError() {
    errorBox.classList.add('hidden');
}

// Fetch Data
async function fetchData() {
    if (APPS_SCRIPT_URL === "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE") {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Please set your Google Apps Script URL in script.js</td></tr>';
        return;
    }

    tableBody.innerHTML = '<tr><td colspan="7" class="text-center loading-text">Loading data...</td></tr>';
    btnRefresh.disabled = true;

    try {
        const response = await fetch(APPS_SCRIPT_URL);
        const result = await response.json();

        if (result.success) {
            renderTable(result.data);
            updateStats(result.data);
        } else {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Failed to load data.</td></tr>';
        }
    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error fetching data. Check console.</td></tr>';
        console.error(error);
    } finally {
        btnRefresh.disabled = false;
    }
}

function renderTable(data) {
    tableBody.innerHTML = '';
    
    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No attendance records found.</td></tr>';
        return;
    }

    // Sort data by Date descending as a basic approach, or just reverse to show latest first
    data.reverse().forEach(row => {
        const tr = document.createElement('tr');
        
        const dateStr = row['Date'] ? new Date(row['Date']).toLocaleDateString('en-IN') : '-';
        
        tr.innerHTML = `
            <td>${dateStr}</td>
            <td>${row['Roll Number'] || '-'}</td>
            <td>${row['Student Name'] || '-'}</td>
            <td>${row['Branch'] || '-'}</td>
            <td>${row['Semester'] || '-'}</td>
            <td>${row['Morning Attendance'] === 'Present' ? `✅ (${row['Morning Time']})` : '❌'}</td>
            <td>${row['Afternoon Attendance'] === 'Present' ? `✅ (${row['Afternoon Time']})` : '❌'}</td>
        `;
        tableBody.appendChild(tr);
    });
}

function updateStats(data) {
    const today = new Date().toLocaleDateString('en-IN');
    let mCount = 0;
    let aCount = 0;
    
    // Filter for today's data
    const todayData = data.filter(row => {
        if (!row['Date']) return false;
        const rowDate = new Date(row['Date']).toLocaleDateString('en-IN');
        return rowDate === today;
    });

    todayData.forEach(row => {
        if (row['Morning Attendance'] === 'Present') mCount++;
        if (row['Afternoon Attendance'] === 'Present') aCount++;
    });

    statMorning.innerText = mCount;
    statAfternoon.innerText = aCount;
    statTotal.innerText = todayData.length; // Total unique students today
}

function exportToExcel() {
    const table = document.getElementById("attendanceTable");
    let rows = Array.from(table.rows);
    let csv = [];

    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll("td, th");
        
        for (let j = 0; j < cols.length; j++) {
            // Remove checkmarks and extra text for clean export
            let text = cols[j].innerText.replace(/✅|❌/g, '').trim();
            row.push('"' + text + '"');
        }
        csv.push(row.join(","));
    }

    downloadCSV(csv.join("\n"), `Attendance_${new Date().toLocaleDateString('en-IN')}.csv`);
}

function downloadCSV(csv, filename) {
    let csvFile;
    let downloadLink;

    csvFile = new Blob([csv], {type: "text/csv"});
    downloadLink = document.createElement("a");
    downloadLink.download = filename;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// Start
init();
