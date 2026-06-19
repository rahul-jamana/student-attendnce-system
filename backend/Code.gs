const SCRIPT_VERSION = "1.0";

function setupSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const headers = [
    "Date",
    "Roll Number",
    "Student Name",
    "Branch",
    "Semester",
    "Morning Attendance",
    "Morning Time",
    "Afternoon Attendance",
    "Afternoon Time"
  ];
  // Set headers if the sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    // Add some styling to headers
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#d9ead3");
  }
}

function doGet(e) {
  // Handle preflight CORS request or simple GET request for reading data
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const headers = data[0];
  const records = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const record = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = row[j];
    }
    records.push(record);
  }

  return ContentService.createTextOutput(JSON.stringify({ success: true, data: records }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    // Parse the incoming JSON data
    let requestData;
    if (e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Invalid request format." }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const {
      date,
      rollNumber,
      studentName,
      branch,
      semester,
      session, // "Morning" or "Afternoon"
      time
    } = requestData;

    if (!date || !rollNumber || !session) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Missing required fields." }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const data = sheet.getDataRange().getValues();
    let rowIndexToUpdate = -1;
    let existingRow = null;

    // Find if the student already has a record for today
    for (let i = 1; i < data.length; i++) {
      // Assuming Column A (index 0) is Date and Column B (index 1) is Roll Number
      // String comparison for safety
      if (String(data[i][0]) === String(date) && String(data[i][1]).toLowerCase() === String(rollNumber).toLowerCase()) {
        rowIndexToUpdate = i + 1; // 1-based index for Google Sheets, +1 because data array is 0-indexed
        existingRow = data[i];
        break;
      }
    }

    if (rowIndexToUpdate !== -1) {
      // Record exists for today
      if (session === "Morning") {
        if (existingRow[5] === "Present") {
          return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Attendance already marked." }))
            .setMimeType(ContentService.MimeType.JSON);
        } else {
          // Update Morning
          sheet.getRange(rowIndexToUpdate, 6).setValue("Present");
          sheet.getRange(rowIndexToUpdate, 7).setValue(time);
        }
      } else if (session === "Afternoon") {
        if (existingRow[7] === "Present") {
          return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Attendance already marked." }))
            .setMimeType(ContentService.MimeType.JSON);
        } else {
          // Update Afternoon
          sheet.getRange(rowIndexToUpdate, 8).setValue("Present");
          sheet.getRange(rowIndexToUpdate, 9).setValue(time);
        }
      }
    } else {
      // Create new record
      const newRow = [
        date,
        rollNumber,
        studentName,
        branch,
        semester,
        session === "Morning" ? "Present" : "", // Morning Attendance
        session === "Morning" ? time : "",      // Morning Time
        session === "Afternoon" ? "Present" : "",// Afternoon Attendance
        session === "Afternoon" ? time : ""     // Afternoon Time
      ];
      sheet.appendRow(newRow);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Attendance Marked Successfully" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Server error: " + error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Function to allow CORS by adding headers to the response
function handleResponse(response) {
  return ContentService.createTextOutput(response)
    .setMimeType(ContentService.MimeType.JSON);
}

// Ensure OPTIONS requests (CORS preflight) are handled gracefully
function doOptions(e) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.JSON);
}
