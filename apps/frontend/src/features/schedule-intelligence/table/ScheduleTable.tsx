import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { motion } from "framer-motion";
import { Calendar, Clock } from "lucide-react";

interface Task {
  Task_Name: string;
  Start_Date: string;
  Finish_Date: string;
}

interface Props {
  data: Task[];
}

const ScheduleTable: React.FC<Props> = ({ data }) => {
  return (
    <motion.div
      className="rounded-xl bg-slate-900 border border-white/[0.06] overflow-hidden"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header */}
      <div className="px-5 py-3 border-b border-white/[0.06]">
        <h2 className="text-base font-semibold text-gray-200 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          Critical Path Schedule
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {data.length} critical tasks
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-gray-400 text-xs font-medium">Task Name</TableHead>
              <TableHead className="text-gray-400 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Start Date
                </div>
              </TableHead>
              <TableHead className="text-gray-400 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Finish Date
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-gray-500 py-10 text-sm">
                  No schedule data. Upload a file to get started.
                </TableCell>
              </TableRow>
            ) : (
              data.map((task, index) => (
                <TableRow
                  key={index}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                >
                  <TableCell className="text-gray-200 text-sm">{task.Task_Name}</TableCell>
                  <TableCell className="text-gray-400 text-sm">{task.Start_Date}</TableCell>
                  <TableCell className="text-gray-400 text-sm">{task.Finish_Date}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
};

export default ScheduleTable;
