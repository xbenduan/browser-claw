import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  X,
  Check,
  Pencil,
  RotateCcw,
  MessageSquarePlus,
  Send,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type {
  ConfirmationRequest,
  ConfirmationResult,
  SkillDefinition,
} from "@/types";
import { parseChatModification } from "@/utils/param-modifier";
import { useI18n } from "@/i18n";

interface ConfirmationCardProps {
  data: ConfirmationRequest;
  /** 关联的 Skill 定义，用于参数校验和提示 */
  skillDefinition?: SkillDefinition;
  onResult: (result: ConfirmationResult) => void;
}

/**
 * 参数编辑模式
 * - 'view': 只读查看（默认）
 * - 'edit': 手动编辑 JSON
 * - 'chat': 通过自然语言聊天修改
 */
type EditMode = "view" | "edit" | "chat";

const ConfirmationCard: React.FC<ConfirmationCardProps> = ({
  data,
  skillDefinition,
  onResult,
}) => {
  const { t } = useI18n();
  const isHighRisk = data.riskLevel === "dangerous";
  const isMediumRisk = data.riskLevel === "moderate";

  // ─── State ───
  const [editMode, setEditMode] = useState<EditMode>("view");
  const [editedParams, setEditedParams] = useState<Record<string, unknown>>(
    data.parameters,
  );
  const [jsonText, setJsonText] = useState(
    JSON.stringify(data.parameters, null, 2),
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "system"; text: string }>
  >([]);
  const [isParamsModified, setIsParamsModified] = useState(false);
  const [showParams, setShowParams] = useState(true);

  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatListRef = useRef<HTMLDivElement>(null);

  // 检测参数是否被修改
  useEffect(() => {
    const modified =
      JSON.stringify(editedParams) !== JSON.stringify(data.parameters);
    setIsParamsModified(modified);
  }, [editedParams, data.parameters]);

  // 聊天消息滚动到底部
  useEffect(() => {
    chatListRef.current?.scrollTo({
      top: chatListRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chatMessages]);

  // ─── 风格 ───
  let borderColor = "border-slate-200";
  let iconColor = "text-violet-600";
  let bgColor = "bg-white/80";
  if (isHighRisk) {
    borderColor = "border-red-200";
    iconColor = "text-red-600";
    bgColor = "bg-red-50";
  } else if (isMediumRisk) {
    borderColor = "border-amber-200";
    iconColor = "text-amber-600";
    bgColor = "bg-amber-50";
  }

  // ─── 手动编辑 JSON ───
  const handleJsonChange = useCallback(
    (value: string) => {
      setJsonText(value);
      try {
        const parsed = JSON.parse(value);
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          setJsonError(t("confirmation.jsonObjectRequired"));
          return;
        }
        setJsonError(null);
        setEditedParams(parsed);
      } catch (e) {
        setJsonError(
          t("confirmation.jsonError", { error: (e as Error).message }),
        );
      }
    },
    [t],
  );

  // ─── 进入编辑模式 ───
  const handleEnterEditMode = useCallback(() => {
    setEditMode("edit");
    setJsonText(JSON.stringify(editedParams, null, 2));
    setJsonError(null);
  }, [editedParams]);

  // ─── 进入聊天模式 ───
  const handleEnterChatMode = useCallback(() => {
    setEditMode("chat");
    setChatMessages([
      {
        role: "system",
        text: t("confirmation.chatGuide"),
      },
    ]);
    setTimeout(() => chatInputRef.current?.focus(), 100);
  }, [t]);

  // ─── 回到查看模式 ───
  const handleBackToView = useCallback(() => {
    setEditMode("view");
    setChatMessages([]);
    setChatInput("");
  }, []);

  // ─── 重置参数 ───
  const handleResetParams = useCallback(() => {
    setEditedParams(data.parameters);
    setJsonText(JSON.stringify(data.parameters, null, 2));
    setJsonError(null);
  }, [data.parameters]);

  // ─── 聊天发送 ───
  const handleChatSend = useCallback(() => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    setChatMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setChatInput("");

    const result = parseChatModification(
      trimmed,
      editedParams,
      skillDefinition,
    );

    if (result.success && result.newParams) {
      setEditedParams(result.newParams);
      setJsonText(JSON.stringify(result.newParams, null, 2));
      setChatMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: t("confirmation.chatModified", {
            changes: result.changes!.join(", "),
          }),
        },
      ]);
    } else {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: result.error || t("confirmation.chatFailed"),
        },
      ]);
    }
  }, [chatInput, editedParams, skillDefinition, t]);

  // ─── 确认 / 拒绝 ───
  const handleConfirm = useCallback(() => {
    const modified =
      JSON.stringify(editedParams) !== JSON.stringify(data.parameters);
    onResult({
      confirmed: true,
      modifiedParameters: modified ? editedParams : undefined,
    });
  }, [editedParams, data.parameters, onResult]);

  const handleReject = useCallback(() => {
    onResult({ confirmed: false });
  }, [onResult]);

  return (
    <div
      className={`glass-card p-4 my-3 border ${borderColor} ${bgColor} shadow-sm backdrop-blur-md`}
    >
      {/* ─── Header ─── */}
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg bg-white border border-slate-200 ${iconColor}`}
        >
          {isHighRisk ? (
            <ShieldAlert className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            {t("confirmation.title")}
            <span className="px-1.5 py-0.5 rounded text-xs bg-violet-50 text-violet-700 font-mono border border-violet-200/60">
              {data.skillName}
            </span>
            {isParamsModified && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 border border-amber-200 font-medium">
                {t("confirmation.modified")}
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 mt-1">{data.skillDescription}</p>
        </div>
      </div>

      {/* ─── URL ─── */}
      <div className="mt-3 bg-slate-50/80 rounded-lg p-2 border border-slate-200 font-mono text-xs flex items-center gap-2 overflow-x-auto custom-scrollbar">
        <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 font-bold uppercase border border-violet-200/60 shrink-0">
          {data.method}
        </span>
        <span className="text-slate-500 whitespace-nowrap" title={data.url}>
          {data.url}
        </span>
      </div>

      {/* ─── Parameters Section ─── */}
      {Object.keys(editedParams).length > 0 && (
        <div className="mt-3">
          {/* Parameters Header with toggle and mode switch */}
          <div className="flex items-center justify-between mb-2">
            <button
              className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-slate-400 hover:text-slate-600 transition-colors"
              onClick={() => setShowParams(!showParams)}
            >
              {showParams ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              {t("confirmation.parametersLabel")}
            </button>

            {showParams && (
              <div className="flex items-center gap-1">
                {isParamsModified && (
                  <button
                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition-colors"
                    onClick={handleResetParams}
                    title={t("confirmation.resetParams")}
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}

                {editMode === "view" && (
                  <>
                    <button
                      className="p-1 rounded hover:bg-violet-50 text-slate-400 hover:text-violet-600 transition-colors duration-150 cursor-pointer"
                      onClick={handleEnterEditMode}
                      title={t("confirmation.manualEdit")}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      className="p-1 rounded hover:bg-violet-50 text-slate-400 hover:text-violet-600 transition-colors duration-150 cursor-pointer"
                      onClick={handleEnterChatMode}
                      title={t("confirmation.chatEdit")}
                    >
                      <MessageSquarePlus className="w-3 h-3" />
                    </button>
                  </>
                )}

                {editMode !== "view" && (
                  <button
                    className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                    onClick={handleBackToView}
                  >
                    {t("confirmation.done")}
                  </button>
                )}
              </div>
            )}
          </div>

          {showParams && (
            <>
              {/* ─── View Mode: Read-only display ─── */}
              {editMode === "view" && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 font-mono text-xs space-y-1.5">
                  {Object.entries(editedParams).map(([key, val]) => {
                    const originalVal = data.parameters[key];
                    const isChanged =
                      JSON.stringify(val) !== JSON.stringify(originalVal);
                    return (
                      <div key={key} className="flex gap-2 w-max min-w-full">
                        <span
                          className={`shrink-0 ${isChanged ? "text-amber-600 font-bold" : "text-cyan-600"}`}
                        >
                          {key}:
                        </span>
                        <span
                          className={`whitespace-nowrap ${isChanged ? "text-amber-700 font-semibold" : "text-amber-600"}`}
                        >
                          {JSON.stringify(val)}
                          {isChanged && (
                            <span className="ml-1.5 text-[9px] text-amber-500 font-normal">
                              ({t("confirmation.original")}:{" "}
                              {JSON.stringify(originalVal)})
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ─── Edit Mode: JSON Editor ─── */}
              {editMode === "edit" && (
                <div className="space-y-2">
                  <textarea
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-xs text-slate-800 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 resize-y min-h-24 max-h-60 custom-scrollbar"
                    value={jsonText}
                    onChange={(e) => handleJsonChange(e.target.value)}
                    spellCheck={false}
                  />
                  {jsonError && (
                    <p className="text-[10px] text-red-500 flex items-center gap-1 px-1">
                      <X className="w-3 h-3" />
                      {jsonError}
                    </p>
                  )}
                  {!jsonError && isParamsModified && (
                    <p className="text-[10px] text-green-600 flex items-center gap-1 px-1">
                      <Check className="w-3 h-3" />
                      {t("confirmation.paramsUpdated")}
                    </p>
                  )}
                </div>
              )}

              {/* ─── Chat Mode: Natural language editing ─── */}
              {editMode === "chat" && (
                <div className="space-y-2">
                  {/* Chat message list */}
                  <div
                    ref={chatListRef}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-2 max-h-40 overflow-y-auto custom-scrollbar space-y-1.5"
                  >
                    {chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`text-xs px-2 py-1 rounded-lg max-w-[90%] ${
                          msg.role === "user"
                            ? "bg-cyan-50 text-cyan-800 border border-cyan-100 ml-auto"
                            : "bg-white text-slate-600 border border-slate-100"
                        }`}
                      >
                        {msg.text}
                      </div>
                    ))}
                  </div>

                  {/* Chat input */}
                  <div className="flex gap-1.5">
                    <input
                      ref={chatInputRef}
                      type="text"
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                      placeholder={t("confirmation.inputPlaceholder")}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleChatSend();
                        }
                      }}
                    />
                    <button
                      className="p-1.5 rounded-lg bg-cyan-50 text-cyan-600 hover:bg-cyan-100 border border-cyan-100 transition-colors disabled:opacity-30"
                      onClick={handleChatSend}
                      disabled={!chatInput.trim()}
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Current params preview (compact) */}
                  <div className="bg-white/60 border border-slate-100 rounded-lg p-2 font-mono text-[10px] text-slate-500 max-h-20 overflow-y-auto custom-scrollbar">
                    {JSON.stringify(editedParams, null, 2)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Footer: Actions ─── */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex gap-2">
          {isHighRisk && (
            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs border border-red-200 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> {t("confirmation.highRisk")}
            </span>
          )}
          {data.isBatch && (
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs border border-blue-200">
              {t("confirmation.batch", { count: data.batchCount ?? 0 })}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            className="glass-button-danger text-xs px-3 py-1.5 h-8"
            onClick={handleReject}
          >
            <X className="w-3.5 h-3.5" />
            {t("confirmation.reject")}
          </button>
          <button
            className={`text-xs px-3 py-1.5 h-8 ${
              isParamsModified
                ? "glass-button-primary ring-1 ring-amber-300"
                : "glass-button-primary"
            }`}
            onClick={handleConfirm}
            disabled={editMode === "edit" && !!jsonError}
          >
            <Check className="w-3.5 h-3.5" />
            {isParamsModified
              ? t("confirmation.confirmModified")
              : t("confirmation.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationCard;
