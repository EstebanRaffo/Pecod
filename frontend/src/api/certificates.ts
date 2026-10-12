import { api } from './client';

export interface CertificateInfo {
  id: string;
  code: string;
  issuedAt: string;
}

export interface CertificateStatus {
  eligible: boolean;
  issued: boolean;
  certificate: CertificateInfo | null;
  reasons: string[];
  attemptsExhausted: boolean;
  unviewedTopicsCount: number;
  unpassedEvaluationsCount: number;
}

export async function getCertificateStatus(courseId: string): Promise<CertificateStatus> {
  const { data } = await api.get<CertificateStatus>(`/courses/${courseId}/certificate/status`);
  return data;
}

export async function downloadCertificatePdf(courseId: string): Promise<{ filename: string; blob: Blob }> {
  const response = await api.get(`/courses/${courseId}/certificate`, {
    responseType: 'blob',
  });

  let filename = `certificado-${courseId}.pdf`;
  const disposition = response.headers['content-disposition'];
  if (disposition) {
    const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
    if (filenameMatch?.[1]) {
      filename = filenameMatch[1];
    }
  }

  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);

  return { filename, blob };
}
