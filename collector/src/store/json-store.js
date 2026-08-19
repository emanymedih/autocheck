import fs from "node:fs/promises";
import path from "node:path";

const EMPTY_STORE = { version: 1, updatedAt: null, vehicles: [] };

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function withObservedSync(previous, vehicle) {
  return {
    ...(previous?.sync || {}),
    ...(vehicle?.sync || {}),
    missingRuns: 0,
    lastObservedAt: vehicle.lastSeenAt || new Date().toISOString()
  };
}

export class JsonCatalogStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async read() {
    try {
      const content = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(content);
      return { ...EMPTY_STORE, ...parsed, vehicles: Array.isArray(parsed.vehicles) ? parsed.vehicles : [] };
    } catch (error) {
      if (error.code === "ENOENT") return structuredClone(EMPTY_STORE);
      throw error;
    }
  }

  async write(data) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, this.filePath);
  }

  async upsertMany(incoming, { providerId, snapshot = false, deactivateAfterMisses = 1 } = {}) {
    const store = await this.read();
    const byId = new Map(store.vehicles.map((vehicle) => [vehicle.id, vehicle]));
    const seenListingIds = new Set();
    let inserted = 0;
    let updated = 0;

    for (const vehicle of incoming) {
      const previous = byId.get(vehicle.id);
      seenListingIds.add(vehicle.source.listingId);
      if (previous) {
        byId.set(vehicle.id, {
          ...previous,
          ...vehicle,
          firstSeenAt: previous.firstSeenAt || vehicle.firstSeenAt,
          lastSeenAt: vehicle.lastSeenAt,
          sync: withObservedSync(previous, vehicle)
        });
        updated += 1;
      } else {
        byId.set(vehicle.id, {
          ...vehicle,
          sync: withObservedSync(null, vehicle)
        });
        inserted += 1;
      }
    }

    let missing = 0;
    let deactivated = 0;
    if (snapshot && providerId) {
      const threshold = positiveInteger(deactivateAfterMisses, 1);
      for (const [id, vehicle] of byId.entries()) {
        if (vehicle.source?.providerId !== providerId) continue;
        if (seenListingIds.has(vehicle.source?.listingId)) continue;
        if (vehicle.status === "inactive") continue;
        const missingRuns = positiveInteger(vehicle.sync?.missingRuns, 0) + 1;
        const shouldDeactivate = missingRuns >= threshold;
        byId.set(id, {
          ...vehicle,
          status: shouldDeactivate ? "inactive" : vehicle.status,
          sync: {
            ...(vehicle.sync || {}),
            missingRuns,
            lastMissingAt: new Date().toISOString()
          }
        });
        missing += 1;
        if (shouldDeactivate) deactivated += 1;
      }
    }

    const next = {
      version: 1,
      updatedAt: new Date().toISOString(),
      vehicles: [...byId.values()]
    };
    await this.write(next);
    return { inserted, updated, missing, deactivated, total: next.vehicles.length };
  }

  async markMissing(listingIds, { providerId, deactivateAfterMisses = 2, checkedAt = new Date().toISOString() } = {}) {
    if (!providerId) throw new Error("providerId is required");
    const requested = new Set((listingIds || []).map((value) => String(value || "").trim()).filter(Boolean));
    if (!requested.size) return { marked: 0, deactivated: 0, total: (await this.read()).vehicles.length };

    const threshold = positiveInteger(deactivateAfterMisses, 2);
    const store = await this.read();
    let marked = 0;
    let deactivated = 0;

    const vehicles = store.vehicles.map((vehicle) => {
      if (vehicle.source?.providerId !== providerId) return vehicle;
      if (!requested.has(String(vehicle.source?.listingId || ""))) return vehicle;
      if (vehicle.status === "inactive") return vehicle;

      const missingRuns = positiveInteger(vehicle.sync?.missingRuns, 0) + 1;
      const shouldDeactivate = missingRuns >= threshold;
      marked += 1;
      if (shouldDeactivate) deactivated += 1;

      return {
        ...vehicle,
        status: shouldDeactivate ? "inactive" : vehicle.status,
        source: {
          ...(vehicle.source || {}),
          checkedAt
        },
        sync: {
          ...(vehicle.sync || {}),
          missingRuns,
          lastMissingAt: checkedAt
        }
      };
    });

    const next = {
      ...store,
      version: 1,
      updatedAt: checkedAt,
      vehicles
    };
    await this.write(next);
    return { marked, deactivated, total: vehicles.length };
  }
}
