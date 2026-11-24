import { useState } from "react";

import type { BulkResult } from "../api";
import { BulkResultBanner } from "../components/BulkResultBanner";

export default function useBulkResult() {
  const [result, setResult] = useState<BulkResult | null>(null);
  const banner = result && (
    <BulkResultBanner result={result} onDismiss={() => setResult(null)} />
  );
  return { banner, onResult: setResult };
}
