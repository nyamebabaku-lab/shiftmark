// Monthly attendance reports as real A4 PDFs (download on a computer, share sheet on a phone).
import { IS_NATIVE } from '../config';
import { hm, dur, money, dayLabel, monthName, hours } from './format';
import { STATUS, MARK_KINDS } from './attendance';

async function lib() {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  return { jsPDF, autoTable };
}
const cur = (s) => (s?.currency || 'GH₵').replace('₵', 'C'); // the built-in PDF font has no ₵
const m = (n, s) => money(n, cur(s));

function header(doc, settings, title, sub) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 64, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(settings?.company || 'ShiftMark', 32, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(165, 243, 252);
  doc.text('Attendance report · ShiftMark', 32, 46);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, 32, 94);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(sub, 32, 110);
}

function footer(doc) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated ${new Date().toLocaleString()} · page ${i} of ${n}`, 32, doc.internal.pageSize.getHeight() - 18);
  }
}

function summaryBox(doc, autoTable, s, settings, y) {
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [8, 145, 178] },
    head: [['Days worked', 'Late', 'Absent', 'Excused', 'Hours', 'Overtime', 'Base pay', 'Overtime pay', 'Total pay']],
    body: [[s.worked, s.late, s.absent, s.excused, hours(s.workedMin), dur(s.otMin), m(s.basePay, settings), m(s.otPay, settings), m(s.pay, settings)]],
  });
  return doc.lastAutoTable.finalY;
}

/** One worker, one month: summary + a row per day. */
export async function workerMonthPdf({ profile, records, summary, settings, year, month }) {
  const { jsPDF, autoTable } = await lib();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  header(doc, settings, `${profile.name}${profile.staff_no ? ` (${profile.staff_no})` : ''}`, `${monthName(month)} ${year} · daily rate ${m(profile.daily_rate, settings)} · overtime ${m(profile.ot_rate, settings)}/h`);
  const y = summaryBox(doc, autoTable, summary, settings, 124);
  autoTable(doc, {
    startY: y + 14,
    styles: { fontSize: 8.5, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42] },
    head: [['Date', 'Shift', 'In', 'Out', 'Worked', 'Late', 'Overtime', 'Status / note']],
    body: records.map((r) => [
      dayLabel(r.date),
      r.shift.type === 'O' ? 'Off' : `${r.shift.label} ${r.shift.startText}-${r.shift.endText}`,
      r.arrival ? hm(r.arrival) : '',
      r.departure ? hm(r.departure) : r.missingOut ? 'no clock-out' : '',
      r.workedMin ? dur(r.workedMin) : '',
      r.late ? `${r.lateMin} min` : '',
      r.otMin ? dur(r.otMin) : '',
      [STATUS[r.status]?.label, r.mark ? MARK_KINDS[r.mark.kind] : '', r.early ? 'left early' : ''].filter(Boolean).join(' · '),
    ]),
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      const r = records[d.row.index];
      if (r.status === 'absent') d.cell.styles.textColor = [190, 18, 60];
      else if (r.status === 'late') d.cell.styles.textColor = [180, 83, 9];
      else if (r.shift.type === 'O') d.cell.styles.textColor = [148, 163, 184];
    },
  });
  footer(doc);
  return save(doc, `${profile.name} ${monthName(month)} ${year} attendance`);
}

/** Whole team, one month. */
export async function teamMonthPdf({ rows, settings, year, month }) {
  const { jsPDF, autoTable } = await lib();
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  header(doc, settings, `Team attendance — ${monthName(month)} ${year}`, `${rows.length} workers`);
  const tot = rows.reduce((a, r) => ({ pay: a.pay + r.summary.pay, worked: a.worked + r.summary.worked, ot: a.ot + r.summary.otMin }), { pay: 0, worked: 0, ot: 0 });
  autoTable(doc, {
    startY: 124,
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [15, 23, 42] },
    head: [['Worker', 'Staff no', 'Days worked', 'Late', 'Absent', 'Excused', 'Extra days', 'Hours', 'Overtime', 'Attendance', 'Base pay', 'OT pay', 'Total pay']],
    body: rows.map(({ profile: p, summary: s }) => [p.name, p.staff_no || '', s.worked, s.late, s.absent, s.excused, s.extra, hours(s.workedMin), dur(s.otMin), s.attendanceRate == null ? '' : `${s.attendanceRate}%`, m(s.basePay, settings), m(s.otPay, settings), m(s.pay, settings)]),
    foot: [['Total', '', tot.worked, '', '', '', '', '', dur(tot.ot), '', '', '', m(tot.pay, settings)]],
    footStyles: { fillColor: [236, 254, 255], textColor: [8, 51, 68], fontStyle: 'bold' },
  });
  footer(doc);
  return save(doc, `Team attendance ${monthName(month)} ${year}`);
}

async function save(doc, name) {
  const file = `${name.replace(/[^\w\s.-]+/g, '').trim().replace(/\s+/g, '-')}.pdf`;
  if (!IS_NATIVE) { doc.save(file); return; }
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const data = doc.output('datauristring').split(',')[1];
  const r = await Filesystem.writeFile({ path: file, data, directory: Directory.Cache });
  await Share.share({ title: name, url: r.uri, dialogTitle: 'Save or send the report' });
}
