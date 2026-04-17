const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');

admin.initializeApp();

const EMAIL_USER = defineSecret('EMAIL_USER');
const EMAIL_PASS = defineSecret('EMAIL_PASS');

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

// 📧 Nodemailer transporter
const createTransporter = () => nodemailer.createTransport({
  host: 'mail.madacan.com',
  port: 587,
  secure: false,
  auth: {
    user: EMAIL_USER.value(),
    pass: EMAIL_PASS.value(),
  },
  tls: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: false
  }
});
// ✅ Revised 1. Job Creation Email with updated recipients

exports.sendJobCreatedEmail = onDocumentCreated({
  document: 'vehicles/{vehicleId}/jobs/{jobId}',
  secrets: [EMAIL_USER, EMAIL_PASS]
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

  const transporter = createTransporter();
  const startDate = formatDate(jobData.startDate || jobData.createdAt);
  const prFileLink = formatPurchaseInfo(jobData.purchaseFileUrl, jobData.purchaseFileName);

  // ✅ TRANSFER JOBS
  if (jobData.transfer) {
    if (isTestVehicle) {
      toRecipients = await getEmailList('defaultTest'); // test vehicles
    } else {
      toRecipients = await getEmailList('defaulttransfer'); // normal transfer
    }

    // Add requester to CC
    const ccRequester = jobData.requester ? [jobData.requester] : [];
    ccRecipients = ccRequester;

    if (toRecipients.length === 0) {
      console.warn('⚠️ No recipients found for transfer email. Skipping send.');
      return;
    }

    const mailOptions = {
      from: '"Fleet App" <noreply@madacan.com>',
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
      await transporter.sendMail(mailOptions);
      console.log('✅ Transfer job email sent to:', toRecipients, '| CC:', ccRecipients);
    } catch (error) {
      console.error('❌ Failed to send transfer job email:', error);
      console.error('❌ MailOptions content:', JSON.stringify(mailOptions, null, 2));
    }

    return; // skip the normal job creation email
  }

  // ✅ NORMAL JOBS (transfer = false)
  if (!isTestVehicle) {
    // To: defaultPreApproval
    toRecipients = await getEmailList('defaultPreApproval');

    // CC: vehicle recipient + defaultAlways
    const ownerEmail = vehicleSnap.data().recipientEmail;
    const ccVehicle = ownerEmail
      ? Array.isArray(ownerEmail)
        ? ownerEmail
        : [ownerEmail]
      : [];
    const ccDefault = await getEmailList('defaultAlways');
    ccRecipients = [...ccVehicle, ...ccDefault];
  } else if (isTestVehicle) {
    toRecipients = await getEmailList('defaultTest'); // test vehicles
    ccRecipients = [];
  }

  const mailOptions = {
    from: '"Fleet App" <noreply@madacan.com>',
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

Thanks,
Fleet Management System`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Normal job creation email sent (To):', toRecipients, '| CC:', ccRecipients);
  } catch (error) {
    console.error('❌ Failed to send normal job creation email:', error);
    console.error('❌ MailOptions content:', JSON.stringify(mailOptions, null, 2));
  }
});


// ✅ 2. FINAL PRE-APPROVAL EMAIL
exports.sendPreApprovalNotification = onDocumentUpdated({
  document: 'vehicles/{vehicleId}/jobs/{jobId}',
  secrets: [EMAIL_USER, EMAIL_PASS]
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

    const transporter = createTransporter();
    const startDate = formatDate(jobData.startDate || jobData.createdAt);
    const prFileLink = formatPurchaseInfo(jobData.purchaseFileUrl, jobData.purchaseFileName);
    const approvedBy = jobData.approvedBy || 'N/A';
    const approvedAt = formatDate(jobData.approvedAt || new Date());
    const preApprovalMeta = `Approved by: ${approvedBy} on ${approvedAt}`;

    // Helper: normalize to array & strip falsy
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

      // CC requester (if looks like an email)
      const requesterEmail = looksLikeEmail(jobData.requesterEmail || jobData.requester)
        ? (jobData.requesterEmail || jobData.requester)
        : null;
      ccRecipients = asArray(requesterEmail);

      // Fallbacks to avoid "No recipients defined"
      if (toRecipients.length === 0 && ccRecipients.length > 0) {
        // move requester to "to" if defaulttransfer is empty
        toRecipients = ccRecipients;
        ccRecipients = [];
      }
      if (toRecipients.length === 0) {
        // final fallback to defaultAlways (if configured)
        toRecipients = await getEmailList('defaultAlways');
      }
      if (toRecipients.length === 0 && ccRecipients.length === 0) {
        console.error('❌ No recipients configured for TRANSFER pre-approval. Aborting send.');
        return;
      }

      const mailOptions = {
        from: '"Fleet App" <noreply@madacan.com>',
        to: toRecipients,
        cc: ccRecipients,
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

Thanks,
Fleet Management System`
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Transfer pre-approval email sent to:', toRecipients, '| CC:', ccRecipients);
      } catch (error) {
        console.error('❌ Failed to send transfer pre-approval email:', error);
        console.error('❌ MailOptions content:', JSON.stringify(mailOptions, null, 2));
      }
      return; // skip normal branch
    }

    // =============================
    // B) NORMAL PRE-APPROVAL
    // =============================
    if (isTestVehicle) {
      toRecipients = await getEmailList('defaultTest');
    } else {
      // CC: Pre & Final approval roles (vehicle-specific override OR defaults)
      const pre = v.preApprovalEmail || await getEmailList('defaultPreApproval');
      const final = v.finalApprovalEmail || await getEmailList('defaultFinalApproval');
      ccRecipients = [...asArray(pre), ...asArray(final)];

      // TO: Verificators + SCM by area
     const verifiers = await getEmailList('defaultVerificator');
const area = (v.Area || '').toUpperCase();

let scmTeam = [];

if (area === 'TNR') {
  const scmTNR = await getEmailList('scmTNR');
  const scmFleet = await getEmailList('scmFleet');
  scmTeam = [...scmTNR, ...scmFleet];
} else if (area === 'TOAMASINA') {
  const scmTMM = await getEmailList('scmTMM');
  const scmFleet = await getEmailList('scmFleet');
  scmTeam = [...scmTMM, ...scmFleet];
} else if (area === 'MORAMANGA') {
  const scmTMM = await getEmailList('scmTMM');
  const scmTNR = await getEmailList('scmTNR');
  const scmFleet = await getEmailList('scmFleet');
  scmTeam = [...scmTMM, ...scmTNR, ...scmFleet];
} else {
  const fallbackDoc = area === 'TNR' ? 'scmTNR' : 'scmTMM';
  scmTeam = await getEmailList(fallbackDoc);
}

toRecipients = [...asArray(verifiers), ...asArray(scmTeam)];

    }

    // Fallbacks to guarantee at least one recipient overall
    if (toRecipients.length === 0 && ccRecipients.length === 0) {
      // try defaultAlways
      toRecipients = await getEmailList('defaultAlways');
    }
    if (toRecipients.length === 0 && ccRecipients.length === 0) {
      // last-ditch: requester (if email)
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
      from: '"Fleet App" <noreply@madacan.com>',
      to: toRecipients,
      cc: ccRecipients,
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

Thanks,
Fleet Management System`
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('✅ Pre-approval email sent to (To):', toRecipients, '| Cc:', ccRecipients);
    } catch (error) {
      console.error('❌ Failed to send pre-approval email:', error);
      console.error('❌ MailOptions content:', JSON.stringify(mailOptions, null, 2));
    }
  }
});


// ✅ FINAL APPROVAL EMAIL with Transfer rule
exports.sendFinalApprovalNotification = onDocumentUpdated({
  document: 'vehicles/{vehicleId}/jobs/{jobId}',
  secrets: [EMAIL_USER, EMAIL_PASS]
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const { vehicleId, jobId } = event.params;

  // ✅ Check if final approval just happened
  if (before.finalApprovalStatus !== 'Approved' && after.finalApprovalStatus === 'Approved') {
    const jobData = after;
    let vehicleInfo = vehicleId;
    let toRecipients = [];
    let ccRecipients = [];
    let isTestVehicle = false;

    // Fetch vehicle document safely
    const vehicleSnap = await admin.firestore().doc(`vehicles/${vehicleId}`).get();
    let v = null;
    if (vehicleSnap.exists) {
      v = vehicleSnap.data();
      isTestVehicle = v?.isTest === true;
      const type = v.type || 'Vehicle';
      const plate = v.plate || 'Unknown Plate';
      const notes = v.notes ? `(${v.notes})` : '';
      vehicleInfo = `${type} - ${plate} ${notes}`.trim();
    }

    const transporter = createTransporter();
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

    // ✅ TRANSFER JOB FINAL APPROVAL
    if (jobData.transfer) {
      if (isTestVehicle) {
        toRecipients = await getEmailList('defaultTest');
      } else {
        toRecipients = await getEmailList('defaulttransfer');
      }
      // CC: requester only
      ccRecipients = jobData.requester ? [jobData.requester] : [];

      const mailOptions = {
        from: '"Fleet App" <noreply@madacan.com>',
        to: toRecipients,
        cc: ccRecipients,
        subject: `🚨 TRANSFER FINAL APPROVED: ${vehicleInfo}`,
        text: `Hello team,

This TRANSFER job Pre-approved & FINAL APPROVED for vehicle: ${vehicleInfo}. Please proceed to the transfer

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

Thanks,
Fleet Management System`
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Transfer final approval email sent to:', toRecipients, '| CC:', ccRecipients);
      } catch (error) {
        console.error('❌ Failed to send transfer final approval email:', error);
        console.error('❌ MailOptions content:', JSON.stringify(mailOptions, null, 2));
      }

      return; // skip normal final approval email
    }

    // ✅ NORMAL FINAL APPROVAL
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
    const scmTNR = await getEmailList('scmTNR');
    const scmFleet = await getEmailList('scmFleet');
    scmRecipients = [...scmTNR, ...scmFleet];
  } else if (area === 'TOAMASINA') {
    const scmTMM = await getEmailList('scmTMM');
    const scmFleet = await getEmailList('scmFleet');
    scmRecipients = [...scmTMM, ...scmFleet];
  } else if (area === 'MORAMANGA') {
    const scmTMM = await getEmailList('scmTMM');
    const scmTNR = await getEmailList('scmTNR');
    const scmFleet = await getEmailList('scmFleet');
    scmRecipients = [...scmTMM, ...scmTNR, ...scmFleet];
  } else {
    const fallbackDoc = area === 'TNR' ? 'scmTNR' : 'scmTMM';
    scmRecipients = await getEmailList(fallbackDoc);
  }
}

    const mailOptions = {
      from: '"Fleet App" <noreply@madacan.com>',
      to: isTestVehicle ? recipientEmails : scmRecipients,
      cc: isTestVehicle ? [] : recipientEmails,
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

Thanks,
Fleet Management System`
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('✅ Final approval email sent to:', isTestVehicle ? recipientEmails : scmRecipients, '| CC:', isTestVehicle ? [] : recipientEmails);
    } catch (error) {
      console.error('❌ Failed to send final approval email:', error);
      console.error('❌ MailOptions content:', JSON.stringify(mailOptions, null, 2));
    }
  }
});

// ✅ REGULAR FINAL APPROVED
exports.sendFinalApprovalNotification = onDocumentUpdated({
  document: 'vehicles/{vehicleId}/jobs/{jobId}',
  secrets: [EMAIL_USER, EMAIL_PASS]
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const { vehicleId, jobId } = event.params;

  const finalStatusChanged =
    before.finalApprovalStatus !== after.finalApprovalStatus &&
    ['Approved', 'Approved as Regular'].includes(after.finalApprovalStatus);

  if (!finalStatusChanged) return;

  const jobData = after;
  let vehicleInfo = vehicleId;
  let toRecipients = [];
  let ccRecipients = [];
  let isTestVehicle = false;

  const vehicleSnap = await admin.firestore().doc(`vehicles/${vehicleId}`).get();
  let v = null;
  if (vehicleSnap.exists) {
    v = vehicleSnap.data();
    isTestVehicle = v?.isTest === true;
    const type = v.type || 'Vehicle';
    const plate = v.plate || 'Unknown Plate';
    const notes = v.notes ? `(${v.notes})` : '';
    vehicleInfo = `${type} - ${plate} ${notes}`.trim();
  }

  const transporter = createTransporter();
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

  // ✅ TRANSFER JOB FINAL APPROVAL
  if (jobData.transfer && after.finalApprovalStatus === 'Approved') {
    toRecipients = isTestVehicle
      ? await getEmailList('defaultTest')
      : await getEmailList('defaulttransfer');

    ccRecipients = jobData.requester ? [jobData.requester] : [];

    const mailOptions = {
      from: '"Fleet App" <noreply@madacan.com>',
      to: toRecipients,
      cc: ccRecipients,
      subject: `🚨 TRANSFER FINAL APPROVED: ${vehicleInfo}`,
      text: `Hello team,

This TRANSFER job Pre-approved & FINAL APPROVED for vehicle: ${vehicleInfo}. Please proceed to the transfer

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

Thanks,
Fleet Management System`
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('✅ Transfer final approval email sent to:', toRecipients, '| CC:', ccRecipients);
    } catch (error) {
      console.error('❌ Failed to send transfer final approval email:', error);
      console.error('❌ MailOptions content:', JSON.stringify(mailOptions, null, 2));
    }

    return;
  }

  // ✅ NORMAL or REGULAR FINAL APPROVAL
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
      const scmTNR = await getEmailList('scmTNR');
      const scmFleet = await getEmailList('scmFleet');
      scmRecipients = [...scmTNR, ...scmFleet];
    } else if (area === 'TOAMASINA') {
      const scmTMM = await getEmailList('scmTMM');
      const scmFleet = await getEmailList('scmFleet');
      scmRecipients = [...scmTMM, ...scmFleet];
    } else if (area === 'MORAMANGA') {
      const scmTMM = await getEmailList('scmTMM');
      const scmTNR = await getEmailList('scmTNR');
      const scmFleet = await getEmailList('scmFleet');
      scmRecipients = [...scmTMM, ...scmTNR, ...scmFleet];
    } else {
      const fallbackDoc = area === 'TNR' ? 'scmTNR' : 'scmTMM';
      scmRecipients = await getEmailList(fallbackDoc);
    }
  }

  const isRegular = after.finalApprovalStatus === 'Approved as Regular';

  const mailOptions = {
    from: '"Fleet App" <noreply@madacan.com>',
    to: isTestVehicle ? recipientEmails : scmRecipients,
    cc: isTestVehicle ? [] : recipientEmails,
    subject: isRegular
      ? `✅ FLEET APP: Regular Approval for ${vehicleInfo}`
      : `✅ FLEET APP: Final Approval for ${vehicleInfo}`,
    text: `Hello team,

A job has been ${isRegular ? 'approved regular' : 'Pre-approved & FINAL APPROVED'} for vehicle: ${vehicleInfo}, please proceed with P.O.

🧾 Job ID: ${jobData.jobNumber || jobId}
📋 Description: ${jobData.description}
👤 Requester: ${jobData.requester}
👷‍♂️ Mechanic: ${jobData.mechanic}
📅 Start Date: ${startDate}
📎 Purchase Request File: ${prFileLink}
📎 Proforma: ${proformaLink}

${approvalNoteText}

✅ Pre-approved by: ${preApprovedBy} on ${preApprovedAt}
✅ ${isRegular ? 'Regular Approved' : 'Final Approved'} by: ${finalApprovedBy} on ${finalApprovedAt}

Thanks,  
Fleet Management System`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ ${after.finalApprovalStatus} email sent to:`, isTestVehicle ? recipientEmails : scmRecipients, '| CC:', isTestVehicle ? [] : recipientEmails);
  } catch (error) {
    console.error(`❌ Failed to send ${after.finalApprovalStatus} email:`, error);
    console.error('❌ MailOptions content:', JSON.stringify(mailOptions, null, 2));
  }
});



// ✅ 4. PR Upload Notification (NEW)
exports.sendPRUploadNotification = onDocumentUpdated({
  document: 'vehicles/{vehicleId}/jobs/{jobId}',
  secrets: [EMAIL_USER, EMAIL_PASS]
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const { vehicleId, jobId } = event.params;

  // ✅ Only trigger if PR file was just uploaded
  if (!before.purchaseFileUrl && after.purchaseFileUrl) {
    const jobData = after;
    let vehicleInfo = vehicleId;
    let recipientEmails = [];

    const vehicleSnap = await admin.firestore().doc(`vehicles/${vehicleId}`).get();
    const v = vehicleSnap.exists ? vehicleSnap.data() : {};
    const isTestVehicle = v?.isTest === true;

    const type = v.type || 'Vehicle';
    const plate = v.plate || 'Unknown Plate';
    const notes = v.notes ? `(${v.notes})` : '';
    vehicleInfo = `${type} - ${plate} ${notes}`.trim();

    if (isTestVehicle) {
      recipientEmails = await getEmailList('defaultTest');
      console.log(`🚧 Test vehicle: sending PR Upload email ONLY to defaultTest:`, recipientEmails);
    } else {
      recipientEmails = await getEmailList('defaultAlways');

      if (v.recipientEmail) {
        recipientEmails.push(...(Array.isArray(v.recipientEmail) ? v.recipientEmail : [v.recipientEmail]));
      }
    }

    const transporter = createTransporter();
    const startDate = formatDate(jobData.startDate || jobData.createdAt);
    const prFileLink = formatPurchaseInfo(jobData.purchaseFileUrl, jobData.purchaseFileName);

    const mailOptions = {
      from: '"Fleet App" <noreply@madacan.com>',
      to: recipientEmails,
      subject: `📎 FLEET APP: Job updated with PR Uploaded for ${vehicleInfo}`,
      text: `Hello team,

A Purchase Request file has been uploaded for vehicle: ${vehicleInfo}.

🧾 Job ID: ${jobData.jobNumber || jobId}
📋 Description: ${jobData.description}
👤 Requester: ${jobData.requester}
👷‍♂️ Mechanic: ${jobData.mechanic}
📅 Start Date: ${startDate}
📎 Purchase Request File: ${prFileLink}

Thanks,
Fleet Management System`
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('✅ PR upload email sent to:', recipientEmails);
    } catch (error) {
      console.error('❌ Failed to send PR upload email:', error);
      console.error('❌ MailOptions content:', JSON.stringify(mailOptions, null, 2));
    }
  }
});

// ✅ 5. Final Approval REJECTION Email with Transfer rule
exports.sendFinalRejectionNotification = onDocumentUpdated({
  document: 'vehicles/{vehicleId}/jobs/{jobId}',
  secrets: [EMAIL_USER, EMAIL_PASS]
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const { vehicleId, jobId } = event.params;

  // ✅ Only trigger when finalApprovalStatus changes to Rejected
  if (before.finalApprovalStatus !== 'Rejected' && after.finalApprovalStatus === 'Rejected') {
    const jobData = after;
    let vehicleInfo = vehicleId;
    let toRecipients = [];
    let ccRecipients = [];
    let isTestVehicle = false;

    const vehicleSnap = await admin.firestore().doc(`vehicles/${vehicleId}`).get();
    if (vehicleSnap.exists) {
      const v = vehicleSnap.data();
      isTestVehicle = v?.isTest === true;
      const type = v.type || 'Vehicle';
      const plate = v.plate || 'Unknown Plate';
      const notes = v.notes ? `(${v.notes})` : '';
      vehicleInfo = `${type} - ${plate} ${notes}`.trim();
    }

    const transporter = createTransporter();
    const startDate = formatDate(jobData.startDate || jobData.createdAt);
    const prFileLink = formatPurchaseInfo(jobData.purchaseFileUrl, jobData.purchaseFileName);
    const proformaLink = formatPurchaseInfo(jobData.updatedProformaUrl, jobData.updatedProformaFileName);

    const rejectedBy = jobData.finalApprovedBy || jobData.approvedBy || 'N/A';
    const rejectedAt = formatDate(jobData.finalApprovedAt || jobData.approvedAt || new Date());
    const approbationNote = jobData.approvalNote
      ? `\n\n📝 Approbation Instructions:\n${jobData.approvalNote}`
      : '';

    // ✅ TRANSFER JOB FINAL REJECTION
    if (jobData.transfer) {
      if (isTestVehicle) {
        toRecipients = await getEmailList('defaultTest');
      } else {
        toRecipients = await getEmailList('defaulttransfer');
      }
      // CC: requester only
      ccRecipients = jobData.requester ? [jobData.requester] : [];

      const mailOptions = {
        from: '"Fleet App" <noreply@madacan.com>',
        to: toRecipients,
        cc: ccRecipients,
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

      try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Transfer final rejection email sent to:', toRecipients, '| CC:', ccRecipients);
      } catch (error) {
        console.error('❌ Failed to send transfer final rejection email:', error);
        console.error('❌ MailOptions content:', JSON.stringify(mailOptions, null, 2));
      }

      return; // skip normal final rejection email
    }

    // ✅ NORMAL FINAL REJECTION
    let recipientEmails = [];

    if (isTestVehicle) {
      recipientEmails = await getEmailList('defaultTest');
      console.log(`🚧 Test vehicle: sending Final Rejection email ONLY to defaultTest:`, recipientEmails);
    } else {
      const always = await getEmailList('defaultAlways');
      const v = vehicleSnap.data();
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
      from: '"Fleet App" <noreply@madacan.com>',
      to: recipientEmails,
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

Thanks,
Fleet Management System`
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('✅ Final rejection email sent (excluding SCM if not test):', recipientEmails);
    } catch (error) {
      console.error('❌ Failed to send final rejection email:', error);
      console.error('❌ MailOptions content:', JSON.stringify(mailOptions, null, 2));
    }
  }
});



// ✅ Urgent Final Approval Email with Transfer rule
exports.sendUrgentApprovalNotification = onDocumentUpdated({
  document: 'vehicles/{vehicleId}/jobs/{jobId}',
  secrets: [EMAIL_USER, EMAIL_PASS]
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const { vehicleId, jobId } = event.params;

  // ✅ Send only when urgentApproval is toggled true
  if (!before.urgentApproval && after.urgentApproval === true) {
    const jobData = after;
    let vehicleInfo = vehicleId;
    let toRecipients = [];
    let ccRecipients = [];
    let isTestVehicle = false;

    const vehicleSnap = await admin.firestore().doc(`vehicles/${vehicleId}`).get();
    if (vehicleSnap.exists) {
      const v = vehicleSnap.data();
      isTestVehicle = v?.isTest === true;
      const type = v.type || 'Vehicle';
      const plate = v.plate || 'Unknown Plate';
      const notes = v.notes ? `(${v.notes})` : '';
      vehicleInfo = `${type} - ${plate} ${notes}`.trim();
    }

    const transporter = createTransporter();
    const startDate = formatDate(jobData.startDate || jobData.createdAt);
    const prFileLink = formatPurchaseInfo(jobData.purchaseFileUrl, jobData.purchaseFileName);
    const proformaLink = formatPurchaseInfo(jobData.updatedProformaUrl, jobData.updatedProformaFileName);

    const finalBy = jobData.finalApprovedBy || jobData.approvedBy || 'N/A';
    const finalAt = formatDate(jobData.finalApprovedAt || jobData.approvedAt || new Date());
    const approvalNoteText = jobData.approvalNote
      ? `\n\n📝 Approbation Instructions:\n${jobData.approvalNote}`
      : '';

    // ✅ TRANSFER JOB URGENT FINAL APPROVAL
    if (jobData.transfer) {
      if (isTestVehicle) {
        toRecipients = await getEmailList('defaultTest');
      } else {
        toRecipients = await getEmailList('defaulttransfer');
      }
      ccRecipients = jobData.requester ? [jobData.requester] : [];

      const mailOptions = {
        from: '"Fleet App" <noreply@madacan.com>',
        to: toRecipients,
        cc: ccRecipients,
        subject: `🚨 TRANSFER JOB: URGENT FINAL APPROVED: ${vehicleInfo}`,
        text: `Hello team,

This TRANSFER job has been URGENTLY FINAL APPROVED for vehicle: ${vehicleInfo}.

🧾 Job ID: ${jobData.jobNumber || jobId}
📋 Description: ${jobData.description}
👤 Requester: ${jobData.requester}
👷‍♂️ Mechanic: ${jobData.mechanic}
📅 Start Date: ${startDate}
📎 Purchase Request File: ${prFileLink}
📎 Proforma: ${proformaLink}

${approvalNoteText}

✅ Urgent Final Approved by: ${finalBy} on ${finalAt}

Thanks,
Fleet Management System`
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Transfer urgent approval email sent to:', toRecipients, '| CC:', ccRecipients);
      } catch (error) {
        console.error('❌ Failed to send transfer urgent approval email:', error);
        console.error('❌ MailOptions content:', JSON.stringify(mailOptions, null, 2));
      }

      return; // skip normal urgent approval email
    }

    // ✅ NORMAL URGENT FINAL APPROVAL
    let allRecipients = [];

    if (isTestVehicle) {
      allRecipients = await getEmailList('defaultTest');
      console.log(`🚧 Test vehicle: sending Urgent Approval email ONLY to defaultTest:`, allRecipients);
    } else {
      const always = await getEmailList('defaultAlways');
      const v = vehicleSnap.data();
      const recipientEmail = v.recipientEmail;
      const ownerEmails = Array.isArray(recipientEmail) ? recipientEmail : recipientEmail ? [recipientEmail] : [];

      const area = (v.Area || '').toUpperCase();
      const scmDocId = area === 'TNR' ? 'scmTNR' : 'scmTMM';
      const scmRecipients = await getEmailList(scmDocId);

      allRecipients = [...always, ...ownerEmails, ...scmRecipients];
    }

    const mailOptions = {
      from: '"Fleet App" <noreply@madacan.com>',
      to: allRecipients,
      subject: `🚨 FLEET APP: URGENT Final Approval for ${vehicleInfo}`,
      text: `Hello team,

A job has been URGENTLY FINAL APPROVED for vehicle: ${vehicleInfo} (without standard pre-approval). Please proceed with P.O.

🧾 Job ID: ${jobData.jobNumber || jobId}
📋 Description: ${jobData.description}
👤 Requester: ${jobData.requester}
👷‍♂️ Mechanic: ${jobData.mechanic}
📅 Start Date: ${startDate}
📎 Purchase Request File: ${prFileLink}
📎 Proforma: ${proformaLink}

${approvalNoteText}

✅ Urgent Final Approved by: ${finalBy} on ${finalAt}

Thanks,
Fleet Management System`
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('✅ Urgent approval email sent to:', allRecipients);
    } catch (error) {
      console.error('❌ Failed to send urgent approval email:', error);
      console.error('❌ MailOptions content:', JSON.stringify(mailOptions, null, 2));
    }
  }
});


// ✅ 6. Verification Note Notification
exports.sendVerificationNoteNotification = onDocumentUpdated({
  document: 'vehicles/{vehicleId}/jobs/{jobId}',
  secrets: [EMAIL_USER, EMAIL_PASS]
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const { vehicleId, jobId } = event.params;

  // ✅ Only trigger if note is newly added
  if (!before.verificationNote && after.verificationNote) {
    const jobData = after;
    let vehicleInfo = vehicleId;
    let recipientEmails = [];

    const vehicleSnap = await admin.firestore().doc(`vehicles/${vehicleId}`).get();
    const v = vehicleSnap.exists ? vehicleSnap.data() : {};
    const isTestVehicle = v?.isTest === true;

    const type = v.type || 'Vehicle';
    const plate = v.plate || 'Unknown Plate';
    const notes = v.notes ? `(${v.notes})` : '';
    vehicleInfo = `${type} - ${plate} ${notes}`.trim();

    if (isTestVehicle) {
      recipientEmails = await getEmailList('defaultTest');
      console.log(`🚧 Test vehicle: sending Verification Note email ONLY to defaultTest:`, recipientEmails);
    } else {
      const final = v.finalApprovalEmail || await getEmailList('defaultFinalApproval');
      const verificator = v.verificatorEmail || await getEmailList('defaultVerificator');

      recipientEmails = [
        ...(Array.isArray(final) ? final : [final]),
        ...(Array.isArray(verificator) ? verificator : [verificator])
      ];
    }

    const transporter = createTransporter();
    const startDate = formatDate(jobData.startDate || jobData.createdAt);
    const prFileLink = formatPurchaseInfo(jobData.purchaseFileUrl, jobData.purchaseFileName); // ✅ ADDED

    const mailOptions = {
      from: '"Fleet App" <noreply@madacan.com>',
      to: recipientEmails,
      subject: `🔍 FLEET APP: Verification Note for ${vehicleInfo}`,
      text: `Hello team,

A verification note has been submitted for vehicle: ${vehicleInfo}.

🧾 Job ID: ${jobData.jobNumber || jobId}
📋 Description: ${jobData.description}
👷‍♂️ Mechanic: ${jobData.mechanic}
📅 Start Date: ${startDate}
📎 Purchase Request File: ${prFileLink}

📝 Verificator Note:
${jobData.verificationNote}

✅ Verified by: ${jobData.verifiedBy || 'N/A'}
📅 On: ${formatDate(jobData.verifiedAt || new Date())}

Thanks,
Fleet Management System`
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('✅ Verificator note email sent to:', recipientEmails);
    } catch (error) {
      console.error('❌ Failed to send verificator note email:', error);
      console.error('❌ MailOptions content:', JSON.stringify(mailOptions, null, 2));
    }
  }
});

// ✅ 7. Updated Proforma Notification (with defaultTest logic)
exports.sendUpdatedProformaNotification = onDocumentUpdated({
  document: 'vehicles/{vehicleId}/jobs/{jobId}',
  secrets: [EMAIL_USER, EMAIL_PASS]
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const { vehicleId, jobId } = event.params;

  // ✅ Only trigger if updatedProformaUrl was just added
  if (!before.updatedProformaUrl && after.updatedProformaUrl) {
    const jobData = after;
    let vehicleInfo = vehicleId;

    const vehicleSnap = await admin.firestore().doc(`vehicles/${vehicleId}`).get();
    const v = vehicleSnap.exists ? vehicleSnap.data() : {};
    const isTestVehicle = v?.isTest === true;

    const type = v.type || 'Vehicle';
    const plate = v.plate || 'Unknown Plate';
    const notes = v.notes ? `(${v.notes})` : '';
    vehicleInfo = `${type} - ${plate} ${notes}`.trim();

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

    const transporter = createTransporter();
    const startDate = formatDate(jobData.startDate || jobData.createdAt);
    const prFileLink = formatPurchaseInfo(jobData.purchaseFileUrl, jobData.purchaseFileName); // ✅ ADDED
    const proformaLink = formatPurchaseInfo(jobData.updatedProformaUrl, jobData.updatedProformaFileName);

    const mailOptions = {
      from: '"Fleet App" <noreply@madacan.com>',
      to: toRecipients,
      cc: ccRecipients,
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

Thanks,
Fleet Management System`
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('✅ Updated Proforma email sent to (To):', toRecipients, '| Cc:', ccRecipients);
    } catch (error) {
      console.error('❌ Failed to send updated proforma email:', error);
      console.error('❌ MailOptions content:', JSON.stringify(mailOptions, null, 2));
    }
  }
});

exports.sendTaskDeliveredNotification = onDocumentUpdated({
  document: 'vehicles/{vehicleId}/jobs/{jobId}/tasks/{taskId}',
  secrets: [EMAIL_USER, EMAIL_PASS]
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const { vehicleId, jobId, taskId } = event.params;

  // Trigger only when arrivalStatus transitions to "Delivered"
  if (before.arrivalStatus === 'Delivered' || after.arrivalStatus !== 'Delivered') return;

  const vehicleRef = admin.firestore().doc(`vehicles/${vehicleId}`);
  const vehicleSnap = await vehicleRef.get();
  const vehicle = vehicleSnap.exists ? vehicleSnap.data() : {};

  const jobSnap = await admin.firestore().doc(`vehicles/${vehicleId}/jobs/${jobId}`).get();
  const job = jobSnap.exists ? jobSnap.data() : {};

  const taskTitle = after.name || taskId;
  const plate = vehicle.plate || 'Unknown Plate';
  const vehicleInfo = `${vehicle.type || 'Vehicle'} - ${plate}${vehicle.notes ? ` (${vehicle.notes})` : ''}`;
  const isTest = vehicle?.isTest === true;

  const deliveredBy = after.returnedPart?.deliveredBy || 'N/A';
  const updatedBy = after.returnedPart?.updatedBy || 'N/A';
  const deliveryDate = formatDate(after.returnedPart?.updatedAt?.toDate?.());

  const returnedImageLink = after.returnedPartImage ? `🔗 Returned Part Image: ${after.returnedPartImage}` : 'No returned image uploaded.';

  const transporter = createTransporter();

  // 📧 Determine recipients
  let toRecipients = [];
  let ccRecipients = [];

  if (isTest) {
    toRecipients = await getEmailList('defaultTest');
    console.log('🚧 Test vehicle - sending only to defaultTest:', toRecipients);
  } else {
    toRecipients = await getEmailList('defaultAlways');
    const ccPre = await getEmailList('defaultPreApproval');
    const ccStore = await getEmailList('defaultStoreroom');
    ccRecipients = [...ccPre, ...ccStore];
  }

  const mailOptions = {
    from: '"Fleet App" <noreply@madacan.com>',
    to: toRecipients,
    cc: ccRecipients,
    subject: `📦 FLEET APP: Task Delivered for ${vehicleInfo}`,
    text: `Hello team,

A task has been marked as DELIVERED for vehicle: ${vehicleInfo}.

🛠 Task: ${taskTitle}
📦 Status: Delivered
👤 Delivered by: ${deliveredBy}
📧 Updated by: ${updatedBy}
📅 Delivery Date: ${deliveryDate}

${returnedImageLink}

🧾 Job Number: ${job.jobNumber || jobId}
📋 Job Description: ${job.description || 'N/A'}

Thanks,
Fleet Management System`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Delivery email sent to:', toRecipients, '| CC:', ccRecipients);
  } catch (err) {
    console.error('❌ Failed to send delivery email:', err);
    console.error('❌ Mail content:', JSON.stringify(mailOptions, null, 2));
  }
});
