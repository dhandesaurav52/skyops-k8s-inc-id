import { jsPDF } from 'jspdf';
import { Incident, Ticket } from '../types';

export function downloadIncidentPdf(inc: Incident) {
  const doc = new jsPDF();
  const now = new Date().toLocaleString();

  // Header Banner
  doc.setFillColor(15, 23, 42); // SkyOps Dark Slate #0f172a
  doc.rect(0, 0, 210, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('SKYOPS', 14, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('SRE Incident Report & Forensic Evidence Summary', 14, 25);

  doc.setFontSize(8);
  doc.text(`Generated: ${now}`, 145, 18);

  // Body Metadata Box
  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.rect(14, 38, 182, 35, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, 38, 182, 35, 'S');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Incident ID: ${inc.id}`, 18, 46);

  // Severity pill
  let sevColor = [239, 68, 68]; // Red for CRITICAL
  if (inc.severity === 'HIGH') sevColor = [249, 115, 22];
  if (inc.severity === 'MEDIUM') sevColor = [234, 179, 8];

  doc.setFillColor(sevColor[0], sevColor[1], sevColor[2]);
  doc.rect(130, 41, 28, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(inc.severity, 134, 46);

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Status: ${inc.status}`, 18, 54);
  doc.text(`Cluster: ${inc.cluster_name} (${inc.cluster_id})`, 18, 60);
  doc.text(`Resource: ${inc.resource_type}/${inc.resource_name} (Namespace: ${inc.namespace})`, 18, 66);
  doc.text(`Occurrences: ${inc.occurrences}`, 120, 54);
  doc.text(`First Detected: ${new Date(inc.first_detected).toLocaleString()}`, 120, 60);
  doc.text(`Last Observed: ${new Date(inc.last_detected).toLocaleString()}`, 120, 66);

  let y = 82;

  // Section 1: Executive Summary & Root Cause
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Executive Summary & Root Cause Analysis', 14, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const summaryLines = doc.splitTextToSize(`Summary: ${inc.summary}`, 180);
  doc.text(summaryLines, 14, y);
  y += summaryLines.length * 5 + 2;

  const impactLines = doc.splitTextToSize(`Business Impact: ${inc.impact}`, 180);
  doc.text(impactLines, 14, y);
  y += impactLines.length * 5 + 2;

  const rootCauseLines = doc.splitTextToSize(`Identified Root Cause: ${inc.root_cause}`, 180);
  doc.text(rootCauseLines, 14, y);
  y += rootCauseLines.length * 5 + 8;

  // Section 2: Technical Evidence & Logs
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Technical Evidence & Container Logs', 14, y);
  y += 6;

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);

  if (inc.evidence && inc.evidence.length > 0) {
    inc.evidence.forEach((item) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const lines = doc.splitTextToSize(`> ${item}`, 180);
      doc.text(lines, 14, y);
      y += lines.length * 4 + 2;
    });
  } else {
    doc.text('No technical evidence lines attached.', 14, y);
    y += 6;
  }
  y += 6;

  // Section 3: Recommended Remediation
  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('3. Recommended Remediation & Action Plan', 14, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  if (inc.suggested_actions && inc.suggested_actions.length > 0) {
    inc.suggested_actions.forEach((act, idx) => {
      doc.text(`${idx + 1}. ${act}`, 14, y);
      y += 5;
    });
  }

  if (inc.suggested_command) {
    y += 2;
    doc.setFont('courier', 'bold');
    doc.text(`Command: ${inc.suggested_command}`, 14, y);
    y += 6;
  }

  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Confidential - SkyOps Observability SaaS Report', 14, 285);

  doc.save(`${inc.id}-SkyOps-Incident-Report.pdf`);
}

export function downloadIncidentJson(inc: Incident) {
  const blob = new Blob([JSON.stringify(inc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${inc.id}-SkyOps.json`;
  a.click();
}

export function downloadIncidentMarkdown(inc: Incident) {
  const md = `# SkyOps Incident Report: ${inc.id}
**Title:** ${inc.title}
**Severity:** ${inc.severity}
**Status:** ${inc.status}
**Cluster:** ${inc.cluster_name} (${inc.cluster_id})
**Resource:** ${inc.resource_type}/${inc.resource_name} (Namespace: ${inc.namespace})
**First Detected:** ${inc.first_detected}
**Occurrences:** ${inc.occurrences}

## 1. Summary
${inc.summary}

## 2. Business Impact
${inc.impact}

## 3. Root Cause Analysis
${inc.root_cause}

## 4. Technical Evidence
\`\`\`
${inc.evidence ? inc.evidence.join('\n') : 'No evidence logs'}
\`\`\`

## 5. Recommended Remediation
${inc.suggested_actions ? inc.suggested_actions.map((a) => `- ${a}`).join('\n') : 'N/A'}

\`\`\`bash
${inc.suggested_command || ''}
\`\`\`
`;

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${inc.id}-SkyOps.md`;
  a.click();
}

// -------------------------------------------------------------
// SRE TICKET DOCUMENT EXPORTERS
// -------------------------------------------------------------

export function downloadTicketPdf(t: Ticket) {
  const doc = new jsPDF();
  const now = new Date().toLocaleString();

  // Header Banner
  doc.setFillColor(30, 27, 75); // Dark Indigo #1e1b4b
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('SKYOPS SRE WORK ORDER', 14, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Site Reliability Engineering Remediation & Action Document', 14, 26);

  doc.setFontSize(8);
  doc.text(`Generated: ${now}`, 140, 18);

  // Metadata Card
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 38, 182, 40, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, 38, 182, 40, 'S');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Ticket: ${t.id}`, 18, 47);

  // Priority Pill
  let prioColor = [239, 68, 68];
  if (t.priority === 'P1') prioColor = [249, 115, 22];
  if (t.priority === 'P2') prioColor = [99, 102, 241];
  if (t.priority === 'P3') prioColor = [100, 116, 139];

  doc.setFillColor(prioColor[0], prioColor[1], prioColor[2]);
  doc.rect(130, 42, 24, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`PRIORITY ${t.priority}`, 132, 47);

  // Status & Details
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Status: ${t.status}`, 18, 55);
  doc.text(`Assignee: ${t.assignee}`, 18, 61);
  doc.text(`Cluster: ${t.cluster_name} | Namespace: ${t.namespace}`, 18, 67);
  doc.text(`Target Resource: ${t.resource}`, 18, 73);

  doc.text(`Incident Ref: ${t.incident_id || 'Direct SRE Creation'}`, 110, 55);
  doc.text(`Severity: ${t.severity}`, 110, 61);
  doc.text(`Created: ${new Date(t.created_at).toLocaleString()}`, 110, 67);
  doc.text(`Last Updated: ${new Date(t.updated_at).toLocaleString()}`, 110, 73);

  let y = 88;

  // Section 1: Executive Overview & Description
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Failure Summary & Business Impact', 14, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const titleLines = doc.splitTextToSize(`Issue: ${t.title}`, 180);
  doc.text(titleLines, 14, y);
  y += titleLines.length * 5 + 2;

  const descLines = doc.splitTextToSize(`Description: ${t.description}`, 180);
  doc.text(descLines, 14, y);
  y += descLines.length * 5 + 2;

  if (t.impact) {
    const impactLines = doc.splitTextToSize(`Impact Scope: ${t.impact}`, 180);
    doc.text(impactLines, 14, y);
    y += impactLines.length * 5 + 2;
  }

  if (t.root_cause) {
    const rcaLines = doc.splitTextToSize(`Root Cause Analysis: ${t.root_cause}`, 180);
    doc.text(rcaLines, 14, y);
    y += rcaLines.length * 5 + 4;
  }
  y += 4;

  // Section 2: Actionable Remediation Checklist
  if (y > 240) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('2. SRE Remediation Checklist & Runbook Tasks', 14, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  if (t.tasks && t.tasks.length > 0) {
    t.tasks.forEach((tsk) => {
      const checkMark = tsk.completed ? '[x]' : '[ ]';
      const line = `${checkMark} ${tsk.text}`;
      doc.text(line, 14, y);
      y += 5;
    });
  } else if (t.suggested_actions && t.suggested_actions.length > 0) {
    t.suggested_actions.forEach((act, idx) => {
      doc.text(`[ ] ${idx + 1}. ${act}`, 14, y);
      y += 5;
    });
  } else {
    doc.text('No explicit task checklist defined.', 14, y);
    y += 5;
  }
  y += 4;

  // Suggested Command
  if (t.suggested_command) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.text('Remediation Command:', 14, y);
    y += 5;
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.text(t.suggested_command, 14, y);
    y += 8;
  }

  // Section 3: Technical Evidence
  if (t.evidence && t.evidence.length > 0) {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('3. Forensic Telemetry & Evidence', 14, y);
    y += 6;

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    t.evidence.forEach((ev) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      const lines = doc.splitTextToSize(`> ${ev}`, 180);
      doc.text(lines, 14, y);
      y += lines.length * 4 + 2;
    });
    y += 4;
  }

  // Section 4: SRE Notes & Work Log
  if (t.comments && t.comments.length > 0) {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('4. Work Notes & Activity Log', 14, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    t.comments.forEach((c) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`${c.author} (${new Date(c.createdAt).toLocaleString()}):`, 14, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(c.message, 175);
      doc.text(lines, 18, y);
      y += lines.length * 4 + 3;
    });
  }

  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('SkyOps SRE Management SaaS - Official Ticket Document', 14, 285);

  doc.save(`${t.id}-SRE-Ticket-Document.pdf`);
}

export function downloadTicketJson(t: Ticket) {
  const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${t.id}-SkyOps-Ticket.json`;
  a.click();
}

export function downloadTicketMarkdown(t: Ticket) {
  const tasksMd = t.tasks
    ? t.tasks.map((tsk) => `- [${tsk.completed ? 'x' : ' '}] ${tsk.text}`).join('\n')
    : (t.suggested_actions ? t.suggested_actions.map((a) => `- [ ] ${a}`).join('\n') : 'None');

  const commentsMd = t.comments && t.comments.length > 0
    ? t.comments.map((c) => `**${c.author}** (${c.createdAt}):\n> ${c.message}`).join('\n\n')
    : 'No notes logged yet.';

  const md = `# SkyOps SRE Ticket Document: ${t.id}

**Title:** ${t.title}  
**Priority:** ${t.priority} | **Severity:** ${t.severity}  
**Status:** ${t.status}  
**Assignee:** ${t.assignee}  
**Cluster / Namespace:** ${t.cluster_name} / ${t.namespace}  
**Resource Target:** ${t.resource}  
**Incident Reference:** ${t.incident_id || 'N/A'}  
**Created:** ${t.created_at} | **Updated:** ${t.updated_at}  

---

## 1. Description & Failure Summary
${t.description}

**Business Impact:** ${t.impact || 'Service degradation'}  
**Root Cause Analysis:** ${t.root_cause || 'Under investigation'}  

---

## 2. Actionable SRE Remediation Checklist
${tasksMd}

${t.suggested_command ? `### Recommended CLI Command\n\`\`\`bash\n${t.suggested_command}\n\`\`\`\n` : ''}
${t.suggested_yaml_patch ? `### Suggested YAML Fix Patch\n\`\`\`yaml\n${t.suggested_yaml_patch}\n\`\`\`\n` : ''}

---

## 3. Forensic Telemetry & Evidence
\`\`\`
${t.evidence && t.evidence.length > 0 ? t.evidence.join('\n') : 'No evidence captured.'}
\`\`\`

---

## 4. Discussion & Work Notes
${commentsMd}
`;

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${t.id}-SkyOps-Ticket.md`;
  a.click();
}

