import { jsPDF } from 'jspdf';
import { Incident } from '../types';

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
