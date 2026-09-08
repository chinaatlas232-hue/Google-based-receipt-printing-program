import { parseExcelFile, parseCustomerFile, mergeShipmentsWithCustomers } from '../utils/excel';
import { ShipmentRecord } from '../types';

export const KNOWN_DRIVE_FILES = {
  SHIPMENTS_FILE_ID: '1IESujqsd6-4RbEfr9cnx8xeYNq-WvTUj',
  CUSTOMERS_FILE_ID: '1gCjzU7Gx5alpv7KZY1mxjIVDJO-yvzww',
  TEMPLATE_FILE_ID: '1_DxNo3KIWWdSQ-Q4r_hatsYZ0sYT8ier',
  LOGO_FILE_ID: '1fAz46COaR6SgT9DNbYqx9Ea9iclQEQTA',
};

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
}

/**
 * Fetch metadata for a file in Google Drive
 */
export async function getDriveFileMetadata(
  fileId: string,
  accessToken: string
): Promise<DriveFileInfo> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,modifiedTime`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`تعذر جلب معلومات الملف (${response.status}): ${errorBody}`);
  }

  return await response.json();
}

/**
 * Download file binary content (handles both Google Sheets and regular Excel files)
 */
export async function downloadDriveFile(
  fileId: string,
  accessToken: string
): Promise<{ arrayBuffer: ArrayBuffer; info: DriveFileInfo }> {
  const metadata = await getDriveFileMetadata(fileId, accessToken);

  let downloadUrl: string;
  if (metadata.mimeType === 'application/vnd.google-apps.spreadsheet') {
    // Export Google Sheet as Excel (.xlsx)
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
  } else {
    // Download standard file directly
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }

  const res = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`خطأ أثناء تحميل الملف (${metadata.name}): ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return { arrayBuffer, info: metadata };
}

/**
 * List spreadsheet and data files from user's Google Drive
 */
export async function listUserDriveFiles(accessToken: string): Promise<DriveFileInfo[]> {
  try {
    const q = "trashed = false and (mimeType contains 'spreadsheet' or mimeType contains 'excel' or mimeType contains 'sheet' or mimeType = 'text/csv' or name contains '.xlsx' or name contains '.xls')";
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=40&fields=files(id,name,mimeType,modifiedTime,size)&orderBy=modifiedTime desc`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      // Fallback to broader list if query syntax isn't supported
      const fallbackUrl = `https://www.googleapis.com/drive/v3/files?pageSize=30&fields=files(id,name,mimeType,modifiedTime,size)&orderBy=modifiedTime desc`;
      const fallbackRes = await fetch(fallbackUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        return data.files || [];
      }
      return [];
    }

    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.error('Failed to list drive files:', err);
    return [];
  }
}

/**
 * High-level function to synchronize both shipments and customer files from Google Drive
 */
export async function syncShipmentsAndCustomersFromDrive(
  accessToken: string,
  shipmentsFileId: string = KNOWN_DRIVE_FILES.SHIPMENTS_FILE_ID,
  customersFileId: string = KNOWN_DRIVE_FILES.CUSTOMERS_FILE_ID
): Promise<{
  shipments: ShipmentRecord[];
  shipmentFileName: string;
  customerFileName?: string;
  mergedCount: number;
}> {
  // 1. Download shipments file
  const shipmentsDownload = await downloadDriveFile(shipmentsFileId, accessToken);
  const parsedShipments = parseExcelFile(shipmentsDownload.arrayBuffer);

  if (parsedShipments.length === 0) {
    throw new Error(`لم يتم العثور على أي سجلات شحنات صالحة في الملف (${shipmentsDownload.info.name})`);
  }

  // 2. Download and merge customer file if available
  let customerFileName: string | undefined = undefined;
  let finalShipments = parsedShipments;
  let mergedCount = 0;

  if (customersFileId) {
    try {
      const customersDownload = await downloadDriveFile(customersFileId, accessToken);
      customerFileName = customersDownload.info.name;
      const parsedCustomers = parseCustomerFile(customersDownload.arrayBuffer);

      if (parsedCustomers.length > 0) {
        finalShipments = mergeShipmentsWithCustomers(parsedShipments, parsedCustomers);
        mergedCount = parsedCustomers.length;
      }
    } catch (custErr) {
      console.warn('Could not load or merge customer info file:', custErr);
    }
  }

  return {
    shipments: finalShipments,
    shipmentFileName: shipmentsDownload.info.name,
    customerFileName,
    mergedCount,
  };
}
