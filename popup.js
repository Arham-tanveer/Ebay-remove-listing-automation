function readFiltersFromUI() {
  return {
    views: { op: document.getElementById('viewsOp').value, value: document.getElementById('views').value || '' },
    watchers: { op: document.getElementById('watchersOp').value, value: document.getElementById('watchers').value || '' },
    sold: { op: document.getElementById('soldOp').value, value: document.getElementById('sold').value || '' },
    days: { op: document.getElementById('daysOp').value, value: document.getElementById('days').value || '' },
    quantity: { op: document.getElementById('qtyOp').value, value: document.getElementById('qty').value || '' 
}
  };
}

function showResult(message, ok = true) {
  const r = document.getElementById('result');
  r.style.display = "block";
  r.className = ok ? "result ok" : "result err";
  r.textContent = message;
}

function setStatus(text) {
  document.getElementById('status').textContent = text || "";
}

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tab.id, message, response => resolve(response));
  });
}

// MAIN TOGGLE BUTTON
const startBtn = document.getElementById("startAutoEnd");

// --------------------------------------------------
// APPLY FILTERS (PAGE ONLY)
// --------------------------------------------------
document.getElementById("applyFilters").addEventListener("click", async () => {
  const filters = readFiltersFromUI();
  setStatus("Applying filters...");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
    } catch (e) { /* already injected */ }

    const resp = await sendToActiveTab({ action: "applyFilters", filters });

    if (resp?.success) {
      showResult(`✓ Selected ${resp.count} listing(s) on this page`, true);
      setStatus("");
      chrome.storage.local.set({ ebayAutoFilters: filters });
    } else {
      showResult("❌ Failed to apply filters", false);
      setStatus("");
    }
  } catch (err) {
    showResult("❌ Error: " + err.message, false);
    setStatus("");
  }
});

// --------------------------------------------------
// START → STOP TOGGLE
// --------------------------------------------------
startBtn.addEventListener("click", async () => {
  // ---- STOP MODE ----
  if (startBtn.classList.contains("stopMode")) {
    setStatus("Stopping auto-end...");

    const resp = await sendToActiveTab({ action: "stopAutoEnd" });

    if (resp?.success) {
      showResult("✓ Auto-end stopped", true);
      startBtn.textContent = "Start";
      startBtn.classList.remove("stopMode");
      chrome.storage.local.set({ ebayAutoEndActive: false });
    } else {
      showResult("❌ Failed to stop", false);
    }

    setStatus("");
    return;
  }

  // ---- START MODE ----
  const filters = readFiltersFromUI();
  setStatus("Starting auto-end...");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
    } catch (e) {}

    const resp = await sendToActiveTab({ action: "startAutoEnd", filters });

    if (resp?.success) {
      showResult("✓ Auto-end started. You may close popup.", true);

      // Turn button into Stop mode
      startBtn.textContent = "Stop";
      startBtn.classList.add("stopMode");

      chrome.storage.local.set({
        ebayAutoFilters: filters,
        ebayAutoEndActive: true
      });
    } else {
      showResult("❌ Failed to start", false);
    }

  } catch (err) {
    showResult("❌ Error: " + err.message, false);
  }

  setStatus("");
});

// --------------------------------------------------
// RESUME UI IF AUTO-END IS CURRENTLY ACTIVE
// --------------------------------------------------
(async function init() {
  const data = await chrome.storage.local.get([
    "ebayAutoFilters",
    "ebayAutoEndActive"
  ]);

  if (data.ebayAutoFilters) {
    const f = data.ebayAutoFilters;

    document.getElementById('viewsOp').value = f.views.op;
    document.getElementById('views').value = f.views.value;

    document.getElementById('watchersOp').value = f.watchers.op;
    document.getElementById('watchers').value = f.watchers.value;

    document.getElementById('soldOp').value = f.sold.op;
    document.getElementById('sold').value = f.sold.value;

    document.getElementById('daysOp').value = f.days.op;
    document.getElementById('days').value = f.days.value;

    // FIX: Quantity restore 
    document.getElementById('qtyOp').value = f.quantity.op;
    document.getElementById('qty').value = f.quantity.value;
}


  if (data.ebayAutoEndActive) {
    setStatus("Auto-end already running...");
    startBtn.textContent = "Stop";
    startBtn.classList.add("stopMode");
  }
})();

// --------------------------------------------------
// RECEIVE STATUS FROM CONTENT SCRIPT LIVE
// --------------------------------------------------
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "AUTO_END_STATUS") return;

  const p = msg.payload || {};

  if (p.error) {
    showResult("❌ " + p.error, false);
    startBtn.textContent = "Start";
    startBtn.classList.remove("stopMode");
    setStatus("");
  }

  else if (p.completed) {
    showResult("✓ Auto-end completed", true);
    startBtn.textContent = "Start";
    startBtn.classList.remove("stopMode");
    setStatus("");
  }

  else if (p.running === false) {
    startBtn.textContent = "Start";
    startBtn.classList.remove("stopMode");
    setStatus("Auto-end stopped.");
  }

  else if (p.running === true) {
    startBtn.textContent = "Stop";
    startBtn.classList.add("stopMode");
    setStatus("Auto-end running...");
  }
});
