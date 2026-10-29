import { useCallback, useEffect, useRef, useState } from "react";
import ChatSidebar from "./ChatSidebar";
import ChatWindow from "./ChatWindow";
import { motion } from "framer-motion";

const STORAGE_KEY = "syncpro.chatSidebarWidth";
const MIN_WIDTH = 200;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 288; // matches the previous fixed w-72

function clamp(value: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));
}

export default function ChatLayout() {
  const [width, setWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return saved ? clamp(saved) : DEFAULT_WIDTH;
  });
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist the chosen width so it survives reloads.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width));
  }, [width]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const left = containerRef.current?.getBoundingClientRect().left ?? 0;
      setWidth(clamp(e.clientX - left));
    };
    const onMouseUp = () => setDragging(false);

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    // Avoid text selection / wrong cursor while dragging.
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging]);

  return (
    <motion.div
      ref={containerRef}
      className="flex h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div style={{ width, flexShrink: 0 }} className="h-full border-r border-white/[0.06]">
        <ChatSidebar />
      </div>

      {/* Drag handle to resize the Chats panel */}
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={onMouseDown}
        onDoubleClick={() => setWidth(DEFAULT_WIDTH)}
        title="Drag to resize · double-click to reset"
        className="group relative w-1 flex-shrink-0 cursor-col-resize self-stretch"
      >
        <div
          className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 rounded-full transition-colors ${
            dragging ? "bg-blue-500" : "bg-white/[0.06] group-hover:bg-blue-500/60"
          }`}
        />
      </div>

      <div className="flex-1 min-w-0">
        <ChatWindow />
      </div>
    </motion.div>
  );
}
