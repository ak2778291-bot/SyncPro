import React from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { motion } from "framer-motion";
import { Loader2, Upload, FileText, Download } from "lucide-react";

interface FileUploaderProps {
  file: File | null;
  setFile: (file: File | null) => void;
  onUpload: () => Promise<void>;
  onExportCSV: () => void;
  onExportExcel: () => void;
  onDataUpdate: React.Dispatch<React.SetStateAction<any[]>>;
  onFlowlineUpdate: React.Dispatch<React.SetStateAction<any>>;
  loading: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  file,
  setFile,
  onUpload,
  onExportCSV,
  onExportExcel,
  loading,
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="mb-2">
        <h2 className="text-xl font-semibold text-white mb-1">Upload Schedule</h2>
        <p className="text-sm text-gray-500">Upload your project schedule to generate a knowledge graph.</p>
      </div>

      {/* Upload card */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        <label className="block text-sm font-medium text-gray-400 mb-3">
          Schedule File
        </label>
        <Input
          type="file"
          onChange={handleFileChange}
          disabled={loading}
          className="w-full bg-slate-900 border-white/[0.08] text-gray-300 text-sm cursor-pointer disabled:opacity-50 file:bg-slate-800 file:text-gray-300 file:border-0 file:mr-3 file:px-3 file:py-1 file:rounded"
        />
        {file && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-400 bg-white/[0.03] p-3 rounded-lg border border-white/[0.06]">
            <FileText className="w-4 h-4 text-blue-400" />
            <span className="font-medium text-gray-300">{file.name}</span>
            <span className="text-gray-600">({(file.size / 1024).toFixed(1)} KB)</span>
          </div>
        )}

        <Button
          onClick={onUpload}
          disabled={!file || loading}
          className="w-full mt-5 bg-blue-600 hover:bg-blue-500 text-white py-5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              Building Knowledge Graph...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload & Build Knowledge Graph
            </>
          )}
        </Button>

        <p className="mt-3 text-center text-xs text-gray-600">
          Supported: .mpp, .pp, .xml, .mspdi
        </p>
      </div>

      {/* Export */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
          <Download className="w-4 h-4 text-gray-500" />
          Export Data
        </h3>
        <div className="flex gap-3">
          <Button
            onClick={onExportCSV}
            variant="outline"
            disabled={loading}
            className="flex-1 bg-transparent border-white/[0.08] text-gray-400 hover:bg-white/[0.04] hover:text-gray-200 text-xs disabled:opacity-40"
          >
            <Download className="mr-2 h-3.5 w-3.5" />
            CSV
          </Button>
          <Button
            onClick={onExportExcel}
            variant="outline"
            disabled={loading}
            className="flex-1 bg-transparent border-white/[0.08] text-gray-400 hover:bg-white/[0.04] hover:text-gray-200 text-xs disabled:opacity-40"
          >
            <Download className="mr-2 h-3.5 w-3.5" />
            Excel
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default FileUploader;
