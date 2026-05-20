const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const fetch = require('node-fetch');

admin.initializeApp();

// 📦 Reusable: Fetch email list from Firestore by document ID
const getEmailList = async (docId) => {
  try {
    const snap = await admin.firestore().doc(`emailRecipients/${docId}`).get();
    return snap.exists ? snap.data().emails || [] : [];
  } catch (err) {
    console.warn(`⚠️ Failed to load email list: ${docId}`, err);
    return [];
  }
};

// 📅 Format Firestore Timestamp to DD/MM/YYYY
const formatDate = (date) => {
  try {
    return date?.toDate().toLocaleDateString('en-GB');
  } catch {
    return 'N/A';
  }
};

// 📎 Format purchase file info
const formatPurchaseInfo = (url, name) => {
  return url ? `${name || 'Purchase Request'}: ${url}` : 'N/A';
};

// 🔄 Retry wrapper for fetch
const sendWithRetry = async (mailOptions, maxRetries = 3) => {
  const endpoint = "https://project-ja0r1.vercel.app/api/sendEmail"; // ✅ fixed
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.API_SECRET || 'fleet-secret-2026'}`
        },
        body: JSON.stringify(mailOptions),
      });
      if (res.ok) {
        console.log(`✅ Email sent successfully on attempt ${attempt + 1}`);
        return true;
      } else {
        console.error(`❌ Attempt ${attempt + 1} failed: ${res.statusText}`);
      }
    } catch (err) {
      console.error(`❌ Attempt ${attempt + 1} error:`, err);
    }
    attempt++;
    await new Promise(r => setTimeout(r, 1000 * attempt)); // exponential backoff
  }
  console.error("❌ All retries failed. Logging to failedEmails collection.");
  await admin.firestore().collection("failedEmails").add({
    mailOptions,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return false;
};

// ✅ Job Creation Email
exports.sendJobCreatedEmail = onDocumentCreated({
  document: 'vehicles/{vehicleId}/jobs/{jobId}'
}, async (event) => {
  const jobData = event.data.data();
  const { vehicleId, jobId } = event.params;

  const vehicleSnap = await admin.firestore().doc(`vehicles/${vehicleId}`).get();
  let vehicleInfo = vehicleId;
  let toRecipients = [];
  let ccRecipients = [];

  let isTestVehicle = false;

  if (vehicleSnap.exists) {
    const v = vehicleSnap.data();
    isTestVehicle = v?.isTest === true;

    const type = v.type || 'Vehicle';
    const plate = v.plate || 'Unknown Plate';
    const notes = v.notes ? `(${v.notes})` : '';
    vehicleInfo = `${type} - ${plate} ${notes}`.trim();
  }

  const startDate = formatDate(jobData.startDate || jobData.createdAt);
  const prFileLink = formatPurchaseInfo(jobData.purchaseFileUrl, jobData.purchaseFileName);

  // ✅ TRANSFER JOBS
  if (jobData.transfer) {
    toRecipients = isTestVehicle
      ? await getEmailList('defaultTest')
      : await getEmailList('defaulttransfer');

    const ccRequester = jobData.requester ? [jobData.requester] : [];
    ccRecipients = ccRequester;

    if (toRecipients.length === 0) {
      console.warn('⚠️ No recipients found for transfer email. Skipping send.');
      return;
    }

    const mailOptions = {
      to: [...new Set(toRecipients)],
      cc: [...new Set(ccRecipients)],
      subject: `🚨 TRANSFER JOB CREATED: ${vehicleInfo}`,
      text: `Hello team,

As described in Subject, another vehicle part is requested to be TRANSFERRED to vehicle: ${vehicleInfo}. Waiting for your approbation.

🧾 Job ID: ${jobData.jobNumber || jobId}
👤 Requester: ${jobData.requester}
👷‍♂️ Mechanic: ${jobData.mechanic}
📋 Description: ${jobData.description}
📅 Start Date: ${startDate}
📎 Purchase Request File: ${prFileLink}

Thanks,
Fleet Management System`
    };

    console.log("📤 Sending transfer job email:", JSON.stringify(mailOptions, null, 2));
    await sendWithRetry(mailOptions);
    return;
  }

  // ✅ NORMAL JOBS
  if (!isTestVehicle) {
    toRecipients = await getEmailList('defaultPreApproval');

    const ownerEmail = vehicleSnap.data().recipientEmail;
    const ccVehicle = ownerEmail
      ? Array.isArray(ownerEmail)
        ? ownerEmail
        : [ownerEmail]
      : [];
    const ccDefault = await getEmailList('defaultAlways');
    ccRecipients = [...new Set([...ccVehicle, ...ccDefault])];
  } else {
    toRecipients = await getEmailList('defaultTest');
    ccRecipients = [];
  }

  const mailOptions = {
    to: [...new Set(toRecipients)],
    cc: [...new Set(ccRecipients)],
    subject: `🚠 FLEET APP: New Job Created for ${vehicleInfo}`,
    text: `Hello team,

A new job has been created for vehicle: ${vehicleInfo}

🧾 Job ID: ${jobData.jobNumber || jobId}
👤 Requester: ${jobData.requester}
👷‍♂️ Mechanic: ${jobData.mechanic}
📋 Description: ${jobData.description}
📅 Start Date: ${startDate}
📎 Purchase Request File: ${prFileLink}

Access the Fleet App:
https://mdc-001.github.io/fleet-madacan/

Thanks,
Fleet Management System`
  };

  console.log("📤 Sending normal job email:", JSON.stringify(mailOptions, null, 2));
  await sendWithRetry(mailOptions);
});
