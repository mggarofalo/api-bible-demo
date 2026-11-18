import { SquareArrowOutUpRight } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

export type LinkButtonProps = {
  title: string;
  href: string;
  external?: boolean;
  children?: ReactNode;
  className?: string;
  /** Shows the link as a folder tab on top of a section (see `.folder-tab` in globals.css) */
  tab?: boolean;
};

/**
 * Renders a link as a button, or as a folder tab
 */
export const LinkButton = ({
  title,
  href,
  external,
  children,
  className,
  tab,
}: LinkButtonProps) => {
  return (
    <Link
      href={href}
      prefetch={false}
      //An external link opens in a new window, as its icon shows
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`flex gap-2 items-center justify-center px-4 py-2 ${
        tab
          ? "folder-tab folder-tab-link"
          : "rounded bg-accent-soft hover:bg-accent hover:text-white border-accent"
      } ${className ?? ""}`}
    >
      {children}
      {!!title && <span className="text-md text-nowrap">{title}</span>}
      {external && (
        <>
          <SquareArrowOutUpRight size={12} aria-hidden="true" />
          <span className="sr-only">, opens in a new window</span>
        </>
      )}
    </Link>
  );
};
