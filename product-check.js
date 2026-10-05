// Shared by all /produkter requests in this server process.
const DETAIL_CONCURRENCY = 6;
const REQUEST_TIMEOUT_MS = 15000;

function createLimiter(limit) {
  let active = 0;
  const queue = [];
  function drain() {
    while (active < limit && queue.length) {
      const { task, resolve, reject } = queue.shift();
      active++;
      Promise.resolve().then(task).then(resolve, reject).finally(() => {
        active--;
        drain();
      });
    }
  }
  return task => new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    drain();
  });
}

async function fetchJson(fetchImpl, url, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      const error = new Error("DanDomain HTTP " + response.status);
      error.code = "HTTP_" + response.status;
      // Release the response stream before giving the slot to the next call.
      if (response.body && typeof response.body.cancel === "function") {
        await response.body.cancel().catch(() => {});
      }
      throw error;
    }
    try {
      return await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      const invalid = new Error("Ugyldigt JSON-svar fra DanDomain");
      invalid.code = "INVALID_RESPONSE";
      throw invalid;
    }
  } catch (error) {
    if (controller.signal.aborted) {
      const timeout = new Error("DanDomain-kald overskred tidsgrænsen");
      timeout.code = "TIMEOUT";
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function descriptionPresent(data) {
  // An error envelope or unexpected schema is not an empty description.
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      Object.prototype.hasOwnProperty.call(data, "error") ||
      !Object.prototype.hasOwnProperty.call(data, "descriptions")) {
    throw new Error("Ugyldigt produktsvar");
  }
  const descriptions = data.descriptions;
  if (descriptions === null) return false;
  if (typeof descriptions !== "object" || Array.isArray(descriptions) ||
      !Object.prototype.hasOwnProperty.call(descriptions, "description")) {
    throw new Error("Ugyldigt beskrivelsesfelt");
  }
  const description = descriptions.description;
  if (description === null) return false;
  if (typeof description !== "string") throw new Error("Ugyldig beskrivelse");
  return description.trim().length > 0;
}

function createProductChecker({ fetchImpl, concurrency = DETAIL_CONCURRENCY,
  timeoutMs = REQUEST_TIMEOUT_MS }) {
  const limit = createLimiter(concurrency);
  return (baseUrl, number, siteId) => limit(async () => {
    try {
      const data = await fetchJson(fetchImpl,
        baseUrl + "/" + encodeURIComponent(number) + "/" + siteId, timeoutMs);
      let present;
      try {
        present = descriptionPresent(data);
      } catch {
        return { present: null, error: "INVALID_RESPONSE" };
      }
      return { present, error: null };
    } catch (error) {
      return { present: null, error: error.code || "NETWORK_ERROR" };
    }
  });
}

module.exports = { createProductChecker, fetchJson, descriptionPresent };
