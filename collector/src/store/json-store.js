import fs from "node:fs/promises";
import path from "node:path";

const EMPTY_STORE = { version: 1, updatedAt: null, vehicles: [] };

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

  async upsertMany(incoming, { providerId, snapshot = false } = {}) {
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
          lastSeenAt: vehicle.lastSeenAt
        });
        updated += 1;
      } else {
        byId.set(vehicle.id, vehicle);
        inserted += 1;
      }
    }

    let deactivated = 0;
    if (snapshot && providerId) {
      for (const [id, vehicle] of byId.entries()) {
        if (vehicle.source?.providerId !== providerId) continue;
        if (seenListingIds.has(vehicle.source?.listingId)) continue;
        if (vehicle.status === "inactive") continue;
        byId.set(id, { ...vehicle, status: "inactive", lastSeenAt: new Date().toISOString() });
        deactivated += 1;
      }
    }

    const next = {
      version: 1,
      updatedAt: new Date().toISOString(),
      vehicles: [...byId.values()]
    };
    await this.write(next);
    return { inserted, updated, deactivated, total: next.vehicles.length };
  }
}
