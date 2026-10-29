import React from "react";
import { BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

const Loader: React.FC = () => {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full w-full bg-slate-950 gap-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Pulsing logo */}
      <motion.div
        className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center"
        animate={{ scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <BarChart3 className="w-6 h-6 text-white" />
      </motion.div>

      {/* Progress bar */}
      <div className="w-40 h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full bg-blue-500 rounded-full"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: "40%" }}
        />
      </div>

      <p className="text-xs text-gray-500">Loading...</p>
    </motion.div>
  );
};

export default Loader;
