import React, { useState, useRef, useMemo } from "react";
import {
  Plus,
  Upload,
  Download,
  Search,
  Trash2,
  Eye,
  Play,
  X,
  Globe,
  BookOpen,
  FileCode,
  Lightbulb,
} from "lucide-react";
import type { SkillDefinition } from "@/types";
import {
  RISK_LEVEL_COLORS,
  RISK_LEVEL_LABELS,
  METHOD_COLORS,
} from "@/utils/constants";
import { Messaging } from "@/utils/messaging";
import {
  EXAMPLE_SKILLS,
  getExampleSkillJSON,
  getSkillTemplateJSON,
} from "@/utils/example-skills";

interface SkillsProps {
  skills: SkillDefinition[];
  hostname: string;
  onAdd: (skill: SkillDefinition) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onImport: (
    data: unknown[]
  ) => Promise<{ imported: number; errors: string[] }>;
  onExport: () => string;
}

// ============ 域名匹配 ============

function matchHost(hostname: string, pattern: string): boolean {
  if (!hostname) return false;
  const regex = pattern.replace(/\./g, "\\.").replace(/\*/g, "[^.]+");
  return new RegExp(`^${regex}$`).test(hostname);
}

function groupSkillsByHost(
  skills: SkillDefinition[],
  hostname: string
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
    groups.push({ pattern: "(未绑定域名)", matched: false, skills: ungrouped });
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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<SkillDefinition | null>(
    null
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detailDialogRef = useRef<HTMLDialogElement>(null);

  const filteredSkills = useMemo(() => {
    if (!searchTerm) return skills;
    const term = searchTerm.toLowerCase();
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.description.toLowerCase().includes(term) ||
        s.id.toLowerCase().includes(term) ||
        (s.meta.category ?? "").toLowerCase().includes(term) ||
        s.binding.hostPatterns.some((p) => p.toLowerCase().includes(term))
    );
  }, [skills, searchTerm]);

  const groups = useMemo(
    () => groupSkillsByHost(filteredSkills, hostname),
    [filteredSkills, hostname]
  );

  const matchedCount = useMemo(
    () =>
      skills.filter((s) =>
        s.binding.hostPatterns.some((p) => matchHost(hostname, p))
      ).length,
    [skills, hostname]
  );

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : [data];
      const result = await onImport(arr);
      setImportMessage(
        `成功导入 ${result.imported} 个 Skill` +
          (result.errors.length > 0 ? `，${result.errors.length} 个失败` : "")
      );
      setTimeout(() => setImportMessage(""), 3000);
    } catch (err) {
      setImportMessage(
        "导入失败: " + (err instanceof Error ? err.message : String(err))
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

  const handleAddExampleSkills = async () => {
    const result = await onImport(EXAMPLE_SKILLS);
    setImportMessage(
      `已添加 ${result.imported} 个示例 Skill` +
        (result.errors.length > 0 ? `（${result.errors.length} 个已存在）` : "")
    );
    setTimeout(() => setImportMessage(""), 3000);
  };

  const handleTestSkill = async (skill: SkillDefinition) => {
    if (skill.api.method !== 'GET') {
      alert('⚠️ 非 GET 请求需要在 Chat 中通过 AI 执行');
      return;
    }
    try {
      // 先确保 Content Script 已连接
      const connected = await Messaging.ensureConnected();
      if (!connected) {
        alert('❌ 测试失败: Content Script 未连接。请确保当前标签页是一个普通网页（非 chrome:// 页面），然后重试。');
        return;
      }
      const response = await Messaging.executeAPI({
        method: skill.api.method,
        url: (skill.api.baseUrl ?? '') + skill.api.path,
        timeout: skill.api.timeout,
      });
      alert(
        response.success
          ? `✅ 测试成功! 状态码: ${response.status}`
          : `❌ 测试失败: ${response.error}`
      );
    } catch (err) {
      alert('❌ 测试失败: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const openDetail = (skill: SkillDefinition) => {
    setSelectedSkill(skill);
    detailDialogRef.current?.showModal();
  };

  // ── Render Skill Card ──
  const renderSkillCard = (skill: SkillDefinition, isMatched: boolean) => (
    <div
      key={skill.id}
      className={`flex items-start gap-2 px-3 py-2 border-b border-base-200 hover:bg-base-200/50 transition-colors ${
        isMatched ? "bg-success/5" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isMatched && (
            <span className="badge badge-xs badge-success">当前站点</span>
          )}
          <span className="font-medium text-sm truncate">{skill.name}</span>
          <span
            className={`text-xs font-mono ${
              METHOD_COLORS[skill.api.method] ?? ""
            }`}
          >
            {skill.api.method}
          </span>
        </div>
        <div className="text-xs opacity-60 truncate mt-0.5">
          {skill.description}
        </div>
        <div className="flex gap-1 mt-1 flex-wrap">
          {skill.meta.category && (
            <span className="badge badge-xs badge-outline">
              {skill.meta.category}
            </span>
          )}
          {skill.meta.riskLevel && (
            <span
              className={`badge badge-xs ${
                RISK_LEVEL_COLORS[skill.meta.riskLevel] ?? ""
              }`}
            >
              {RISK_LEVEL_LABELS[skill.meta.riskLevel] ?? skill.meta.riskLevel}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-0.5 shrink-0 pt-0.5">
        <button
          className="btn btn-xs btn-ghost btn-square"
          onClick={() => openDetail(skill)}
          title="详情"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        <button
          className="btn btn-xs btn-ghost btn-square"
          onClick={() => handleTestSkill(skill)}
          title="测试"
        >
          <Play className="w-3.5 h-3.5" />
        </button>
        <button
          className="btn btn-xs btn-ghost btn-square text-error"
          onClick={() => {
            if (confirm(`确认删除 Skill「${skill.name}」？`))
              onRemove(skill.id);
          }}
          title="删除"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 p-3 border-b border-base-200 bg-base-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-base-content/60 flex items-center gap-1">
              <span className="badge badge-xs badge-success">
                当前网站 {matchedCount} 个可用
              </span>
            </span>
          </div>
          <div className="flex gap-1 items-center">
            <span className="w-px h-4 bg-base-300 mx-0.5" />
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              className="btn btn-xs btn-ghost"
              onClick={() => fileInputRef.current?.click()}
              title="导入"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
            <button
              className="btn btn-xs btn-ghost"
              onClick={handleExport}
              title="导出"
              disabled={skills.length === 0}
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              className="btn btn-xs btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="w-3.5 h-3.5" /> 新增
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            type="text"
            className="input input-xs w-full"
            placeholder="搜索 Skills（名称、描述、域名）..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {importMessage && (
        <div className="alert alert-info text-xs mx-3 mt-2 py-1">
          {importMessage}
        </div>
      )}

      {/* Skills List or Empty State */}
      <div className="flex-1 overflow-y-auto">
        {filteredSkills.length === 0 ? (
          /* ─── Empty State with Examples ─── */
          <div className="p-6 text-center">
            {skills.length === 0 ? (
              <div className="space-y-4">
                <div>
                  <Lightbulb className="w-10 h-10 mx-auto mb-3 text-warning opacity-50" />
                  <p className="text-sm font-medium">还没有任何 Skill</p>
                  <p className="text-xs text-base-content/50 mt-1">
                    Skill 定义了 AI 可以调用的 API，每个 Skill 对应一个 HTTP
                    接口
                  </p>
                </div>

                {/* Quick actions */}
                <div className="flex flex-col gap-2 items-center">
                  <button
                    className="btn btn-primary btn-sm gap-1.5"
                    onClick={handleAddExampleSkills}
                  >
                    <BookOpen className="w-4 h-4" />
                    一键添加示例 Skills
                  </button>
                  <span className="text-[10px] text-base-content/40">
                    包含 GitHub 仓库查询、Issue 创建、文章列表等{" "}
                    {EXAMPLE_SKILLS.length} 个示例
                  </span>
                </div>

                <div className="divider text-xs text-base-content/30">或</div>

                <div className="flex justify-center gap-2">
                  <button
                    className="btn btn-outline btn-sm gap-1"
                    onClick={() => setShowAddModal(true)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    手动添加
                  </button>
                  <button
                    className="btn btn-outline btn-sm gap-1"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    导入 JSON
                  </button>
                </div>

                {/* Example preview */}
                <details className="text-left mt-4">
                  <summary className="text-xs cursor-pointer text-base-content/50 hover:text-base-content/80">
                    📖 查看 Skill JSON 格式示例
                  </summary>
                  <div className="mt-2 bg-base-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-1.5 bg-base-300 text-xs font-semibold flex items-center justify-between">
                      <span>示例：{EXAMPLE_SKILLS[0].name}</span>
                      <span
                        className={`font-mono ${
                          METHOD_COLORS[EXAMPLE_SKILLS[0].api.method] ?? ""
                        }`}
                      >
                        {EXAMPLE_SKILLS[0].api.method}
                      </span>
                    </div>
                    <pre className="p-3 text-xs overflow-auto max-h-64 font-mono leading-relaxed whitespace-pre-wrap">
                      {getExampleSkillJSON(0)}
                    </pre>
                  </div>
                </details>
              </div>
            ) : (
              <p className="text-xs opacity-50">没有匹配的搜索结果</p>
            )}
          </div>
        ) : (
          <div>
            {groups.map((group) => (
              <div key={group.pattern}>
                <div
                  className={`sticky top-0 z-5 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 ${
                    group.matched
                      ? "bg-success/10 text-success border-b border-success/20"
                      : "bg-base-200 text-base-content/60 border-b border-base-300"
                  }`}
                >
                  <Globe className="w-3 h-3" />
                  <span className="font-mono">{group.pattern}</span>
                  <span className="badge badge-xs badge-outline ml-auto">
                    {group.skills.length}
                  </span>
                  {group.matched && (
                    <span className="badge badge-xs badge-success">
                      当前站点
                    </span>
                  )}
                </div>
                <div>
                  {group.skills.map((skill) =>
                    renderSkillCard(skill, group.matched)
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <dialog ref={detailDialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
              <X className="w-4 h-4" />
            </button>
          </form>
          {selectedSkill && (
            <SkillDetail skill={selectedSkill} hostname={hostname} />
          )}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* Add Modal */}
      {showAddModal && (
        <SkillAddModal
          onClose={() => setShowAddModal(false)}
          onAdd={async (skill) => {
            await onAdd(skill);
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
};

// ============ Skill Detail ============
const SkillDetail: React.FC<{ skill: SkillDefinition; hostname: string }> = ({
  skill,
  hostname,
}) => {
  const isMatched = skill.binding.hostPatterns.some((p) =>
    matchHost(hostname, p)
  );

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-lg">{skill.name}</h3>
      <p className="text-sm opacity-70">{skill.description}</p>
      {isMatched && (
        <div className="badge badge-success badge-sm">
          ✅ 匹配当前站点 {hostname}
        </div>
      )}
      <div className="divider my-1" />
      <div className="text-xs space-y-2">
        <div>
          <span className="font-semibold">ID:</span>{" "}
          <code className="bg-base-200 px-1 rounded">{skill.id}</code>
        </div>
        <div>
          <span className="font-semibold">版本:</span> {skill.version}
        </div>
        <div>
          <span className="font-semibold">接口:</span>{" "}
          <code className="bg-base-200 px-1 rounded">
            {skill.api.method} {skill.api.baseUrl ?? ""}
            {skill.api.path}
          </code>
        </div>
        <div>
          <span className="font-semibold">超时:</span>{" "}
          {skill.api.timeout ?? 30000}ms
        </div>
        <div>
          <span className="font-semibold">站点匹配规则:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {skill.binding.hostPatterns.map((p, i) => (
              <span
                key={i}
                className={`badge badge-sm font-mono ${
                  matchHost(hostname, p) ? "badge-success" : "badge-outline"
                }`}
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="divider my-1" />
      <h4 className="font-semibold text-sm">参数定义</h4>
      {skill.parameters.length === 0 ? (
        <p className="text-xs opacity-50">无参数</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-xs">
            <thead>
              <tr>
                <th>名称</th>
                <th>类型</th>
                <th>位置</th>
                <th>必填</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {skill.parameters.map((p) => (
                <tr key={p.name}>
                  <td className="font-mono">{p.name}</td>
                  <td>{p.type}</td>
                  <td>{p.location}</td>
                  <td>{p.required ? "✅" : ""}</td>
                  <td className="max-w-40 truncate">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {skill.response.extractors && skill.response.extractors.length > 0 && (
        <>
          <h4 className="font-semibold text-sm">响应提取器</h4>
          <div className="overflow-x-auto">
            <table className="table table-xs">
              <thead>
                <tr>
                  <th>字段</th>
                  <th>路径</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {skill.response.extractors.map((ext) => (
                  <tr key={ext.name}>
                    <td className="font-mono">{ext.name}</td>
                    <td className="font-mono text-xs">{ext.path}</td>
                    <td>{ext.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="divider my-1" />
      <details>
        <summary className="text-xs cursor-pointer opacity-70">
          查看完整 JSON
        </summary>
        <pre className="bg-base-200 rounded p-2 mt-1 text-xs overflow-auto max-h-60 whitespace-pre-wrap">
          {JSON.stringify(skill, null, 2)}
        </pre>
      </details>
    </div>
  );
};

// ============ Skill Add Modal ============
const SkillAddModal: React.FC<{
  onClose: () => void;
  onAdd: (skill: SkillDefinition) => Promise<void>;
}> = ({ onClose, onAdd }) => {
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const parsed = JSON.parse(jsonText);
      await onAdd(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
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

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg mb-2">新增 Skill</h3>

        {/* Quick actions */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-base-content/50">快速填充：</span>
          <button
            className="btn btn-xs btn-outline btn-primary gap-1"
            onClick={() => setShowExamples(!showExamples)}
          >
            <BookOpen className="w-3 h-3" />
            {showExamples ? "收起示例" : "查看示例"}
          </button>
          <button
            className="btn btn-xs btn-outline gap-1"
            onClick={loadTemplate}
          >
            <FileCode className="w-3 h-3" />
            空白模板
          </button>
        </div>

        {/* Example selector */}
        {showExamples && (
          <div className="mb-3 space-y-1 p-2 bg-base-200 rounded-lg">
            <p className="text-xs text-base-content/60 mb-2">
              选择一个示例，了解格式后可修改为你自己的配置：
            </p>
            {EXAMPLE_SKILLS.map((skill, idx) => (
              <button
                key={skill.id}
                className="btn btn-ghost btn-sm w-full justify-start text-left h-auto py-2"
                onClick={() => loadExample(idx)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-mono font-bold ${
                        METHOD_COLORS[skill.api.method] ?? ""
                      }`}
                    >
                      {skill.api.method}
                    </span>
                    <span className="text-sm font-medium">{skill.name}</span>
                  </div>
                  <p className="text-xs opacity-60 truncate mt-0.5">
                    {skill.description}
                  </p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {skill.binding.hostPatterns.map((p, i) => (
                      <span
                        key={i}
                        className="badge badge-xs badge-outline font-mono"
                      >
                        {p}
                      </span>
                    ))}
                    <span
                      className={`badge badge-xs ${
                        RISK_LEVEL_COLORS[skill.meta.riskLevel ?? "safe"] ?? ""
                      }`}
                    >
                      {RISK_LEVEL_LABELS[skill.meta.riskLevel ?? "safe"] ??
                        "safe"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* JSON Editor */}
        <textarea
          className="textarea w-full h-52 font-mono text-xs leading-relaxed"
          placeholder={`粘贴 Skill JSON 或点击上方「查看示例」加载范例...\n\n必填字段：id, name, description, version, api, parameters, response, meta, binding`}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
        />
        {error && (
          <div className="alert alert-error text-xs mt-2 py-1">{error}</div>
        )}

        {/* Schema hint — only when textarea is empty */}
        {!jsonText && (
          <div className="text-[10px] text-base-content/40 mt-2 space-y-0.5">
            <p className="font-semibold">Skill JSON 结构说明：</p>
            <p>
              • <code>id</code> 唯一标识 · <code>name</code> 显示名称 ·{" "}
              <code>description</code> AI 读取的功能描述
            </p>
            <p>
              • <code>api</code> HTTP 接口（method / path / baseUrl / timeout）
            </p>
            <p>
              • <code>parameters[]</code> 参数列表（name / type /
              location[path|query|body|header] / required / description）
            </p>
            <p>
              • <code>response</code> 响应处理（type + extractors 用 JSONPath
              提取关键字段）
            </p>
            <p>
              • <code>meta</code> 元信息（category / tags /
              riskLevel[safe|moderate|dangerous]）
            </p>
            <p>
              • <code>binding.hostPatterns</code> 匹配的域名，支持{" "}
              <code>*</code> 通配符
            </p>
          </div>
        )}

        <div className="modal-action">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleSubmit}
            disabled={!jsonText.trim() || loading}
          >
            {loading ? "校验中..." : "添加"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
};

export default Skills;
