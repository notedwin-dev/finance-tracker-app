/**
 * CLOUDPATCH: Recalculate balances using app services.
 * Run with: VITE_GOOGLE_API_KEY=... GOOGLE_ACCESS_TOKEN=... npx tsx patch_sheets.ts
 */

import * as sheetsService from "./services/sheets.services.ts";
import { calculateBalances } from "./helpers/balance.helper";

const ACCESS_TOKEN = process.env.GOOGLE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error("Missing GOOGLE_ACCESS_TOKEN");
  process.exit(1);
}

// 1. Mock Browser Globals for sheets.services.ts
(global as any).window = {
  gapi: {
    load: (name: string, cb: () => void) => cb(),
    client: {
      init: () => Promise.resolve(),
      setToken: (token: any) => {},
      sheets: {
        spreadsheets: {
          get: async ({ spreadsheetId }: any) => {
            const res = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
              {
                headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
              },
            );
            return { result: await res.json() };
          },
          values: {
            get: async ({ spreadsheetId, range }: any) => {
              const res = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`,
                {
                  headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
                },
              );
              return { result: await res.json() };
            },
            update: async ({ spreadsheetId, range, resource }: any) => {
              const res = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
                {
                  method: "PUT",
                  headers: {
                    Authorization: `Bearer ${ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(resource),
                },
              );
              return { result: await res.json() };
            },
            clear: async ({ spreadsheetId, range }: any) => {
              const res = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
                {
                  method: "POST",
                  headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
                },
              );
              return { result: await res.json() };
            },
          },
        },
      },
      drive: {
        files: {
          list: async ({ q }: any) => {
            const res = await fetch(
              `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}`,
              {
                headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
              },
            );
            return { result: await res.json() };
          },
        },
      },
    },
  },
};

(global as any).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

async function run() {
  console.log("--- Initializing Service ---");
  // Set dummy API key to bypass check if not provided
  if (!process.env.VITE_GOOGLE_API_KEY) {
    process.env.VITE_GOOGLE_API_KEY = "dummy-key-for-patch";
  }

  await sheetsService.initGapiClient();
  sheetsService.setGapiAccessToken(ACCESS_TOKEN);

  // We need to set a user ID to avoid the strict filtering in loadFromGoogleSheets.
  // We'll try to find any user ID in the sheet first or use the one from the user's data.
  const KNOWN_USER_ID = "105084147593511773354";
  sheetsService.setSheetUser(KNOWN_USER_ID);

  console.log("--- Loading Data from Sheets ---");
  const data = await sheetsService.loadFromGoogleSheets();
  if (!data) throw new Error("Failed to load data");

  console.log(
    `Found ${data.transactions.length} transactions and ${data.accounts.length} accounts.`,
  );

  console.log("--- Recalculating Balances ---");
  const balances = calculateBalances(data.transactions, data.accounts);

  const updatedAccounts = data.accounts.map((acc) => ({
    ...acc,
    balance: balances[acc.id] ?? acc.balance,
    updatedAt: Date.now(),
  }));

  console.log("--- Saving Updated Accounts ---");
  await sheetsService.saveToSheet("Accounts", updatedAccounts);

  console.log("--- Done ---");
  updatedAccounts.forEach((acc) => {
    console.log(`  ${acc.name}: ${acc.balance.toFixed(2)}`);
  });
}

run().catch(console.error);
