import { ChevronDown, ChevronUp, Filter, Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EmptyData from '@/components/default-empty-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ItemContent, ItemFooter, ItemHeader } from '@/components/ui/item';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils/cn.util';
import DefaultLoading from '../default-loading';

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  rowKey,
  className,
  searchable = true,
  searchPlaceholder = 'Search...',
  itemsPerPage = 10,
  showPagination = true,
  striped = false,
  hoverable = true,
  bordered = true,
  compact = false,
  loading = false,
  onRowClick,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  const [pageSize, setPageSize] = useState(itemsPerPage);
  const [currentPage, setCurrentPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  // Filter data based on search and column filters
  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Global search
    if (search) {
      filtered = filtered.filter((row) =>
        columns.some((column) => {
          const value = row[column.key as keyof T];
          return value?.toString().toLowerCase().includes(search.toLowerCase());
        }),
      );
    }

    // Column filters
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value) {
        filtered = filtered.filter((row) => {
          const rowValue = row[key as keyof T];
          return rowValue?.toString().toLowerCase().includes(value.toLowerCase());
        });
      }
    });

    return filtered;
  }, [data, search, columnFilters, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    const { key, direction } = sortConfig;
    if (!key) return filteredData;

    return [...filteredData].sort((a, b) => {
      const column = columns.find((col) => col.key === key);
      const aValue = column?.sortAccessor ? column.sortAccessor(a) : a[key as keyof T];
      const bValue = column?.sortAccessor ? column.sortAccessor(b) : b[key as keyof T];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (aValue < bValue) {
        return direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [filteredData, sortConfig, columns.find]);

  // Pagination
  const paginatedData = useMemo(() => {
    if (!showPagination) return sortedData;

    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize, showPagination]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleColumnFilter = (key: string, value: string) => {
    setColumnFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
    setCurrentPage(1);
  };

  const clearColumnFilter = (key: string) => {
    setColumnFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  };

  if (loading) {
    return <DefaultLoading />;
  }

  return (
    <div className={cn('flex flex-col gap-6 rounded-lg border-sidebar-border bg-background py-6 text-card-foreground md:border', className, !bordered && 'border-0')}>
      {/* Search and Filters */}
      {searchable && (
        <ItemHeader className="justify-end px-6">
          <div className="flex flex-col items-end gap-4 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 transform text-muted-foreground" />
              <Input
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8"
              />
            </div>
          </div>
        </ItemHeader>
      )}

      {/* Table */}
      <ItemContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-full">
            <thead className="bg-secondary">
              <tr>
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={cn('text-left align-top font-medium text-muted-foreground', compact ? 'p-4' : 'p-6', column.width && `w-[${column.width}]`)}
                    style={column.width ? { width: column.width } : undefined}
                  >
                    {/* biome-ignore lint/a11y/noStaticElementInteractions: Interactive only when sortable */}
                    {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Interactive only when sortable */}
                    <div
                      className={cn('flex items-center justify-between gap-2', column.sortable && 'group cursor-pointer transition-colors hover:text-foreground')}
                      onClick={column.sortable ? () => handleSort(column.key) : undefined}
                      onKeyDown={
                        column.sortable
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleSort(column.key);
                              }
                            }
                          : undefined
                      }
                      role={column.sortable ? 'button' : undefined}
                      tabIndex={column.sortable ? 0 : undefined}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{column.header}</span>
                        {column.sortable && (
                          <div className="flex flex-col">
                            <ChevronUp
                              className={cn(
                                'size-3',
                                sortConfig.key === column.key && sortConfig.direction === 'asc' ? 'text-primary' : 'text-muted-foreground/40 group-hover:text-muted-foreground/70',
                              )}
                            />
                            <ChevronDown
                              className={cn(
                                '-mt-1 size-3',
                                sortConfig.key === column.key && sortConfig.direction === 'desc' ? 'text-primary' : 'text-muted-foreground/40 group-hover:text-muted-foreground/70',
                              )}
                            />
                          </div>
                        )}
                      </div>
                      {column.filterable && (
                        <div className="relative">
                          <Filter className="size-3 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    {/* Column Filter */}
                    {column.filterable && (
                      <div className="relative mt-3">
                        <Input
                          type="text"
                          placeholder="Filter..."
                          value={columnFilters[String(column.key)] || ''}
                          onChange={(e) => handleColumnFilter(String(column.key), e.target.value)}
                          className="h-8 pr-8 text-xs"
                        />
                        {columnFilters[String(column.key)] && (
                          <Button variant="ghost" size="icon" onClick={() => clearColumnFilter(String(column.key))} className="absolute top-0 right-0 h-8 w-8 hover:bg-transparent">
                            <X className="size-3 text-muted-foreground hover:text-foreground" />
                          </Button>
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="bg-card">
                    <EmptyData />
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, index) => {
                  const key = typeof rowKey === 'function' ? rowKey(row) : rowKey ? row[rowKey] : index;
                  return (
                    <tr
                      key={key}
                      className={cn(
                        'border-border border-t transition-colors',
                        striped && index % 2 === 0 && 'bg-muted/20',
                        hoverable && 'hover:bg-secondary',
                        onRowClick && 'cursor-pointer',
                      )}
                      onClick={() => onRowClick?.(row, index)}
                    >
                      {columns.map((column) => (
                        <td key={String(column.key)} className={cn('align-middle text-foreground text-sm', compact ? 'px-4 py-3' : 'px-6 py-4')}>
                          {column.render ? column.render(row[column.key as keyof T], row) : String(row[column.key as keyof T] ?? '')}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </ItemContent>

      {/* Pagination */}
      {showPagination && sortedData.length > 0 && (
        <ItemFooter className="flex flex-col items-center justify-between gap-4 px-6 py-4 sm:flex-row">
          <div className="order-2 flex items-center gap-2 text-muted-foreground text-sm sm:order-1">
            <span>{t('show')}</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                setPageSize(Number(val));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span>{t('per.page')}</span>
            <span className="ml-4 tabular-nums">
              {t('total')}: {sortedData.length}
            </span>
          </div>

          <div className="order-1 sm:order-2">
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    className={cn(currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer')}
                  />
                </PaginationItem>

                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                  let pageNumber: number;
                  if (totalPages <= 5) {
                    pageNumber = i + 1;
                  } else if (currentPage <= 3) {
                    pageNumber = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNumber = totalPages - 4 + i;
                  } else {
                    pageNumber = currentPage - 2 + i;
                  }

                  if (pageNumber < 1 || pageNumber > totalPages) return null;

                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink isActive={currentPage === pageNumber} onClick={() => setCurrentPage(pageNumber)} className="cursor-pointer">
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}

                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    className={cn(currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer')}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </ItemFooter>
      )}
    </div>
  );
}

export type DataTableColumn<T> = {
  key: string; // Changed from keyof T to allow virtual keys
  header: ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, row: T) => ReactNode;
  sortAccessor?: (row: T) => any;
  width?: string;
};

export type DataTableProps<T> = {
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey?: keyof T | ((row: T) => string | number);
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  itemsPerPage?: number;
  showPagination?: boolean;
  striped?: boolean;
  hoverable?: boolean;
  bordered?: boolean;
  compact?: boolean;
  loading?: boolean;
  onRowClick?: (row: T, index: number) => void;
};
