import React, { useState } from "react";
import chatStore, { useChatStore } from "./chatStore";
import { observer } from "mobx-react-lite";
import { Plus, Trash2, MessageSquare, Clock } from "lucide-react";

const ChatSidebar: React.FC = observer(() => {
  const store = useChatStore();
  const [newTitle, setNewTitle] = useState("");

  const onCreate = () => {
    const title = newTitle.trim() || undefined;
    store.createSession(title);
    setNewTitle("");
  };

  return (
    <aside className="w-full h-full bg-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-500" />
          Chats
        </h3>
        <button
          onClick={() => store.createSession()}
          title="New chat"
          className="rounded-lg p-1.5 bg-blue-600 hover:bg-blue-500 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-white" />
        </button>
      </div>

      {/* New chat input */}
      <div className="flex-shrink-0 p-3 border-b border-white/[0.06]">
        <input
          className="w-full px-3 py-2 bg-slate-800 border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
          placeholder="Chat title (optional)"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onCreate()}
        />
        <button
          className="mt-2 w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-xs font-medium transition-colors"
          onClick={onCreate}
        >
          New Chat
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {store.sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => store.setActive(s.id)}
            className={`px-4 py-3 cursor-pointer border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${
              store.activeId === s.id ? "bg-white/[0.06] border-l-2 border-l-blue-500" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-200 truncate">{s.title}</div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                  <MessageSquare className="w-3 h-3" />
                  <span>{s.messages.length}</span>
                  <Clock className="w-3 h-3 ml-1" />
                  <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Delete this chat?")) chatStore.deleteSession(s.id);
                }}
                className="p-1 rounded hover:bg-red-500/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-gray-600 hover:text-red-400" />
              </button>
            </div>
          </div>
        ))}

        {store.sessions.length === 0 && (
          <div className="p-6 text-center">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-700" />
            <p className="text-sm text-gray-500">No chats yet</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-white/[0.06] text-[11px] text-gray-600 text-center">
        Chats saved locally
      </div>
    </aside>
  );
});

export default ChatSidebar;
