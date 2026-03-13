import { useState, useEffect, useCallback, useMemo } from "react";
import type { SkillDefinition } from "@/types";
import { Storage } from "@/utils/storage";
import { validateSkill, validateSkills } from "@/utils/validation";
import { builtinSkills } from "@/utils/builtin-skills";

export function useSkills() {
  const [userSkills, setUserSkills] = useState<SkillDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  // 从 chrome.storage 恢复用户自定义 Skills
  useEffect(() => {
    Storage.getSkills().then((stored) => {
      setUserSkills(stored);
      setLoading(false);
    });
  }, []);

  // 合并内置 Skills + 用户 Skills
  // 内置 Skills 始终在前面，且不会被用户同 ID 的 Skill 覆盖
  const skills = useMemo(() => {
    const builtinIds = new Set(builtinSkills.map((s) => s.id));
    const filtered = userSkills.filter((s) => !builtinIds.has(s.id));
    return [...builtinSkills, ...filtered];
  }, [userSkills]);

  // 持久化（只保存用户自定义 Skills）
  const persist = useCallback(async (newSkills: SkillDefinition[]) => {
    setUserSkills(newSkills);
    await Storage.setSkills(newSkills);
  }, []);

  const addSkill = useCallback(
    async (skill: SkillDefinition) => {
      const validation = validateSkill(skill);
      if (!validation.valid) {
        throw new Error("Skill 校验失败: " + validation.errors.join("; "));
      }
      if (skills.some((s) => s.id === skill.id)) {
        throw new Error(`Skill ID "${skill.id}" 已存在`);
      }
      await persist([...userSkills, skill]);
    },
    [skills, userSkills, persist],
  );

  const updateSkill = useCallback(
    async (skill: SkillDefinition) => {
      const validation = validateSkill(skill);
      if (!validation.valid) {
        throw new Error("Skill 校验失败: " + validation.errors.join("; "));
      }
      const newSkills = userSkills.map((s) => (s.id === skill.id ? skill : s));
      await persist(newSkills);
    },
    [userSkills, persist],
  );

  const removeSkill = useCallback(
    async (id: string) => {
      await persist(userSkills.filter((s) => s.id !== id));
    },
    [userSkills, persist],
  );

  const importSkills = useCallback(
    async (
      input: unknown[],
    ): Promise<{ imported: number; errors: string[] }> => {
      const { valid, invalid } = validateSkills(input);
      const errors = invalid.map(
        (inv) => `Item ${inv.index}: ${inv.errors.join("; ")}`,
      );
      const existingIds = new Set(skills.map((s) => s.id));
      const newSkills = valid.filter((s) => !existingIds.has(s.id));
      if (newSkills.length > 0) {
        await persist([...userSkills, ...newSkills]);
      }
      return { imported: newSkills.length, errors };
    },
    [skills, userSkills, persist],
  );

  const exportSkills = useCallback(() => {
    return JSON.stringify(userSkills, null, 2);
  }, [userSkills]);

  return {
    skills,
    loading,
    addSkill,
    updateSkill,
    removeSkill,
    importSkills,
    exportSkills,
  };
}
