import { DEMO_LAWYERS } from "@/data/mocks/lawyers";
import type { LawyerRepository } from "@/services/types";

export const mockLawyerRepository: LawyerRepository = {
  async list(filters) {
    let rows = [...DEMO_LAWYERS];
    if (filters?.city && filters.city !== "all") {
      rows = rows.filter((l) => l.city === filters.city);
    }
    if (filters?.practiceArea && filters.practiceArea !== "all") {
      rows = rows.filter((l) =>
        l.practiceAreas.includes(filters.practiceArea as (typeof l.practiceAreas)[number]),
      );
    }
    if (filters?.language && filters.language !== "all") {
      rows = rows.filter((l) => l.languages.includes(filters.language as string));
    }
    return { ok: true, data: rows };
  },
  async getById(id) {
    const found = DEMO_LAWYERS.find((l) => l.id === id);
    if (!found) {
      return { ok: false, code: "not_found", message: "This demo profile was not found." };
    }
    return { ok: true, data: found };
  },
};
