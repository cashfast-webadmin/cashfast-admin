"use no memo";

import * as React from "react";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { type ColumnDef, flexRender, type Table as TanStackTable } from "@tanstack/react-table";

import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { DraggableRow } from "./draggable-row";

interface DataTableProps<TData, TValue> {
  table: TanStackTable<TData>;
  columns: ColumnDef<TData, TValue>[];
  dndEnabled?: boolean;
  onReorder?: (newData: TData[]) => void;
  /** When provided, expanded rows render this content in a full-width cell below the row */
  renderExpandedRow?: (row: ReturnType<TanStackTable<TData>["getRowModel"]>["rows"][number]) => React.ReactNode;
  /** When true, table header sticks to top of scroll container (use when table is inside overflow-auto). */
  stickyHeader?: boolean;
  compact?: boolean;
}

const cellClass = "px-1.5 py-1";

function renderTableBody<TData, TValue>({
  table,
  columns,
  dndEnabled,
  dataIds,
  renderExpandedRow,
  compact,
}: {
  table: TanStackTable<TData>;
  columns: ColumnDef<TData, TValue>[];
  dndEnabled: boolean;
  dataIds: UniqueIdentifier[];
  renderExpandedRow?: (row: ReturnType<TanStackTable<TData>["getRowModel"]>["rows"][number]) => React.ReactNode;
  compact?: boolean;
}) {
  if (!table.getRowModel().rows.length) {
    return (
      <TableRow>
        <TableCell colSpan={columns.length} className={cn("h-24 text-center", cellClass)}>
          No results.
        </TableCell>
      </TableRow>
    );
  }
  if (dndEnabled) {
    return (
      <SortableContext items={dataIds} strategy={verticalListSortingStrategy}>
        {table.getRowModel().rows.map((row) => (
          <DraggableRow key={row.id} row={row} />
        ))}
      </SortableContext>
    );
  }
  return table.getRowModel().rows.map((row) => (
    <React.Fragment key={row.id}>
      <TableRow data-state={row.getIsSelected() && "selected"}>
        {row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id} className={cellClass}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
      {renderExpandedRow && row.getIsExpanded() && (
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableCell colSpan={columns.length} className="p-0">
            {renderExpandedRow(row)}
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  ));
}

export function DataTable<TData, TValue>({
  table,
  columns,
  dndEnabled = false,
  onReorder,
  renderExpandedRow,
  stickyHeader = false,
  compact = false,
}: DataTableProps<TData, TValue>) {
  const dataIds: UniqueIdentifier[] = table.getRowModel().rows.map((row) => Number(row.id) as UniqueIdentifier);
  const sortableId = React.useId();
  const sensors = useSensors(useSensor(MouseSensor, {}), useSensor(TouchSensor, {}), useSensor(KeyboardSensor, {}));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active && over && active.id !== over.id && onReorder) {
      const oldIndex = dataIds.indexOf(active.id);
      const newIndex = dataIds.indexOf(over.id);

      // Call parent with new data order (parent manages state)
      const newData = arrayMove(table.options.data, oldIndex, newIndex);
      onReorder(newData);
    }
  }

  const tableContent = (
    <Table
      noScrollWrapper={stickyHeader}
      className={compact ? "text-xs [&_th_button]:h-6 [&_th_button]:-ml-2" : undefined}
    >
      <TableHeader
        className={cn("sticky top-0 z-10 bg-muted", compact && "h-8 [&_th]:h-8 [&_th]:px-1.5 [&_th]:py-1")}
      >
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              return (
                <TableHead key={header.id} colSpan={header.colSpan}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody className="**:data-[slot=table-cell]:first:w-8">
        {renderTableBody({ table, columns, dndEnabled, dataIds, renderExpandedRow, compact })}
      </TableBody>
    </Table>
  );

  if (dndEnabled) {
    return (
      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
        sensors={sensors}
        id={sortableId}
      >
        {tableContent}
      </DndContext>
    );
  }

  return tableContent;
}
