const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
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
  const endpoint = "https://fleet-api-sigma.vercel.app/api/sendEmail"; // ✅ use your Vercel project
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

// ✅ Pre-Approval Notification Email
exports.sendPreApprovalNotification = onDocumentUpdated({
  document: 'vehicles/{vehicleId}/jobs/{jobId}'
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const { vehicleId, jobId } = event.params;

  // Trigger only when adminApprovalStatus flips to Approved
  if (before.adminApprovalStatus !== 'Approved' && after.adminApprovalStatus === 'Approved') {
    const jobData = after;

    const vehicleSnap = await admin.firestore().doc(`vehicles/${vehicleId}`).get();
    const v = vehicleSnap.exists ? vehicleSnap.data() : {};
    const isTestVehicle = v?.isTest === true;

    const type = v.type || 'Vehicle';
    const plate = v.plate || 'Unknown Plate';
    const notes = v.notes ? `(${v.notes})` : '';
    const vehicleInfo = `${type} - ${plate} ${notes}`.trim();

    const startDate = formatDate(jobData.startDate || jobData.createdAt);
    const prFileLink = formatPurchaseInfo(jobData.purchaseFileUrl, jobData.purchaseFileName);
    const approvedBy = jobData.approvedBy || 'N/A';
    const approvedAt = formatDate(jobData.approvedAt || new Date());
    const preApprovalMeta = `Approved by: ${approvedBy} on ${approvedAt}`;

    // Helpers
    const asArray = (x) => (Array.isArray(x) ? x : (x ? [x] : [])).filter(Boolean);
    const looksLikeEmail = (s) => typeof s === 'string' && s.includes('@');

    let toRecipients = [];
    let ccRecipients = [];

    // =============================
    // A) TRANSFER JOB PRE-APPROVAL
    // =============================
    if (jobData.transfer) {
      toRecipients = isTestVehicle
        ? await getEmailList('defaultTest')
        : await getEmailList('defaulttransfer');

      const requesterEmail = looksLikeEmail(jobData.requesterEmail || jobData.requester)
        ? (jobData.requesterEmail || jobData.requester)
        : null;
      ccRecipients = asArray(requesterEmail);

      if (toRecipients.length === 0 && ccRecipients.length > 0) {
        toRecipients = ccRecipients;
        ccRecipients = [];
      }
      if (toRecipients.length === 0) {
        toRecipients = await getEmailList('defaultAlways');
      }
      if (toRecipients.length === 0 && ccRecipients.length === 0) {
        console.error('❌ No recipients configured for TRANSFER pre-approval. Aborting send.');
        return;
      }

      const mailOptions = {
        to: [...new Set(toRecipients)],
        cc: [...new Set(ccRecipients)],
        subject: `🚨 TRANSFER PRE-APPROVED: ${vehicleInfo}`,
        text: `Hello team,

This TRANSFER job has been PRE-APPROVED for vehicle: ${vehicleInfo}.

🧾 Job ID: ${jobData.jobNumber || jobId}
👤 Requester: ${jobData.requester}
👷‍♂️ Mechanic: ${jobData.mechanic}
📋 Description: ${jobData.description}
📅 Start Date: ${startDate}
📎 Purchase Request File: ${prFileLink}

✅ ${preApprovalMeta}

Access the Fleet App:
https://mdc-001.github.io/fleet-madacan/

Thanks,
Fleet Management System`
      };

      console.log("📤 Sending transfer pre-approval email:", JSON.stringify(mailOptions, null, 2));
      await sendWithRetry(mailOptions);
      return;
    }

    // =============================
    // B) NORMAL PRE-APPROVAL
    // =============================
    if (isTestVehicle) {
      toRecipients = await getEmailList('defaultTest');
    } else {
      const pre = v.preApprovalEmail || await getEmailList('defaultPreApproval');
      const final = v.finalApprovalEmail || await getEmailList('defaultFinalApproval');
      ccRecipients = [...asArray(pre), ...asArray(final)];

      const verifiers = await getEmailList('defaultVerificator');
      const area = (v.Area || '').toUpperCase();

      let scmTeam = [];
      if (area === 'TNR') {
        scmTeam = [...await getEmailList('scmTNR'), ...await getEmailList('scmFleet')];
      } else if (area === 'TOAMASINA') {
        scmTeam = [...await getEmailList('scmTMM'), ...await getEmailList('scmFleet')];
      } else if (area === 'MORAMANGA') {
        scmTeam = [...await getEmailList('scmTMM'), ...await getEmailList('scmTNR'), ...await getEmailList('scmFleet')];
      } else {
        scmTeam = await getEmailList('scmTMM');
      }

      toRecipients = [...asArray(verifiers), ...asArray(scmTeam)];
    }

    if (toRecipients.length === 0 && ccRecipients.length === 0) {
      toRecipients = await getEmailList('defaultAlways');
    }
    if (toRecipients.length === 0 && ccRecipients.length === 0) {
      const requesterEmail = looksLikeEmail(jobData.requesterEmail || jobData.requester)
        ? (jobData.requesterEmail || jobData.requester)
        : null;
      ccRecipients = asArray(requesterEmail);
    }
    if (toRecipients.length === 0 && ccRecipients.length === 0) {
      console.error('❌ No recipients for NORMAL pre-approval. Aborting send.');
      return;
    }

    const mailOptions = {
      to: [...new Set(toRecipients)],
      cc: [...new Set(ccRecipients)],
      subject: `🛡️ FLEET APP: Job Pre-Approved for ${vehicleInfo}`,
      text: `Hello team,

A job has been PRE-APPROVED for vehicle: ${vehicleInfo}

SCM Team: "Please submit selected proforma when ready by replying to this email to Fleet maintenance"

🧾 Job ID: ${jobData.jobNumber || jobId}
📋 Description: ${jobData.description}
👤 Requester: ${jobData.requester}
👷‍♂️ Mechanic: ${jobData.mechanic}
📅 Start Date: ${startDate}
📎 Purchase Request File: ${prFileLink}

✅ ${preApprovalMeta}

Access the Fleet App:
https://mdc-001.github.io/fleet-madacan/

Thanks,
Fleet Management System`
    };

    console.log("📤 Sending normal pre-approval email:", JSON.stringify(mailOptions, null, 2));
    await sendWithRetry(mailOptions);
  }
});

// ✅ Updated Proforma Notification
exports.sendUpdatedProformaNotification = onDocumentUpdated({
  document: 'vehicles/{vehicleId}/jobs/{jobId}'
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const { vehicleId, jobId } = event.params;

  // Trigger only when updatedProformaUrl was just added
  if (!before.updatedProformaUrl && after.updatedProformaUrl) {
    const jobData = after;

    const vehicleSnap = await admin.firestore().doc(`vehicles/${vehicleId}`).get();
    const v = vehicleSnap.exists ? vehicleSnap.data() : {};
    const isTestVehicle = v?.isTest === true;

    const type = v.type || 'Vehicle';
    const plate = v.plate || 'Unknown Plate';
    const notes = v.notes ? `(${v.notes})` : '';
    const vehicleInfo = `${type} - ${plate} ${notes}`.trim();

    let toRecipients = [];
    let ccRecipients = [];

    if (isTestVehicle) {
      toRecipients = await getEmailList('defaultTest');
      console.log(`🚧 Test vehicle: sending Updated Proforma email ONLY to defaultTest:`, toRecipients);
    } else {
      toRecipients = [
        ...(await getEmailList('defaultFinalApproval')),
        ...(await getEmailList('defaultVerificator'))
      ];
      ccRecipients = await getEmailList('defaultPreApproval');
    }

    const startDate = formatDate(jobData.startDate || jobData.createdAt);
    const prFileLink = formatPurchaseInfo(jobData.purchaseFileUrl, jobData.purchaseFileName);
    const proformaLink = formatPurchaseInfo(jobData.updatedProformaUrl, jobData.updatedProformaFileName);

    const mailOptions = {
      to: [...new Set(toRecipients)],
      cc: [...new Set(ccRecipients)],
      subject: `📤 FLEET APP: Updated Proforma uploaded for ${vehicleInfo}`,
      text: `Hello team,

A job for vehicle ${vehicleInfo} has received an UPDATED PROFORMA file. Awaiting further instructions and approbation.

🧾 Job ID: ${jobData.jobNumber || jobId}
📋 Description: ${jobData.description}
👤 Requester: ${jobData.requester}
👷‍♂️ Mechanic: ${jobData.mechanic}
📅 Start Date: ${startDate}
📎 Purchase Request File: ${prFileLink}
📎 Proforma: ${proformaLink}

Access the Fleet App:
https://mdc-001.github.io/fleet-madacan/

Thanks,
Fleet Management System`
    };

    console.log("📤 Sending updated proforma email:", JSON.stringify(mailOptions, null, 2));
    await sendWithRetry(mailOptions);
  }
});

// ✅ Final Approval Notification Email
exports.sendFinalApprovalNotification = onDocumentUpdated({
  document: 'vehicles/{vehicleId}/jobs/{jobId}'
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const { vehicleId, jobId } = event.params;

  // Trigger only when finalApprovalStatus flips to Approved
  if (before.finalApprovalStatus !== 'Approved' && after.finalApprovalStatus === 'Approved') {
    const jobData = after;

    const vehicleSnap = await admin.firestore().doc(`vehicles/${vehicleId}`).get();
    const v = vehicleSnap.exists ? vehicleSnap.data() : {};
    const isTestVehicle = v?.isTest === true;

    const type = v.type || 'Vehicle';
    const plate = v.plate || 'Unknown Plate';
    const notes = v.notes ? `(${v.notes})` : '';
    const vehicleInfo = `${type} - ${plate} ${notes}`.trim();

    const startDate = formatDate(jobData.startDate || jobData.createdAt);
    const prFileLink = formatPurchaseInfo(jobData.purchaseFileUrl, jobData.purchaseFileName);
    const proformaLink = formatPurchaseInfo(jobData.updatedProformaUrl, jobData.updatedProformaFileName);

    const preApprovedBy = jobData.preApprovedBy || 'N/A';
    const preApprovedAt = formatDate(jobData.preApprovedAt || new Date());
    const finalApprovedBy = jobData.finalApprovedBy || 'N/A';
    const finalApprovedAt = formatDate(jobData.finalApprovedAt || new Date());

    const approvalNoteText = jobData.approvalNote
      ? `\n\n📝 Approbation Instructions:\n${jobData.approvalNote}\n`
      : '';

    let toRecipients = [];
    let ccRecipients = [];

    // =============================
    // A) TRANSFER JOB FINAL APPROVAL
    // =============================
    if (jobData.transfer) {
      toRecipients = isTestVehicle
        ? await getEmailList('defaultTest')
        : await getEmailList('defaulttransfer');

      ccRecipients = jobData.requester ? [jobData.requester] : [];

      const mailOptions = {
        to: [...new Set(toRecipients)],
        cc: [...new Set(ccRecipients)],
        subject: `🚨 TRANSFER FINAL APPROVED: ${vehicleInfo}`,
        text: `Hello team,

This TRANSFER job has been Pre-approved & FINAL APPROVED for vehicle: ${vehicleInfo}. Please proceed to the transfer.

🧾 Job ID: ${jobData.jobNumber || jobId}
📋 Description: ${jobData.description}
👤 Requester: ${jobData.requester}
👷‍♂️ Mechanic: ${jobData.mechanic}
📅 Start Date: ${startDate}
📎 Purchase Request File: ${prFileLink}
📎 Proforma: ${proformaLink}

${approvalNoteText}

✅ Pre-approved by: ${preApprovedBy} on ${preApprovedAt}
✅ Final Approved by: ${finalApprovedBy} on ${finalApprovedAt}

Access the Fleet App:
https://mdc-001.github.io/fleet-madacan/

Thanks,
Fleet Management System`
      };

      console.log("📤 Sending transfer final approval email:", JSON.stringify(mailOptions, null, 2));
      await sendWithRetry(mailOptions);
      return;
    }

    // =============================
    // B) NORMAL FINAL APPROVAL
    // =============================
    let recipientEmails = [];
    let scmRecipients = [];

    if (isTestVehicle) {
      recipientEmails = await getEmailList('defaultTest');
      console.log(`🚧 Test vehicle: sending FINAL APPROVAL email ONLY to defaultTest:`, recipientEmails);
    } else {
      recipientEmails = await getEmailList('defaultAlways');

      const pre = v?.preApprovalEmail || await getEmailList('defaultPreApproval');
      const final = v?.finalApprovalEmail || await getEmailList('defaultFinalApproval');
      const owner = v?.recipientEmail;

      recipientEmails = [
        ...recipientEmails,
        ...(Array.isArray(pre) ? pre : [pre]),
        ...(Array.isArray(final) ? final : [final]),
        ...(Array.isArray(owner) ? owner : owner ? [owner] : [])
      ];

      const area = (v?.Area || '').toUpperCase();

      if (area === 'TNR') {
        scmRecipients = [...await getEmailList('scmTNR'), ...await getEmailList('scmFleet')];
      } else if (area === 'TOAMASINA') {
        scmRecipients = [...await getEmailList('scmTMM'), ...await getEmailList('scmFleet')];
      } else if (area === 'MORAMANGA') {
        scmRecipients = [...await getEmailList('scmTMM'), ...await getEmailList('scmTNR'), ...await getEmailList('scmFleet')];
      } else {
        scmRecipients = await getEmailList('scmTMM');
      }
    }

    const mailOptions = {
      to: [...new Set(isTestVehicle ? recipientEmails : scmRecipients)],
      cc: [...new Set(isTestVehicle ? [] : recipientEmails)],
      subject: `✅ FLEET APP: Final Approval for ${vehicleInfo}`,
      text: `Hello team,

A job has been Pre-approved & FINAL APPROVED for vehicle: ${vehicleInfo}, please proceed with P.O.

🧾 Job ID: ${jobData.jobNumber || jobId}
📋 Description: ${jobData.description}
👤 Requester: ${jobData.requester}
👷‍♂️ Mechanic: ${jobData.mechanic}
📅 Start Date: ${startDate}
📎 Purchase Request File: ${prFileLink}
📎 Proforma: ${proformaLink}

${approvalNoteText}

✅ Pre-approved by: ${preApprovedBy} on ${preApprovedAt}
✅ Final Approved by: ${finalApprovedBy} on ${finalApprovedAt}

Access the Fleet App:
https://mdc-001.github.io/fleet-madacan/

Thanks,
Fleet Management System`
    };

    console.log("📤 Sending final approval email:", JSON.stringify(mailOptions, null, 2));
    await sendWithRetry(mailOptions);
  }
});

// ✅ Final Approval Rejection Notification
exports.sendFinalRejectionNotification = onDocumentUpdated({
  document: 'vehicles/{vehicleId}/jobs/{jobId}'
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const { vehicleId, jobId } = event.params;

  // Trigger only when finalApprovalStatus flips to Rejected
  if (before.finalApprovalStatus !== 'Rejected' && after.finalApprovalStatus === 'Rejected') {
    const jobData = after;

    const vehicleSnap = await admin.firestore().doc(`vehicles/${vehicleId}`).get();
    const v = vehicleSnap.exists ? vehicleSnap.data() : {};
    const isTestVehicle = v?.isTest === true;

    const type = v.type || 'Vehicle';
    const plate = v.plate || 'Unknown Plate';
    const notes = v.notes ? `(${v.notes})` : '';
    const vehicleInfo = `${type} - ${plate} ${notes}`.trim();

    const startDate = formatDate(jobData.startDate || jobData.createdAt);
    const prFileLink = formatPurchaseInfo(jobData.purchaseFileUrl, jobData.purchaseFileName);
    const proformaLink = formatPurchaseInfo(jobData.updatedProformaUrl, jobData.updatedProformaFileName);

    const rejectedBy = jobData.finalApprovedBy || jobData.approvedBy || 'N/A';
    const rejectedAt = formatDate(jobData.finalApprovedAt || jobData.approvedAt || new Date());
    const approbationNote = jobData.approvalNote
      ? `\n\n📝 Approbation Instructions:\n${jobData.approvalNote}`
      : '';

    let toRecipients = [];
    let ccRecipients = [];

    // =============================
    // A) TRANSFER JOB FINAL REJECTION
    // =============================
    if (jobData.transfer) {
      toRecipients = isTestVehicle
        ? await getEmailList('defaultTest')
        : await getEmailList('defaulttransfer');

      ccRecipients = jobData.requester ? [jobData.requester] : [];

      const mailOptions = {
        to: [...new Set(toRecipients)],
        cc: [...new Set(ccRecipients)],
        subject: `❌ TRANSFER FINAL REJECTED: ${vehicleInfo}`,
        text: `Hello team,

This TRANSFER job has been FINAL REJECTED for vehicle: ${vehicleInfo}.

🧾 Job ID: ${jobData.jobNumber || jobId}
📋 Description: ${jobData.description}
👤 Requester: ${jobData.requester}
👷‍♂️ Mechanic: ${jobData.mechanic}
📅 Start Date: ${startDate}
📎 Purchase Request File: ${prFileLink}
📎 Proforma: ${proformaLink}

❌ Rejected by: ${rejectedBy} on ${rejectedAt}

${approbationNote}

Thanks,
Fleet Management System`
      };

      console.log("📤 Sending transfer final rejection email:", JSON.stringify(mailOptions, null, 2));
      await sendWithRetry(mailOptions);
      return;
    }

    // =============================
    // B) NORMAL FINAL REJECTION
    // =============================
    let recipientEmails = [];

    if (isTestVehicle) {
      recipientEmails = await getEmailList('defaultTest');
      console.log(`🚧 Test vehicle: sending Final Rejection email ONLY to defaultTest:`, recipientEmails);
    } else {
      const always = await getEmailList('defaultAlways');
      const pre = v.preApprovalEmail || await getEmailList('defaultPreApproval');
      const final = v.finalApprovalEmail || await getEmailList('defaultFinalApproval');
      const owner = v.recipientEmail;

      const additional = [
        ...(Array.isArray(pre) ? pre : [pre]),
        ...(Array.isArray(final) ? final : [final]),
        ...(Array.isArray(owner) ? owner : owner ? [owner] : [])
      ];

      const area = (v.Area || '').toUpperCase();
      const scmFallback = await getEmailList(area === 'TNR' ? 'scmTNR' : 'scmTMM');

      recipientEmails = [
        ...always,
        ...additional.filter(email => !scmFallback.includes(email))
      ];
    }

    const mailOptions = {
      to: [...new Set(recipientEmails)],
      subject: `❌ FLEET APP: Final Approval REJECTED for ${vehicleInfo}`,
      text: `Hello team,

The FINAL APPROVAL for a job has been REJECTED for vehicle: ${vehicleInfo}.

🧾 Job ID: ${jobData.jobNumber || jobId}
📋 Description: ${jobData.description}
👤 Requester: ${jobData.requester}
👷‍♂️ Mechanic: ${jobData.mechanic}
📅 Start Date: ${startDate}
📎 Purchase Request File: ${prFileLink}
📎 Proforma: ${proformaLink}

❌ Rejected by: ${rejectedBy} on ${rejectedAt}

${approbationNote}

Access the Fleet App:
https://mdc-001.github.io/fleet-madacan/

Thanks,
Fleet Management System`
    };

    console.log("📤 Sending final rejection email:", JSON.stringify(mailOptions, null, 2));
    await sendWithRetry(mailOptions);
  }
});

// ✅ PR Upload Notification
exports.sendPRUploadNotification = onDocumentUpdated({
  document: 'vehicles/{vehicleId}/jobs/{jobId}'
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const { vehicleId, jobId } = event.params;

  // Trigger only when purchaseFileUrl was newly added
  if (!before.purchaseFileUrl && after.purchaseFileUrl) {
    const jobData = after;

    const vehicleSnap = await admin.firestore().doc(`vehicles/${vehicleId}`).get();
    const v = vehicleSnap.exists ? vehicleSnap.data() : {};
    const isTestVehicle = v?.isTest === true;

    const type = v.type || 'Vehicle';
    const plate = v.plate || 'Unknown Plate';
    const notes = v.notes ? `(${v.notes})` : '';
    const vehicleInfo = `${type} - ${plate} ${notes}`.trim();

    let recipientEmails = [];

    if (isTestVehicle) {
      recipientEmails = await getEmailList('defaultTest');
      console.log(`🚧 Test vehicle: sending PR Upload email ONLY to defaultTest:`, recipientEmails);
    } else {
      recipientEmails = await getEmailList('defaultAlways');

      if (v.recipientEmail) {
        recipientEmails.push(...(Array.isArray(v.recipientEmail) ? v.recipientEmail : [v.recipientEmail]));
      }
    }

    const startDate = formatDate(jobData.startDate || jobData.createdAt);
    const prFileLink = formatPurchaseInfo(jobData.purchaseFileUrl, jobData.purchaseFileName);

    const mailOptions = {
      to: [...new Set(recipientEmails)],
      subject: `📎 FLEET APP: Job updated with PR Uploaded for ${vehicleInfo}`,
      text: `Hello team,

A Purchase Request file has been uploaded for vehicle: ${vehicleInfo}.

🧾 Job ID: ${jobData.jobNumber || jobId}
📋 Description: ${jobData.description}
👤 Requester: ${jobData.requester}
👷‍♂️ Mechanic: ${jobData.mechanic}
📅 Start Date: ${startDate}
📎 Purchase Request File: ${prFileLink}

Access the Fleet App:
https://mdc-001.github.io/fleet-madacan/

Thanks,
Fleet Management System`
    };

    console.log("📤 Sending PR upload email:", JSON.stringify(mailOptions, null, 2));
    await sendWithRetry(mailOptions);
  }
});

 

// ✅ Tire Service Creation Email
exports.sendTireServiceCreatedEmail = onDocumentCreated({
  document: 'customerServiceTracking/{requestId}'
}, async (event) => {
  const requestData = event.data.data();
  const { requestId } = event.params;

  // Load recipients from Firestore
  const recipientsSnap = await admin.firestore().doc('emailRecipients/customerService').get();
  if (!recipientsSnap.exists) {
    console.warn('⚠️ No recipients configured for customerService');
    return;
  }
  const recipients = recipientsSnap.data();

  // For tire service → send to both user + scm
  const toRecipients = [
    ...(recipients.user || []),
    ...(recipients.scm || [])
  ];

  if (toRecipients.length === 0) {
    console.warn('⚠️ No recipients found for tire service. Skipping send.');
    return;
  }

  const mailOptions = {
    to: [...new Set(toRecipients)],
    subject: `🛞 New Tire Service Request - ${requestData.plate || 'Unknown Plate'}`,
    text: `Hello team,

A new Tire Service request has been created.

🧾 Request ID: ${requestId}
🚗 Plate: ${requestData.plate || 'N/A'}
👤 Driver: ${requestData.driverName || 'N/A'}
🏢 Service Provider: ${requestData.serviceProvider || 'N/A'}
📅 Created At: ${formatDate(requestData.createdAt)}

Please log in to Fleet App to review and take action.

Thanks,
Fleet Management System`
  };

  console.log("📤 Sending tire service email:", JSON.stringify(mailOptions, null, 2));
  await sendWithRetry(mailOptions);
});
