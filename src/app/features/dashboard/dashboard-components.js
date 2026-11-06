import { escapeHtml } from '../../shared/formatters.js';

export function dashboardDistributionRows(items, emptyMessage = 'Nenhum dado informado', suffix = 'dos cadastros') {
  if (!items.length) return `<div class="dashboard-panel-empty">${emptyMessage}</div>`;
  const tones = ['brand', 'success', 'neutral', 'brand', 'success', 'neutral'];
  return items.map((item, index) => `<div class="dashboard-status-row"><div><span class="dashboard-status-dot is-${tones[index % tones.length]}"></span><strong>${escapeHtml(item.label)}</strong><span>${item.count}</span></div><div class="dashboard-progress is-${tones[index % tones.length]}"><i style="width:${item.percentage}%"></i></div><small>${item.percentage}% ${escapeHtml(suffix)}</small></div>`).join('');
}

export function reportDistributionPanel(title, description, icon, items, total, highlightLabel = '') {
  const highest = Math.max(1, ...items.map((item) => item.count));
  const rows = items.map((item) => {
    const percentage = total ? Math.round((item.count / total) * 100) : 0;
    const width = item.count ? Math.max(5, Math.round((item.count / highest) * 100)) : 0;
    return `<div class="report-distribution-row ${item.label === highlightLabel ? 'is-predominant' : ''}"><div><strong>${escapeHtml(item.label)}</strong><span>${item.count} agendamento(s)</span></div><div class="report-distribution-bar"><i style="width:${width}%"></i></div><strong>${percentage}%</strong></div>`;
  }).join('');
  return `<article class="report-analysis-panel"><header><i data-lucide="${icon}"></i><div><h2>${title}</h2><span>${description}</span></div></header><div class="report-distribution-list">${rows}</div></article>`;
}

export function performanceTableRows(items) {
  return items.map((item) => `<tr><td><strong>${escapeHtml(item.label)}</strong></td><td>${item.total}</td><td>${item.scheduled}</td><td>${item.attended}</td><td>${item.missed}</td><td><strong>${item.attendanceRate}%</strong></td></tr>`).join('');
}

export function statusRows(items, total, suffix = 'dos agendamentos') {
  return items.map(([label, count, tone]) => { const percentage = total ? Math.round((count / total) * 100) : 0; return `<div class="dashboard-status-row"><div><span class="dashboard-status-dot is-${tone}"></span><strong>${label}</strong><span>${count}</span></div><div class="dashboard-progress is-${tone}"><i style="width:${percentage}%"></i></div><small>${percentage}% ${suffix}</small></div>`; }).join('');
}
