/**
 * LIVE PATCH SCRIPT FOR GOOGLE SHEETS
 * Uses fetch and Google Sheets API to recalculate account balances.
 *
 * Instructions:
 * 1. Get your Access Token from the Browser (localStorage.getItem('google_access_token'))
 * 2. Run: GOOGLE_ACCESS_TOKEN=your_token node patch_sheets.cjs
 */

const ACCESS_TOKEN = process.env.GOOGLE_ACCESS_TOKEN;
const SPREADSHEET_TITLE = "ZenFinance Data";
const USD_RATE = 4.45;

if (!ACCESS_TOKEN) {
  console.error("Please provide GOOGLE_ACCESS_TOKEN environment variable.");
  process.exit(1);
}

// Helpers from sheets.helper.ts
const fromSerialDate = (serial) => {
  if (typeof serial !== "number") return String(serial || "");
  if (serial > 100000) return String(serial);
  const baseDate = Date.UTC(1899, 11, 30);
  const d = new Date(baseDate + serial * 24 * 60 * 60 * 1000);
  return (
    d.getUTCFullYear() +
    "-" +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getUTCDate()).padStart(2, "0")
  );
};

async function runPatch() {
  try {
    console.log("Searching for spreadsheet...");
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(SPREADSHEET_TITLE)}' and trashed=false`,
      { method: "GET", headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } },
    );

    const file = driveRes.data.files[0];
    if (!file) throw new Error("Spreadsheet not found");
    const fileId = file.id;
    console.log(`Found spreadsheet: ${fileId}`);

    // 1. Fetch Transactions
    console.log("Fetching transactions...");
    const txRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/'Transactions'!A:Z?valueRenderOption=UNFORMATTED_VALUE`,
      { method: "GET", headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } },
    );
    const txRows = txRes.data.values || [];
    const txHeaders = txRows[0];
    const transactions = txRows.slice(1).map((row) => {
      const obj = {};
      txHeaders.forEach((h, i) => {
        let val = row[i];
        if (h === "date" && typeof val === "number") val = fromSerialDate(val);
        obj[h] = val;
      });
      return obj;
    });

    // 2. Fetch Accounts
    console.log("Fetching accounts...");
    const accRes = await axios.get(
      `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/'Accounts'!A:Z?valueRenderOption=UNFORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } },
    );
    const accRows = accRes.data.values || [];
    const accHeaders = accRows[0];
    const accounts = accRows.slice(1).map((row) => {
      const obj = {};
      accHeaders.forEach((h, i) => (obj[h] = row[i]));
      return obj;
    });

    console.log(
      `Analyzing ${transactions.length} transactions and ${accounts.length} accounts...`,
    );

    // 3. Recalculate Balances
    const balances = {};
    accounts.forEach((acc) => (balances[acc.id] = 0));

    transactions.forEach((tx) => {
      const acc = accounts.find((a) => a.id === tx.accountId);
      if (!acc) return;

      const getConvertedAmount = (amt, txCur, accCur) => {
        if (txCur === accCur) return amt;
        if (txCur === "USD" && accCur === "MYR") return amt * USD_RATE;
        if (txCur === "MYR" && accCur === "USD") return amt / USD_RATE;
        return amt;
      };

      const amount = getConvertedAmount(
        tx.amount || 0,
        tx.currency,
        acc.currency,
      );

      if (
        tx.type === "INCOME" ||
        tx.type === "ACCOUNT_OPENING" ||
        tx.type === "ADJUSTMENT"
      ) {
        balances[tx.accountId] += amount;
      } else if (tx.type === "EXPENSE") {
        balances[tx.accountId] -= amount;
      } else if (tx.type === "TRANSFER") {
        if (tx.transferDirection === "OUT" || !tx.transferDirection) {
          balances[tx.accountId] -= amount;
          if (
            !tx.transferDirection &&
            tx.toAccountId &&
            balances[tx.toAccountId] !== undefined
          ) {
            const toAcc = accounts.find((a) => a.id === tx.toAccountId);
            const toAmount = getConvertedAmount(
              tx.amount,
              tx.currency,
              toAcc.currency,
            );
            balances[tx.toAccountId] += toAmount;
          }
        } else if (tx.transferDirection === "IN") {
          balances[tx.accountId] += amount;
        }
      }
    });

    // 4. Update Accounts in Sheet
    console.log("Updating balances in Google Sheets...");
    const updatedRows = accounts.map((acc) => {
      const newAcc = {
        ...acc,
        balance: balances[acc.id] || 0,
        updatedAt: Date.now(),
      };
      return accHeaders.map((h) => {
        let val = newAcc[h];
        if (typeof val === "object" && val !== null) return JSON.stringify(val);
        return val ?? "";
      });
    });

    await axios.put(
      `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/'Accounts'!A2?valueInputOption=USER_ENTERED`,
      { values: updatedRows },
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } },
    );

    console.log("--- SUCCESS ---");
    accounts.forEach((acc) => {
      const oldB = acc.balance;
      const newB = balances[acc.id];
      console.log(
        `${acc.name}: ${oldB.toFixed(2)} -> ${newB.toFixed(2)} (${(newB - oldB).toFixed(2)})`,
      );
    });
  } catch (err) {
    console.error("Patch failed:", err.response?.data || err.message);
  }
}

runPatch();
