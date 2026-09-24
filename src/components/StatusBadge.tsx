import React from "react";
import {
  ShieldAlert,
  CheckCircle,
  Clock,
  Eye,
  CheckCheck,
  PauseCircle,
  PlayCircle,
  MinusCircle,
} from "lucide-react";
import { WorkflowStatus, ProjectStatus } from "../types";

interface StatusBadgeProps {
  status: WorkflowStatus | ProjectStatus | string;
  size?: "sm" | "md" | "lg";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = "md",
}) => {
  const norm = (status || "").toUpperCase();

  let bg = "bg-gray-100";
  let border = "border-gray-300";
  let text = "text-gray-700";
  let label = status;
  let Icon: React.ElementType = InfoIcon;

  switch (norm) {
    case "FLAGGED":
      bg = "bg-red-50";
      border = "border-[#F04438]";
      text = "text-[#D92D20]";
      label = "FLAGGED";
      Icon = ShieldAlert;
      break;
    case "ESCALATED":
      bg = "bg-red-50";
      border = "border-[#F04438]";
      text = "text-[#D92D20]";
      label = "ESCALATED";
      Icon = ShieldAlert;
      break;
    case "VERIFIED":
      bg = "bg-emerald-50";
      border = "border-[#12B76A]";
      text = "text-[#027A48]";
      label = "VERIFIED";
      Icon = CheckCircle;
      break;
    case "PENDING":
      bg = "bg-amber-50";
      border = "border-[#F79009]";
      text = "text-[#B54708]";
      label = "PENDING";
      Icon = Clock;
      break;
    case "UNDER_REVIEW":
      bg = "bg-blue-50";
      border = "border-[#2E90FA]";
      text = "text-[#1D4E89]";
      label = "UNDER REVIEW";
      Icon = Eye;
      break;
    case "RESOLVED":
      bg = "bg-slate-100";
      border = "border-slate-300";
      text = "text-slate-700";
      label = "RESOLVED";
      Icon = CheckCheck;
      break;
    case "COMPLETED":
      bg = "bg-emerald-50";
      border = "border-[#12B76A]";
      text = "text-[#027A48]";
      label = "Completed";
      Icon = CheckCircle;
      break;
    case "IN PROGRESS":
      bg = "bg-blue-50";
      border = "border-[#2E90FA]";
      text = "text-[#1D4E89]";
      label = "In Progress";
      Icon = PlayCircle;
      break;
    case "STALLED":
      bg = "bg-red-50";
      border = "border-[#F04438]";
      text = "text-[#D92D20]";
      label = "Stalled";
      Icon = PauseCircle;
      break;
    case "NOT STARTED":
      bg = "bg-gray-100";
      border = "border-gray-300";
      text = "text-gray-700";
      label = "Not Started";
      Icon = MinusCircle;
      break;
  }

  const sizeClasses = {
    sm: "text-[11px] px-2 py-0.5 space-x-1",
    md: "text-xs px-2.5 py-0.5 space-x-1.5",
    lg: "text-sm px-3 py-1 space-x-2",
  }[size];

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-md border ${bg} ${border} ${text} ${sizeClasses} whitespace-nowrap`}
    >
      <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      <span>{label}</span>
    </span>
  );
};

function InfoIcon(props: any) {
  return <Clock {...props} />;
}
