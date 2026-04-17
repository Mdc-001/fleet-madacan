import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const checkbox = (checked) => (checked ? '[x]' : '[ ]');

const loadImageFromUrl = async (url) => {
  const response = await fetch(url);
  const blob = await response.blob();
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
};

export const handleDownloadReport = async (job, vehicle) => {
  const doc = new jsPDF();
  const createdAt = job?.createdAt?.toDate?.()?.toLocaleDateString('en-GB') || new Date().toLocaleDateString('en-GB');
  const isRepair = !!job.purchaseFileUrl;

  // ✅ Use the logo URL and base64
  const logoUrl = 'https://firebasestorage.googleapis.com/v0/b/fleet-mvp.firebasestorage.app/o/Logo_Madacan_2019.jpg?alt=media&token=83bf8d42-5514-478c-a696-42a8cf290113';
  const logoBase64 = await loadImageFromUrl(logoUrl);
// Add logo on the left
doc.addImage(logoBase64, 'JPEG', 10, 10, 30, 20); // Y=17 centers it with Y=25 title

// Title centered
doc.setFontSize(18);
doc.setFont('helvetica', 'bold');
doc.text('VEHICULE MAINTENANCE REPORT', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
// Date aligned right
doc.setFontSize(11);
doc.setFont('helvetica', 'normal');

// ✅ DATE POSITION – just above table
doc.setFontSize(11);
doc.setFont('helvetica', 'normal');
doc.text('Date:', 160, 35); // label
doc.text(createdAt, 180, 35); // value


  // --- Section 1: Info ---
autoTable(doc, {
  startY: 40, // 👈 Add more space here
  head: [['1- Information']],
  body: [],
  theme: 'grid',
  headStyles: {
    fillColor: [240, 240, 240],
    textColor: [0, 0, 0],
    fontStyle: 'bold',
    font: 'helvetica'
  }
});


 autoTable(doc, {
  startY: doc.lastAutoTable.finalY,
  body: [
    ['Vehicle Model:', vehicle?.type || ''],
    ['Plate Number:', vehicle?.plate || ''],
    ['Departement:', vehicle?.departement || ''],
    ['Localisation:', vehicle?.Area || ''],
    ['Milage (Km):', job?.mileage?.toString() || '']
  ],
  theme: 'grid',
  styles: { fontSize: 10, cellPadding: 2 },
  columnStyles: {
    0: { fontStyle: 'bold', cellWidth: 60 },
    1: { cellWidth: 122 }
  }
});


  // --- Section 2: Maintenance ---
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY +  10,
    head: [['2- Maintenance']],
    body: [],
    theme: 'grid',
    headStyles: {
  fillColor: [240, 240, 240], // light gray background
  textColor: [0, 0, 0],       // ensure black text
  fontStyle: 'bold',
  font: 'helvetica'           // ensure standard readable font
}

  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    head: [['Routine M.', 'Repair', 'Lubrification']],
    body: [[
      checkbox(!isRepair),
      checkbox(isRepair),
      checkbox(false)
    ]],
    theme: 'grid',
    styles: { fontSize: 10, halign: 'center' }
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 2,
    body: [
      [{ content: 'Inspection/Finding:', styles: { fontStyle: 'bold' } }, job.description || 'N/A'],
      [{ content: 'Activities/Services:', styles: { fontStyle: 'bold' } },
        (job.tasks?.length
          ? job.tasks.map((task, i) => `• ${task.title || task.name || 'Unnamed Task'}`).join('\n')
          : 'N/A')],
      [{ content: 'Responsable:', styles: { fontStyle: 'bold' } }, job.mechanic || 'N/A']
    ],
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 132 }
    },
    styles: { fontSize: 10, cellPadding: 3 }
  });

  // --- Section 3: Photos ---
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 10,
    head: [[
      { content: '3- Photos Spares Parts', styles: { fontStyle: 'bold', halign: 'left' } },
      { content: `PR N°: ${job.purchaseRequestNumber || 'N/A'}`, styles: { fontStyle: 'bold', halign: 'right' } }
    ]],
    theme: 'grid',
    headStyles: {
      fontStyle: 'bold',
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0]
    },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 70 }
    }
  });

  let currentY = doc.lastAutoTable.finalY + 8;

  for (let i = 0; i < job.tasks?.length; i++) {
  const task = job.tasks[i];
  const hasBefore = !!task.beforeImage;
  const hasAfter = !!task.afterImage;

  // Check and add page if near bottom
  if (currentY + 70 > doc.internal.pageSize.getHeight()) {
    doc.addPage();
    currentY = 20; // reset Y for new page
  }

  currentY += 10;
  doc.setFontSize(11);
  doc.text(`Task ${i + 1}: ${task.name || task.title || 'Untitled'}`, 14, currentY);
  currentY += 5;

  if (!hasBefore && !hasAfter) {
    doc.setFontSize(10);
    doc.text('No picture upload for this task.', 14, currentY);
    currentY += 10;
    continue;
  }

  if (hasBefore) {
    const img = await loadImageFromUrl(task.beforeImage);
    doc.text('Existing Spares', 14, currentY + 5);
    doc.addImage(img, 'JPEG', 14, currentY + 8, 80, 45);
  }

  if (hasAfter) {
    const img = await loadImageFromUrl(task.afterImage);
    doc.text('New Spares', 110, currentY + 5);
    doc.addImage(img, 'JPEG', 110, currentY + 8, 80, 45);
  }

  currentY += 58;
}


  // --- Section 4: Comments ---
autoTable(doc, {
  startY: currentY + 8,
  head: [['4- Comment']],
  body: [[{ content: '', colSpan: 1 }]], // 👈 Blank content
  theme: 'grid',
  styles: {
    fontSize: 10,
    cellPadding: 4
  },
  headStyles: {
    fillColor: [240, 240, 240],
    textColor: [0, 0, 0],
    fontStyle: 'bold',
    halign: 'left'
  },
  columnStyles: {
    0: { cellWidth: 180 } // 👈 Matches Checklist table width
  },
  bodyStyles: {
    minCellHeight: 40 // 👈 Makes it visibly tall like a comment box
  },
  pageBreak: 'avoid'
});




  const firstTask = job.tasks?.[0] || {};
  let postCommentY = doc.lastAutoTable.finalY;

  if (firstTask?.returnedPartImage) {
    const img = await loadImageFromUrl(firstTask.returnedPartImage);
    const imgY = postCommentY + 5;
    doc.addImage(img, 'JPEG', 140, imgY, 60, 40);
    postCommentY = imgY + 45;
  } else {
    postCommentY += 5;
  }

  // --- Section 5: Checklist ---
  autoTable(doc, {
    startY: postCommentY + 8,
    head: [['Checklist', 'Yes', 'No']],
    body: [
      ['Are the new spare parts properly installed and suitable for the vehicle?', '', ''],
      ['Has the maintenance responsible conducted a test following the replacement of the parts?', '', '']
    ],
    theme: 'grid',
    headStyles: {
      fontStyle: 'bold',
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0]
    },
    pageBreak: 'avoid'
  });

  // --- Section 6: Signatures ---
  const today = new Date().toLocaleDateString('en-GB');
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 10,
    head: [['', 'End User', 'Maintenance', 'Supervisor']],
    body: [
      ['Date', today, job.createdAt ? job.createdAt.toDate().toLocaleDateString('en-GB') : '', ''],
      ['Name', '', '', ''],
      ['Signature', '', '', '']
    ],
    theme: 'grid',
    headStyles: {
      fontStyle: 'bold',
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0]
    },
    pageBreak: 'avoid'
  });

  // --- Save PDF ---
  doc.save(`Maintenance_Report_${vehicle.plate || 'vehicle'}.pdf`);
};
