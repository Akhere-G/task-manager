import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  totalPages: number;
  setPage: (page: number) => void;
  scrollUpOnNavigate?: boolean;
}

export default function Pagination({
  currentPage,
  totalPages,
  setPage,
  scrollUpOnNavigate,
}: PaginationProps) {
  const goToPage = (page: number) => {
    setPage(page);
    if (scrollUpOnNavigate) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  let indexes = [-2, -1, 0, 1, 2];
  if (currentPage === 1) indexes = [0, 1, 2, 3, 4];
  else if (currentPage === 2) indexes = [-1, 0, 1, 2, 3];
  else if (currentPage === totalPages - 1) indexes = [-3, -2, -1, 0, 1];
  else if (currentPage === totalPages) indexes = [-4, -3, -2, -1, 0];

  const pageNumbers = indexes
    .map((i) => currentPage + i)
    .filter((p) => p > 0 && p <= totalPages);

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <div className="flex gap-2 items-center justify-center flex-col md:flex-row">
      <div className="flex gap-1">
        <button
          onClick={() => goToPage(currentPage - 1)}
          className={`w-10 h-10 p-2.5 ${hasPrev ? "btn-secondary" : "btn-secondary-disabled"}`}
          disabled={!hasPrev}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden="true" size={20} />
        </button>

        {pageNumbers.map((page) => (
          <button
            key={page}
            onClick={() => goToPage(page)}
            className={`w-10 h-10  transition-none ${
              page === currentPage ? "btn-primary" : "btn-secondary"
            }`}
            aria-current={page === currentPage ? "page" : undefined}
            aria-label={`Go to page ${page}`}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => goToPage(currentPage + 1)}
          className={`w-10 h-10 p-2.5 ${hasNext ? "btn-secondary" : "btn-secondary-disabled"}`}
          disabled={!hasNext}
          aria-label="Next page"
        >
          <ChevronRight aria-hidden="true" size={20} />
        </button>
      </div>

      <span className="text-sm text-text-sub ml-4 hidden md:block">
        Pages: {totalPages}
      </span>
    </div>
  );
}
