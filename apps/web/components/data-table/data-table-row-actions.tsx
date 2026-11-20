"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Trash2, ArrowRightCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DataTableRowActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  onConvert?: () => void;
  customActions?: {
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    onClick: () => void;
  }[];
}

export function DataTableRowActions({
  onEdit,
  onDelete,
  onConvert,
  customActions,
}: DataTableRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-8 w-8 p-0 data-[state=open]:bg-slate-100"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        {onEdit && (
          <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
            <Pencil className="mr-2 h-4 w-4 text-slate-500" />
            Edit
          </DropdownMenuItem>
        )}
        {onConvert && (
          <DropdownMenuItem onClick={onConvert} className="cursor-pointer text-[#EA580C] focus:text-[#EA580C]">
            <ArrowRightCircle className="mr-2 h-4 w-4 text-[#EA580C]" />
            Convert
          </DropdownMenuItem>
        )}
        {customActions?.map((action, idx) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={idx}
              onClick={action.onClick}
              className="cursor-pointer"
            >
              {Icon && <Icon className="mr-2 h-4 w-4 text-slate-500" />}
              {action.label}
            </DropdownMenuItem>
          );
        })}
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <Trash2 className="mr-2 h-4 w-4 text-red-600" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
