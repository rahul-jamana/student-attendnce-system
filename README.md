# Smart QR Attendance System

A complete QR Code Attendance Management System using HTML, CSS, JavaScript, Google Sheets, and Google Apps Script.

## Features
- **Admin Dashboard**: Generate session-specific QR codes with an embedded location. View and export attendance data.
- **Student Scanner**: Scan QR codes, validate location within a 50-meter radius, and submit attendance securely.
- **Google Sheets Backend**: Uses a serverless Google Apps Script to store data directly in Google Sheets.
- **Duplicate Prevention**: Client-side and server-side checks to prevent multiple submissions per session.
- **GPS Validation**: Ensures students are physically present (within 50 meters of the teacher) when marking attendance.

---

## Setup Instructions

### 1. Set up the Google Sheet Database
1. Go to [Google Sheets](https://sheets.google.com) and create a new blank spreadsheet. Name it "Attendance DB" (or anything you prefer).
2. Go to **Extensions** > **Apps Script**.
3. Delete any code in the editor and copy-paste the entire contents of `backend/Code.gs` into the script editor.
4. Click the **Save** icon (or press Ctrl+S).
5. At the top of the editor, there is a dropdown menu showing functions. Select the `setupSheet` function and click **Run**. 
6. Google will ask for permissions. Click **Review Permissions**, select your Google account, click **Advanced**, and then click **Go to Untitled project (unsafe)** to allow it to modify your spreadsheet.
7. Check your Google Sheet; the headers should now be created and styled.

### 2. Deploy the Google Apps Script
1. In the Apps Script editor, click the blue **Deploy** button at the top right, and select **New deployment**.
2. Click the gear icon ⚙️ next to "Select type" and choose **Web app**.
3. Fill in the details:
   - **Description**: Attendance API
   - **Execute as**: Me (your email)
   - **Who has access**: Anyone
4. Click **Deploy**.
5. Copy the **Web app URL** provided. It will look something like: `https://script.google.com/macros/s/.../exec`.

### 3. Configure the Frontend
1. Open `admin/script.js` in a text editor.
2. At the top of the file, find the line:
   ```javascript
   const APPS_SCRIPT_URL = "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE";
   ```
3. Replace `"YOUR_GOOGLE_APPS_SCRIPT_URL_HERE"` with the Web app URL you copied in the previous step.
4. Save the file.
5. Repeat this exact process for `student/script.js`.

### 4. Hosting the System
**IMPORTANT: Modern web browsers require sites to be served over a secure `HTTPS` connection to allow access to the device Camera and GPS Location.**

You can host these HTML folders on any static file hosting service for free:
- **GitHub Pages**: Upload the `admin` and `student` folders to a GitHub repository and enable GitHub Pages.
- **Vercel / Netlify**: Drag and drop the folders into their deployment dashboard.

**For Local Testing:**
If you want to test on your local machine with your phone:
1. Use an extension like Live Server in VS Code, or run `npx serve` in your folder.
2. To test from a phone on the same Wi-Fi network, use a secure tunneling tool like **ngrok** (`ngrok http 5500`) to get an `https://` URL.

---

## Workflow
1. **Teacher**: Opens the Admin Dashboard, allows location access, and clicks **Generate Morning QR**. A QR code appears with a 10-minute timer.
2. **Student**: Opens the Student Scanner app, allows camera and location access. Scans the teacher's QR code.
3. **Validation**: The student's app calculates the distance between the teacher's saved location (inside the QR) and the student's current location. If within 50 meters, the form opens.
4. **Submission**: The student enters their roll number and details. The data is sent securely to the Google Sheet.

