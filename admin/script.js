// ==========================================
// CONFIGURATION
// Paste your Google Apps Script Web App URL here
const APPS_SCRIPT_URL = "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE";
// ==========================================

// State
let adminLat = null;
let adminLng = null;
let qrCode = null;
let countdownInterval = null;

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

const statMorning = document.getElementById('statMorning');
const statAfternoon = document.getElementById('statAfternoon');
const statTotal = document.getElementById('statTotal');

// Initialize
function init() {
    getAdminLocation();
    fetchData();

    btnMorning.addEventListener('click', () => generateQR('Morning'));
    btnAfternoon.addEventListener('click', () => generateQR('Afternoon'));
    btnStopSession.addEventListener('click', stopSession);
    btnRefresh.addEventListener('click', fetchData);
    btnExport.addEventListener('click', exportToExcel);
}

function getAdminLocation() {
    if (!navigator.geolocation) {
        showLocationError("Geolocation is not supported by your browser.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            adminLat = position.coords.latitude;
            adminLng = position.coords.longitude;
            
            locationStatus.className = 'location-status success';
            locationText.innerText = `Location Acquired: ${adminLat.toFixed(5)}, ${adminLng.toFixed(5)}`;
            
            // Enable buttons
            btnMorning.disabled = false;
            btnAfternoon.disabled = false;
        },
        (error) => {
            let msg = "Failed to get location.";
            if (error.code === 1) msg = "Location access denied. Please allow location access.";
            else if (error.code === 2) msg = "Position unavailable.";
            else if (error.code === 3) msg = "Location request timed out.";
            showLocationError(msg);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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

    // 10 minutes expiry
    const expiryTime = Date.now() + 10 * 60 * 1000;
    const token = Math.random().toString(36).substring(2, 15);

    const qrData = {
        session: session,
        lat: adminLat,
        lng: adminLng,
        exp: expiryTime,
        token: token,
        date: new Date().toLocaleDateString('en-IN')
    };

    qrSessionTitle.innerText = `${session} Session Active`;
    qrSessionTitle.style.color = session === 'Morning' ? 'var(--secondary)' : 'var(--primary)';
    
    qrCode = new QRCode(qrcodeElement, {
        text: JSON.stringify(qrData),
        width: 300,
        height: 300,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
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
