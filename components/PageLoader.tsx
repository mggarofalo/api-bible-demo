import { Loader } from "lucide-react";

/**
 * Simple loading screen. A screen reader reads it as the status "Loading".
 */
export default function PageLoader() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex justify-center items-center h-screen w-full"
    >
      <Loader className="animate-spin" aria-hidden="true" />
    </div>
  );
}
