import { supabase } from './supabase';

export type AttachmentType = 'image' | 'document' | 'link';

export interface FileUploadResult {
  path: string;
  name: string;
  size: number;
  type: AttachmentType;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }

  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isDocument = ALLOWED_DOCUMENT_TYPES.includes(file.type);

  if (!isImage && !isDocument) {
    return {
      valid: false,
      error: 'Only JPG, PNG, GIF, WebP, PDF, Excel, and CSV files are allowed',
    };
  }

  return { valid: true };
}

export function getFileType(file: File): AttachmentType {
  if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'image';
  }
  return 'document';
}

export async function uploadFile(
  file: File,
  userId: string
): Promise<FileUploadResult> {
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('post-attachments')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  return {
    path: fileName,
    name: file.name,
    size: file.size,
    type: getFileType(file),
  };
}

export function getFileUrl(path: string): string {
  const { data } = supabase.storage
    .from('post-attachments')
    .getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteFile(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from('post-attachments')
    .remove([path]);

  if (error) {
    throw error;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function getFileIcon(type: AttachmentType, fileName?: string): string {
  if (type === 'image') return '🖼️';
  if (type === 'link') return '🔗';

  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return '📄';
    if (['xls', 'xlsx', 'csv'].includes(ext || '')) return '📊';
  }

  return '📎';
}
