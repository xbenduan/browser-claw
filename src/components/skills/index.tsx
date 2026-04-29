import React, { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  Download,
  Eye,
  FileCode,
  FileJson,
  Globe,
  Lightbulb,
  Loader2,
  Play,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import yaml from "js-yaml";
import Modal from "@/components/shared/Modal";
import {
  openAPISpecToSkills,
  skillToOpenAPISpec,
  validateOpenAPISpec,
} from "@/core/openapi-converter";
import { useI18n } from "@/i18n";
import type { SkillDefinition } from "@/types";
import type { OpenAPISpec } from "@/types/openapi";
import {
  EXAMPLE_SKILLS,
  getExampleSkillJSON,
  getSkillTemplateJSON,
} from "@/utils/example-skills";
import { Messaging } from "@/utils/messaging";

interface SkillsProps {
  skills: SkillDefinition[];
  hostname: string;
  onAdd: (skill: SkillDefinition) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onImport: (
    data: unknown[],
  ) => Promise<{ imported: number; errors: string[] }>;
  onExport: () => string;
}

const getRiskLevelConfig = (
  t: (key: string, vars?: Record<string, string | number>) => string,
) => ({
  safe: {
    label: t("skills.risk.safe"),
    color: "text-green-600 bg-green-50 border-green-200",
    icon: ShieldCheck,
  },
  moderate: {
    label: t("skills.risk.moderate"),
    color: "text-amber-600 bg-amber-50 border-amber-200",
    icon: AlertTriangle,
  },
  high: {
    label: t("skills.risk.high"),
    color: "text-red-600 bg-red-50 border-red-200",
    icon: ShieldAlert,
  },
  dangerous: {
    label: t("skills.risk.high"),
    color: "text-red-600 bg-red-50 border-red-200",
    icon: ShieldAlert,
  },
});

const METHOD_COLORS: Record<string, string> = {
  GET: "text-green-600",
  POST: "text-blue-600",
  PUT: "text-amber-600",
  PATCH: "text-amber-600",
  DELETE: "text-red-600",
};

// ============ 域名匹配 ============

function matchHost(hostname: string, pattern: string): boolean {
  if (!hostname) return false;
  const regex = pattern.replace(/\./g, "\\.").replace(/\*/g, "[^.]+");
  return new RegExp(`^${regex}$`).test(hostname);
}

function groupSkillsByHost(
  skills: SkillDefinition[],
  hostname: string,
  unboundLabel: string,
): { pattern: string; matched: boolean; skills: SkillDefinition[] }[] {
  const patternMap = new Map<string, Set<string>>();
  const skillMap = new Map<string, SkillDefinition>();

  for (const skill of skills) {
    skillMap.set(skill.id, skill);
    for (const pattern of skill.binding.hostPatterns) {
      if (!patternMap.has(pattern)) patternMap.set(pattern, new Set());
      patternMap.get(pattern)!.add(skill.id);
    }
  }

  const groups: {
    pattern: string;
    matched: boolean;
    skills: SkillDefinition[];
  }[] = [];
  const assignedSkills = new Set<string>();

  const sortedPatterns = [...patternMap.keys()].sort((a, b) => {
    const aMatch = matchHost(hostname, a);
    const bMatch = matchHost(hostname, b);
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    return a.localeCompare(b);
  });

  for (const pattern of sortedPatterns) {
    const skillIds = patternMap.get(pattern)!;
    const groupSkills: SkillDefinition[] = [];
    for (const id of skillIds) {
      if (!assignedSkills.has(id)) {
        assignedSkills.add(id);
        const s = skillMap.get(id);
        if (s) groupSkills.push(s);
      }
    }
    if (groupSkills.length > 0) {
      groups.push({
        pattern,
        matched: matchHost(hostname, pattern),
        skills: groupSkills,
      });
    }
  }

  const ungrouped = skills.filter((s) => !assignedSkills.has(s.id));
  if (ungrouped.length > 0) {
    groups.push({ pattern: unboundLabel, matched: false, skills: ungrouped });
  }

  return groups;
}

// ============ Main Component ============

const Skills: React.FC<SkillsProps> = ({
  skills,
  hostname,
  onAdd,
  onRemove,
  onImport,
  onExport,
}) => {
  const { t } = useI18n();
  const riskConfig = useMemo(() => getRiskLevelConfig(t), [t]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<SkillDefinition | null>(
    null,
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<SkillDefinition | null>(
    null,
  );
  const [alertInfo, setAlertInfo] = useState<{
    title: string;
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  const filteredSkills = useMemo(() => {
    if (!searchTerm) return skills;
    const term = searchTerm.toLowerCase();
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.description.toLowerCase().includes(term) ||
        s.id.toLowerCase().includes(term) ||
        (s.meta.category ?? "").toLowerCase().includes(term) ||
        s.binding.hostPatterns.some((p) => p.toLowerCase().includes(term)),
    );
  }, [skills, searchTerm]);

  const groups = useMemo(
    () => groupSkillsByHost(filteredSkills, hostname, t("skills.unboundHost")),
    [filteredSkills, hostname, t],
  );

  const matchedCount = useMemo(
    () =>
      skills.filter((s) =>
        s.binding.hostPatterns.some((p) => matchHost(hostname, p)),
      ).length,
    [skills, hostname],
  );

  // Detect whether input text is an OpenAPI 3.x spec (JSON or YAML)
  const detectOpenAPI = (text: string): unknown | null => {
    const trimmed = text.trim();
    try {
      const parsed = trimmed.startsWith('{') || trimmed.startsWith('[')
        ? JSON.parse(trimmed)
        : yaml.load(trimmed);
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof (parsed as { openapi?: unknown }).openapi === 'string' &&
        String((parsed as { openapi: string }).openapi).startsWith('3.')
      ) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();

      // Try OpenAPI first
      const maybeOpenAPI = detectOpenAPI(text);
      if (maybeOpenAPI) {
        const validation = validateOpenAPISpec(maybeOpenAPI);
        if (!validation.valid) {
          throw new Error(`OpenAPI 格式错误: ${validation.errors.join('; ')}`);
        }
        const skillsFromSpec = openAPISpecToSkills(maybeOpenAPI as OpenAPISpec);
        const result = await onImport(skillsFromSpec as unknown as unknown[]);
        setImportMessage(
          t('skills.importOpenAPISuccess', { count: result.imported }) +
            (result.errors.length > 0 ? t('skills.importFailedCount', { count: result.errors.length }) : "")
        );
        setTimeout(() => setImportMessage(""), 3000);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // Fallback: legacy skill-JSON
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : [data];
      const result = await onImport(arr);
      setImportMessage(
        t("skills.importSuccess", { count: result.imported }) +
          (result.errors.length > 0
            ? t("skills.importFailedCount", { count: result.errors.length })
            : ""),
      );
      setTimeout(() => setImportMessage(""), 3000);
    } catch (err) {
      setImportMessage(
        t("skills.importFailed", {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      setTimeout(() => setImportMessage(""), 3000);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExport = () => {
    const json = onExport();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `browser-claw-skills-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportOpenAPI = () => {
    // Merge all user skills into a single OpenAPI document grouped by path
    const specs = skills.map(skillToOpenAPISpec);
    const merged: OpenAPISpec = {
      openapi: '3.1.0',
      info: {
        title: 'Browser Claw Skills',
        version: '1.0.0',
        description: `Exported ${skills.length} skill(s) from Browser Claw`,
      },
      paths: {},
    };
    for (const spec of specs) {
      for (const [path, methods] of Object.entries(spec.paths)) {
        merged.paths[path] = { ...(merged.paths[path] ?? {}), ...methods };
      }
    }
    const text = JSON.stringify(merged, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `browser-claw-openapi-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddExampleSkills = async () => {
    const result = await onImport(EXAMPLE_SKILLS);
    setImportMessage(
      t("skills.addedExample", { count: result.imported }) +
        (result.errors.length > 0
          ? t("skills.existsCount", { count: result.errors.length })
          : ""),
    );
    setTimeout(() => setImportMessage(""), 3000);
  };

  const handleTestSkill = async (skill: SkillDefinition) => {
    if (skill.api.method !== "GET") {
      setAlertInfo({
        title: t("skills.methodNotSupported"),
        message: t("skills.methodNotSupportedDesc"),
        type: "warning",
      });
      return;
    }
    try {
      const connected = await Messaging.ensureConnected();
      if (!connected) {
        setAlertInfo({
          title: t("skills.connectFailed"),
          message: t("skills.connectFailedDesc"),
          type: "error",
        });
        return;
      }
      const response = await Messaging.executeAPI({
        method: skill.api.method,
        url: (skill.api.baseUrl ?? "") + skill.api.path,
        timeout: skill.api.timeout,
      });

      if (response.success) {
        setAlertInfo({
          title: t("skills.testSuccess"),
          message: t("skills.testSuccessStatus", {
            status: response.status ?? "",
          }),
          type: "success",
        });
      } else {
        setAlertInfo({
          title: t("skills.testFailed"),
          message: response.error || t("skills.unknownError"),
          type: "error",
        });
      }
    } catch (err) {
      setAlertInfo({
        title: t("skills.testError"),
        message: err instanceof Error ? err.message : String(err),
        type: "error",
      });
    }
  };

  const openDetail = (skill: SkillDefinition) => {
    setSelectedSkill(skill);
  };

  const closeDetail = () => {
    setSelectedSkill(null);
  };

  // ── Render Skill Card ──
  const renderSkillCard = (skill: SkillDefinition, isMatched: boolean) => {
    const risk =
      riskConfig[skill.meta.riskLevel as keyof typeof riskConfig] ||
      riskConfig.safe;

    return (
      <div
        key={skill.id}
        className={`flex items-start gap-3 p-3 rounded-lg border transition-all duration-300 mb-2 ${
          isMatched
            ? "bg-cyan-50 border-cyan-200 hover:bg-cyan-100"
            : "bg-white border-slate-200 hover:bg-slate-50"
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {isMatched && (
              <span className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-600 text-[10px] border border-cyan-200">
                {t("skills.currentSite")}
              </span>
            )}
            <span className="font-medium text-sm text-slate-800 truncate">
              {skill.name}
            </span>
            <span
              className={`text-[10px] font-mono font-bold ${
                METHOD_COLORS[skill.api.method] ?? "text-slate-400"
              }`}
            >
              {skill.api.method}
            </span>
          </div>
          <div className="text-xs text-slate-500 truncate opacity-80 mb-2">
            {skill.description}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {skill.meta.category && (
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] border border-slate-200">
                {skill.meta.category}
              </span>
            )}
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] border flex items-center gap-1 ${risk.color}`}
            >
              {risk.label}
            </span>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-slate-100 transition-colors"
            onClick={() => openDetail(skill)}
            title={t("skills.details")}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-slate-100 transition-colors"
            onClick={() => handleTestSkill(skill)}
            title={t("skills.test")}
          >
            <Play className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors"
            onClick={() => setDeleteTarget(skill)}
            title={t("skills.delete")}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full font-sans text-slate-700">
      {/* Header */}
      <div className="sticky top-0 z-10 p-4 border-b border-slate-200 bg-white/80 backdrop-blur-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <span className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-600 border border-cyan-200">
                {t("skills.currentSiteAvailable", { count: matchedCount })}
              </span>
            </span>
          </div>
          <div className="flex gap-1 items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.yaml,.yml"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-white transition-colors"
              onClick={() => fileInputRef.current?.click()}
              title={t('skills.importHint')}
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-white transition-colors"
              onClick={handleExport}
              title={t("skills.export")}
              disabled={skills.length === 0}
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-white transition-colors"
              onClick={handleExportOpenAPI}
              title={t('skills.exportOpenAPI')}
              disabled={skills.length === 0}
            >
              <FileJson className="w-4 h-4" />
            </button>
            <button
              className="glass-button-primary text-xs px-3 py-1.5 h-8 ml-1"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="w-3.5 h-3.5" /> {t("skills.add")}
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            className="glass-input w-full pl-9 py-1.5 text-xs h-8"
            placeholder={t("skills.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {importMessage && (
        <div className="px-4 pt-2">
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 text-xs">
            {importMessage}
          </div>
        </div>
      )}

      {/* Skills List */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {filteredSkills.length === 0 ? (
          <div className="p-6 text-center">
            {skills.length === 0 ? (
              <div className="space-y-6">
                <div>
                  <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mx-auto mb-4 border border-slate-200 shadow-sm">
                    <Lightbulb className="w-8 h-8 text-yellow-500 opacity-80" />
                  </div>
                  <p className="text-sm font-medium text-slate-800">
                    {t("skills.emptyTitle")}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-50 mx-auto">
                    {t("skills.emptyDesc")}
                  </p>
                </div>

                <div className="flex flex-col gap-3 items-center">
                  <button
                    className="glass-button-primary w-full max-w-50 justify-center"
                    onClick={handleAddExampleSkills}
                  >
                    <BookOpen className="w-4 h-4" />
                    {t("skills.addExamples")}
                  </button>
                  <span className="text-[10px] text-slate-500">
                    {t("skills.exampleCount", { count: EXAMPLE_SKILLS.length })}
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full max-w-50 mx-auto">
                  <div className="h-px bg-slate-200 flex-1" />
                  <span className="text-[10px] text-slate-400">
                    {t("skills.or")}
                  </span>
                  <div className="h-px bg-slate-200 flex-1" />
                </div>

                <div className="flex justify-center gap-3">
                  <button
                    className="glass-button text-xs"
                    onClick={() => setShowAddModal(true)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t("skills.manualAdd")}
                  </button>
                  <button
                    className="glass-button text-xs"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {t("skills.importJson")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <Search className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-500">
                  {t("skills.noSearchResult")}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.pattern}>
                <div
                  className={`sticky top-0 z-5 px-3 py-2 text-xs font-semibold flex items-center gap-2 rounded-lg mb-2 backdrop-blur-md ${
                    group.matched
                      ? "bg-cyan-50 text-cyan-700 border border-cyan-200"
                      : "bg-white text-slate-500 border-slate-200"
                  }`}
                >
                  <Globe className="w-3 h-3" />
                  <span className="font-mono truncate max-w-45">
                    {group.pattern}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] ml-auto">
                    {group.skills.length}
                  </span>
                </div>
                <div>
                  {group.skills.map((skill) =>
                    renderSkillCard(skill, group.matched),
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedSkill}
        onClose={closeDetail}
        title={t("skills.detailTitle")}
        width="max-w-lg"
      >
        {selectedSkill && (
          <SkillDetail skill={selectedSkill} hostname={hostname} />
        )}
      </Modal>

      {/* Add Modal */}
      <SkillAddModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={async (skill) => {
          await onAdd(skill);
          setShowAddModal(false);
        }}
        onImport={onImport}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t("skills.deleteTitle")}
        width="max-w-sm"
        footer={
          <>
            <button
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              onClick={() => setDeleteTarget(null)}
            >
              {t("common.cancel")}
            </button>
            <button
              className="glass-button-danger text-xs px-3 py-1.5"
              onClick={async () => {
                if (deleteTarget) {
                  await onRemove(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              {t("common.delete")}
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-red-50 text-red-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-slate-700 font-medium">
              {t("skills.deleteConfirm", { name: deleteTarget?.name ?? "" })}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {t("skills.deleteDesc")}
            </p>
          </div>
        </div>
      </Modal>

      {/* Alert Modal */}
      <Modal
        isOpen={!!alertInfo}
        onClose={() => setAlertInfo(null)}
        title={alertInfo?.title || t("skills.alertTitle")}
        width="max-w-sm"
        footer={
          <button
            className="glass-button-primary text-xs px-4 py-1.5"
            onClick={() => setAlertInfo(null)}
          >
            {t("skills.ok")}
          </button>
        }
      >
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-full shrink-0 ${
              alertInfo?.type === "success"
                ? "bg-green-50 text-green-600"
                : alertInfo?.type === "error"
                  ? "bg-red-50 text-red-600"
                  : "bg-amber-50 text-amber-600"
            }`}
          >
            {alertInfo?.type === "success" ? (
              <Check className="w-5 h-5" />
            ) : alertInfo?.type === "error" ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <Lightbulb className="w-5 h-5" />
            )}
          </div>
          <div className="text-sm text-slate-600 leading-relaxed pt-1">
            {alertInfo?.message}
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ============ Skill Detail ============
const SkillDetail: React.FC<{ skill: SkillDefinition; hostname: string }> = ({
  skill,
  hostname,
}) => {
  const { t } = useI18n();
  const isMatched = skill.binding.hostPatterns.some((p) =>
    matchHost(hostname, p),
  );

  return (
    <div className="space-y-6 text-slate-600 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-xl text-slate-800">{skill.name}</h3>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            {skill.description}
          </p>
        </div>
        {isMatched && (
          <div className="px-2.5 py-1 rounded-full bg-green-50 text-green-600 text-xs font-medium border border-green-200 shrink-0 flex items-center gap-1">
            <Check className="w-3 h-3" /> {t("skills.matchedSite")}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 text-xs">
        <div className="col-span-2 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
          <span className="block text-slate-400 mb-1.5 font-medium uppercase tracking-wider text-[10px]">
            {t("skills.id")}
          </span>
          <code
            className="text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 block truncate"
            title={skill.id}
          >
            {skill.id}
          </code>
        </div>
        <div className="col-span-1 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
          <span className="block text-slate-400 mb-1.5 font-medium uppercase tracking-wider text-[10px]">
            {t("skills.version")}
          </span>
          <span className="text-slate-700 font-medium">{skill.version}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 col-span-3">
          <span className="block text-slate-400 mb-1.5 font-medium uppercase tracking-wider text-[10px]">
            {t("skills.endpoint")}
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`font-bold px-1.5 py-0.5 rounded ${METHOD_COLORS[skill.api.method].replace("text-", "bg-").replace("600", "100")} ${METHOD_COLORS[skill.api.method]}`}
            >
              {skill.api.method}
            </span>
            <code className="text-slate-700 break-all bg-white px-2 py-0.5 rounded border border-slate-200 flex-1">
              {skill.api.baseUrl ?? ""}
              {skill.api.path}
            </code>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-bold text-slate-800 mb-3 text-xs flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-cyan-500" />
          {t("skills.hostRules")}
        </h4>
        <div className="flex flex-wrap gap-2">
          {skill.binding.hostPatterns.map((p, i) => (
            <span
              key={i}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors ${
                matchHost(hostname, p)
                  ? "bg-green-50 text-green-700 border-green-200 shadow-sm"
                  : "bg-white text-slate-500 border-slate-200"
              }`}
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-bold text-slate-800 mb-3 text-xs flex items-center gap-2">
          <FileCode className="w-3.5 h-3.5 text-purple-500" />
          {t("skills.paramsDef")}
        </h4>
        {skill.parameters.length === 0 ? (
          <p className="text-xs text-slate-400 italic pl-1">
            {t("skills.noParams")}
          </p>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="p-3 font-medium">{t("skills.paramName")}</th>
                  <th className="p-3 font-medium">
                    {t("skills.paramLocation")}
                  </th>
                  <th className="p-3 font-medium">
                    {t("skills.paramRequired")}
                  </th>
                  <th className="p-3 font-medium">{t("skills.paramDesc")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {skill.parameters.map((p) => (
                  <tr
                    key={p.name}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="p-3 font-mono text-cyan-600 font-medium">
                      {p.name}
                    </td>
                    <td className="p-3 text-slate-500">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px]">
                        {p.location}
                      </span>
                    </td>
                    <td className="p-3">
                      {p.required ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pt-2">
        <details className="group">
          <summary className="text-xs cursor-pointer text-slate-500 hover:text-cyan-600 transition-colors list-none flex items-center gap-1.5 font-medium">
            <div className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center group-open:rotate-90 transition-transform">
              <Play className="w-2 h-2 fill-current" />
            </div>
            {t("skills.viewJson")}
          </summary>
          <pre className="mt-3 bg-slate-50 rounded-xl p-4 text-[10px] overflow-auto max-h-60 text-slate-600 font-mono border border-slate-200 custom-scrollbar shadow-inner">
            {JSON.stringify(skill, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
};

// ============ Skill Add Modal ============
const SkillAddModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdd: (skill: SkillDefinition) => Promise<void>;
  onImport: (data: unknown[]) => Promise<{ imported: number; errors: string[] }>;
}> = ({ isOpen, onClose, onAdd, onImport }) => {
  const { t, messages } = useI18n();
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const text = jsonText.trim();
      // Try parse as YAML or JSON
      let parsed: unknown;
      if (text.startsWith('{') || text.startsWith('[')) {
        parsed = JSON.parse(text);
      } else {
        parsed = yaml.load(text);
      }

      // Detect OpenAPI
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof (parsed as { openapi?: unknown }).openapi === 'string' &&
        String((parsed as { openapi: string }).openapi).startsWith('3.')
      ) {
        const validation = validateOpenAPISpec(parsed);
        if (!validation.valid) {
          throw new Error(`OpenAPI 格式错误: ${validation.errors.join('; ')}`);
        }
        const skillsFromSpec = openAPISpecToSkills(parsed as OpenAPISpec);
        if (skillsFromSpec.length === 0) {
          throw new Error('OpenAPI 中未找到任何可导入的接口');
        }
        const result = await onImport(skillsFromSpec as unknown as unknown[]);
        if (result.errors.length > 0 && result.imported === 0) {
          throw new Error(result.errors.join('; '));
        }
        onClose();
        return;
      }

      // Single skill JSON
      await onAdd(parsed as SkillDefinition);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadOpenAPITemplate = () => {
    setJsonText(`openapi: 3.1.0
info:
  title: My API
  version: 1.0.0
  x-hostPatterns:
    - api.example.com
servers:
  - url: https://api.example.com
paths:
  /users/{id}:
    get:
      operationId: getUser
      summary: 获取用户信息
      description: 根据用户 ID 查询用户详情
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
          description: 用户 ID
      responses:
        '200':
          description: OK
      x-riskLevel: safe
`);
    setShowExamples(false);
    setError('');
  };

  const loadExample = (index: number) => {
    setJsonText(getExampleSkillJSON(index));
    setShowExamples(false);
    setError("");
  };

  const loadTemplate = () => {
    setJsonText(getSkillTemplateJSON());
    setShowExamples(false);
    setError("");
  };

  const footer = (
    <>
      <button
        className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 transition-colors"
        onClick={onClose}
      >
        {t("common.cancel")}
      </button>
      <button
        className="glass-button-primary px-5 py-2 shadow-md hover:shadow-lg"
        onClick={handleSubmit}
        disabled={!jsonText.trim() || loading}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Check className="w-4 h-4" />
        )}
        {loading ? t("skills.validating") : t("skills.confirmAdd")}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("skills.addSkillTitle")}
      footer={footer}
      height="h-[85vh]"
    >
      <div className="space-y-6">
        {/* Quick actions */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500">
            {t("skills.quickFill")}
          </span>
          <button
            className="px-3 py-1.5 rounded-lg bg-cyan-50 text-cyan-600 text-xs font-medium hover:bg-cyan-100 border border-cyan-100 transition-colors flex items-center gap-1.5"
            onClick={() => setShowExamples(!showExamples)}
          >
            <BookOpen className="w-3.5 h-3.5" />
            {showExamples ? t("skills.hideExamples") : t("skills.showExamples")}
          </button>
          <button
            className="px-3 py-1.5 rounded-lg bg-purple-50 text-purple-600 text-xs font-medium hover:bg-purple-100 border border-purple-100 transition-colors flex items-center gap-1.5"
            onClick={loadTemplate}
          >
            <FileCode className="w-3.5 h-3.5" />
            {t("skills.blankTemplate")}
          </button>
          <button
            className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-medium hover:bg-emerald-100 border border-emerald-100 transition-colors flex items-center gap-1.5"
            onClick={loadOpenAPITemplate}
          >
            <FileJson className="w-3.5 h-3.5" />
            {t('skills.openAPITemplate')}
          </button>
        </div>

        {/* Example selector */}
        {showExamples && (
          <div className="p-1 bg-slate-50 rounded-xl border border-slate-200 animate-in slide-in-from-top-2">
            <div className="p-2 text-xs text-slate-500 font-medium">
              {t("skills.exampleHint")}
            </div>
            <div className="grid grid-cols-1 gap-1 max-h-60 overflow-y-auto custom-scrollbar px-1 pb-1">
              {EXAMPLE_SKILLS.map((skill, idx) => (
                <button
                  key={skill.id}
                  className="flex flex-col items-start p-3 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm transition-all text-left group"
                  onClick={() => loadExample(idx)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${METHOD_COLORS[
                        skill.api.method
                      ]
                        .replace("text-", "bg-")
                        .replace(
                          "600",
                          "100",
                        )} ${METHOD_COLORS[skill.api.method]}`}
                    >
                      {skill.api.method}
                    </span>
                    <span className="text-sm font-medium text-slate-700 group-hover:text-cyan-600 transition-colors">
                      {skill.name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 truncate w-full pl-0.5">
                    {skill.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* JSON Editor */}
        <div className="relative">
          <textarea
            className="w-full h-80 font-mono text-xs leading-relaxed p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all resize-none shadow-inner text-slate-700"
            placeholder={t('skills.jsonOrOpenAPIPlaceholder')}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
          {!jsonText && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none opacity-40">
              <FileCode className="w-10 h-10 mx-auto mb-3 text-slate-400" />
              <span className="text-sm font-medium text-slate-500">
                {t("skills.jsonEmptyHint")}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs flex items-center gap-2 animate-in slide-in-from-top-1">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Schema hint */}
        {!jsonText && (
          <div className="p-4 rounded-xl bg-slate-50/50 border border-slate-100 text-xs text-slate-500 space-y-2">
            <p className="font-semibold text-slate-700">
              {t("skills.jsonStructureTitle")}
            </p>
            <ul className="space-y-1.5 list-disc list-inside opacity-80 pl-1">
              {messages.skills.jsonStructureItems.map((item, index) => (
                <li key={index} dangerouslySetInnerHTML={{ __html: item }} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default Skills;
