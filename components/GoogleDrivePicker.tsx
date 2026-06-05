import React, { useState } from "react";
import {
  DrivePicker,
  DrivePickerDocsView,
} from "@googleworkspace/drive-picker-react";
import { logger } from "../src/lib/application/logger";

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

  if (!clientId || !apiKey) {
    logger.error(
      "GoogleDrivePicker: Missing VITE_GOOGLE_CLIENT_ID or VITE_GOOGLE_API_KEY",
    );
  }
  if (!appId) {
    logger.warn(
      "GoogleDrivePicker: Missing VITE_GOOGLE_APP_ID - this may cause integration issues",
    );
  }

  const handlePicked = (e: CustomEvent) => {
    const data = e.detail;
    if (data.docs && data.docs.length > 0) {
      const fileId = data.docs[0].id;
      logger.log("User selected spreadsheet via picker:", fileId);
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

/**
 * Hook to use Google Drive Picker imperatively
 */
export const useGoogleDrivePicker = () => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerCallback, setPickerCallback] = useState<
    ((fileId: string | null) => void) | null
  >(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
  const appId = import.meta.env.VITE_GOOGLE_APP_ID;

  const openPicker = (accessToken?: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setPickerCallback(() => resolve);
      setIsPickerOpen(true);
    });
  };

  const handlePicked = (e: CustomEvent) => {
    const data = e.detail;
    if (data.docs && data.docs.length > 0) {
      const fileId = data.docs[0].id;
      logger.log("User selected spreadsheet via picker:", fileId);
      pickerCallback?.(fileId);
    } else {
      pickerCallback?.(null);
    }
    setIsPickerOpen(false);
    setPickerCallback(null);
  };

  const handleCanceled = () => {
    logger.log("Drive picker canceled");
    pickerCallback?.(null);
    setIsPickerOpen(false);
    setPickerCallback(null);
  };

  const PickerComponent =
    isPickerOpen && clientId && apiKey ? (
      <DrivePicker
        client-id={clientId}
        app-id={appId}
        developer-key={apiKey}
        onPicked={handlePicked}
        onCanceled={handleCanceled}
        onOauthError={(e) => {
          logger.error("OAuth error:", e.detail);
          pickerCallback?.(null);
          setIsPickerOpen(false);
          setPickerCallback(null);
        }}
      >
        <DrivePickerDocsView
          mime-types="application/vnd.google-apps.spreadsheet"
          mode="list"
        />
      </DrivePicker>
    ) : null;

  return {
    openPicker,
    PickerComponent,
  };
};

export default GoogleDrivePicker;
