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

// ✅ Revised Job Creation Email using Vercel endpoint
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
    if (isTestVehicle) {
      toRecipients = await getEmailList('defaultTest');
    } else {
      toRecipients = await getEmailList('defaulttransfer');
    }

    const ccRequester = jobData.requester ? [jobData.requester] : [];
    ccRecipients = ccRequester;

    if (toRecipients.length === 0) {
      console.warn('⚠️ No recipients found for transfer email. Skipping send.');
      return;
    }

    const mailOptions = {
      to: toRecipients,
      cc: ccRecipients,
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

    try {
      await fetch("https://fleet-mail-service.vercel.app/api/sendEmail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.API_SECRET}` // optional
        },
        body: JSON.stringify(mailOptions),
      });
      console.log('✅ Transfer job email forwarded to Vercel');
    } catch (error) {
      console.error('❌ Failed to call Vercel endpoint:', error);
    }

    return;
  }

  // ✅ NORMAL JOBS (transfer = false)
  if (!isTestVehicle) {
    toRecipients = await getEmailList('defaultPreApproval');

    const ownerEmail = vehicleSnap.data().recipientEmail;
    const ccVehicle = ownerEmail
      ? Array.isArray(ownerEmail)
        ? ownerEmail
        : [ownerEmail]
      : [];
    const ccDefault = await getEmailList('defaultAlways');
    ccRecipients = [...ccVehicle, ...ccDefault];
  } else if (isTestVehicle) {
    toRecipients = await getEmailList('defaultTest');
    ccRecipients = [];
  }

  const mailOptions = {
    to: toRecipients,
    cc: ccRecipients,
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

  try {
    await fetch("https://fleet-mail-service.vercel.app/api/sendEmail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.API_SECRET}` // optional
      },
      body: JSON.stringify(mailOptions),
    });
    console.log('✅ Normal job creation email forwarded to Vercel');
  } catch (error) {
    console.error('❌ Failed to call Vercel endpoint:', error);
  }
});
