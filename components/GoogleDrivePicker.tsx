import React, { useState } from "react";
import {
  DrivePicker,
  DrivePickerDocsView,
} from "@googleworkspace/drive-picker-react";
import { logger } from "../src/lib/infrastructure/logger";

const maskFileId = (fileId: string): string => {
  return fileId.length > 4 ? `***${fileId.slice(-4)}` : "***";
};

interface GoogleDrivePickerProps {
  onPicked: (fileId: string) => void;
  onCancel?: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
  accessToken?: string;
}

/**
 * Google Drive Picker wrapper component
 * Uses @googleworkspace/drive-picker-react for selecting spreadsheets
 */
export const GoogleDrivePicker: React.FC<GoogleDrivePickerProps> = ({
  onPicked,
  onCancel,
  children,
  disabled = false,
  accessToken,
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
  const appId = import.meta.env.VITE_GOOGLE_APP_ID;

  const handlePicked = (e: CustomEvent) => {
    const data = e.detail;
    if (data.docs && data.docs.length > 0) {
      const fileId = data.docs[0].id;
      logger.log("User selected spreadsheet via picker:", maskFileId(fileId));
      onPicked(fileId);
    }
    setIsPickerOpen(false);
  };

  const handleCanceled = () => {
    logger.log("Drive picker canceled");
    onCancel?.();
    setIsPickerOpen(false);
  };

  const handleOauthError = (e: CustomEvent) => {
    logger.error("OAuth error in Drive Picker:", e.detail);
    setIsPickerOpen(false);
  };

  const openPicker = () => {
    if (!disabled && clientId && apiKey) {
      setIsPickerOpen(true);
    } else {
      logger.error("Drive Picker: Missing clientId or apiKey");
    }
  };

  return (
    <>
      {children ? (
        <div
          onClick={openPicker}
          style={{ cursor: disabled ? "not-allowed" : "pointer" }}
        >
          {children}
        </div>
      ) : null}

      {isPickerOpen && clientId && apiKey && (
        <DrivePicker
          client-id={clientId}
          app-id={appId}
          developer-key={apiKey}
          onPicked={handlePicked}
          onCanceled={handleCanceled}
          onOauthError={handleOauthError}
        >
          <DrivePickerDocsView
            mime-types="application/vnd.google-apps.spreadsheet"
            mode="list"
          />
        </DrivePicker>
      )}
    </>
  );
};

