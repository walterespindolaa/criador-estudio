type DriveFileLike = {
  id?: string | null;
  external_file_id?: string | null;
  viewUrl?: string | null;
  view_url?: string | null;
};

export function getGoogleDriveFileId(file: DriveFileLike): string | null {
  const fileId = file.id || file.external_file_id;
  return fileId?.trim() || null;
}

export function getGoogleDrivePrimaryMediaUrl(file: DriveFileLike): string | null {
  const fileId = getGoogleDriveFileId(file);
  if (!fileId) return null;
  return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w1600`;
}

export function getGoogleDriveThumbnailUrl(file: DriveFileLike, size = 400): string | null {
  const fileId = getGoogleDriveFileId(file);
  if (!fileId) return null;
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`;
}

export function uniqueMediaUrls(urls: Array<string | null | undefined>): string[] {
  return Array.from(new Set(urls.map(u => u?.trim()).filter(Boolean) as string[]));
}

export function mapDriveFilesToPrimaryMediaUrls(files: DriveFileLike[]): string[] {
  return uniqueMediaUrls(files.map(f => getGoogleDrivePrimaryMediaUrl(f)));
}
